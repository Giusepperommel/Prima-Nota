import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function calcolaScadenzaVersamento(
  tipo: string,
  periodo: number,
  anno: number
): string {
  if (tipo === "MENSILE") {
    // 16 of month+1
    const meseSuccessivo = periodo + 1;
    if (meseSuccessivo > 12) {
      return new Date(anno + 1, 0, 16).toISOString();
    }
    return new Date(anno, meseSuccessivo - 1, 16).toISOString();
  }

  // TRIMESTRALE
  // periodo = quarter number (1-4)
  // Q1 → May 16, Q2 → Aug 16, Q3 → Nov 16, Q4 → Mar 16 next year
  switch (periodo) {
    case 1:
      return new Date(anno, 4, 16).toISOString(); // May 16
    case 2:
      return new Date(anno, 7, 16).toISOString(); // Aug 16
    case 3:
      return new Date(anno, 10, 16).toISOString(); // Nov 16
    case 4:
      return new Date(anno + 1, 2, 16).toISOString(); // Mar 16 next year
    default:
      return new Date(anno, 0, 16).toISOString();
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const annoParam = searchParams.get("anno");

    if (!annoParam) {
      return NextResponse.json(
        { error: "Parametro anno obbligatorio" },
        { status: 400 }
      );
    }

    const anno = parseInt(annoParam, 10);
    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const liquidazioni = await prisma.liquidazioneIva.findMany({
      where: {
        societaId,
        anno,
      },
      orderBy: [{ periodo: "asc" }],
    });

    const serialized = liquidazioni.map((liq) => ({
      ...liq,
      ivaEsigibile: Number(liq.ivaEsigibile),
      ivaDetraibile: Number(liq.ivaDetraibile),
      saldo: Number(liq.saldo),
      creditoPeriodoPrecedente: Number(liq.creditoPeriodoPrecedente),
      accontoVersato: Number(liq.accontoVersato),
      importoVersato: liq.importoVersato != null ? Number(liq.importoVersato) : null,
      totaleOperazioniAttive: Number(liq.totaleOperazioniAttive),
      totaleOperazioniPassive: Number(liq.totaleOperazioniPassive),
      debitoPeriodoPrecedente: Number(liq.debitoPeriodoPrecedente),
      creditoAnnoPrecedente: Number(liq.creditoAnnoPrecedente),
      versamentiAutoUE: Number(liq.versamentiAutoUE),
      creditiImposta: Number(liq.creditiImposta),
      interessiDovuti: Number(liq.interessiDovuti),
      metodoAcconto: liq.metodoAcconto,
      stampaDefinitiva: liq.stampaDefinitiva,
      dataStampaDefinitiva: liq.dataStampaDefinitiva?.toISOString() ?? null,
      dataVersamento: liq.dataVersamento?.toISOString() ?? null,
      createdAt: liq.createdAt.toISOString(),
      scadenzaVersamento: calcolaScadenzaVersamento(liq.tipo, liq.periodo, liq.anno),
    }));

    return NextResponse.json({ data: serialized });
  } catch (error) {
    console.error("Errore nel recupero liquidazioni IVA:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
