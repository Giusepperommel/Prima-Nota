// src/lib/bi/types.ts
export type { CategoriaKpi, PeriodoTipo, StatoBudget, StatoReport } from "@prisma/client";

export interface PeriodRange {
  da: Date;
  a: Date;
  label: string;
}

export interface KpiResult {
  codice: string;
  nome: string;
  categoria: string;
  valore: number;
  valorePrec: number | null;
  variazione: number | null;
  trend: "up" | "down" | "stable" | null;
  unita: string; // "€", "%", "giorni", "n"
}

export interface ComparisonRow {
  label: string;
  valoreCorrente: number;
  valorePrecedente: number;
  delta: number;
  deltaPerc: number | null;
}
