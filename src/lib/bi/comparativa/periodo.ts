// src/lib/bi/comparativa/periodo.ts
import type { ComparisonRow } from "../types";
import type { ComparisonResult } from "./types";
import { calculateAllKpis } from "../kpi/engine";
import { buildPeriodRange } from "../utils";

export function buildComparisonRow(label: string, corrente: number, precedente: number): ComparisonRow {
  const delta = corrente - precedente;
  const deltaPerc = precedente !== 0 ? ((delta / Math.abs(precedente)) * 100) : null;
  return {
    label,
    valoreCorrente: Math.round(corrente * 100) / 100,
    valorePrecedente: Math.round(precedente * 100) / 100,
    delta: Math.round(delta * 100) / 100,
    deltaPerc: deltaPerc != null ? Math.round(deltaPerc * 100) / 100 : null,
  };
}

export async function comparePeriods(
  societaId: number,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<ComparisonResult> {
  const corrente = await calculateAllKpis(societaId, anno, periodo, periodoTipo);
  const range = buildPeriodRange(anno, periodo, periodoTipo);

  // Build previous period params
  let annoPrec = anno;
  let periodoPrec = periodo;
  if (periodoTipo === "MESE") {
    periodoPrec = periodo === 1 ? 12 : periodo - 1;
    annoPrec = periodo === 1 ? anno - 1 : anno;
  } else if (periodoTipo === "TRIMESTRE") {
    periodoPrec = periodo === 1 ? 4 : periodo - 1;
    annoPrec = periodo === 1 ? anno - 1 : anno;
  } else {
    annoPrec = anno - 1;
  }

  const precedente = await calculateAllKpis(societaId, annoPrec, periodoPrec, periodoTipo);
  const rangePrec = buildPeriodRange(annoPrec, periodoPrec, periodoTipo);

  const righe: ComparisonRow[] = corrente.map((kpi) => {
    const prev = precedente.find((p) => p.codice === kpi.codice);
    return buildComparisonRow(kpi.nome, kpi.valore, prev?.valore ?? 0);
  });

  const ricaviRow = righe.find((r) => r.label === "Ricavi");
  const costiRow = righe.find((r) => r.label === "Costi");
  const margineRow = righe.find((r) => r.label === "Margine Lordo");

  return {
    titolo: `Confronto ${range.label} vs ${rangePrec.label}`,
    periodoCorrente: range.label,
    periodoPrecedente: rangePrec.label,
    righe,
    sommario: {
      deltaRicavi: ricaviRow?.delta ?? 0,
      deltaCosti: costiRow?.delta ?? 0,
      deltaMargine: margineRow?.delta ?? 0,
    },
  };
}
