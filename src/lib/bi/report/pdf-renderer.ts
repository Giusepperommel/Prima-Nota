// src/lib/bi/report/pdf-renderer.ts
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import React from "react";
import type { GeneratedReportData } from "./generator";

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------
const colors = {
  primary: "#1e3a5f",
  headerBg: "#e8edf2",
  positive: "#15803d",
  negative: "#dc2626",
  border: "#e5e7eb",
  altRow: "#f7f8fa",
  muted: "#9ca3af",
  text: "#111827",
  white: "#ffffff",
  // Alert severity
  critical: "#dc2626",
  warning: "#f59e0b",
  info: "#3b82f6",
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: colors.text },
  header: { marginBottom: 20, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingBottom: 10 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: colors.primary, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#6b7280", marginBottom: 2 },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingBottom: 4,
  },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6" },
  label: { flex: 1, fontSize: 10 },
  value: { width: 100, textAlign: "right", fontSize: 10, fontFamily: "Helvetica-Bold" },
  // Comparison table
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    minHeight: 20,
    alignItems: "center",
  },
  tableHeaderCell: {
    color: colors.white,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: "row",
    minHeight: 18,
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    flexDirection: "row",
    minHeight: 18,
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.altRow,
  },
  tableCell: { fontSize: 8, paddingHorizontal: 6, paddingVertical: 3 },
  tableCellBold: { fontSize: 8, paddingHorizontal: 6, paddingVertical: 3, fontFamily: "Helvetica-Bold" },
  // Alert badges
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f6",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 8,
  },
  badgeText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.white },
  // Footer with page numbers
  footer: {
    position: "absolute",
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: colors.muted },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmtNumber(n: number): string {
  return Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPerc(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function severityColor(gravita: string): string {
  if (gravita === "CRITICAL") return colors.critical;
  if (gravita === "WARNING") return colors.warning;
  return colors.info;
}

function severityLabel(gravita: string): string {
  if (gravita === "CRITICAL") return "CRITICO";
  if (gravita === "WARNING") return "AVVISO";
  return "INFO";
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function KpiSection({ titolo, dati }: { titolo: string; dati: any[] }) {
  if (!Array.isArray(dati) || dati.length === 0) return null;
  return React.createElement(View, { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, titolo),
    ...dati.map((kpi: any, i: number) =>
      React.createElement(View, { key: i, style: styles.row },
        React.createElement(Text, { style: styles.label }, kpi.nome || kpi.codice || String(kpi.titolo || "")),
        React.createElement(Text, { style: styles.value },
          kpi.valore != null ? `${fmtNumber(kpi.valore)} ${kpi.unita || ""}`.trim() : "—"
        ),
        // Show trend arrow if available
        kpi.variazione != null
          ? React.createElement(Text, {
              style: {
                width: 60,
                textAlign: "right",
                fontSize: 8,
                color: kpi.variazione > 0 ? colors.positive : kpi.variazione < 0 ? colors.negative : colors.muted,
              },
            }, fmtPerc(kpi.variazione))
          : null
      )
    )
  );
}

function TextSection({ titolo, dati }: { titolo: string; dati: any }) {
  return React.createElement(View, { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, titolo),
    React.createElement(Text, { style: { fontSize: 10, lineHeight: 1.5 } }, dati?.narrativaAI || dati?.testo || "")
  );
}

function ComparisonSection({ titolo, dati }: { titolo: string; dati: any }) {
  if (!dati || !dati.righe || !Array.isArray(dati.righe) || dati.righe.length === 0) return null;

  const righe: Array<{
    label: string;
    valoreCorrente: number;
    valorePrecedente: number;
    delta: number;
    deltaPerc: number | null;
  }> = dati.righe;

  return React.createElement(View, { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, titolo),
    // Sub-header with period labels
    dati.periodoCorrente && dati.periodoPrecedente
      ? React.createElement(Text, {
          style: { fontSize: 8, color: colors.muted, marginBottom: 6 },
        }, `${dati.periodoPrecedente}  vs  ${dati.periodoCorrente}`)
      : null,
    // Table header
    React.createElement(View, { style: styles.tableHeaderRow },
      React.createElement(Text, { style: [styles.tableHeaderCell, { width: "30%" }] }, "Voce"),
      React.createElement(Text, { style: [styles.tableHeaderCell, { width: "20%", textAlign: "right" }] }, "Precedente"),
      React.createElement(Text, { style: [styles.tableHeaderCell, { width: "20%", textAlign: "right" }] }, "Corrente"),
      React.createElement(Text, { style: [styles.tableHeaderCell, { width: "15%", textAlign: "right" }] }, "Delta"),
      React.createElement(Text, { style: [styles.tableHeaderCell, { width: "15%", textAlign: "right" }] }, "Delta %"),
    ),
    // Table rows
    ...righe.map((riga, i) => {
      const deltaColor = riga.delta > 0 ? colors.positive : riga.delta < 0 ? colors.negative : colors.text;
      return React.createElement(View, { key: i, style: i % 2 === 0 ? styles.tableRow : styles.tableRowAlt },
        React.createElement(Text, { style: [styles.tableCellBold, { width: "30%" }] }, riga.label),
        React.createElement(Text, { style: [styles.tableCell, { width: "20%", textAlign: "right" }] }, fmtNumber(riga.valorePrecedente)),
        React.createElement(Text, { style: [styles.tableCell, { width: "20%", textAlign: "right" }] }, fmtNumber(riga.valoreCorrente)),
        React.createElement(Text, { style: [styles.tableCellBold, { width: "15%", textAlign: "right", color: deltaColor }] }, fmtNumber(riga.delta)),
        React.createElement(Text, { style: [styles.tableCell, { width: "15%", textAlign: "right", color: deltaColor }] }, fmtPerc(riga.deltaPerc)),
      );
    }),
    // Summary row if available
    dati.sommario
      ? React.createElement(View, {
          style: { flexDirection: "row", marginTop: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.primary },
        },
          React.createElement(Text, { style: [styles.tableCellBold, { width: "30%" }] }, "Riepilogo"),
          React.createElement(Text, {
            style: [styles.tableCellBold, { width: "23.3%", textAlign: "right", color: dati.sommario.deltaRicavi >= 0 ? colors.positive : colors.negative }],
          }, `Ricavi: ${fmtNumber(dati.sommario.deltaRicavi)}`),
          React.createElement(Text, {
            style: [styles.tableCellBold, { width: "23.3%", textAlign: "right", color: dati.sommario.deltaCosti <= 0 ? colors.positive : colors.negative }],
          }, `Costi: ${fmtNumber(dati.sommario.deltaCosti)}`),
          React.createElement(Text, {
            style: [styles.tableCellBold, { width: "23.3%", textAlign: "right", color: dati.sommario.deltaMargine >= 0 ? colors.positive : colors.negative }],
          }, `Margine: ${fmtNumber(dati.sommario.deltaMargine)}`),
        )
      : null,
  );
}

function AlertSection({ titolo, dati }: { titolo: string; dati: any[] }) {
  if (!Array.isArray(dati) || dati.length === 0) return null;

  return React.createElement(View, { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, titolo),
    ...dati.map((alert: any, i: number) => {
      const bgColor = severityColor(alert.gravita || "INFO");
      return React.createElement(View, { key: i, style: styles.alertRow },
        // Severity badge
        React.createElement(View, { style: [styles.badge, { backgroundColor: bgColor }] },
          React.createElement(Text, { style: styles.badgeText }, severityLabel(alert.gravita || "INFO"))
        ),
        // Alert message
        React.createElement(Text, { style: { flex: 1, fontSize: 9 } }, alert.messaggio || ""),
        // Alert type
        React.createElement(Text, { style: { width: 80, fontSize: 7, textAlign: "right", color: colors.muted } }, alert.tipo || ""),
      );
    })
  );
}

function HealthScoreSection({ titolo, dati }: { titolo: string; dati: any }) {
  if (!dati) return null;
  const score = dati.punteggio ?? dati.score ?? null;
  if (score == null) return null;

  const scoreColor = score >= 70 ? colors.positive : score >= 40 ? colors.warning : colors.negative;

  return React.createElement(View, { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, titolo),
    React.createElement(View, { style: { flexDirection: "row", alignItems: "center", marginBottom: 8 } },
      React.createElement(View, {
        style: {
          width: 50, height: 50, borderRadius: 25,
          backgroundColor: scoreColor, justifyContent: "center", alignItems: "center", marginRight: 12,
        },
      },
        React.createElement(Text, { style: { fontSize: 18, fontFamily: "Helvetica-Bold", color: colors.white } }, String(Math.round(score)))
      ),
      React.createElement(Text, { style: { fontSize: 12 } }, `Health Score: ${Math.round(score)}/100`)
    )
  );
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

function ReportDocument({ data, societaNome }: { data: GeneratedReportData; societaNome: string }) {
  return React.createElement(Document, {},
    React.createElement(Page, { size: "A4", style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.title }, societaNome),
        React.createElement(Text, { style: styles.subtitle }, `Periodo: ${data.periodo}`),
        React.createElement(Text, { style: { fontSize: 8, color: colors.muted } },
          `Generato: ${new Date(data.generatoAt).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })}`
        )
      ),
      // Sections
      ...data.sezioni.map((sezione, i) => {
        switch (sezione.tipo) {
          case "text":
            return React.createElement(TextSection, { key: i, titolo: sezione.titolo, dati: sezione.dati });
          case "comparison":
            return React.createElement(ComparisonSection, { key: i, titolo: sezione.titolo, dati: sezione.dati });
          case "alert_summary":
            return React.createElement(AlertSection, { key: i, titolo: sezione.titolo, dati: Array.isArray(sezione.dati) ? sezione.dati : [] });
          case "health_score":
            return React.createElement(HealthScoreSection, { key: i, titolo: sezione.titolo, dati: sezione.dati });
          case "kpi_summary":
          case "kpi_table":
          default:
            return React.createElement(KpiSection, { key: i, titolo: sezione.titolo, dati: Array.isArray(sezione.dati) ? sezione.dati : [] });
        }
      }),
      // Footer with page numbers
      React.createElement(View, { style: styles.footer, fixed: true } as any,
        React.createElement(Text, { style: styles.footerText },
          `Prima Nota — Report generato il ${new Date().toLocaleDateString("it-IT")}`
        ),
        React.createElement(Text, {
          style: styles.footerText,
          render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `Pagina ${pageNumber} di ${totalPages}`,
        } as any)
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function renderReportToPdf(data: GeneratedReportData, societaNome: string): Promise<Buffer> {
  const doc = React.createElement(ReportDocument, { data, societaNome });
  const buffer = await renderToBuffer(doc as any);
  return Buffer.from(buffer);
}
