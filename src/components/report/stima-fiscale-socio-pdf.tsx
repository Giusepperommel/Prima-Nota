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

export type StimaFiscaleSocioData = {
  societa: {
    ragioneSociale: string;
  };
  anno: number;
  regime: "ORDINARIO" | "TRASPARENZA";
  socio: {
    nome: string;
    cognome: string;
    quotaPercentuale: number;
    socioLavoratore: boolean;
  };
  fatturato: number;
  costi: number;
  ammortamento: number;
  utileAnteImposte: number;
  iresProQuota: number;
  irapProQuota: number;
  totaleImposteSocietaProQuota: number;
  utileDopoImposteSocieta: number;
  ritenutaDividendi: number;
  irpef: number;
  dettaglioIrpef: DettaglioScaglione[];
  inps: number;
  totaleCaricoFiscalePersonale: number;
  nettoStimato: number;
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
  violet: "#7c3aed",
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
  titleText: {
    fontSize: 11,
    marginTop: 6,
    fontFamily: "Helvetica-Bold",
  },
  socioInfo: {
    fontSize: 10,
    marginTop: 4,
    color: colors.text,
  },
  socioDetail: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 2,
  },
  lavoratoreBadge: {
    fontSize: 7,
    color: colors.violet,
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
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
  data: StimaFiscaleSocioData;
};

export function StimaFiscaleSocioPdf({ data }: Props) {
  const {
    societa,
    anno,
    regime,
    socio,
    fatturato,
    costi,
    ammortamento,
    utileAnteImposte,
    iresProQuota,
    irapProQuota,
    totaleImposteSocietaProQuota,
    utileDopoImposteSocieta,
    ritenutaDividendi,
    irpef,
    dettaglioIrpef,
    inps,
    totaleCaricoFiscalePersonale,
    nettoStimato,
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
          <Text style={styles.titleText}>
            Stima Fiscale per Socio - Anno {anno}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 6,
            }}
          >
            <Text style={styles.socioInfo}>
              {socio.cognome} {socio.nome} - Quota: {fmtPerc(socio.quotaPercentuale)}
            </Text>
            {socio.socioLavoratore && (
              <Text style={styles.lavoratoreBadge}>LAVORATORE</Text>
            )}
          </View>
          <Text style={styles.regimeBadge}>Regime: {regimeLabel}</Text>
        </View>

        {/* Section 1: Riepilogo Economico */}
        <Text style={styles.sectionTitle}>
          1. Riepilogo Economico del Socio
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Fatturato</Text>
            <Text style={styles.summaryValue}>{fmtCurrency(fatturato)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Costi</Text>
            <Text style={styles.summaryValue}>{fmtCurrency(costi)}</Text>
            {ammortamento > 0 && (
              <Text style={{ fontSize: 7, color: colors.muted, marginTop: 2 }}>
                di cui amm.to: {fmtCurrency(ammortamento)}
              </Text>
            )}
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: utileColor }]}>
            <Text style={styles.summaryLabel}>
              {utileAnteImposte >= 0 ? "Utile Ante Imposte" : "Perdita"}
            </Text>
            <Text style={[styles.summaryValue, { color: utileColor }]}>
              {fmtCurrency(utileAnteImposte)}
            </Text>
          </View>
          <View
            style={[styles.summaryCard, { borderLeftColor: colors.positive }]}
          >
            <Text style={styles.summaryLabel}>Netto Stimato</Text>
            <Text style={[styles.summaryValue, { color: colors.positive }]}>
              {fmtCurrency(nettoStimato)}
            </Text>
          </View>
        </View>

        {/* Section 2: Imposte Societa Pro-Quota */}
        <Text style={styles.sectionTitle}>
          2. Imposte Societa (Pro-Quota)
        </Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "50%" }]}>
              Voce
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "50%", textAlign: "right" },
              ]}
            >
              Importo
            </Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: "50%" }]}>
              IRES (pro-quota)
            </Text>
            <Text
              style={[styles.tableCell, { width: "50%", textAlign: "right" }]}
            >
              {regime === "ORDINARIO"
                ? fmtCurrency(iresProQuota)
                : "N/A - Trasparenza"}
            </Text>
          </View>
          <View style={styles.tableRowAlt}>
            <Text style={[styles.tableCell, { width: "50%" }]}>
              IRAP (pro-quota)
            </Text>
            <Text
              style={[styles.tableCell, { width: "50%", textAlign: "right" }]}
            >
              {fmtCurrency(irapProQuota)}
            </Text>
          </View>
          <View style={styles.tableRowTotal}>
            <Text style={[styles.tableCellBold, { width: "50%" }]}>
              Totale Imposte Societa
            </Text>
            <Text
              style={[
                styles.tableCellBold,
                {
                  width: "50%",
                  textAlign: "right",
                  color: colors.negative,
                },
              ]}
            >
              {fmtCurrency(totaleImposteSocietaProQuota)}
            </Text>
          </View>
        </View>

        {/* Utile dopo imposte societa */}
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
              color:
                utileDopoImposteSocieta >= 0
                  ? colors.positive
                  : colors.negative,
            }}
          >
            {fmtCurrency(utileDopoImposteSocieta)}
          </Text>
        </View>

        {/* Section 3: Imposte Personali */}
        <Text style={styles.sectionTitle}>3. Imposte Personali</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: "50%" }]}>
              Voce
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                { width: "50%", textAlign: "right" },
              ]}
            >
              Importo
            </Text>
          </View>
          {regime === "ORDINARIO" ? (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: "50%" }]}>
                Ritenuta Dividendi (26%)
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  {
                    width: "50%",
                    textAlign: "right",
                    color: colors.negative,
                  },
                ]}
              >
                {fmtCurrency(ritenutaDividendi)}
              </Text>
            </View>
          ) : (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { width: "50%" }]}>IRPEF</Text>
              <Text
                style={[
                  styles.tableCell,
                  {
                    width: "50%",
                    textAlign: "right",
                    color: colors.negative,
                  },
                ]}
              >
                {fmtCurrency(irpef)}
              </Text>
            </View>
          )}
          {inps > 0 && (
            <View style={styles.tableRowAlt}>
              <Text style={[styles.tableCell, { width: "50%" }]}>
                INPS Gestione Commercianti
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  {
                    width: "50%",
                    textAlign: "right",
                    color: colors.warning,
                  },
                ]}
              >
                {fmtCurrency(inps)}
              </Text>
            </View>
          )}
          <View style={styles.tableRowTotal}>
            <Text style={[styles.tableCellBold, { width: "50%" }]}>
              Totale Carico Fiscale Personale
            </Text>
            <Text
              style={[
                styles.tableCellBold,
                {
                  width: "50%",
                  textAlign: "right",
                  color: colors.negative,
                },
              ]}
            >
              {fmtCurrency(totaleCaricoFiscalePersonale)}
            </Text>
          </View>
        </View>

        {/* Section 4: Dettaglio Scaglioni IRPEF (solo trasparenza) */}
        {regime === "TRASPARENZA" && dettaglioIrpef.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              4. Dettaglio Scaglioni IRPEF
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, { width: "35%" }]}>
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
              {dettaglioIrpef.map((scag, i) => (
                <View
                  key={i}
                  style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
                >
                  <Text style={[styles.tableCell, { width: "35%" }]}>
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
          </>
        )}

        {/* Section: Riepilogo Finale */}
        <Text style={styles.sectionTitle}>
          {regime === "TRASPARENZA" && dettaglioIrpef.length > 0 ? "5" : "4"}.
          Riepilogo Finale
        </Text>
        <View style={styles.riepilogoBox}>
          <View style={styles.riepilogoRow}>
            <Text style={styles.riepilogoLabel}>Fatturato del socio</Text>
            <Text style={styles.riepilogoValue}>{fmtCurrency(fatturato)}</Text>
          </View>
          <View style={styles.riepilogoRow}>
            <Text style={styles.riepilogoLabel}>Costi del socio</Text>
            <Text style={styles.riepilogoValue}>{fmtCurrency(costi)}</Text>
          </View>
          <View style={styles.riepilogoRow}>
            <Text style={styles.riepilogoLabel}>Utile ante imposte</Text>
            <Text style={[styles.riepilogoValue, { color: utileColor }]}>
              {fmtCurrency(utileAnteImposte)}
            </Text>
          </View>
          <View style={styles.riepilogoRow}>
            <Text style={styles.riepilogoLabel}>
              Imposte societa (pro-quota)
            </Text>
            <Text style={[styles.riepilogoValue, { color: colors.negative }]}>
              -{fmtCurrency(totaleImposteSocietaProQuota)}
            </Text>
          </View>
          <View style={styles.riepilogoRow}>
            <Text style={styles.riepilogoLabel}>Carico fiscale personale</Text>
            <Text style={[styles.riepilogoValue, { color: colors.negative }]}>
              -{fmtCurrency(totaleCaricoFiscalePersonale)}
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
              Netto Stimato
            </Text>
            <Text
              style={[
                styles.riepilogoValue,
                { fontSize: 11, color: colors.positive },
              ]}
            >
              {fmtCurrency(nettoStimato)}
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
