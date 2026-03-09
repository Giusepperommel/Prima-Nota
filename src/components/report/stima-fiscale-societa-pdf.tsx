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

type DettaglioScaglione = {
  scaglione: string;
  imponibile: number;
  imposta: number;
  aliquota: number;
};

type DettaglioSocioFiscale = {
  socioId: number;
  nome: string;
  cognome: string;
  quotaPercentuale: number;
  quotaUtile: number;
  ritenutaDividendi: number;
  irpef: number;
  dettaglioIrpef: DettaglioScaglione[];
  inps: number;
  totaleCaricoFiscale: number;
  nettoStimato: number;
};

export type StimaFiscaleSocietaData = {
  societa: {
    ragioneSociale: string;
    partitaIva: string;
    codiceFiscale: string;
  };
  anno: number;
  regime: "ORDINARIO" | "TRASPARENZA";
  utileAnteImposte: number;
  fatturato: number;
  costi: number;
  ires: number;
  irap: number;
  aliquotaIrap: number;
  totaleImposteSocieta: number;
  utileDopoImposte: number;
  dettaglioSoci: DettaglioSocioFiscale[];
  riepilogoComplessivo: {
    totaleImposteSocieta: number;
    totaleCaricoSoci: number;
    pressioneFiscaleEffettiva: number;
  };
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

function today(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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
  warning: "#d97706",
};

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: colors.text,
  },
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
  titleText: {
    fontSize: 11,
    marginTop: 6,
    fontFamily: "Helvetica-Bold",
  },
  regimeBadge: {
    fontSize: 8,
    marginTop: 4,
    color: colors.primary,
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 3,
    borderBottom: `1px solid ${colors.primary}`,
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
  tableRowTotal: {
    flexDirection: "row",
    minHeight: 24,
    alignItems: "center",
    borderTop: `2px solid ${colors.primary}`,
    backgroundColor: colors.headerBg,
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
  // Riepilogo box
  riepilogoBox: {
    marginTop: 12,
    backgroundColor: colors.headerBg,
    borderRadius: 4,
    padding: 12,
    borderLeft: `3px solid ${colors.primary}`,
  },
  riepilogoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  riepilogoLabel: {
    fontSize: 9,
    color: colors.muted,
  },
  riepilogoValue: {
    fontSize: 9,
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
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  footerText: {
    fontSize: 7,
    color: colors.muted,
  },
  disclaimer: {
    fontSize: 7,
    color: colors.negative,
    fontFamily: "Helvetica-Oblique",
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  data: StimaFiscaleSocietaData;
};

export function StimaFiscaleSocietaPdf({ data }: Props) {
  const {
    societa,
    anno,
    regime,
    utileAnteImposte,
    fatturato,
    costi,
    ires,
    irap,
    aliquotaIrap,
    totaleImposteSocieta,
    utileDopoImposte,
    dettaglioSoci,
    riepilogoComplessivo,
  } = data;

  const regimeLabel =
    regime === "TRASPARENZA"
      ? "Trasparenza Fiscale (Art. 116 TUIR)"
      : "Ordinario (IRES)";

  const utileColor = utileAnteImposte >= 0 ? colors.positive : colors.negative;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{societa.ragioneSociale}</Text>
          <Text style={styles.headerInfo}>
            P.IVA: {societa.partitaIva} | C.F.: {societa.codiceFiscale}
          </Text>
          <Text style={styles.titleText}>
            Stima Fiscale Societaria - Anno {anno}
          </Text>
          <Text style={styles.regimeBadge}>Regime: {regimeLabel}</Text>
        </View>

        {/* Section 1: Riepilogo */}
        <Text style={styles.sectionTitle}>1. Riepilogo Economico</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Fatturato</Text>
            <Text style={styles.summaryValue}>{fmtCurrency(fatturato)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Costi</Text>
            <Text style={styles.summaryValue}>{fmtCurrency(costi)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: utileColor }]}>
            <Text style={styles.summaryLabel}>
              {utileAnteImposte >= 0 ? "Utile Ante Imposte" : "Perdita"}
            </Text>
            <Text style={[styles.summaryValue, { color: utileColor }]}>
              {fmtCurrency(utileAnteImposte)}
            </Text>
          </View>
        </View>

        {/* Section 2: Dettaglio Imposte Societa */}
        <Text style={styles.sectionTitle}>2. Dettaglio Imposte Societa</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "30%" }]}>
              Voce
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "25%", textAlign: "right" },
              ]}
            >
              Base Imponibile
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "20%", textAlign: "right" },
              ]}
            >
              Aliquota
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "25%", textAlign: "right" },
              ]}
            >
              Importo
            </Text>
          </View>
          {/* IRES */}
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "30%" }]}>IRES</Text>
            <Text
              style={[styles.tableCell, { width: "25%", textAlign: "right" }]}
            >
              {regime === "ORDINARIO" ? fmtCurrency(utileAnteImposte) : "-"}
            </Text>
            <Text
              style={[styles.tableCell, { width: "20%", textAlign: "right" }]}
            >
              {regime === "ORDINARIO" ? "24,00%" : "-"}
            </Text>
            <Text
              style={[
                styles.tableCellBold,
                { width: "25%", textAlign: "right" },
              ]}
            >
              {regime === "ORDINARIO"
                ? fmtCurrency(ires)
                : "N/A - Trasparenza"}
            </Text>
          </View>
          {/* IRAP */}
          <View style={styles.tableRowAlt}>
            <Text style={[styles.tableCell, { width: "30%" }]}>IRAP</Text>
            <Text
              style={[styles.tableCell, { width: "25%", textAlign: "right" }]}
            >
              {fmtCurrency(utileAnteImposte)}
            </Text>
            <Text
              style={[styles.tableCell, { width: "20%", textAlign: "right" }]}
            >
              {fmtPerc(aliquotaIrap)}
            </Text>
            <Text
              style={[
                styles.tableCellBold,
                { width: "25%", textAlign: "right" },
              ]}
            >
              {fmtCurrency(irap)}
            </Text>
          </View>
          {/* Total */}
          <View style={styles.tableRowTotal}>
            <Text style={[styles.tableCellBold, { width: "30%" }]}>
              Totale Imposte
            </Text>
            <Text
              style={[styles.tableCell, { width: "25%", textAlign: "right" }]}
            />
            <Text
              style={[styles.tableCell, { width: "20%", textAlign: "right" }]}
            />
            <Text
              style={[
                styles.tableCellBold,
                {
                  width: "25%",
                  textAlign: "right",
                  color: colors.negative,
                },
              ]}
            >
              {fmtCurrency(totaleImposteSocieta)}
            </Text>
          </View>
        </View>

        {/* Utile dopo imposte */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            marginBottom: 4,
          }}
        >
          <Text style={{ fontSize: 9, color: colors.muted, marginRight: 8 }}>
            Utile dopo imposte societa:
          </Text>
          <Text
            style={{
              fontSize: 10,
              fontFamily: "Helvetica-Bold",
              color: utileDopoImposte >= 0 ? colors.positive : colors.negative,
            }}
          >
            {fmtCurrency(utileDopoImposte)}
          </Text>
        </View>

        {/* Section 3: Carico per Socio */}
        {dettaglioSoci.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              3. Carico Fiscale per Socio
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: "18%" }]}>
                  Socio
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { width: "10%", textAlign: "right" },
                  ]}
                >
                  Quota %
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { width: "15%", textAlign: "right" },
                  ]}
                >
                  Quota Utile
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { width: "15%", textAlign: "right" },
                  ]}
                >
                  {regime === "ORDINARIO" ? "Rit. Div." : "IRPEF"}
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { width: "12%", textAlign: "right" },
                  ]}
                >
                  INPS
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { width: "15%", textAlign: "right" },
                  ]}
                >
                  Carico Tot.
                </Text>
                <Text
                  style={[
                    styles.tableHeaderCell,
                    { width: "15%", textAlign: "right" },
                  ]}
                >
                  Netto
                </Text>
              </View>
              {dettaglioSoci.map((s, i) => (
                <View
                  key={s.socioId}
                  style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={[styles.tableCell, { width: "18%" }]}>
                    {s.cognome} {s.nome}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { width: "10%", textAlign: "right" },
                    ]}
                  >
                    {fmtPerc(s.quotaPercentuale)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      { width: "15%", textAlign: "right" },
                    ]}
                  >
                    {fmtCurrency(s.quotaUtile)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      {
                        width: "15%",
                        textAlign: "right",
                        color: colors.negative,
                      },
                    ]}
                  >
                    {regime === "ORDINARIO"
                      ? fmtCurrency(s.ritenutaDividendi)
                      : fmtCurrency(s.irpef)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCell,
                      {
                        width: "12%",
                        textAlign: "right",
                        color: s.inps > 0 ? colors.warning : colors.text,
                      },
                    ]}
                  >
                    {s.inps > 0 ? fmtCurrency(s.inps) : "-"}
                  </Text>
                  <Text
                    style={[
                      styles.tableCellBold,
                      {
                        width: "15%",
                        textAlign: "right",
                        color: colors.negative,
                      },
                    ]}
                  >
                    {fmtCurrency(s.totaleCaricoFiscale)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCellBold,
                      {
                        width: "15%",
                        textAlign: "right",
                        color: colors.positive,
                      },
                    ]}
                  >
                    {fmtCurrency(s.nettoStimato)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Dettaglio scaglioni IRPEF per trasparenza */}
            {regime === "TRASPARENZA" &&
              dettaglioSoci
                .filter((s) => s.dettaglioIrpef.length > 0)
                .map((s) => (
                  <View key={`irpef-${s.socioId}`} style={{ marginBottom: 8 }}>
                    <Text
                      style={{
                        fontSize: 8,
                        fontFamily: "Helvetica-Bold",
                        color: colors.primary,
                        marginBottom: 4,
                      }}
                    >
                      Scaglioni IRPEF - {s.cognome} {s.nome}
                    </Text>
                    <View style={styles.table}>
                      <View
                        style={[
                          styles.tableHeaderRow,
                          { backgroundColor: colors.muted },
                        ]}
                      >
                        <Text
                          style={[styles.tableHeaderCell, { width: "35%" }]}
                        >
                          Scaglione
                        </Text>
                        <Text
                          style={[
                            styles.tableHeaderCell,
                            { width: "25%", textAlign: "right" },
                          ]}
                        >
                          Imponibile
                        </Text>
                        <Text
                          style={[
                            styles.tableHeaderCell,
                            { width: "15%", textAlign: "right" },
                          ]}
                        >
                          Aliquota
                        </Text>
                        <Text
                          style={[
                            styles.tableHeaderCell,
                            { width: "25%", textAlign: "right" },
                          ]}
                        >
                          Imposta
                        </Text>
                      </View>
                      {s.dettaglioIrpef.map((scag, j) => (
                        <View
                          key={j}
                          style={
                            j % 2 === 0 ? styles.tableRow : styles.tableRowAlt
                          }
                        >
                          <Text
                            style={[styles.tableCell, { width: "35%" }]}
                          >
                            {scag.scaglione}
                          </Text>
                          <Text
                            style={[
                              styles.tableCell,
                              { width: "25%", textAlign: "right" },
                            ]}
                          >
                            {fmtCurrency(scag.imponibile)}
                          </Text>
                          <Text
                            style={[
                              styles.tableCell,
                              { width: "15%", textAlign: "right" },
                            ]}
                          >
                            {fmtPerc(scag.aliquota)}
                          </Text>
                          <Text
                            style={[
                              styles.tableCellBold,
                              { width: "25%", textAlign: "right" },
                            ]}
                          >
                            {fmtCurrency(scag.imposta)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
          </>
        )}

        {/* Section 4: Riepilogo Complessivo */}
        <Text style={styles.sectionTitle}>
          {dettaglioSoci.length > 0 ? "4" : "3"}. Riepilogo Complessivo
        </Text>
        <View style={styles.riepilogoBox}>
          <View style={styles.riepilogoRow}>
            <Text style={styles.riepilogoLabel}>
              Totale Imposte Societa (IRES + IRAP)
            </Text>
            <Text style={[styles.riepilogoValue, { color: colors.negative }]}>
              {fmtCurrency(riepilogoComplessivo.totaleImposteSocieta)}
            </Text>
          </View>
          <View style={styles.riepilogoRow}>
            <Text style={styles.riepilogoLabel}>
              Totale Carico Soci (Ritenute/IRPEF + INPS)
            </Text>
            <Text style={[styles.riepilogoValue, { color: colors.negative }]}>
              {fmtCurrency(riepilogoComplessivo.totaleCaricoSoci)}
            </Text>
          </View>
          <View
            style={[
              styles.riepilogoRow,
              {
                borderTop: `1px solid ${colors.border}`,
                paddingTop: 6,
                marginTop: 4,
              },
            ]}
          >
            <Text
              style={[
                styles.riepilogoLabel,
                { fontFamily: "Helvetica-Bold", color: colors.text },
              ]}
            >
              Pressione Fiscale Effettiva
            </Text>
            <Text
              style={[
                styles.riepilogoValue,
                { fontSize: 11, color: colors.primary },
              ]}
            >
              {fmtPerc(riepilogoComplessivo.pressioneFiscaleEffettiva)}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text style={styles.disclaimer}>
              Stima indicativa a fini di pianificazione. Non sostituisce la
              consulenza del commercialista.
            </Text>
          </View>
          <View style={styles.footerRow}>
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
        </View>
      </Page>
    </Document>
  );
}
