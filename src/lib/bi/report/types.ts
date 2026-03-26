// src/lib/bi/report/types.ts
export interface ReportSectionDef {
  tipo: "kpi_summary" | "kpi_table" | "comparison" | "health_score" | "alert_summary" | "text";
  titolo: string;
  config?: Record<string, unknown>;
}

export interface PredefinedReport {
  tipo: string;
  nome: string;
  descrizione: string;
  sezioni: ReportSectionDef[];
  destinatariDefault: string[];
}
