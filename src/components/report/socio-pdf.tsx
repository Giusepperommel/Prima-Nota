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

export type SocioReportData = {
  socio: {
    nome: string;
    cognome: string;
    quotaPercentuale: number;
  };
  societa: {
    ragioneSociale: string;
  };
  periodo: { da: string; a: string };
  riepilogo: {
    fatturato: number;
    costi: number;
    ammortamento?: number;
    utile: number;
  };
  dettaglioOperazioni: {
    id: number;
    data: string;
    tipo: string;
    descrizione: string;
    importoTotale: number;
    importoSocio: number;
    percentuale: number;
    categoria: string;
  }[];
  dettaglioAmmortamento?: {
    cespiteId: number;
    descrizione: string;
    valoreIniziale: number;
    aliquota: number;
    quotaAnnua: number;
    percentualeSocio: number;
    quotaSocio: number;
  }[];
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

function fmtPerc(value: number): string {
  return (
    new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + "%"
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function today(): string {
  return fmtDate(new Date().toISOString());
}

const tipoLabel: Record<string, string> = {
  FATTURA_ATTIVA: "Fattura Attiva",
  COSTO: "Costo",
  SPESA: "Spesa",
  CESPITE: "Cespite",
};

// ---------------------------------------------------------------------------
// Styles
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
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: colors.text,
  },
  // Header
  header: {
    marginBottom: 16,
    borderBottom: `2px solid ${colors.primary}`,
    paddingBottom: 10,
  },
  companyName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 4,
  },
  socioName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  headerInfo: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 2,
  },
  periodText: {
    fontSize: 10,
    marginTop: 6,
    fontFamily: "Helvetica-Bold",
  },
  // Section
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginTop: 14,
    marginBottom: 8,
    paddingBottom: 3,
    borderBottom: `1px solid ${colors.primary}`,
  },
  // Summary
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.headerBg,
    borderRadius: 4,
    padding: 10,
    borderLeft: `3px solid ${colors.primary}`,
  },
  summaryLabel: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 3,
  },
  summaryValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  // Table
  table: {
    width: "100%",
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    minHeight: 22,
    alignItems: "center",
  },
  tableHeaderCell: {
    color: colors.white,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 4,
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: "row",
    minHeight: 18,
    alignItems: "center",
    borderBottom: `0.5px solid ${colors.border}`,
  },
  tableRowAlt: {
    flexDirection: "row",
    minHeight: 18,
    alignItems: "center",
    borderBottom: `0.5px solid ${colors.border}`,
    backgroundColor: colors.altRow,
  },
  tableCell: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  tableCellBold: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 3,
    fontFamily: "Helvetica-Bold",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    borderTop: `1px solid ${colors.border}`,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: colors.muted,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  data: SocioReportData;
};

export function SocioPdf({ data }: Props) {
  const { socio, societa, periodo, riepilogo, dettaglioOperazioni, dettaglioAmmortamento } = data;

  const utileColor = riepilogo.utile >= 0 ? colors.positive : colors.negative;

  return (
    <Document>
      <Page size="A4" orientation="portrait" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header} fixed>
          <Text style={styles.companyName}>{societa.ragioneSociale}</Text>
          <Text style={styles.socioName}>
            Report Socio: {socio.cognome} {socio.nome}
          </Text>
          <Text style={styles.headerInfo}>
            Quota societaria: {fmtPerc(socio.quotaPercentuale)}
          </Text>
          <Text style={styles.periodText}>
            Periodo: {fmtDate(periodo.da)} - {fmtDate(periodo.a)}
          </Text>
        </View>

        {/* Section 1: Riepilogo */}
        <Text style={styles.sectionTitle}>1. Riepilogo</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Fatturato</Text>
            <Text style={styles.summaryValue}>
              {fmtCurrency(riepilogo.fatturato)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Costi</Text>
            <Text style={styles.summaryValue}>
              {fmtCurrency(riepilogo.costi)}
            </Text>
            {(riepilogo.ammortamento ?? 0) > 0 && (
              <Text style={{ fontSize: 7, color: colors.muted, marginTop: 2 }}>
                di cui amm.to: {fmtCurrency(riepilogo.ammortamento!)}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.summaryCard,
              { borderLeftColor: utileColor },
            ]}
          >
            <Text style={styles.summaryLabel}>
              {riepilogo.utile >= 0 ? "Utile" : "Perdita"}
            </Text>
            <Text style={[styles.summaryValue, { color: utileColor }]}>
              {fmtCurrency(riepilogo.utile)}
            </Text>
          </View>
        </View>

        {/* Section 2: Dettaglio Operazioni */}
        <Text style={styles.sectionTitle}>2. Dettaglio Operazioni</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={[styles.tableHeaderCell, { width: "10%" }]}>
              Data
            </Text>
            <Text style={[styles.tableHeaderCell, { width: "12%" }]}>
              Tipo
            </Text>
            <Text style={[styles.tableHeaderCell, { width: "26%" }]}>
              Descrizione
            </Text>
            <Text style={[styles.tableHeaderCell, { width: "12%" }]}>
              Categoria
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "14%", textAlign: "right" },
              ]}
            >
              Imp. Totale
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "10%", textAlign: "right" },
              ]}
            >
              % Socio
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "16%", textAlign: "right" },
              ]}
            >
              Imp. Socio
            </Text>
          </View>
          {dettaglioOperazioni.map((op, i) => (
            <View
              key={op.id}
              style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              wrap={false}
            >
              <Text style={[styles.tableCell, { width: "10%" }]}>
                {fmtDate(op.data)}
              </Text>
              <Text style={[styles.tableCell, { width: "12%" }]}>
                {tipoLabel[op.tipo] || op.tipo}
              </Text>
              <Text style={[styles.tableCell, { width: "26%" }]}>
                {op.descrizione.length > 40
                  ? op.descrizione.substring(0, 40) + "..."
                  : op.descrizione}
              </Text>
              <Text style={[styles.tableCell, { width: "12%" }]}>
                {op.categoria}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { width: "14%", textAlign: "right" },
                ]}
              >
                {fmtCurrency(op.importoTotale)}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { width: "10%", textAlign: "right" },
                ]}
              >
                {fmtPerc(op.percentuale)}
              </Text>
              <Text
                style={[
                  styles.tableCellBold,
                  { width: "16%", textAlign: "right" },
                ]}
              >
                {fmtCurrency(op.importoSocio)}
              </Text>
            </View>
          ))}
        </View>

        {/* Section 3: Ammortamento Cespiti */}
        {dettaglioAmmortamento && dettaglioAmmortamento.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>3. Ammortamento Cespiti</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow} fixed>
                <Text style={[styles.tableHeaderCell, { width: "24%" }]}>
                  Cespite
                </Text>
                <Text
                  style={[styles.tableHeaderCell, { width: "16%", textAlign: "right" }]}
                >
                  Valore Iniziale
                </Text>
                <Text
                  style={[styles.tableHeaderCell, { width: "12%", textAlign: "right" }]}
                >
                  Aliquota
                </Text>
                <Text
                  style={[styles.tableHeaderCell, { width: "16%", textAlign: "right" }]}
                >
                  Quota Annua
                </Text>
                <Text
                  style={[styles.tableHeaderCell, { width: "14%", textAlign: "right" }]}
                >
                  % Socio
                </Text>
                <Text
                  style={[styles.tableHeaderCell, { width: "18%", textAlign: "right" }]}
                >
                  Quota Socio
                </Text>
              </View>
              {dettaglioAmmortamento.map((c, i) => (
                <View
                  key={c.cespiteId}
                  style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, { width: "24%" }]}>
                    {c.descrizione.length > 30
                      ? c.descrizione.substring(0, 30) + "..."
                      : c.descrizione}
                  </Text>
                  <Text
                    style={[styles.tableCell, { width: "16%", textAlign: "right" }]}
                  >
                    {fmtCurrency(c.valoreIniziale)}
                  </Text>
                  <Text
                    style={[styles.tableCell, { width: "12%", textAlign: "right" }]}
                  >
                    {fmtPerc(c.aliquota)}
                  </Text>
                  <Text
                    style={[styles.tableCell, { width: "16%", textAlign: "right" }]}
                  >
                    {fmtCurrency(c.quotaAnnua)}
                  </Text>
                  <Text
                    style={[styles.tableCell, { width: "14%", textAlign: "right" }]}
                  >
                    {fmtPerc(c.percentualeSocio)}
                  </Text>
                  <Text
                    style={[styles.tableCellBold, { width: "18%", textAlign: "right" }]}
                  >
                    {fmtCurrency(c.quotaSocio)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generato da Prima Nota - {today()}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Pagina ${pageNumber} di ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
