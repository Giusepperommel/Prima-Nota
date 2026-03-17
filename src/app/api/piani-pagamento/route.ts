import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generaPianoPagamento } from "@/lib/calcoli-pagamenti";
import { validaPagamentiCustom } from "@/lib/calcoli-pagamenti";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const {
      operazioneId,
      tipo,
      numeroRate,
      tan,
      anticipo,
      dataInizio,
      pagamentiCustom,
    } = body;

    // Validate required fields
    if (!operazioneId || !tipo || !dataInizio) {
      return NextResponse.json(
        { error: "Campi obbligatori mancanti: operazioneId, tipo, dataInizio" },
        { status: 400 }
      );
    }

    if (!["RATEALE", "CUSTOM"].includes(tipo)) {
      return NextResponse.json(
        { error: "Tipo piano pagamento non valido. Valori accettati: RATEALE, CUSTOM" },
        { status: 400 }
      );
    }

    // Verify operazione exists and belongs to societaId
    const operazione = await prisma.operazione.findFirst({
      where: { id: operazioneId, societaId, eliminato: false },
      include: { pianoPagamento: true },
    });

    if (!operazione) {
      return NextResponse.json(
        { error: "Operazione non trovata" },
        { status: 404 }
      );
    }

    if (operazione.pianoPagamento) {
      return NextResponse.json(
        { error: "L'operazione ha già un piano di pagamento associato" },
        { status: 409 }
      );
    }

    const importoTotale = Number(operazione.importoTotale);
    const anticipoNum = Number(anticipo || 0);

    if (tipo === "RATEALE") {
      if (!numeroRate || numeroRate <= 0) {
        return NextResponse.json(
          { error: "Il numero di rate deve essere maggiore di 0" },
          { status: 400 }
        );
      }

      if (anticipoNum >= importoTotale) {
        return NextResponse.json(
          { error: "L'anticipo deve essere inferiore all'importo totale" },
          { status: 400 }
        );
      }

      const importoDaFinanziare = importoTotale - anticipoNum;
      const piano = generaPianoPagamento(
        importoDaFinanziare,
        numeroRate,
        tan,
        new Date(dataInizio)
      );

      const result = await prisma.$transaction(async (tx) => {
        const pianoPagamento = await tx.pianoPagamento.create({
          data: {
            operazioneId,
            societaId,
            tipo: "RATEALE",
            stato: "ATTIVO",
            numeroRate,
            importoRata: piano.importoRata,
            tan: tan ?? null,
            anticipo: anticipoNum,
            dataInizio: new Date(dataInizio),
          },
        });

        const pagamentiData: any[] = [];

        // If anticipo > 0, create first payment as EFFETTUATO
        if (anticipoNum > 0) {
          pagamentiData.push({
            pianoPagamentoId: pianoPagamento.id,
            numeroPagamento: 0,
            data: new Date(dataInizio),
            importo: anticipoNum,
            quotaCapitale: anticipoNum,
            quotaInteressi: 0,
            stato: "EFFETTUATO",
            dataEffettivaPagamento: new Date(dataInizio),
            note: "Anticipo",
          });
        }

        // Add generated installments
        for (const rata of piano.rate) {
          pagamentiData.push({
            pianoPagamentoId: pianoPagamento.id,
            numeroPagamento: rata.numeroPagamento,
            data: rata.data,
            importo: rata.importo,
            quotaCapitale: rata.quotaCapitale,
            quotaInteressi: rata.quotaInteressi,
            stato: "PREVISTO",
          });
        }

        await tx.pagamento.createMany({ data: pagamentiData });

        return tx.pianoPagamento.findUnique({
          where: { id: pianoPagamento.id },
          include: { pagamenti: { orderBy: { numeroPagamento: "asc" } } },
        });
      });

      return NextResponse.json(serializePiano(result), { status: 201 });
    }

    // CUSTOM
    if (!pagamentiCustom || !Array.isArray(pagamentiCustom) || pagamentiCustom.length === 0) {
      return NextResponse.json(
        { error: "Per un piano CUSTOM è necessario fornire almeno un pagamento" },
        { status: 400 }
      );
    }

    const validazione = validaPagamentiCustom(importoTotale, pagamentiCustom);
    if (validazione.superato) {
      return NextResponse.json(
        {
          error: "La somma dei pagamenti supera l'importo totale dell'operazione",
          dettagli: validazione,
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const pianoPagamento = await tx.pianoPagamento.create({
        data: {
          operazioneId,
          societaId,
          tipo: "CUSTOM",
          stato: "ATTIVO",
          dataInizio: new Date(dataInizio),
        },
      });

      const pagamentiData = pagamentiCustom.map(
        (p: { data: string; importo: number; note?: string }, index: number) => ({
          pianoPagamentoId: pianoPagamento.id,
          numeroPagamento: index + 1,
          data: new Date(p.data),
          importo: p.importo,
          quotaCapitale: p.importo,
          quotaInteressi: 0,
          stato: "PREVISTO" as const,
          note: p.note ?? null,
        })
      );

      await tx.pagamento.createMany({ data: pagamentiData });

      return tx.pianoPagamento.findUnique({
        where: { id: pianoPagamento.id },
        include: { pagamenti: { orderBy: { numeroPagamento: "asc" } } },
      });
    });

    return NextResponse.json(serializePiano(result), { status: 201 });
  } catch (error) {
    console.error("Errore creazione piano pagamento:", error);
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
    pagamenti: piano.pagamenti?.map((p: any) => ({
      ...p,
      importo: Number(p.importo),
      quotaCapitale: Number(p.quotaCapitale),
      quotaInteressi: Number(p.quotaInteressi),
    })),
  };
}
