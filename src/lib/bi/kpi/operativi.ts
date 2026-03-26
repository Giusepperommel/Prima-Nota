// src/lib/bi/kpi/operativi.ts
import { prisma } from "@/lib/prisma";
import type { KpiCalculator } from "./types";
import type { KpiResult, PeriodRange } from "../types";
import { calcolaVariazione, determinaTrend } from "../utils";

function makeResult(codice: string, nome: string, valore: number, valorePrec: number | null, unita: string, cat: string = "OPERATIVO"): KpiResult {
  const variazione = valorePrec != null ? calcolaVariazione(valore, valorePrec) : null;
  return {
    codice, nome, categoria: cat,
    valore: Math.round(valore * 100) / 100,
    valorePrec: valorePrec != null ? Math.round(valorePrec * 100) / 100 : null,
    variazione: variazione != null ? Math.round(variazione * 100) / 100 : null,
    trend: determinaTrend(variazione), unita,
  };
}

async function countFatture(societaId: number, periodo: PeriodRange): Promise<number> {
  return prisma.fatturaElettronica.count({
    where: {
      societaId,
      dataDocumento: { gte: periodo.da, lte: periodo.a },
    },
  });
}

async function calcTassoInsoluti(societaId: number, periodo: PeriodRange): Promise<number> {
  const totale = await prisma.scadenzaPartitario.count({
    where: {
      societaId, tipo: "CLIENTE",
      dataScadenza: { gte: periodo.da, lte: periodo.a },
    },
  });
  if (totale === 0) return 0;

  const insoluti = await prisma.scadenzaPartitario.count({
    where: {
      societaId, tipo: "CLIENTE",
      stato: { in: ["APERTA", "PARZIALE"] },
      dataScadenza: { gte: periodo.da, lte: periodo.a },
    },
  });

  return (insoluti / totale) * 100;
}

export const kpiOperativi: KpiCalculator[] = [
  {
    codice: "NUM_FATTURE", nome: "Numero Fatture", categoria: "OPERATIVO", unita: "n",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await countFatture(societaId, periodo);
      const valorePrec = periodoPrec ? await countFatture(societaId, periodoPrec) : null;
      return makeResult("NUM_FATTURE", "Numero Fatture", valore, valorePrec, "n");
    },
  },
  {
    codice: "TASSO_INSOLUTI", nome: "Tasso Insoluti", categoria: "OPERATIVO", unita: "%",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await calcTassoInsoluti(societaId, periodo);
      const valorePrec = periodoPrec ? await calcTassoInsoluti(societaId, periodoPrec) : null;
      return makeResult("TASSO_INSOLUTI", "Tasso Insoluti", valore, valorePrec, "%");
    },
  },
];
