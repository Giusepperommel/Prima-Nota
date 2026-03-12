import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const bozze = await prisma.operazione.findMany({
      where: {
        societaId,
        bozza: true,
        eliminato: false,
      },
      include: {
        categoria: { select: { id: true, nome: true } },
        operazioneRicorrente: {
          select: { id: true, tipoContratto: true },
        },
      },
      orderBy: { dataOperazione: "asc" },
    });

    const serialized = bozze.map((op) => ({
      id: op.id,
      dataOperazione: op.dataOperazione.toISOString(),
      descrizione: op.descrizione,
      importoTotale: Number(op.importoTotale),
      categoria: op.categoria,
      tipoOperazione: op.tipoOperazione,
      operazioneRicorrenteId: op.operazioneRicorrenteId,
      tipoContratto: op.operazioneRicorrente?.tipoContratto ?? null,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore GET bozze:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;

    const body = await request.json();
    const { transactions } = body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "Nessuna transazione da creare" },
        { status: 400 }
      );
    }

    // Get the first active category as default
    const defaultCategoria = await prisma.categoriaSpesa.findFirst({
      where: { societaId, attiva: true },
      orderBy: { nome: "asc" },
    });

    if (!defaultCategoria) {
      return NextResponse.json(
        { error: "Nessuna categoria attiva trovata" },
        { status: 400 }
      );
    }

    // Get active soci for ripartizione COMUNE
    const soci = await prisma.socio.findMany({
      where: { societaId, attivo: true },
      select: { id: true, quotaPercentuale: true },
    });

    if (soci.length === 0) {
      return NextResponse.json(
        { error: "Non ci sono soci attivi" },
        { status: 400 }
      );
    }

    const ids: number[] = [];

    for (const tx of transactions) {
      const { dataOperazione, descrizione, importoTotale } = tx;

      if (!descrizione || !importoTotale) continue;

      const importo = parseFloat(String(importoTotale));
      if (isNaN(importo) || importo <= 0) continue;

      const data = dataOperazione
        ? new Date(dataOperazione + "T00:00:00")
        : new Date();

      const operazione = await prisma.operazione.create({
        data: {
          societaId,
          tipoOperazione: "COSTO",
          dataOperazione: data,
          descrizione: String(descrizione),
          importoTotale: importo,
          categoriaId: defaultCategoria.id,
          percentualeDeducibilita: Number(defaultCategoria.percentualeDeducibilita),
          importoDeducibile: importo * Number(defaultCategoria.percentualeDeducibilita) / 100,
          deducibilitaCustom: false,
          tipoRipartizione: "COMUNE",
          bozza: true,
          createdByUserId: userId,
          ripartizioni: {
            create: soci.map((s) => ({
              socioId: s.id,
              percentuale: Number(s.quotaPercentuale),
              importoCalcolato:
                (importo * Number(s.quotaPercentuale)) / 100,
            })),
          },
        },
      });

      ids.push(operazione.id);
    }

    return NextResponse.json({
      bozzeCreate: ids.length,
      ids,
    });
  } catch (error) {
    console.error("Errore POST bozze:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
