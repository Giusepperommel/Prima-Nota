import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
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
    const { data, importo, note } = body;

    if (!data || importo == null || importo <= 0) {
      return NextResponse.json(
        { error: "Campi obbligatori mancanti: data, importo (> 0)" },
        { status: 400 }
      );
    }

    // Verify plan exists, belongs to societa, and is CUSTOM
    const piano = await prisma.pianoPagamento.findFirst({
      where: { id: pianoId, societaId },
      include: {
        pagamenti: true,
        operazione: { select: { importoTotale: true } },
      },
    });

    if (!piano) {
      return NextResponse.json(
        { error: "Piano di pagamento non trovato" },
        { status: 404 }
      );
    }

    if (piano.tipo !== "CUSTOM") {
      return NextResponse.json(
        { error: "È possibile aggiungere pagamenti solo a piani di tipo CUSTOM" },
        { status: 400 }
      );
    }

    if (piano.stato !== "ATTIVO") {
      return NextResponse.json(
        { error: "Il piano di pagamento non è attivo" },
        { status: 400 }
      );
    }

    // Validate total won't exceed operazione importoTotale
    const importoTotale = Number(piano.operazione.importoTotale);
    const sommaEsistente = piano.pagamenti
      .filter((p) => p.stato !== "ANNULLATO")
      .reduce((sum, p) => sum + Number(p.importo), 0);
    const nuovoTotale = Math.round((sommaEsistente + importo) * 100) / 100;

    if (nuovoTotale > importoTotale) {
      return NextResponse.json(
        {
          error: "L'importo supera il totale dell'operazione",
          dettagli: {
            importoTotaleOperazione: importoTotale,
            sommaPagamentiEsistenti: Math.round(sommaEsistente * 100) / 100,
            importoNuovoPagamento: importo,
            rimanente: Math.round((importoTotale - sommaEsistente) * 100) / 100,
          },
        },
        { status: 400 }
      );
    }

    // Auto-number: find max numeroPagamento
    const maxNumero = piano.pagamenti.reduce(
      (max, p) => Math.max(max, p.numeroPagamento),
      0
    );

    const pagamento = await prisma.pagamento.create({
      data: {
        pianoPagamentoId: pianoId,
        numeroPagamento: maxNumero + 1,
        data: new Date(data),
        importo,
        quotaCapitale: importo,
        quotaInteressi: 0,
        stato: "PREVISTO",
        note: note ?? null,
      },
    });

    return NextResponse.json(
      {
        ...pagamento,
        importo: Number(pagamento.importo),
        quotaCapitale: Number(pagamento.quotaCapitale),
        quotaInteressi: Number(pagamento.quotaInteressi),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore aggiunta pagamento:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
