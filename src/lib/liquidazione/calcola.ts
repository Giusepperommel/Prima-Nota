/**
 * Liquidazione IVA calculation engine.
 *
 * Pure function that computes periodic IVA liquidation from register data.
 * Maps to VP1-VP14 fields used in LIPE declarations.
 */

import { prisma } from "@/lib/prisma";
import {
  CalcoloLiquidazioneInput,
  CalcoloLiquidazioneResult,
  SOGLIA_VERSAMENTO_MINIMO,
  MAGGIORAZIONE_TRIMESTRALE,
} from "./types";

/**
 * Determines the date range for a liquidation period.
 */
export function getDateRange(
  tipo: "MENSILE" | "TRIMESTRALE",
  periodo: number,
  anno: number
): { dataInizio: Date; dataFine: Date } {
  if (tipo === "MENSILE") {
    const dataInizio = new Date(anno, periodo - 1, 1);
    const dataFine = new Date(anno, periodo, 0); // last day of month
    return { dataInizio, dataFine };
  }
  // TRIMESTRALE: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
  const meseInizio = (periodo - 1) * 3;
  const dataInizio = new Date(anno, meseInizio, 1);
  const dataFine = new Date(anno, meseInizio + 3, 0);
  return { dataInizio, dataFine };
}

/**
 * Determines the codice tributo F24 for IVA payment.
 */
export function getCodiceTributo(
  tipo: "MENSILE" | "TRIMESTRALE",
  periodo: number
): string {
  if (tipo === "MENSILE") {
    // 6001-6012 for months 1-12
    return `60${String(periodo).padStart(2, "0")}`;
  }
  // TRIMESTRALE: 6031 (Q1), 6032 (Q2), 6033 (Q3), 6034 (Q4 = acconto/saldo annuale → 6099)
  if (periodo === 4) return "6099";
  return `603${periodo}`;
}

/**
 * Sums IVA register data for a given period from the operazioni table.
 */
async function sumRegistro(
  societaId: number,
  registroIva: "VENDITE" | "ACQUISTI",
  dataInizio: Date,
  dataFine: Date
): Promise<{ totaleImponibile: number; totaleIva: number }> {
  // For VENDITE, also include doppia registrazione entries (reverse charge / autofattura)
  const registroFilter =
    registroIva === "VENDITE"
      ? {
          OR: [
            { registroIva: "VENDITE" as const },
            { doppiaRegistrazione: true },
          ],
        }
      : { registroIva };

  const result = await prisma.operazione.aggregate({
    where: {
      societaId,
      eliminato: false,
      ...registroFilter,
      dataRegistrazione: {
        gte: dataInizio,
        lte: dataFine,
      },
    },
    _sum: {
      importoImponibile: true,
      importoIva: true,
    },
  });

  return {
    totaleImponibile: Number(result._sum.importoImponibile ?? 0),
    totaleIva: Number(result._sum.importoIva ?? 0),
  };
}

/**
 * Sums corrispettivi (gross amounts) and computes scorporo IVA.
 * Corrispettivi are recorded at gross amounts; we need to separate imponibile and IVA.
 */
async function sumCorrispettivi(
  societaId: number,
  dataInizio: Date,
  dataFine: Date
): Promise<{ totaleImponibile: number; totaleIva: number }> {
  const operazioni = await prisma.operazione.findMany({
    where: {
      societaId,
      eliminato: false,
      registroIva: "CORRISPETTIVI",
      dataRegistrazione: {
        gte: dataInizio,
        lte: dataFine,
      },
    },
    select: {
      importoImponibile: true,
      importoIva: true,
      aliquotaIva: true,
    },
  });

  let totaleImponibile = 0;
  let totaleIva = 0;

  for (const op of operazioni) {
    // If importoIva is already set, use it directly (already scorporato)
    if (op.importoIva != null) {
      totaleImponibile += Number(op.importoImponibile ?? 0);
      totaleIva += Number(op.importoIva);
    } else if (op.aliquotaIva != null && Number(op.aliquotaIva) > 0) {
      // Scorporo: from gross amount, separate imponibile and IVA
      const lordo = Number(op.importoImponibile ?? 0);
      const aliquota = Number(op.aliquotaIva) / 100;
      const imponibile = lordo / (1 + aliquota);
      const iva = lordo - imponibile;
      totaleImponibile += imponibile;
      totaleIva += iva;
    } else {
      totaleImponibile += Number(op.importoImponibile ?? 0);
    }
  }

  return {
    totaleImponibile: Math.round(totaleImponibile * 100) / 100,
    totaleIva: Math.round(totaleIva * 100) / 100,
  };
}

/**
 * Gets the previous period's liquidation for carry-forward logic.
 */
async function getPreviousLiquidation(
  societaId: number,
  tipo: "MENSILE" | "TRIMESTRALE",
  periodo: number,
  anno: number
) {
  let prevPeriodo: number;
  let prevAnno: number;

  if (tipo === "MENSILE") {
    if (periodo === 1) {
      prevPeriodo = 12;
      prevAnno = anno - 1;
    } else {
      prevPeriodo = periodo - 1;
      prevAnno = anno;
    }
  } else {
    if (periodo === 1) {
      prevPeriodo = 4;
      prevAnno = anno - 1;
    } else {
      prevPeriodo = periodo - 1;
      prevAnno = anno;
    }
  }

  return prisma.liquidazioneIva.findUnique({
    where: {
      societaId_tipo_periodo_anno: {
        societaId,
        tipo,
        periodo: prevPeriodo,
        anno: prevAnno,
      },
    },
  });
}

/**
 * Gets credit from prior year's annual declaration (VP9).
 * This is the credit from Dec/Q4 of previous year that was carried forward.
 */
async function getCreditoAnnoPrecedente(
  societaId: number,
  tipo: "MENSILE" | "TRIMESTRALE",
  periodo: number,
  anno: number
): Promise<number> {
  // VP9 only applies to the first period of the year
  if (periodo !== 1) return 0;

  const ultimoPeriodoPrec = tipo === "MENSILE" ? 12 : 4;
  const liqPrecedente = await prisma.liquidazioneIva.findUnique({
    where: {
      societaId_tipo_periodo_anno: {
        societaId,
        tipo,
        periodo: ultimoPeriodoPrec,
        anno: anno - 1,
      },
    },
  });

  if (!liqPrecedente) return 0;

  // If the last period of previous year ended with a credit (negative saldo),
  // that becomes VP9 for the first period of the new year
  const importoFinale = calculateImportoFinale(liqPrecedente);
  return importoFinale < 0 ? Math.abs(importoFinale) : 0;
}

/**
 * Helper to calculate VP14 from a liquidation record.
 */
function calculateImportoFinale(liq: {
  saldo: unknown;
  debitoPeriodoPrecedente: unknown;
  creditoPeriodoPrecedente: unknown;
  creditoAnnoPrecedente: unknown;
  versamentiAutoUE: unknown;
  creditiImposta: unknown;
  interessiDovuti: unknown;
  accontoVersato: unknown;
}): number {
  const saldo = Number(liq.saldo ?? 0);
  const debitoPrec = Number(liq.debitoPeriodoPrecedente ?? 0);
  const creditoPrec = Number(liq.creditoPeriodoPrecedente ?? 0);
  const creditoAnno = Number(liq.creditoAnnoPrecedente ?? 0);
  const versamentiAutoUE = Number(liq.versamentiAutoUE ?? 0);
  const creditiImposta = Number(liq.creditiImposta ?? 0);
  const interessi = Number(liq.interessiDovuti ?? 0);
  const acconto = Number(liq.accontoVersato ?? 0);

  return (
    saldo +
    debitoPrec -
    creditoPrec -
    creditoAnno -
    versamentiAutoUE -
    creditiImposta +
    interessi -
    acconto
  );
}

/**
 * Main calculation function for IVA liquidation.
 *
 * Queries registers for the period, computes VP2-VP14, handles carry-forward.
 */
export async function calcolaLiquidazione(
  input: CalcoloLiquidazioneInput
): Promise<CalcoloLiquidazioneResult> {
  const { societaId, tipo, periodo, anno } = input;
  const { dataInizio, dataFine } = getDateRange(tipo, periodo, anno);

  // VP2 + VP4: Vendite register
  const vendite = await sumRegistro(societaId, "VENDITE", dataInizio, dataFine);

  // VP3 + VP5: Acquisti register
  const acquisti = await sumRegistro(
    societaId,
    "ACQUISTI",
    dataInizio,
    dataFine
  );

  // Corrispettivi (add to vendite side)
  const corrispettivi = await sumCorrispettivi(
    societaId,
    dataInizio,
    dataFine
  );

  // VP2: totale operazioni attive = vendite imponibile + corrispettivi imponibile
  const totaleOperazioniAttive =
    Math.round((vendite.totaleImponibile + corrispettivi.totaleImponibile) * 100) / 100;

  // VP3: totale operazioni passive
  const totaleOperazioniPassive =
    Math.round(acquisti.totaleImponibile * 100) / 100;

  // VP4: IVA esigibile = IVA vendite + IVA corrispettivi
  const ivaEsigibile =
    Math.round((vendite.totaleIva + corrispettivi.totaleIva) * 100) / 100;

  // VP5: IVA detraibile
  const ivaDetraibile = Math.round(acquisti.totaleIva * 100) / 100;

  // VP6: saldo = VP4 - VP5
  const saldo = Math.round((ivaEsigibile - ivaDetraibile) * 100) / 100;

  // Get previous period data for carry-forward
  const prevLiq = await getPreviousLiquidation(societaId, tipo, periodo, anno);

  // VP7: debito periodo precedente (debito < 25.82 not paid)
  let debitoPeriodoPrecedente = 0;
  if (prevLiq) {
    const prevImportoFinale = calculateImportoFinale(prevLiq);
    if (prevImportoFinale > 0 && prevImportoFinale < SOGLIA_VERSAMENTO_MINIMO) {
      debitoPeriodoPrecedente =
        Math.round(prevImportoFinale * 100) / 100;
    }
  }

  // VP8: credito periodo precedente
  let creditoPeriodoPrecedente = 0;
  if (prevLiq) {
    const prevImportoFinale = calculateImportoFinale(prevLiq);
    if (prevImportoFinale < 0) {
      creditoPeriodoPrecedente =
        Math.round(Math.abs(prevImportoFinale) * 100) / 100;
    }
  }

  // VP9: credito anno precedente (only first period)
  const creditoAnnoPrecedente = await getCreditoAnnoPrecedente(
    societaId,
    tipo,
    periodo,
    anno
  );

  // VP10, VP11: default to 0 (can be manually adjusted)
  const versamentiAutoUE = 0;
  const creditiImposta = 0;

  // VP12: interessi dovuti — 1% surcharge for quarterly (except Q4)
  let interessiDovuti = 0;
  if (tipo === "TRIMESTRALE" && periodo !== 4 && saldo > 0) {
    interessiDovuti = Math.round(saldo * MAGGIORAZIONE_TRIMESTRALE * 100) / 100;
  }

  // VP13: acconto versato — only for Dec (mensile) or Q4 (trimestrale)
  const accontoVersato = 0; // Will be set separately via acconto endpoint

  // VP14: importo finale
  const importoFinale =
    Math.round(
      (saldo +
        debitoPeriodoPrecedente -
        creditoPeriodoPrecedente -
        creditoAnnoPrecedente -
        versamentiAutoUE -
        creditiImposta +
        interessiDovuti -
        accontoVersato) *
        100
    ) / 100;

  const codiceTributo = getCodiceTributo(tipo, periodo);

  return {
    totaleOperazioniAttive,
    totaleOperazioniPassive,
    ivaEsigibile,
    ivaDetraibile,
    saldo,
    debitoPeriodoPrecedente,
    creditoPeriodoPrecedente,
    creditoAnnoPrecedente,
    versamentiAutoUE,
    creditiImposta,
    interessiDovuti,
    accontoVersato,
    importoFinale,
    codiceTributo,
  };
}

/**
 * Pure calculation function (no DB access) for testing.
 * Takes pre-fetched register totals and previous period data.
 */
export function calcolaLiquidazionePura(params: {
  tipo: "MENSILE" | "TRIMESTRALE";
  periodo: number;
  ivaEsigibile: number;
  ivaDetraibile: number;
  totaleOperazioniAttive: number;
  totaleOperazioniPassive: number;
  debitoPeriodoPrecedente?: number;
  creditoPeriodoPrecedente?: number;
  creditoAnnoPrecedente?: number;
  versamentiAutoUE?: number;
  creditiImposta?: number;
  accontoVersato?: number;
}): CalcoloLiquidazioneResult {
  const {
    tipo,
    periodo,
    ivaEsigibile,
    ivaDetraibile,
    totaleOperazioniAttive,
    totaleOperazioniPassive,
    debitoPeriodoPrecedente = 0,
    creditoPeriodoPrecedente = 0,
    creditoAnnoPrecedente = 0,
    versamentiAutoUE = 0,
    creditiImposta = 0,
    accontoVersato = 0,
  } = params;

  const saldo = Math.round((ivaEsigibile - ivaDetraibile) * 100) / 100;

  let interessiDovuti = 0;
  if (tipo === "TRIMESTRALE" && periodo !== 4 && saldo > 0) {
    interessiDovuti = Math.round(saldo * MAGGIORAZIONE_TRIMESTRALE * 100) / 100;
  }

  const importoFinale =
    Math.round(
      (saldo +
        debitoPeriodoPrecedente -
        creditoPeriodoPrecedente -
        creditoAnnoPrecedente -
        versamentiAutoUE -
        creditiImposta +
        interessiDovuti -
        accontoVersato) *
        100
    ) / 100;

  const codiceTributo = getCodiceTributo(tipo, periodo);

  return {
    totaleOperazioniAttive,
    totaleOperazioniPassive,
    ivaEsigibile,
    ivaDetraibile,
    saldo,
    debitoPeriodoPrecedente,
    creditoPeriodoPrecedente,
    creditoAnnoPrecedente,
    versamentiAutoUE,
    creditiImposta,
    interessiDovuti,
    accontoVersato,
    importoFinale,
    codiceTributo,
  };
}
