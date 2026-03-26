// src/lib/bi/report/pdf-renderer.ts
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import React from "react";
import type { GeneratedReportData } from "./generator";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  header: { marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 12, color: "#6b7280", marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6" },
  label: { flex: 1, fontSize: 10 },
  value: { width: 100, textAlign: "right", fontSize: 10, fontWeight: "bold" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#9ca3af" },
});

function KpiSection({ titolo, dati }: { titolo: string; dati: any[] }) {
  if (!Array.isArray(dati) || dati.length === 0) return null;
  return React.createElement(View, { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, titolo),
    ...dati.map((kpi: any, i: number) =>
      React.createElement(View, { key: i, style: styles.row },
        React.createElement(Text, { style: styles.label }, kpi.nome || kpi.codice || String(kpi.titolo || "")),
        React.createElement(Text, { style: styles.value },
          kpi.valore != null ? `${Number(kpi.valore).toLocaleString("it-IT")} ${kpi.unita || ""}`.trim() : "—"
        )
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

function ReportDocument({ data, societaNome }: { data: GeneratedReportData; societaNome: string }) {
  return React.createElement(Document, {},
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.title }, societaNome),
        React.createElement(Text, { style: styles.subtitle }, `Periodo: ${data.periodo} — Generato: ${new Date(data.generatoAt).toLocaleDateString("it-IT")}`)
      ),
      ...data.sezioni.map((sezione, i) => {
        if (sezione.tipo === "text") {
          return React.createElement(TextSection, { key: i, titolo: sezione.titolo, dati: sezione.dati });
        }
        return React.createElement(KpiSection, { key: i, titolo: sezione.titolo, dati: Array.isArray(sezione.dati) ? sezione.dati : [] });
      }),
      React.createElement(Text, { style: styles.footer }, `Prima Nota — Report generato automaticamente il ${new Date().toLocaleDateString("it-IT")}`)
    )
  );
}

export async function renderReportToPdf(data: GeneratedReportData, societaNome: string): Promise<Buffer> {
  const doc = React.createElement(ReportDocument, { data, societaNome });
  const buffer = await renderToBuffer(doc as any);
  return Buffer.from(buffer);
}
