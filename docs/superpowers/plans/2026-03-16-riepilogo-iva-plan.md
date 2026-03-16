# Riepilogo IVA Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Riepilogo IVA" tab to the Report page showing IVA a debito, IVA a credito, saldo, monthly chart, summary table, and PDF export.

**Architecture:** New API route aggregates IVA data from Operazione table by tipo (FATTURA_ATTIVA vs COSTO/CESPITE). A new tab in report-client.tsx follows the exact same pattern as "Stima Fiscale Societa" (anno selector, generate button, PDF download, preview component). PDF component reuses the same styles/structure as stima-fiscale-societa-pdf.tsx.

**Tech Stack:** Next.js API Route, Prisma, Recharts (BarChart), @react-pdf/renderer

**Spec:** `docs/superpowers/specs/2026-03-16-riepilogo-iva-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/api/report/iva/route.ts` | Create | API endpoint: aggregate IVA data by year |
| `src/components/report/riepilogo-iva-pdf.tsx` | Create | PDF component for IVA report |
| `src/app/report/report-client.tsx` | Modify | Add IVA tab, state, fetch, preview component |

---

## Task 1: API Route

**Files:**
- Create: `src/app/api/report/iva/route.ts`

- [ ] **Step 1: Create API route**

```ts
// src/app/api/report/iva/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MESI_LABEL = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const annoParam = searchParams.get("anno");
    const anno = annoParam ? parseInt(annoParam, 10) : new Date().getFullYear();

    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: {
        ragioneSociale: true,
        partitaIva: true,
        codiceFiscale: true,
      },
    });

    if (!societa) {
      return NextResponse.json({ error: "Societa non trovata" }, { status: 404 });
    }

    const dataInizio = new Date(`${anno}-01-01`);
    const dataFine = new Date(`${anno}-12-31`);

    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        eliminato: false,
        bozza: false,
        dataOperazione: { gte: dataInizio, lte: dataFine },
      },
      select: {
        tipoOperazione: true,
        importoIva: true,
        ivaDetraibile: true,
        ivaIndetraibile: true,
        dataOperazione: true,
      },
    });

    // Aggregate totals
    let ivaDebito = 0;
    let ivaCredito = 0;
    let ivaIndetraibile = 0;

    // Monthly buckets (0-11)
    const mensileDebito = new Array(12).fill(0);
    const mensileCredito = new Array(12).fill(0);

    for (const op of operazioni) {
      const mese = new Date(op.dataOperazione).getMonth();

      if (op.tipoOperazione === "FATTURA_ATTIVA") {
        const importoIva = Number(op.importoIva) || 0;
        ivaDebito += importoIva;
        mensileDebito[mese] += importoIva;
      } else {
        // COSTO or CESPITE
        const detraibile = Number(op.ivaDetraibile) || 0;
        const indetraibile = Number(op.ivaIndetraibile) || 0;
        ivaCredito += detraibile;
        ivaIndetraibile += indetraibile;
        mensileCredito[mese] += detraibile;
      }
    }

    // Round
    ivaDebito = Math.round(ivaDebito * 100) / 100;
    ivaCredito = Math.round(ivaCredito * 100) / 100;
    ivaIndetraibile = Math.round(ivaIndetraibile * 100) / 100;
    const saldoIva = Math.round((ivaDebito - ivaCredito) * 100) / 100;

    const andamentoMensile = Array.from({ length: 12 }, (_, i) => {
      const d = Math.round(mensileDebito[i] * 100) / 100;
      const c = Math.round(mensileCredito[i] * 100) / 100;
      return {
        mese: `${anno}-${String(i + 1).padStart(2, "0")}`,
        meseLabel: MESI_LABEL[i],
        ivaDebito: d,
        ivaCredito: c,
        saldoIva: Math.round((d - c) * 100) / 100,
      };
    });

    return NextResponse.json({
      anno,
      societa: {
        ragioneSociale: societa.ragioneSociale,
        partitaIva: societa.partitaIva,
        codiceFiscale: societa.codiceFiscale,
      },
      totali: { ivaDebito, ivaCredito, ivaIndetraibile, saldoIva },
      andamentoMensile,
    });
  } catch (error) {
    console.error("Errore nel riepilogo IVA:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Test manually**

Run: `curl http://localhost:3000/api/report/iva?anno=2026` (with valid session)
Expected: JSON with `anno`, `societa`, `totali`, `andamentoMensile` (12 entries)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/report/iva/route.ts
git commit -m "feat: add API route for IVA riepilogo report"
```

---

## Task 2: PDF Component

**Files:**
- Create: `src/components/report/riepilogo-iva-pdf.tsx`
- Reference: `src/components/report/stima-fiscale-societa-pdf.tsx` (copy styles/structure)

- [ ] **Step 1: Create PDF component**

```tsx
// src/components/report/riepilogo-iva-pdf.tsx
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
            <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/report/riepilogo-iva-pdf.tsx
git commit -m "feat: add PDF component for IVA riepilogo report"
```

---

## Task 3: Report Client — Add IVA Tab

**Files:**
- Modify: `src/app/report/report-client.tsx`

This task modifies the existing report-client.tsx to add the IVA tab. The changes follow the exact same pattern as the "Stima Fiscale Societa" tab.

- [ ] **Step 1: Add imports**

Add to the existing imports at the top of `report-client.tsx`:

```tsx
import {
  RiepilogoIvaPdf,
  type RiepilogoIvaData,
} from "@/components/report/riepilogo-iva-pdf";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
```

- [ ] **Step 2: Add state variables**

Add after the existing stima-socio state block (around line 137):

```tsx
// Riepilogo IVA state
const [ivaAnno, setIvaAnno] = useState(String(new Date().getFullYear()));
const [ivaData, setIvaData] = useState<RiepilogoIvaData | null>(null);
const [ivaLoading, setIvaLoading] = useState(false);
const [ivaError, setIvaError] = useState<string | null>(null);
const [ivaPdfLoading, setIvaPdfLoading] = useState(false);
```

- [ ] **Step 3: Add fetch and PDF download functions**

Add after the existing `downloadStimaSocioPdf` function:

```tsx
// Fetch riepilogo IVA
const fetchIva = useCallback(async () => {
  setIvaLoading(true);
  setIvaError(null);
  setIvaData(null);

  try {
    const params = new URLSearchParams({ anno: ivaAnno });
    const res = await fetch(`/api/report/iva?${params}`);
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "Errore nel caricamento del riepilogo IVA");
    }
    const data: RiepilogoIvaData = await res.json();
    setIvaData(data);
  } catch (err) {
    setIvaError(err instanceof Error ? err.message : "Errore sconosciuto");
  } finally {
    setIvaLoading(false);
  }
}, [ivaAnno]);

// Download PDF IVA
const downloadIvaPdf = useCallback(async () => {
  if (!ivaData) return;
  setIvaPdfLoading(true);
  try {
    const blob = await pdf(<RiepilogoIvaPdf data={ivaData} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `riepilogo-iva-${ivaData.anno}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // silent
  } finally {
    setIvaPdfLoading(false);
  }
}, [ivaData]);
```

- [ ] **Step 4: Add TabsTrigger**

In the `<TabsList>` (around line 317), add after the stima-socio trigger:

```tsx
<TabsTrigger value="iva">Riepilogo IVA</TabsTrigger>
```

- [ ] **Step 5: Add TabsContent**

Add before the closing `</Tabs>` tag (around line 653), after the stima-socio TabsContent:

```tsx
{/* ================================================================= */}
{/* TAB: Riepilogo IVA                                                */}
{/* ================================================================= */}
<TabsContent value="iva">
  <Card>
    <CardHeader>
      <CardTitle>Riepilogo IVA</CardTitle>
      <CardDescription>
        Prospetto riepilogativo IVA a debito e IVA a credito per l&apos;anno selezionato.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="iva-anno">Anno</Label>
          <Input
            id="iva-anno"
            type="number"
            min="2000"
            max="2100"
            value={ivaAnno}
            onChange={(e) => setIvaAnno(e.target.value)}
            className="w-32"
          />
        </div>
        <Button onClick={fetchIva} disabled={ivaLoading}>
          {ivaLoading ? "Caricamento..." : "Genera Riepilogo"}
        </Button>
        {ivaData && (
          <Button
            variant="outline"
            onClick={downloadIvaPdf}
            disabled={ivaPdfLoading}
          >
            {ivaPdfLoading ? "Generazione PDF..." : "Scarica PDF"}
          </Button>
        )}
      </div>

      {ivaError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {ivaError}
        </div>
      )}

      {ivaLoading && (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {ivaData && !ivaLoading && (
        <RiepilogoIvaPreview data={ivaData} />
      )}
    </CardContent>
  </Card>
</TabsContent>
```

- [ ] **Step 6: Add RiepilogoIvaPreview component**

Add at the bottom of the file, before the closing of the module (after the existing `SummaryCard` component):

```tsx
// ---------------------------------------------------------------------------
// Riepilogo IVA Preview
// ---------------------------------------------------------------------------

function RiepilogoIvaPreview({ data }: { data: RiepilogoIvaData }) {
  const saldoColor = data.totali.saldoIva > 0 ? "text-red-400" : "text-green-400";
  const saldoLabel = data.totali.saldoIva > 0 ? "IVA Dovuta" : "IVA a Credito";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="text-lg font-semibold">{data.societa.ragioneSociale}</h3>
        <p className="text-sm text-muted-foreground">
          Anno: {data.anno}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="IVA a Debito" value={formatCurrency(data.totali.ivaDebito)} />
        <SummaryCard label="IVA a Credito" value={formatCurrency(data.totali.ivaCredito)} />
        <SummaryCard
          label={saldoLabel}
          value={formatCurrency(Math.abs(data.totali.saldoIva))}
          className={saldoColor}
        />
      </div>

      {/* Chart */}
      <div>
        <h4 className="mb-3 text-sm font-semibold">Andamento Mensile</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data.andamentoMensile}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="meseLabel" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                color: "hsl(var(--popover-foreground))",
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend />
            <Bar dataKey="ivaDebito" name="IVA Debito" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ivaCredito" name="IVA Credito" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail table */}
      <div>
        <h4 className="mb-3 text-sm font-semibold">Dettaglio</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voce</TableHead>
              <TableHead className="text-right">Importo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">IVA su fatture attive (debito)</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totali.ivaDebito)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">IVA su costi detraibile (credito)</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totali.ivaCredito)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">IVA su costi indetraibile</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totali.ivaIndetraibile)}</TableCell>
            </TableRow>
            <TableRow className="border-t-2">
              <TableCell className="font-bold">{saldoLabel}</TableCell>
              <TableCell className={`text-right font-bold ${saldoColor}`}>
                {formatCurrency(Math.abs(data.totali.saldoIva))}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify the app compiles**

Run: `npm run build` or check dev server for errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/report/report-client.tsx
git commit -m "feat: add Riepilogo IVA tab to Report page with chart and PDF export"
```
