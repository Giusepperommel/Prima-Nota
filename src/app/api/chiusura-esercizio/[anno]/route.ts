import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ anno: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { anno: annoParam } = await context.params;
    const anno = parseInt(annoParam, 10);

    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const chiusura = await prisma.chiusuraEsercizio.findUnique({
      where: { societaId_anno: { societaId, anno } },
      include: {
        rateiRisconti: true,
        liquidazioniIva: true,
      },
    });

    if (!chiusura) {
      return NextResponse.json(
        { error: `Chiusura esercizio per l'anno ${anno} non trovata` },
        { status: 404 }
      );
    }

    const serializeDecimal = (val: any) => (val != null ? Number(val) : null);

    return NextResponse.json({
      ...chiusura,
      capitaleSociale: serializeDecimal(chiusura.capitaleSociale),
      saldoBancaIniziale: serializeDecimal(chiusura.saldoBancaIniziale),
      saldoCassaIniziale: serializeDecimal(chiusura.saldoCassaIniziale),
      riservaLegale: serializeDecimal(chiusura.riservaLegale),
      riservaStatutaria: serializeDecimal(chiusura.riservaStatutaria),
      riservaEstraordinaria: serializeDecimal(chiusura.riservaEstraordinaria),
      utiliPerditePortatiANuovo: serializeDecimal(chiusura.utiliPerditePortatiANuovo),
      saldoBancaFinale: serializeDecimal(chiusura.saldoBancaFinale),
      saldoCassaFinale: serializeDecimal(chiusura.saldoCassaFinale),
      risultatoEsercizio: serializeDecimal(chiusura.risultatoEsercizio),
      dataApertura: chiusura.dataApertura.toISOString(),
      dataChiusura: chiusura.dataChiusura.toISOString(),
      dataCreazione: chiusura.dataCreazione.toISOString(),
      dataChiusuraEffettiva: chiusura.dataChiusuraEffettiva?.toISOString() ?? null,
      rateiRisconti: chiusura.rateiRisconti.map((rr) => ({
        ...rr,
        importoOriginario: Number(rr.importoOriginario),
        importoCalcolato: Number(rr.importoCalcolato),
        dataInizioCompetenza: rr.dataInizioCompetenza.toISOString(),
        dataFineCompetenza: rr.dataFineCompetenza.toISOString(),
        dataManifestazioneFin: rr.dataManifestazioneFin.toISOString(),
        createdAt: rr.createdAt.toISOString(),
      })),
      liquidazioniIva: chiusura.liquidazioniIva.map((liq) => ({
        ...liq,
        ivaEsigibile: Number(liq.ivaEsigibile),
        ivaDetraibile: Number(liq.ivaDetraibile),
        saldo: Number(liq.saldo),
        creditoPeriodoPrecedente: Number(liq.creditoPeriodoPrecedente),
        accontoVersato: Number(liq.accontoVersato),
        importoVersato: serializeDecimal(liq.importoVersato),
        dataVersamento: liq.dataVersamento?.toISOString() ?? null,
        createdAt: liq.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Errore nel recupero chiusura esercizio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
