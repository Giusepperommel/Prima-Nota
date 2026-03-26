// src/lib/bi/report/templates.ts
import type { PredefinedReport } from "./types";

export const PREDEFINED_REPORTS: PredefinedReport[] = [
  {
    tipo: "CRUSCOTTO_MENSILE",
    nome: "Cruscotto Mensile",
    descrizione: "KPI principali + trend + alert attivi",
    destinatariDefault: ["ADMIN", "STANDARD"],
    sezioni: [
      { tipo: "health_score", titolo: "Salute Azienda" },
      { tipo: "kpi_summary", titolo: "KPI Economici", config: { categoria: "ECONOMICO" } },
      { tipo: "kpi_summary", titolo: "KPI Finanziari", config: { categoria: "FINANZIARIO" } },
      { tipo: "comparison", titolo: "Confronto vs Mese Precedente", config: { periodoTipo: "MESE" } },
      { tipo: "alert_summary", titolo: "Alert Attivi" },
    ],
  },
  {
    tipo: "REPORT_IVA_TRIMESTRALE",
    nome: "Report IVA Trimestrale",
    descrizione: "Riepilogo IVA + liquidazione + previsione",
    destinatariDefault: ["ADMIN", "COMMERCIALISTA"],
    sezioni: [
      { tipo: "kpi_summary", titolo: "KPI Fiscali", config: { categoria: "FISCALE" } },
      { tipo: "kpi_table", titolo: "Dettaglio IVA", config: { codici: ["DEBITO_IVA", "CREDITO_IVA"] } },
      { tipo: "comparison", titolo: "Confronto vs Trimestre Precedente", config: { periodoTipo: "TRIMESTRE" } },
    ],
  },
  {
    tipo: "ANALISI_COSTI",
    nome: "Analisi Costi",
    descrizione: "Breakdown costi per categoria + confronto periodo",
    destinatariDefault: ["ADMIN"],
    sezioni: [
      { tipo: "kpi_summary", titolo: "Riepilogo Costi", config: { codici: ["COSTI", "EBITDA", "CASH_BURN_RATE"] } },
      { tipo: "comparison", titolo: "Confronto vs Periodo Precedente", config: { periodoTipo: "MESE" } },
    ],
  },
  {
    tipo: "SITUAZIONE_CLIENTI_FORNITORI",
    nome: "Situazione Clienti/Fornitori",
    descrizione: "Aging, insoluti, scaduto, previsione",
    destinatariDefault: ["ADMIN", "COMMERCIALISTA"],
    sezioni: [
      { tipo: "kpi_summary", titolo: "KPI Operativi", config: { categoria: "OPERATIVO" } },
      { tipo: "kpi_table", titolo: "DSO e DPO", config: { codici: ["DSO", "DPO", "TASSO_INSOLUTI"] } },
    ],
  },
  {
    tipo: "REPORT_ANNUALE",
    nome: "Report Annuale",
    descrizione: "CE + SP + KPI + trend + confronto YoY",
    destinatariDefault: ["ADMIN"],
    sezioni: [
      { tipo: "health_score", titolo: "Salute Azienda" },
      { tipo: "kpi_summary", titolo: "Tutti i KPI", config: {} },
      { tipo: "comparison", titolo: "Confronto Anno Precedente", config: { periodoTipo: "ANNO" } },
      { tipo: "text", titolo: "Narrativa AI", config: { aiGenerated: true } },
    ],
  },
  {
    tipo: "MULTI_CLIENTE",
    nome: "Dashboard Multi-Cliente",
    descrizione: "Dashboard aggregata con semafori per commercialista",
    destinatariDefault: ["COMMERCIALISTA"],
    sezioni: [
      { tipo: "health_score", titolo: "Panoramica Clienti" },
      { tipo: "alert_summary", titolo: "Alert Critici" },
    ],
  },
];

export function getReportTemplate(tipo: string): PredefinedReport | undefined {
  return PREDEFINED_REPORTS.find((r) => r.tipo === tipo);
}
