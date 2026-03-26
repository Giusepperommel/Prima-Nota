// src/lib/bi/kpi/engine.ts
import { prisma } from "@/lib/prisma";
import type { KpiCalculator } from "./types";
import type { KpiResult, PeriodRange } from "../types";
import { buildPeriodRange } from "../utils";
import { kpiEconomici } from "./economici";
import { kpiFinanziari } from "./finanziari";
import { kpiFiscali } from "./fiscali";
import { kpiOperativi } from "./operativi";

export function getAllKpiCalculators(): KpiCalculator[] {
  return [...kpiEconomici, ...kpiFinanziari, ...kpiFiscali, ...kpiOperativi];
}

function getPreviousPeriod(anno: number, periodo: number, tipo: string): PeriodRange {
  switch (tipo) {
    case "MESE": {
      const prevMese = periodo === 1 ? 12 : periodo - 1;
      const prevAnno = periodo === 1 ? anno - 1 : anno;
      return buildPeriodRange(prevAnno, prevMese, "MESE");
    }
    case "TRIMESTRE": {
      const prevQ = periodo === 1 ? 4 : periodo - 1;
      const prevAnno = periodo === 1 ? anno - 1 : anno;
      return buildPeriodRange(prevAnno, prevQ, "TRIMESTRE");
    }
    case "ANNO":
    default:
      return buildPeriodRange(anno - 1, 1, "ANNO");
  }
}

export async function calculateAllKpis(
  societaId: number,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<KpiResult[]> {
  const range = buildPeriodRange(anno, periodo, periodoTipo);
  const prevRange = getPreviousPeriod(anno, periodo, periodoTipo);
  const calculators = getAllKpiCalculators();

  const results: KpiResult[] = [];
  for (const calc of calculators) {
    try {
      const result = await calc.calculate(societaId, range, prevRange);
      results.push(result);
    } catch (error) {
      console.error(`[KpiEngine] Errore calcolo ${calc.codice}:`, error);
    }
  }

  return results;
}

export async function calculateAndCacheKpis(
  societaId: number,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<KpiResult[]> {
  const results = await calculateAllKpis(societaId, anno, periodo, periodoTipo);
  const periodLabel = buildPeriodRange(anno, periodo, periodoTipo).label;

  for (const result of results) {
    // Find or create KpiDefinizione
    let kpiDef = await prisma.kpiDefinizione.findFirst({
      where: { codice: result.codice, OR: [{ societaId }, { societaId: null }] },
    });

    if (!kpiDef) {
      kpiDef = await prisma.kpiDefinizione.create({
        data: {
          codice: result.codice,
          nome: result.nome,
          categoria: mapCategoria(result.categoria),
          formula: {},
          attivo: true,
        },
      });
    }

    await prisma.kpiValore.upsert({
      where: {
        societaId_kpiId_periodo_periodoTipo: {
          societaId,
          kpiId: kpiDef.id,
          periodo: periodLabel,
          periodoTipo: periodoTipo as any,
        },
      },
      update: {
        valore: result.valore,
        valorePrec: result.valorePrec,
        variazione: result.variazione,
        trend: result.trend,
        calcolatoAt: new Date(),
      },
      create: {
        societaId,
        kpiId: kpiDef.id,
        periodo: periodLabel,
        periodoTipo: periodoTipo as any,
        valore: result.valore,
        valorePrec: result.valorePrec,
        variazione: result.variazione,
        trend: result.trend,
      },
    });
  }

  return results;
}

function mapCategoria(cat: string): any {
  const map: Record<string, string> = {
    ECONOMICO: "ECONOMICO",
    FINANZIARIO: "FINANZIARIO",
    FISCALE: "FISCALE",
    OPERATIVO: "OPERATIVO",
    CRESCITA: "CRESCITA",
  };
  return map[cat] || "ECONOMICO";
}
