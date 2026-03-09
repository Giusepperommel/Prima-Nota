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

export type RendicontoData = {
  societa: {
    ragioneSociale: string;
    partitaIva: string;
    codiceFiscale: string;
  };
  periodo: { da: string; a: string };
  riepilogo: {
    fatturato: number;
    costi: number;
    ammortamento?: number;
    utile: number;
    numOperazioni: number;
  };
  dettaglioPerCategoria: {
    categoria: string;
    fatturato: number;
    costi: number;
    totale: number;
  }[];
  dettaglioAmmortamento?: {
    cespiteId: number;
    descrizione: string;
    valoreIniziale: number;
    aliquota: number;
    quotaAnnua: number;
    fondoAmmortamento: number;
    attribuzione: { nome: string; cognome: string; percentuale: number }[];
  }[];
  ripartizioneSoci: {
    socioId: number;
    nome: string;
    cognome: string;
    quotaPercentuale: number;
    fatturato: number;
    costi: number;
    ammortamento?: number;
    utile: number;
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
    marginBottom: 20,
    borderBottom: `2px solid ${colors.primary}`,
    paddingBottom: 10,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 4,
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
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 3,
    borderBottom: `1px solid ${colors.primary}`,
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
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: "row",
    minHeight: 20,
    alignItems: "center",
    borderBottom: `0.5px solid ${colors.border}`,
  },
  tableRowAlt: {
    flexDirection: "row",
    minHeight: 20,
    alignItems: "center",
    borderBottom: `0.5px solid ${colors.border}`,
    backgroundColor: colors.altRow,
  },
  tableCell: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tableCellBold: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontFamily: "Helvetica-Bold",
  },
  // Summary cards
  summaryRow: {
    flexDirection: "row",
    gap: 12,
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
  // Util
  textRight: {
    textAlign: "right",
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  data: RendicontoData;
};

export function RendicontoPdf({ data }: Props) {
  const { societa, periodo, riepilogo, dettaglioPerCategoria, dettaglioAmmortamento, ripartizioneSoci } =
    data;

  const utileColor = riepilogo.utile >= 0 ? colors.positive : colors.negative;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{societa.ragioneSociale}</Text>
          <Text style={styles.headerInfo}>
            P.IVA: {societa.partitaIva} | C.F.: {societa.codiceFiscale}
          </Text>
          <Text style={styles.periodText}>
            Rendiconto Societario: {fmtDate(periodo.da)} -{" "}
            {fmtDate(periodo.a)}
          </Text>
        </View>

        {/* Section 1: Riepilogo */}
        <Text style={styles.sectionTitle}>1. Riepilogo Generale</Text>
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
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>N. Operazioni</Text>
            <Text style={styles.summaryValue}>{riepilogo.numOperazioni}</Text>
          </View>
        </View>

        {/* Section 2: Dettaglio per Categoria */}
        <Text style={styles.sectionTitle}>2. Dettaglio per Categoria</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "40%" }]}>
              Categoria
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "20%", textAlign: "right" },
              ]}
            >
              Fatturato
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "20%", textAlign: "right" },
              ]}
            >
              Costi
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "20%", textAlign: "right" },
              ]}
            >
              Totale
            </Text>
          </View>
          {dettaglioPerCategoria.map((cat, i) => (
            <View
              key={i}
              style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
            >
              <Text style={[styles.tableCell, { width: "40%" }]}>
                {cat.categoria}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { width: "20%", textAlign: "right" },
                ]}
              >
                {fmtCurrency(cat.fatturato)}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { width: "20%", textAlign: "right" },
                ]}
              >
                {fmtCurrency(cat.costi)}
              </Text>
              <Text
                style={[
                  styles.tableCellBold,
                  {
                    width: "20%",
                    textAlign: "right",
                    color: cat.totale >= 0 ? colors.positive : colors.negative,
                  },
                ]}
              >
                {fmtCurrency(cat.totale)}
              </Text>
            </View>
          ))}
        </View>

        {/* Section 3: Ammortamento Cespiti */}
        {dettaglioAmmortamento && dettaglioAmmortamento.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>3. Ammortamento Cespiti</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: "30%" }]}>
                  Cespite
                </Text>
                <Text
                  style={[styles.tableHeaderCell, { width: "18%", textAlign: "right" }]}
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
                  Quota Periodo
                </Text>
                <Text style={[styles.tableHeaderCell, { width: "24%" }]}>
                  Attribuzione
                </Text>
              </View>
              {dettaglioAmmortamento.map((c, i) => (
                <View
                  key={c.cespiteId}
                  style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={[styles.tableCell, { width: "30%" }]}>
                    {c.descrizione}
                  </Text>
                  <Text
                    style={[styles.tableCell, { width: "18%", textAlign: "right" }]}
                  >
                    {fmtCurrency(c.valoreIniziale)}
                  </Text>
                  <Text
                    style={[styles.tableCell, { width: "12%", textAlign: "right" }]}
                  >
                    {fmtPerc(c.aliquota)}
                  </Text>
                  <Text
                    style={[styles.tableCellBold, { width: "16%", textAlign: "right" }]}
                  >
                    {fmtCurrency(c.quotaAnnua)}
                  </Text>
                  <Text style={[styles.tableCell, { width: "24%" }]}>
                    {c.attribuzione
                      .map((a) => `${a.cognome} ${a.nome}`)
                      .join(", ")}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Section 4: Ripartizione Soci */}
        <Text style={styles.sectionTitle}>
          {dettaglioAmmortamento && dettaglioAmmortamento.length > 0 ? "4" : "3"}. Ripartizione tra i Soci
        </Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "25%" }]}>
              Socio
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "15%", textAlign: "right" },
              ]}
            >
              Quota %
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "20%", textAlign: "right" },
              ]}
            >
              Fatturato
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "20%", textAlign: "right" },
              ]}
            >
              Costi
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "20%", textAlign: "right" },
              ]}
            >
              Utile/Perdita
            </Text>
          </View>
          {ripartizioneSoci.map((socio, i) => (
            <View
              key={socio.socioId}
              style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
            >
              <Text style={[styles.tableCell, { width: "25%" }]}>
                {socio.cognome} {socio.nome}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { width: "15%", textAlign: "right" },
                ]}
              >
                {fmtPerc(socio.quotaPercentuale)}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { width: "20%", textAlign: "right" },
                ]}
              >
                {fmtCurrency(socio.fatturato)}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { width: "20%", textAlign: "right" },
                ]}
              >
                {fmtCurrency(socio.costi)}
              </Text>
              <Text
                style={[
                  styles.tableCellBold,
                  {
                    width: "20%",
                    textAlign: "right",
                    color: socio.utile >= 0 ? colors.positive : colors.negative,
                  },
                ]}
              >
                {fmtCurrency(socio.utile)}
              </Text>
            </View>
          ))}
        </View>

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
