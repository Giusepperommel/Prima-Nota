// src/lib/bi/comparativa/types.ts
import type { ComparisonRow, PeriodRange } from "../types";

export interface ComparisonResult {
  titolo: string;
  periodoCorrente: string;
  periodoPrecedente: string;
  righe: ComparisonRow[];
  sommario: {
    deltaRicavi: number;
    deltaCosti: number;
    deltaMargine: number;
  };
}
