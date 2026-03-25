import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matchWithClaude } from "@/lib/import/riconciliazione-ai";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    // Get unreconciled movements
    const movimenti = await prisma.movimentoBancario.findMany({
      where: { societaId, statoRiconciliazione: "NON_RICONCILIATO" },
      take: 50,  // batch size
    });

    if (movimenti.length === 0) {
      return NextResponse.json({ message: "Nessun movimento da riconciliare", risultati: [] });
    }

    // Get unlinked operations as candidates
    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        bozza: false,
        movimentiBancari: { none: {} },
      },
      include: { fornitore: { select: { denominazione: true } } },
      take: 100,
    });

    const candidati = operazioni.map((op) => ({
      id: op.id,
      descrizione: op.descrizione,
      importo: Number(op.importoTotale),
      data: op.dataOperazione.toISOString().split("T")[0],
      fornitore: (op.fornitore as any)?.denominazione,
    }));

    const risultati = [];

    for (const mov of movimenti) {
      const result = await matchWithClaude(
        {
          descrizione: mov.descrizione,
          importo: Number(mov.importo),
          data: mov.data.toISOString().split("T")[0],
        },
        candidati,
      );

      if (result.operazioneId && result.confidence >= 0.9) {
        // Auto-reconcile high confidence matches
        await prisma.movimentoBancario.update({
          where: { id: mov.id },
          data: {
            riconciliatoConOperazioneId: result.operazioneId,
            statoRiconciliazione: "RICONCILIATO",
          },
        });
      }

      risultati.push({
        movimentoId: mov.id,
        descrizione: mov.descrizione,
        importo: Number(mov.importo),
        ...result,
        autoRiconciliato: result.operazioneId !== null && result.confidence >= 0.9,
      });
    }

    return NextResponse.json({
      totale: movimenti.length,
      riconciliati: risultati.filter((r) => r.autoRiconciliato).length,
      suggeriti: risultati.filter((r) => r.operazioneId && !r.autoRiconciliato).length,
      nonTrovati: risultati.filter((r) => !r.operazioneId).length,
      risultati,
    });
  } catch (error) {
    console.error("POST /api/import/riconciliazione-ai error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
