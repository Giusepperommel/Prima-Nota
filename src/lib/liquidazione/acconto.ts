/**
 * Acconto IVA calculation.
 *
 * Supports three methods:
 * 1. Storico (default): 88% of IVA paid for Dec/Q4 of previous year
 * 2. Previsionale: 88% of estimated IVA (user-provided)
 * 3. Analitico: 100% of liquidation as of Dec 20
 */

import { prisma } from "@/lib/prisma";
import {
  AccontoIvaInput,
  AccontoIvaResult,
  SOGLIA_ACCONTO_MINIMO,
  PERCENTUALE_ACCONTO,
} from "./types";

/**
 * Calculates the acconto IVA for December (mensile) or Q4 (trimestrale).
 */
export async function calcolaAcconto(
  input: AccontoIvaInput
): Promise<AccontoIvaResult> {
  const { societaId, anno, metodo = 1, importoPrevisionale } = input;

  // Determine the tipo from the previous year's liquidation
  const prevLiq = await prisma.liquidazioneIva.findFirst({
    where: {
      societaId,
      anno: anno - 1,
    },
    select: { tipo: true },
  });

  const tipo = prevLiq?.tipo ?? "MENSILE";
  const periodoRiferimento = tipo === "MENSILE" ? 12 : 4;

  let baseCalcolo = 0;
  let importo = 0;

  switch (metodo) {
    case 1: {
      // Metodo storico: 88% of IVA versata for Dec/Q4 of previous year
      const liqPrevAnno = await prisma.liquidazioneIva.findUnique({
        where: {
          societaId_tipo_periodo_anno: {
            societaId,
            tipo,
            periodo: periodoRiferimento,
            anno: anno - 1,
          },
        },
      });

      if (liqPrevAnno) {
        // Base is the saldo of the last period (VP6 + VP12 - VP13)
        const saldo = Number(liqPrevAnno.saldo ?? 0);
        const interessi = Number(liqPrevAnno.interessiDovuti ?? 0);
        const acconto = Number(liqPrevAnno.accontoVersato ?? 0);
        baseCalcolo = saldo + interessi - acconto;
      }

      importo =
        baseCalcolo > 0
          ? Math.round(baseCalcolo * PERCENTUALE_ACCONTO * 100) / 100
          : 0;
      break;
    }
    case 2: {
      // Metodo previsionale: 88% of user-estimated IVA
      baseCalcolo = importoPrevisionale ?? 0;
      importo =
        baseCalcolo > 0
          ? Math.round(baseCalcolo * PERCENTUALE_ACCONTO * 100) / 100
          : 0;
      break;
    }
    case 3: {
      // Metodo analitico: 100% of liquidation as of Dec 20
      // Uses actual data up to Dec 20 (or Nov for trimestrale)
      // For simplicity, we calculate from the existing register data
      const liqCorrente = await prisma.liquidazioneIva.findUnique({
        where: {
          societaId_tipo_periodo_anno: {
            societaId,
            tipo,
            periodo: periodoRiferimento,
            anno,
          },
        },
      });

      if (liqCorrente) {
        baseCalcolo = Number(liqCorrente.saldo ?? 0);
      }
      importo = baseCalcolo > 0 ? Math.round(baseCalcolo * 100) / 100 : 0;
      break;
    }
  }

  const dovuto = importo >= SOGLIA_ACCONTO_MINIMO;

  return {
    importo: dovuto ? importo : 0,
    dovuto,
    metodo,
    baseCalcolo,
  };
}

/**
 * Pure calculation function for acconto IVA (no DB access), for testing.
 */
export function calcolaAccontoPuro(params: {
  metodo: 1 | 2 | 3;
  baseCalcolo: number;
}): AccontoIvaResult {
  const { metodo, baseCalcolo } = params;

  let importo: number;

  if (metodo === 3) {
    // Analitico: 100%
    importo = baseCalcolo > 0 ? Math.round(baseCalcolo * 100) / 100 : 0;
  } else {
    // Storico or previsionale: 88%
    importo =
      baseCalcolo > 0
        ? Math.round(baseCalcolo * PERCENTUALE_ACCONTO * 100) / 100
        : 0;
  }

  const dovuto = importo >= SOGLIA_ACCONTO_MINIMO;

  return {
    importo: dovuto ? importo : 0,
    dovuto,
    metodo,
    baseCalcolo,
  };
}
