import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { SessionUser } from "@/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const scritturaId = parseInt(id);
  if (isNaN(scritturaId)) {
    return NextResponse.json({ error: "ID non valido" }, { status: 400 });
  }

  // Find the scrittura
  const existing = await prisma.scritturaContabile.findFirst({
    where: { id: scritturaId, societaId, eliminato: false },
  });

  if (!existing) {
    return NextResponse.json({ error: "Scrittura non trovata" }, { status: 404 });
  }

  // Only PROVVISORIA or MANUALE can be edited
  if (existing.stato === "DEFINITIVA" && existing.tipoScrittura === "AUTO") {
    return NextResponse.json(
      { error: "Non e possibile modificare una scrittura automatica definitiva" },
      { status: 403 },
    );
  }

  if (existing.tipoScrittura !== "MANUALE" && existing.tipoScrittura !== "RETTIFICA" && existing.tipoScrittura !== "STORNO") {
    if (existing.stato === "DEFINITIVA") {
      return NextResponse.json(
        { error: "Non e possibile modificare una scrittura automatica definitiva" },
        { status: 403 },
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const { descrizione, causale, dataRegistrazione, dataCompetenza, movimenti, stato } = body;

  if (!descrizione || typeof descrizione !== "string" || descrizione.trim().length === 0) {
    return NextResponse.json({ error: "Descrizione obbligatoria" }, { status: 400 });
  }
  if (!Array.isArray(movimenti) || movimenti.length < 2) {
    return NextResponse.json(
      { error: "Servono almeno 2 movimenti contabili" },
      { status: 400 },
    );
  }

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

  const dataReg = dataRegistrazione ? new Date(dataRegistrazione) : existing.dataRegistrazione;
  const dataComp = dataCompetenza ? new Date(dataCompetenza) : existing.dataCompetenza;
  const statoScrittura = stato === "DEFINITIVA" ? "DEFINITIVA" : stato === "PROVVISORIA" ? "PROVVISORIA" : existing.stato;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Delete existing movimenti
      await tx.movimentoContabile.deleteMany({
        where: { scritturaId },
      });

      // Update scrittura and recreate movimenti
      const result = await tx.scritturaContabile.update({
        where: { id: scritturaId },
        data: {
          descrizione: descrizione.trim(),
          causale: causale || existing.causale,
          dataRegistrazione: dataReg,
          dataCompetenza: dataComp,
          stato: statoScrittura,
          totaleDare,
          totaleAvere,
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

      return result;
    });

    return NextResponse.json({
      ...updated,
      totaleDare: Number(updated.totaleDare),
      totaleAvere: Number(updated.totaleAvere),
      movimenti: updated.movimenti.map((m) => ({
        ...m,
        importoDare: Number(m.importoDare),
        importoAvere: Number(m.importoAvere),
      })),
    });
  } catch (error: unknown) {
    console.error("Errore aggiornamento scrittura:", error);
    return NextResponse.json(
      { error: "Errore nell'aggiornamento della scrittura" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

  const { id } = await context.params;
  const scritturaId = parseInt(id);
  if (isNaN(scritturaId)) {
    return NextResponse.json({ error: "ID non valido" }, { status: 400 });
  }

  const existing = await prisma.scritturaContabile.findFirst({
    where: { id: scritturaId, societaId, eliminato: false },
  });

  if (!existing) {
    return NextResponse.json({ error: "Scrittura non trovata" }, { status: 404 });
  }

  // Only MANUALE scritture can be hard-deleted (they have no linked operation)
  if (existing.tipoScrittura !== "MANUALE") {
    return NextResponse.json(
      { error: "Solo le scritture manuali possono essere eliminate" },
      { status: 403 },
    );
  }

  try {
    // Hard delete — movimenti cascade via onDelete: Cascade
    await prisma.scritturaContabile.delete({
      where: { id: scritturaId },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Errore eliminazione scrittura:", error);
    return NextResponse.json(
      { error: "Errore nell'eliminazione della scrittura" },
      { status: 500 },
    );
  }
}
