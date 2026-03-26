// src/lib/bi/kpi/economici.ts
import { prisma } from "@/lib/prisma";
import type { KpiCalculator } from "./types";
import type { KpiResult, PeriodRange } from "../types";
import { calcolaImportoNetto, calcolaVariazione, determinaTrend } from "../utils";

async function sumOperazioniByTipo(
  societaId: number,
  periodo: PeriodRange,
  tipoOperazione: string
): Promise<number> {
  const operazioni = await prisma.operazione.findMany({
    where: {
      societaId,
      tipoOperazione: tipoOperazione as any,
      dataOperazione: { gte: periodo.da, lte: periodo.a },
      eliminato: false,
      bozza: false,
    },
    select: { importoImponibile: true, importoTotale: true, aliquotaIva: true },
  });

  return operazioni.reduce(
    (sum, op) => sum + calcolaImportoNetto({
      importoImponibile: op.importoImponibile ? Number(op.importoImponibile) : null,
      importoTotale: Number(op.importoTotale),
      aliquotaIva: op.aliquotaIva ? Number(op.aliquotaIva) : null,
    }),
    0
  );
}

function makeKpiResult(
  codice: string,
  nome: string,
  valore: number,
  valorePrec: number | null,
  unita: string
): KpiResult {
  const variazione = valorePrec != null ? calcolaVariazione(valore, valorePrec) : null;
  return {
    codice,
    nome,
    categoria: "ECONOMICO",
    valore: Math.round(valore * 100) / 100,
    valorePrec: valorePrec != null ? Math.round(valorePrec * 100) / 100 : null,
    variazione: variazione != null ? Math.round(variazione * 100) / 100 : null,
    trend: determinaTrend(variazione),
    unita,
  };
}

export const kpiEconomici: KpiCalculator[] = [
  {
    codice: "RICAVI",
    nome: "Ricavi",
    categoria: "ECONOMICO",
    unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await sumOperazioniByTipo(societaId, periodo, "FATTURA_ATTIVA");
      const valorePrec = periodoPrec ? await sumOperazioniByTipo(societaId, periodoPrec, "FATTURA_ATTIVA") : null;
      return makeKpiResult("RICAVI", "Ricavi", valore, valorePrec, "€");
    },
  },
  {
    codice: "COSTI",
    nome: "Costi",
    categoria: "ECONOMICO",
    unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await sumOperazioniByTipo(societaId, periodo, "COSTO");
      const valorePrec = periodoPrec ? await sumOperazioniByTipo(societaId, periodoPrec, "COSTO") : null;
      return makeKpiResult("COSTI", "Costi", valore, valorePrec, "€");
    },
  },
  {
    codice: "MARGINE_LORDO",
    nome: "Margine Lordo",
    categoria: "ECONOMICO",
    unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const ricavi = await sumOperazioniByTipo(societaId, periodo, "FATTURA_ATTIVA");
      const costi = await sumOperazioniByTipo(societaId, periodo, "COSTO");
      const valore = ricavi - costi;
      let valorePrec: number | null = null;
      if (periodoPrec) {
        const ricaviPrec = await sumOperazioniByTipo(societaId, periodoPrec, "FATTURA_ATTIVA");
        const costiPrec = await sumOperazioniByTipo(societaId, periodoPrec, "COSTO");
        valorePrec = ricaviPrec - costiPrec;
      }
      return makeKpiResult("MARGINE_LORDO", "Margine Lordo", valore, valorePrec, "€");
    },
  },
  {
    codice: "EBITDA",
    nome: "EBITDA",
    categoria: "ECONOMICO",
    unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      // EBITDA = Ricavi - Costi operativi (escl. ammortamenti e imposte)
      const ricavi = await sumOperazioniByTipo(societaId, periodo, "FATTURA_ATTIVA");
      const costiOp = await sumOperazioniByTipo(societaId, periodo, "COSTO");
      const valore = ricavi - costiOp;
      let valorePrec: number | null = null;
      if (periodoPrec) {
        const rP = await sumOperazioniByTipo(societaId, periodoPrec, "FATTURA_ATTIVA");
        const cP = await sumOperazioniByTipo(societaId, periodoPrec, "COSTO");
        valorePrec = rP - cP;
      }
      return makeKpiResult("EBITDA", "EBITDA", valore, valorePrec, "€");
    },
  },
  {
    codice: "UTILE_NETTO",
    nome: "Utile Netto",
    categoria: "ECONOMICO",
    unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const ricavi = await sumOperazioniByTipo(societaId, periodo, "FATTURA_ATTIVA");
      const costi = await sumOperazioniByTipo(societaId, periodo, "COSTO");
      const imposte = await sumOperazioniByTipo(societaId, periodo, "PAGAMENTO_IMPOSTE");
      const valore = ricavi - costi - imposte;
      let valorePrec: number | null = null;
      if (periodoPrec) {
        const rP = await sumOperazioniByTipo(societaId, periodoPrec, "FATTURA_ATTIVA");
        const cP = await sumOperazioniByTipo(societaId, periodoPrec, "COSTO");
        const iP = await sumOperazioniByTipo(societaId, periodoPrec, "PAGAMENTO_IMPOSTE");
        valorePrec = rP - cP - iP;
      }
      return makeKpiResult("UTILE_NETTO", "Utile Netto", valore, valorePrec, "€");
    },
  },
];
