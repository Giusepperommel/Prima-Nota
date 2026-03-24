/**
 * LIPE data builder.
 *
 * Constructs a LipeFornitura from liquidazione and societa data.
 * For mensile: 3 moduli per quarter (one per month).
 * For trimestrale: 1 modulo per quarter.
 */

import { prisma } from "@/lib/prisma";
import type {
  LipeFornitura,
  LipeComunicazione,
  LipeFrontespizio,
  LipeModulo,
} from "./types";

/**
 * Builds LIPE data from DB records for a given quarter.
 */
export async function buildLipeData(
  societaId: number,
  anno: number,
  trimestre: number
): Promise<LipeFornitura> {
  // Fetch societa data
  const societa = await prisma.societa.findUniqueOrThrow({
    where: { id: societaId },
    select: {
      partitaIva: true,
      codiceFiscale: true,
      ragioneSociale: true,
    },
  });

  // Fetch liquidazioni for this quarter
  const liquidazioni = await prisma.liquidazioneIva.findMany({
    where: {
      societaId,
      anno,
      // For mensile: periodo within the quarter's months
      // For trimestrale: periodo = trimestre
      OR: [
        // Mensile: months in this quarter
        {
          tipo: "MENSILE",
          periodo: {
            gte: (trimestre - 1) * 3 + 1,
            lte: trimestre * 3,
          },
        },
        // Trimestrale: this quarter
        {
          tipo: "TRIMESTRALE",
          periodo: trimestre,
        },
      ],
    },
    orderBy: { periodo: "asc" },
  });

  // Build moduli
  const datiContabili: LipeModulo[] = liquidazioni.map((liq) => {
    const saldo = Number(liq.saldo ?? 0);
    const importoFinale = calcImportoFinale(liq);

    const modulo: LipeModulo = {
      totaleOperazioniAttive: Number(liq.totaleOperazioniAttive ?? 0),
      totaleOperazioniPassive: Number(liq.totaleOperazioniPassive ?? 0),
      ivaEsigibile: Number(liq.ivaEsigibile),
      ivaDetratta: Number(liq.ivaDetraibile),
      debitoPrec: Number(liq.debitoPeriodoPrecedente ?? 0),
      creditoPrec: Number(liq.creditoPeriodoPrecedente ?? 0),
      creditoAnnoPrec: Number(liq.creditoAnnoPrecedente ?? 0),
      versamentiAutoUE: Number(liq.versamentiAutoUE ?? 0),
      creditiImposta: Number(liq.creditiImposta ?? 0),
      interessiDovuti: Number(liq.interessiDovuti ?? 0),
      acconto: Number(liq.accontoVersato ?? 0),
    };

    // VP6: mutually exclusive
    if (saldo >= 0) {
      modulo.ivaDovuta = Math.round(saldo * 100) / 100;
    } else {
      modulo.ivaCredito = Math.round(Math.abs(saldo) * 100) / 100;
    }

    // VP14: mutually exclusive
    if (importoFinale >= 0) {
      modulo.importoDaVersare = Math.round(importoFinale * 100) / 100;
    } else {
      modulo.importoACredito = Math.round(Math.abs(importoFinale) * 100) / 100;
    }

    // Set mese or trimestre
    if (liq.tipo === "MENSILE") {
      modulo.mese = liq.periodo;
    } else {
      modulo.trimestre = liq.periodo;
    }

    return modulo;
  });

  const frontespizio: LipeFrontespizio = {
    codiceFiscale: societa.codiceFiscale,
    anno,
    trimestre,
    partitaIva: societa.partitaIva,
    cognomeODenominazione: societa.ragioneSociale,
    firmaDelDichiarante: true,
  };

  const comunicazione: LipeComunicazione = {
    frontespizio,
    datiContabili,
  };

  return {
    intestazione: {
      codiceFornitura: "IVP18",
    },
    comunicazione,
  };
}

/**
 * Pure builder function for testing (no DB).
 */
export function buildLipeDataPura(params: {
  codiceFiscale: string;
  partitaIva: string;
  ragioneSociale: string;
  anno: number;
  trimestre: number;
  liquidazioni: Array<{
    tipo: "MENSILE" | "TRIMESTRALE";
    periodo: number;
    ivaEsigibile: number;
    ivaDetraibile: number;
    saldo: number;
    totaleOperazioniAttive: number;
    totaleOperazioniPassive: number;
    debitoPeriodoPrecedente: number;
    creditoPeriodoPrecedente: number;
    creditoAnnoPrecedente: number;
    versamentiAutoUE: number;
    creditiImposta: number;
    interessiDovuti: number;
    accontoVersato: number;
  }>;
}): LipeFornitura {
  const {
    codiceFiscale,
    partitaIva,
    ragioneSociale,
    anno,
    trimestre,
    liquidazioni,
  } = params;

  const datiContabili: LipeModulo[] = liquidazioni.map((liq) => {
    const saldo = liq.saldo;
    const importoFinale =
      saldo +
      liq.debitoPeriodoPrecedente -
      liq.creditoPeriodoPrecedente -
      liq.creditoAnnoPrecedente -
      liq.versamentiAutoUE -
      liq.creditiImposta +
      liq.interessiDovuti -
      liq.accontoVersato;

    const modulo: LipeModulo = {
      totaleOperazioniAttive: liq.totaleOperazioniAttive,
      totaleOperazioniPassive: liq.totaleOperazioniPassive,
      ivaEsigibile: liq.ivaEsigibile,
      ivaDetratta: liq.ivaDetraibile,
      debitoPrec: liq.debitoPeriodoPrecedente,
      creditoPrec: liq.creditoPeriodoPrecedente,
      creditoAnnoPrec: liq.creditoAnnoPrecedente,
      versamentiAutoUE: liq.versamentiAutoUE,
      creditiImposta: liq.creditiImposta,
      interessiDovuti: liq.interessiDovuti,
      acconto: liq.accontoVersato,
    };

    if (saldo >= 0) {
      modulo.ivaDovuta = Math.round(saldo * 100) / 100;
    } else {
      modulo.ivaCredito = Math.round(Math.abs(saldo) * 100) / 100;
    }

    if (importoFinale >= 0) {
      modulo.importoDaVersare = Math.round(importoFinale * 100) / 100;
    } else {
      modulo.importoACredito = Math.round(Math.abs(importoFinale) * 100) / 100;
    }

    if (liq.tipo === "MENSILE") {
      modulo.mese = liq.periodo;
    } else {
      modulo.trimestre = liq.periodo;
    }

    return modulo;
  });

  return {
    intestazione: {
      codiceFornitura: "IVP18",
    },
    comunicazione: {
      frontespizio: {
        codiceFiscale,
        anno,
        trimestre,
        partitaIva,
        cognomeODenominazione: ragioneSociale,
        firmaDelDichiarante: true,
      },
      datiContabili,
    },
  };
}

function calcImportoFinale(liq: {
  saldo: unknown;
  debitoPeriodoPrecedente: unknown;
  creditoPeriodoPrecedente: unknown;
  creditoAnnoPrecedente: unknown;
  versamentiAutoUE: unknown;
  creditiImposta: unknown;
  interessiDovuti: unknown;
  accontoVersato: unknown;
}): number {
  return (
    Number(liq.saldo ?? 0) +
    Number(liq.debitoPeriodoPrecedente ?? 0) -
    Number(liq.creditoPeriodoPrecedente ?? 0) -
    Number(liq.creditoAnnoPrecedente ?? 0) -
    Number(liq.versamentiAutoUE ?? 0) -
    Number(liq.creditiImposta ?? 0) +
    Number(liq.interessiDovuti ?? 0) -
    Number(liq.accontoVersato ?? 0)
  );
}
