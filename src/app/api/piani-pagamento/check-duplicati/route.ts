import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Checks if a new operation might be a duplicate of an existing
 * payment in an active piano pagamento.
 *
 * Returns matching pagamenti PREVISTO with similar amount (±5%) and date (±7 days).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = request.nextUrl;
    const importoStr = searchParams.get("importo");
    const dataStr = searchParams.get("data");

    if (!importoStr || !dataStr) {
      return NextResponse.json({ matches: [] });
    }

    const importo = parseFloat(importoStr);
    const data = new Date(dataStr);

    if (isNaN(importo) || importo <= 0 || isNaN(data.getTime())) {
      return NextResponse.json({ matches: [] });
    }

    // Search window: ±5% on amount, ±7 days on date
    const tolleranzaImporto = importo * 0.05;
    const importoMin = importo - tolleranzaImporto;
    const importoMax = importo + tolleranzaImporto;

    const dataMin = new Date(data);
    dataMin.setDate(dataMin.getDate() - 7);
    const dataMax = new Date(data);
    dataMax.setDate(dataMax.getDate() + 7);

    const pagamentiMatch = await prisma.pagamento.findMany({
      where: {
        stato: "PREVISTO",
        importo: { gte: importoMin, lte: importoMax },
        data: { gte: dataMin, lte: dataMax },
        pianoPagamento: {
          societaId,
          stato: "ATTIVO",
          operazione: { eliminato: false, bozza: false },
        },
      },
      select: {
        id: true,
        numeroPagamento: true,
        data: true,
        importo: true,
        pianoPagamento: {
          select: {
            id: true,
            operazione: {
              select: {
                id: true,
                descrizione: true,
                tipoOperazione: true,
                importoTotale: true,
              },
            },
          },
        },
      },
      take: 5,
    });

    const matches = pagamentiMatch.map((p) => ({
      pagamentoId: p.id,
      numeroPagamento: p.numeroPagamento,
      data: p.data.toISOString(),
      importo: Number(p.importo),
      pianoId: p.pianoPagamento.id,
      operazioneId: p.pianoPagamento.operazione.id,
      operazioneDescrizione: p.pianoPagamento.operazione.descrizione,
      operazioneTipo: p.pianoPagamento.operazione.tipoOperazione,
      operazioneImporto: Number(p.pianoPagamento.operazione.importoTotale),
    }));

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Errore check duplicati:", error);
    return NextResponse.json({ matches: [] });
  }
}
