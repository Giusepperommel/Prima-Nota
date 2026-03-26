// src/lib/bi/kpi/finanziari.ts
import { prisma } from "@/lib/prisma";
import { differenceInDays } from "date-fns";
import type { KpiCalculator } from "./types";
import type { KpiResult, PeriodRange } from "../types";
import { calcolaVariazione, determinaTrend } from "../utils";

function makeResult(codice: string, nome: string, valore: number, valorePrec: number | null, unita: string): KpiResult {
  const variazione = valorePrec != null ? calcolaVariazione(valore, valorePrec) : null;
  return {
    codice, nome, categoria: "FINANZIARIO",
    valore: Math.round(valore * 100) / 100,
    valorePrec: valorePrec != null ? Math.round(valorePrec * 100) / 100 : null,
    variazione: variazione != null ? Math.round(variazione * 100) / 100 : null,
    trend: determinaTrend(variazione), unita,
  };
}

async function calcDSO(societaId: number, periodo: PeriodRange): Promise<number> {
  const chiuse = await prisma.scadenzaPartitario.findMany({
    where: {
      societaId, tipo: "CLIENTE", stato: "CHIUSA",
      dataScadenza: { gte: periodo.da, lte: periodo.a },
    },
    include: { operazione: { select: { dataOperazione: true } } },
  });

  if (chiuse.length === 0) return 0;
  const totalDays = chiuse.reduce((sum, s) => {
    if (!s.operazione?.dataOperazione) return sum;
    return sum + Math.max(0, differenceInDays(s.dataScadenza, s.operazione.dataOperazione));
  }, 0);
  return totalDays / chiuse.length;
}

async function calcDPO(societaId: number, periodo: PeriodRange): Promise<number> {
  const chiuse = await prisma.scadenzaPartitario.findMany({
    where: {
      societaId, tipo: "FORNITORE", stato: "CHIUSA",
      dataScadenza: { gte: periodo.da, lte: periodo.a },
    },
    include: { operazione: { select: { dataOperazione: true } } },
  });

  if (chiuse.length === 0) return 0;
  const totalDays = chiuse.reduce((sum, s) => {
    if (!s.operazione?.dataOperazione) return sum;
    return sum + Math.max(0, differenceInDays(s.dataScadenza, s.operazione.dataOperazione));
  }, 0);
  return totalDays / chiuse.length;
}

async function calcCashBurn(societaId: number, periodo: PeriodRange): Promise<number> {
  const costi = await prisma.operazione.aggregate({
    where: {
      societaId, tipoOperazione: "COSTO",
      dataOperazione: { gte: periodo.da, lte: periodo.a },
      eliminato: false, bozza: false,
    },
    _sum: { importoTotale: true },
  });
  const months = Math.max(1, differenceInDays(periodo.a, periodo.da) / 30);
  return Number(costi._sum.importoTotale ?? 0) / months;
}

export const kpiFinanziari: KpiCalculator[] = [
  {
    codice: "DSO", nome: "Days Sales Outstanding", categoria: "FINANZIARIO", unita: "giorni",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await calcDSO(societaId, periodo);
      const valorePrec = periodoPrec ? await calcDSO(societaId, periodoPrec) : null;
      return makeResult("DSO", "Days Sales Outstanding", valore, valorePrec, "giorni");
    },
  },
  {
    codice: "DPO", nome: "Days Payable Outstanding", categoria: "FINANZIARIO", unita: "giorni",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await calcDPO(societaId, periodo);
      const valorePrec = periodoPrec ? await calcDPO(societaId, periodoPrec) : null;
      return makeResult("DPO", "Days Payable Outstanding", valore, valorePrec, "giorni");
    },
  },
  {
    codice: "CASH_BURN_RATE", nome: "Cash Burn Rate", categoria: "FINANZIARIO", unita: "€/mese",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await calcCashBurn(societaId, periodo);
      const valorePrec = periodoPrec ? await calcCashBurn(societaId, periodoPrec) : null;
      return makeResult("CASH_BURN_RATE", "Cash Burn Rate", valore, valorePrec, "€/mese");
    },
  },
];
