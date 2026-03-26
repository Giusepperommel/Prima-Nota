import type { KpiResult, PeriodRange } from "../types";

export interface KpiCalculator {
  codice: string;
  nome: string;
  categoria: string;
  unita: string;
  calculate: (societaId: number, periodo: PeriodRange, periodoPrec: PeriodRange | null) => Promise<KpiResult>;
}
