import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { SessionUser } from "@/types";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const societaId = user.societaId;

  if (!societaId) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!user.modalitaCommercialista) {
    return NextResponse.json(
      { error: "Funzione riservata alla modalita commercialista" },
      { status: 403 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const { descrizione, causale, dataRegistrazione, dataCompetenza, movimenti, stato } = body;

  // --- Validation ---
  if (!descrizione || typeof descrizione !== "string" || descrizione.trim().length === 0) {
    return NextResponse.json({ error: "Descrizione obbligatoria" }, { status: 400 });
  }
  if (!causale || typeof causale !== "string") {
    return NextResponse.json({ error: "Causale obbligatoria" }, { status: 400 });
  }
  if (!dataRegistrazione) {
    return NextResponse.json({ error: "Data registrazione obbligatoria" }, { status: 400 });
  }
  if (!Array.isArray(movimenti) || movimenti.length < 2) {
    return NextResponse.json(
      { error: "Servono almeno 2 movimenti contabili" },
      { status: 400 },
    );
  }

  // Validate balance: sum dare = sum avere
  let totaleDare = 0;
  let totaleAvere = 0;
  for (const mov of movimenti) {
    if (!mov.contoId || typeof mov.contoId !== "number") {
      return NextResponse.json({ error: "contoId obbligatorio per ogni movimento" }, { status: 400 });
    }
    const dare = Number(mov.importoDare || 0);
    const avere = Number(mov.importoAvere || 0);
    if (dare < 0 || avere < 0) {
      return NextResponse.json({ error: "Importi non possono essere negativi" }, { status: 400 });
    }
    if (dare === 0 && avere === 0) {
      return NextResponse.json(
        { error: "Ogni movimento deve avere almeno un importo (dare o avere)" },
        { status: 400 },
      );
    }
    totaleDare += dare;
    totaleAvere += avere;
  }

  totaleDare = Math.round(totaleDare * 100) / 100;
  totaleAvere = Math.round(totaleAvere * 100) / 100;

  if (totaleDare !== totaleAvere) {
    return NextResponse.json(
      { error: `Scrittura non bilanciata: Dare ${totaleDare} != Avere ${totaleAvere}` },
      { status: 400 },
    );
  }

  const dataReg = new Date(dataRegistrazione);
  const anno = dataReg.getFullYear();
  const dataComp = dataCompetenza ? new Date(dataCompetenza) : dataReg;
  const statoScrittura = stato === "DEFINITIVA" ? "DEFINITIVA" : "PROVVISORIA";

  try {
    const scrittura = await prisma.$transaction(async (tx) => {
      // Get next protocollo with FOR UPDATE locking
      const result = await tx.$queryRaw<{ max_prot: number | null }[]>`
        SELECT MAX(numero_protocollo) as max_prot
        FROM scritture_contabili
        WHERE societa_id = ${societaId} AND anno = ${anno}
        FOR UPDATE
      `;
      const nextProtocollo = (result[0]?.max_prot ?? 0) + 1;

      const created = await tx.scritturaContabile.create({
        data: {
          societaId,
          dataRegistrazione: dataReg,
          dataCompetenza: dataComp,
          numeroProtocollo: nextProtocollo,
          anno,
          descrizione: descrizione.trim(),
          causale,
          tipoScrittura: "MANUALE",
          stato: statoScrittura,
          totaleDare,
          totaleAvere,
          createdByUserId: user.id,
          movimenti: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create: movimenti.map((mov: Record<string, any>, idx: number) => ({
              societaId,
              contoId: mov.contoId,
              importoDare: Number(mov.importoDare || 0),
              importoAvere: Number(mov.importoAvere || 0),
              descrizione: mov.descrizione || null,
              ordine: idx + 1,
            })),
          },
        },
        include: {
          movimenti: {
            include: { conto: { select: { codice: true, descrizione: true } } },
            orderBy: { ordine: "asc" },
          },
        },
      });

      return created;
    });

    return NextResponse.json({
      ...scrittura,
      totaleDare: Number(scrittura.totaleDare),
      totaleAvere: Number(scrittura.totaleAvere),
      movimenti: scrittura.movimenti.map((m) => ({
        ...m,
        importoDare: Number(m.importoDare),
        importoAvere: Number(m.importoAvere),
      })),
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Errore creazione scrittura contabile:", error);
    return NextResponse.json(
      { error: "Errore nella creazione della scrittura contabile" },
      { status: 500 },
    );
  }
}
