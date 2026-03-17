import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string; pagamentoId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id, pagamentoId: pagamentoIdStr } = await context.params;
    const pianoId = parseInt(id, 10);
    const pagamentoId = parseInt(pagamentoIdStr, 10);

    if (isNaN(pianoId) || isNaN(pagamentoId)) {
      return NextResponse.json(
        { error: "ID non valido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { stato, dataEffettivaPagamento } = body;

    if (stato !== "EFFETTUATO") {
      return NextResponse.json(
        { error: "Stato non valido. Valori accettati: EFFETTUATO" },
        { status: 400 }
      );
    }

    // Verify ownership via pianoPagamento.societaId
    const pagamento = await prisma.pagamento.findFirst({
      where: {
        id: pagamentoId,
        pianoPagamentoId: pianoId,
        pianoPagamento: { societaId },
      },
      include: { pianoPagamento: true },
    });

    if (!pagamento) {
      return NextResponse.json(
        { error: "Pagamento non trovato" },
        { status: 404 }
      );
    }

    if (pagamento.stato !== "PREVISTO") {
      return NextResponse.json(
        { error: "Solo i pagamenti con stato PREVISTO possono essere modificati" },
        { status: 400 }
      );
    }

    if (pagamento.pianoPagamento.stato !== "ATTIVO") {
      return NextResponse.json(
        { error: "Il piano di pagamento non è attivo" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Mark payment as EFFETTUATO
      const updated = await tx.pagamento.update({
        where: { id: pagamentoId },
        data: {
          stato: "EFFETTUATO",
          dataEffettivaPagamento: dataEffettivaPagamento
            ? new Date(dataEffettivaPagamento)
            : new Date(),
        },
      });

      // Check if all payments are now completed (no PREVISTO remaining)
      const previstiRimanenti = await tx.pagamento.count({
        where: {
          pianoPagamentoId: pianoId,
          stato: "PREVISTO",
        },
      });

      if (previstiRimanenti === 0) {
        await tx.pianoPagamento.update({
          where: { id: pianoId },
          data: {
            stato: "COMPLETATO",
            dataChiusura: new Date(),
          },
        });
      }

      return tx.pagamento.findUnique({
        where: { id: pagamentoId },
        include: {
          pianoPagamento: {
            select: { id: true, stato: true },
          },
        },
      });
    });

    return NextResponse.json(serializePagamento(result));
  } catch (error) {
    console.error("Errore aggiornamento pagamento:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

// Helper to serialize Decimal fields to numbers
function serializePagamento(pagamento: any) {
  if (!pagamento) return pagamento;
  return {
    ...pagamento,
    importo: Number(pagamento.importo),
    quotaCapitale: Number(pagamento.quotaCapitale),
    quotaInteressi: Number(pagamento.quotaInteressi),
  };
}
