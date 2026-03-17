import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await context.params;
    const pianoId = parseInt(id, 10);

    if (isNaN(pianoId)) {
      return NextResponse.json(
        { error: "ID piano pagamento non valido" },
        { status: 400 }
      );
    }

    const piano = await prisma.pianoPagamento.findFirst({
      where: { id: pianoId, societaId },
      include: {
        pagamenti: { orderBy: { numeroPagamento: "asc" } },
        operazione: {
          select: {
            id: true,
            descrizione: true,
            importoTotale: true,
            dataOperazione: true,
            tipoOperazione: true,
            numeroDocumento: true,
          },
        },
      },
    });

    if (!piano) {
      return NextResponse.json(
        { error: "Piano di pagamento non trovato" },
        { status: 404 }
      );
    }

    return NextResponse.json(serializePiano(piano));
  } catch (error) {
    console.error("Errore recupero piano pagamento:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await context.params;
    const pianoId = parseInt(id, 10);

    if (isNaN(pianoId)) {
      return NextResponse.json(
        { error: "ID piano pagamento non valido" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { azione } = body;

    if (azione !== "CHIUDI_ANTICIPATAMENTE") {
      return NextResponse.json(
        { error: "Azione non supportata. Valori accettati: CHIUDI_ANTICIPATAMENTE" },
        { status: 400 }
      );
    }

    const { motivoChiusura, penaleEstinzione, saldoResiduo } = body;

    if (!motivoChiusura) {
      return NextResponse.json(
        { error: "Il motivo di chiusura è obbligatorio" },
        { status: 400 }
      );
    }

    const piano = await prisma.pianoPagamento.findFirst({
      where: { id: pianoId, societaId },
      include: { pagamenti: true },
    });

    if (!piano) {
      return NextResponse.json(
        { error: "Piano di pagamento non trovato" },
        { status: 404 }
      );
    }

    if (piano.stato !== "ATTIVO") {
      return NextResponse.json(
        { error: "Il piano di pagamento non è attivo" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Cancel all PREVISTO payments
      await tx.pagamento.updateMany({
        where: {
          pianoPagamentoId: pianoId,
          stato: "PREVISTO",
        },
        data: { stato: "ANNULLATO" },
      });

      // Update plan status
      return tx.pianoPagamento.update({
        where: { id: pianoId },
        data: {
          stato: "CHIUSO_ANTICIPATAMENTE",
          dataChiusura: new Date(),
          motivoChiusura,
          penaleEstinzione: penaleEstinzione ?? null,
          saldoResiduo: saldoResiduo ?? null,
        },
        include: {
          pagamenti: { orderBy: { numeroPagamento: "asc" } },
          operazione: {
            select: {
              id: true,
              descrizione: true,
              importoTotale: true,
              dataOperazione: true,
              tipoOperazione: true,
              numeroDocumento: true,
            },
          },
        },
      });
    });

    return NextResponse.json(serializePiano(result));
  } catch (error) {
    console.error("Errore chiusura piano pagamento:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

// Helper to serialize Decimal fields to numbers
function serializePiano(piano: any) {
  if (!piano) return piano;
  return {
    ...piano,
    importoRata: piano.importoRata ? Number(piano.importoRata) : null,
    tan: piano.tan ? Number(piano.tan) : null,
    anticipo: piano.anticipo ? Number(piano.anticipo) : null,
    penaleEstinzione: piano.penaleEstinzione ? Number(piano.penaleEstinzione) : null,
    saldoResiduo: piano.saldoResiduo ? Number(piano.saldoResiduo) : null,
    operazione: piano.operazione
      ? {
          ...piano.operazione,
          importoTotale: Number(piano.operazione.importoTotale),
        }
      : null,
    pagamenti: piano.pagamenti?.map((p: any) => ({
      ...p,
      importo: Number(p.importo),
      quotaCapitale: Number(p.quotaCapitale),
      quotaInteressi: Number(p.quotaInteressi),
    })),
  };
}
