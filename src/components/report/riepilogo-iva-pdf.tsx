"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiepilogoIvaData = {
  anno: number;
  societa: { ragioneSociale: string; partitaIva: string; codiceFiscale: string };
  totali: {
    ivaDebito: number;
    ivaCredito: number;
    ivaIndetraibile: number;
    saldoIva: number;
  };
  andamentoMensile: Array<{
    mese: string;
    meseLabel: string;
    ivaDebito: number;
    ivaCredito: number;
    saldoIva: number;
  }>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `\u20AC ${formatted}`;
}

function today(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Styles (same palette as stima-fiscale-societa-pdf)
// ---------------------------------------------------------------------------

const colors = {
  primary: "#1e3a5f",
  headerBg: "#e8edf2",
  altRow: "#f7f8fa",
  border: "#cbd5e1",
  white: "#ffffff",
  text: "#1a1a1a",
  muted: "#64748b",
  positive: "#15803d",
  negative: "#dc2626",
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica", color: colors.text },
  header: { marginBottom: 20, borderBottom: `2px solid ${colors.primary}`, paddingBottom: 10 },
  companyName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: colors.primary, marginBottom: 4 },
  headerInfo: { fontSize: 8, color: colors.muted, marginBottom: 2 },
  titleText: { fontSize: 11, marginTop: 6, fontFamily: "Helvetica-Bold" },
  sectionTitle: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: colors.primary,
    marginTop: 16, marginBottom: 8, paddingBottom: 3, borderBottom: `1px solid ${colors.primary}`,
  },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  summaryCard: { flex: 1, backgroundColor: colors.headerBg, borderRadius: 4, padding: 10, borderLeft: `3px solid ${colors.primary}` },
  summaryLabel: { fontSize: 8, color: colors.muted, marginBottom: 3 },
  summaryValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: colors.primary },
  table: { width: "100%", marginBottom: 10 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: colors.primary, minHeight: 22, alignItems: "center" },
  tableHeaderCell: { color: colors.white, fontSize: 8, fontFamily: "Helvetica-Bold", paddingHorizontal: 6, paddingVertical: 5 },
  tableRow: { flexDirection: "row", minHeight: 20, alignItems: "center", borderBottom: `0.5px solid ${colors.border}` },
  tableRowAlt: { flexDirection: "row", minHeight: 20, alignItems: "center", borderBottom: `0.5px solid ${colors.border}`, backgroundColor: colors.altRow },
  tableRowTotal: { flexDirection: "row", minHeight: 24, alignItems: "center", borderTop: `2px solid ${colors.primary}`, backgroundColor: colors.headerBg },
  tableCell: { fontSize: 8, paddingHorizontal: 6, paddingVertical: 4 },
  tableCellBold: { fontSize: 8, paddingHorizontal: 6, paddingVertical: 4, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 20, left: 30, right: 30, borderTop: `1px solid ${colors.border}`, paddingTop: 6 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  footerText: { fontSize: 7, color: colors.muted },
  disclaimer: { fontSize: 7, color: colors.negative, fontFamily: "Helvetica-Oblique" },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RiepilogoIvaPdf({ data }: { data: RiepilogoIvaData }) {
  const { societa, anno, totali, andamentoMensile } = data;
  const saldoColor = totali.saldoIva > 0 ? colors.negative : colors.positive;
  const saldoLabel = totali.saldoIva > 0 ? "IVA Dovuta" : "IVA a Credito";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{societa.ragioneSociale}</Text>
          <Text style={styles.headerInfo}>
            P.IVA: {societa.partitaIva} | C.F.: {societa.codiceFiscale}
          </Text>
          <Text style={styles.titleText}>Riepilogo IVA - Anno {anno}</Text>
        </View>

        {/* Section 1: Riepilogo */}
        <Text style={styles.sectionTitle}>1. Riepilogo Annuale</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>IVA a Debito</Text>
            <Text style={styles.summaryValue}>{fmtCurrency(totali.ivaDebito)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>IVA a Credito</Text>
            <Text style={styles.summaryValue}>{fmtCurrency(totali.ivaCredito)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: saldoColor }]}>
            <Text style={styles.summaryLabel}>{saldoLabel}</Text>
            <Text style={[styles.summaryValue, { color: saldoColor }]}>
              {fmtCurrency(Math.abs(totali.saldoIva))}
            </Text>
          </View>
        </View>

        {/* Section 2: Dettaglio */}
        <Text style={styles.sectionTitle}>2. Dettaglio</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "60%" }]}>Voce</Text>
            <Text style={[styles.tableHeaderCell, { width: "40%", textAlign: "right" }]}>Importo</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "60%" }]}>IVA su fatture attive (debito)</Text>
            <Text style={[styles.tableCell, { width: "40%", textAlign: "right" }]}>{fmtCurrency(totali.ivaDebito)}</Text>
          </View>
          <View style={styles.tableRowAlt}>
            <Text style={[styles.tableCell, { width: "60%" }]}>IVA su costi detraibile (credito)</Text>
            <Text style={[styles.tableCell, { width: "40%", textAlign: "right" }]}>{fmtCurrency(totali.ivaCredito)}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "60%" }]}>IVA su costi indetraibile</Text>
            <Text style={[styles.tableCell, { width: "40%", textAlign: "right" }]}>{fmtCurrency(totali.ivaIndetraibile)}</Text>
          </View>
          <View style={styles.tableRowTotal}>
            <Text style={[styles.tableCellBold, { width: "60%" }]}>{saldoLabel}</Text>
            <Text style={[styles.tableCellBold, { width: "40%", textAlign: "right", color: saldoColor }]}>
              {fmtCurrency(Math.abs(totali.saldoIva))}
            </Text>
          </View>
        </View>

        {/* Section 3: Andamento Mensile */}
        <Text style={styles.sectionTitle}>3. Andamento Mensile</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "25%" }]}>Mese</Text>
            <Text style={[styles.tableHeaderCell, { width: "25%", textAlign: "right" }]}>IVA Debito</Text>
            <Text style={[styles.tableHeaderCell, { width: "25%", textAlign: "right" }]}>IVA Credito</Text>
            <Text style={[styles.tableHeaderCell, { width: "25%", textAlign: "right" }]}>Saldo</Text>
          </View>
          {andamentoMensile.map((m, i) => (
            <View key={m.mese} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { width: "25%" }]}>{m.meseLabel}</Text>
              <Text style={[styles.tableCell, { width: "25%", textAlign: "right" }]}>{fmtCurrency(m.ivaDebito)}</Text>
              <Text style={[styles.tableCell, { width: "25%", textAlign: "right" }]}>{fmtCurrency(m.ivaCredito)}</Text>
              <Text style={[styles.tableCellBold, { width: "25%", textAlign: "right", color: m.saldoIva > 0 ? colors.negative : colors.positive }]}>
                {fmtCurrency(Math.abs(m.saldoIva))}
              </Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text style={styles.disclaimer}>
              Riepilogo indicativo. Non sostituisce la liquidazione IVA ufficiale.
            </Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Generato da Prima Nota - {today()}</Text>
            <Text
              style={styles.footerText}
              render={({ pageNumber, totalPages }) =>
                `Pagina ${pageNumber} di ${totalPages}`
              }
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}
