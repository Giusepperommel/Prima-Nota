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
        fornitore: { select: { id: true, denominazione: true } },
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
      sorgente: op.sorgente ?? null,
      aiConfidence: op.aiConfidence ?? null,
      fornitore: op.fornitore
        ? { id: op.fornitore.id, denominazione: op.fornitore.denominazione }
        : null,
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

    // Build a map of valid category IDs for quick lookup
    const validCategoriaIds = new Set<number>();
    const categorieMap = new Map<number, { percentualeDeducibilita: number }>();
    const allCategorie = await prisma.categoriaSpesa.findMany({
      where: { societaId, attiva: true },
      select: { id: true, percentualeDeducibilita: true },
    });
    for (const cat of allCategorie) {
      validCategoriaIds.add(cat.id);
      categorieMap.set(cat.id, { percentualeDeducibilita: Number(cat.percentualeDeducibilita) });
    }

    for (const tx of transactions) {
      const { dataOperazione, descrizione, importoTotale, categoriaId } = tx;

      if (!descrizione || !importoTotale) continue;

      const importo = parseFloat(String(importoTotale));
      if (isNaN(importo) || importo <= 0) continue;

      const data = dataOperazione
        ? new Date(dataOperazione + "T12:00:00")
        : new Date();

      // Use AI-suggested category if valid, otherwise fall back to default
      const useCategoriaId = categoriaId && validCategoriaIds.has(categoriaId)
        ? categoriaId
        : defaultCategoria.id;
      const catData = categorieMap.get(useCategoriaId) ?? { percentualeDeducibilita: Number(defaultCategoria.percentualeDeducibilita) };

      const operazione = await prisma.operazione.create({
        data: {
          societaId,
          tipoOperazione: "COSTO",
          dataOperazione: data,
          descrizione: String(descrizione),
          importoTotale: importo,
          categoriaId: useCategoriaId,
          percentualeDeducibilita: catData.percentualeDeducibilita,
          importoDeducibile: importo * catData.percentualeDeducibilita / 100,
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
