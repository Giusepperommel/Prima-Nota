import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcolaLiquidazione } from "@/lib/liquidazione/calcola";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const { tipo, periodo, anno } = body;

    if (!tipo || !["MENSILE", "TRIMESTRALE"].includes(tipo)) {
      return NextResponse.json(
        { error: "Parametro tipo obbligatorio (MENSILE o TRIMESTRALE)" },
        { status: 400 }
      );
    }

    if (!periodo || !anno) {
      return NextResponse.json(
        { error: "Parametri periodo e anno obbligatori" },
        { status: 400 }
      );
    }

    const maxPeriodo = tipo === "MENSILE" ? 12 : 4;
    if (periodo < 1 || periodo > maxPeriodo) {
      return NextResponse.json(
        { error: `Periodo non valido (1-${maxPeriodo})` },
        { status: 400 }
      );
    }

    // Calculate liquidation from register data
    const result = await calcolaLiquidazione({
      societaId,
      tipo,
      periodo,
      anno,
    });

    // Upsert the liquidation record
    const liquidazione = await prisma.liquidazioneIva.upsert({
      where: {
        societaId_tipo_periodo_anno: {
          societaId,
          tipo,
          periodo,
          anno,
        },
      },
      create: {
        societaId,
        tipo,
        periodo,
        anno,
        ivaEsigibile: result.ivaEsigibile,
        ivaDetraibile: result.ivaDetraibile,
        saldo: result.saldo,
        totaleOperazioniAttive: result.totaleOperazioniAttive,
        totaleOperazioniPassive: result.totaleOperazioniPassive,
        debitoPeriodoPrecedente: result.debitoPeriodoPrecedente,
        creditoPeriodoPrecedente: result.creditoPeriodoPrecedente,
        creditoAnnoPrecedente: result.creditoAnnoPrecedente,
        interessiDovuti: result.interessiDovuti,
        codiceTributo: result.codiceTributo,
      },
      update: {
        ivaEsigibile: result.ivaEsigibile,
        ivaDetraibile: result.ivaDetraibile,
        saldo: result.saldo,
        totaleOperazioniAttive: result.totaleOperazioniAttive,
        totaleOperazioniPassive: result.totaleOperazioniPassive,
        debitoPeriodoPrecedente: result.debitoPeriodoPrecedente,
        creditoPeriodoPrecedente: result.creditoPeriodoPrecedente,
        creditoAnnoPrecedente: result.creditoAnnoPrecedente,
        interessiDovuti: result.interessiDovuti,
        codiceTributo: result.codiceTributo,
      },
    });

    return NextResponse.json({
      data: {
        ...result,
        id: liquidazione.id,
        statoVersamento: liquidazione.statoVersamento,
      },
    });
  } catch (error) {
    console.error("Errore nel calcolo liquidazione IVA:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
