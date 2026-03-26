# Fase 3: BI & Reportistica Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full BI dashboard page (`/bi`) with all 12 KPIs grouped by category, interactive Recharts charts for comparative analysis, and a budget management page (`/bi/budget`) with CRUD and scostamento visualization.

**Architecture:** New pages under `src/app/(app)/bi/` following existing pattern (server page.tsx → AuthenticatedLayout → client content). Reuses `KpiGrid`, `KpiCard` from Fase 2. New Recharts components for trend lines, comparison bars, and budget charts. Budget page with editable grid for monthly amounts.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Card, Tabs, Table, Select, Input, Dialog), Recharts (BarChart, LineChart, AreaChart, PieChart), Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-03-26-frontend-infrastruttura-roadmap.md` (Fase 3)

---

## File Structure

### New files
```
src/components/bi/
  trend-chart.tsx              — 12-month line chart for KPI trend (Recharts)
  comparison-bar-chart.tsx     — Side-by-side bar chart for period comparison
  category-pie-chart.tsx       — Pie/donut chart for cost/revenue breakdown
  kpi-detail-card.tsx          — Expanded KPI card with semaforo + history
  period-selector.tsx          — Reusable year/period/type selector
  budget-grid.tsx              — Editable monthly budget grid (12 months x N accounts)
  budget-vs-actual-chart.tsx   — Stacked bar chart budget vs consuntivo

src/app/(app)/bi/
  page.tsx                     — BI dashboard server page
  bi-content.tsx               — BI dashboard client content (tabs: KPI, Confronto, Grafici)

src/app/(app)/bi/budget/
  page.tsx                     — Budget management server page
  budget-content.tsx           — Budget client content (list, create, detail with comparison)
```

---

## Task 1: PeriodSelector Component

**Files:**
- Create: `src/components/bi/period-selector.tsx`

- [ ] **Step 1: Create PeriodSelector**

```tsx
// src/components/bi/period-selector.tsx
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PeriodSelectorProps {
  anno: number;
  periodo: number;
  periodoTipo: string;
  onAnnoChange: (anno: number) => void;
  onPeriodoChange: (periodo: number) => void;
  onPeriodoTipoChange: (tipo: string) => void;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const quarters = ["Q1 (Gen-Mar)", "Q2 (Apr-Giu)", "Q3 (Lug-Set)", "Q4 (Ott-Dic)"];

export function PeriodSelector({ anno, periodo, periodoTipo, onAnnoChange, onPeriodoChange, onPeriodoTipoChange }: PeriodSelectorProps) {
  const periodOptions = periodoTipo === "MESE" ? months : periodoTipo === "TRIMESTRE" ? quarters : ["Intero anno"];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={periodoTipo} onValueChange={onPeriodoTipoChange}>
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="MESE">Mensile</SelectItem>
          <SelectItem value="TRIMESTRE">Trimestrale</SelectItem>
          <SelectItem value="ANNO">Annuale</SelectItem>
        </SelectContent>
      </Select>
      <Select value={String(anno)} onValueChange={(v) => onAnnoChange(Number(v))}>
        <SelectTrigger className="w-24 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {periodoTipo !== "ANNO" && (
        <Select value={String(periodo)} onValueChange={(v) => onPeriodoChange(Number(v))}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((label, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bi/period-selector.tsx
git commit -m "feat(fase3): add PeriodSelector component"
```

---

## Task 2: TrendChart Component

**Files:**
- Create: `src/components/bi/trend-chart.tsx`

- [ ] **Step 1: Create TrendChart**

```tsx
// src/components/bi/trend-chart.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface TrendDataPoint {
  label: string;
  [key: string]: string | number;
}

interface TrendSeries {
  dataKey: string;
  name: string;
  color: string;
}

interface TrendChartProps {
  title: string;
  data: TrendDataPoint[];
  series: TrendSeries[];
  height?: number;
}

export function TrendChart({ title, data, series, height = 300 }: TrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip
              formatter={(value: number) => [`€ ${value.toLocaleString("it-IT")}`, ""]}
              labelStyle={{ fontWeight: "bold" }}
            />
            <Legend iconType="circle" iconSize={8} />
            {series.map((s) => (
              <Line
                key={s.dataKey}
                type="monotone"
                dataKey={s.dataKey}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bi/trend-chart.tsx
git commit -m "feat(fase3): add TrendChart line chart component"
```

---

## Task 3: ComparisonBarChart Component

**Files:**
- Create: `src/components/bi/comparison-bar-chart.tsx`

- [ ] **Step 1: Create ComparisonBarChart**

```tsx
// src/components/bi/comparison-bar-chart.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";

interface ComparisonDataPoint {
  label: string;
  corrente: number;
  precedente: number;
}

interface ComparisonBarChartProps {
  title: string;
  data: ComparisonDataPoint[];
  height?: number;
  correnteLabel?: string;
  precedenteLabel?: string;
}

export function ComparisonBarChart({
  title,
  data,
  height = 300,
  correnteLabel = "Periodo corrente",
  precedenteLabel = "Periodo precedente",
}: ComparisonBarChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip formatter={(value: number) => [`€ ${value.toLocaleString("it-IT")}`, ""]} />
            <Legend iconType="square" iconSize={10} />
            <Bar dataKey="corrente" name={correnteLabel} fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="precedente" name={precedenteLabel} fill="#93c5fd" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bi/comparison-bar-chart.tsx
git commit -m "feat(fase3): add ComparisonBarChart component"
```

---

## Task 4: KpiDetailCard Component

**Files:**
- Create: `src/components/bi/kpi-detail-card.tsx`

- [ ] **Step 1: Create KpiDetailCard**

```tsx
// src/components/bi/kpi-detail-card.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiDetailCardProps {
  codice: string;
  nome: string;
  categoria: string;
  valore: number;
  valorePrec: number | null;
  variazione: number | null;
  trend: "up" | "down" | "stable" | null;
  unita: string;
}

function getSemaforoColor(variazione: number | null, isPositiveGood: boolean = true): string {
  if (variazione === null) return "bg-gray-200";
  const adjusted = isPositiveGood ? variazione : -variazione;
  if (adjusted > 5) return "bg-emerald-500";
  if (adjusted > -5) return "bg-amber-500";
  return "bg-red-500";
}

function formatVal(valore: number, unita: string): string {
  if (unita === "€" || unita === "€/mese") return `€ ${valore.toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;
  if (unita === "%") return `${valore.toFixed(1)}%`;
  if (unita === "giorni") return `${Math.round(valore)} gg`;
  return String(Math.round(valore));
}

const CATEGORIA_COLORS: Record<string, string> = {
  ECONOMICO: "bg-blue-100 text-blue-800",
  FINANZIARIO: "bg-purple-100 text-purple-800",
  FISCALE: "bg-orange-100 text-orange-800",
  OPERATIVO: "bg-green-100 text-green-800",
  CRESCITA: "bg-pink-100 text-pink-800",
};

export function KpiDetailCard({ codice, nome, categoria, valore, valorePrec, variazione, trend, unita }: KpiDetailCardProps) {
  const isReversed = ["COSTI", "CASH_BURN_RATE", "DSO", "DPO", "TASSO_INSOLUTI", "DEBITO_IVA"].includes(codice);
  const semaforoColor = getSemaforoColor(variazione, !isReversed);
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? (isReversed ? "text-red-600" : "text-emerald-600") :
                     trend === "down" ? (isReversed ? "text-emerald-600" : "text-red-600") : "text-gray-400";

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-medium">{nome}</CardTitle>
          <Badge variant="outline" className={`text-[10px] mt-1 ${CATEGORIA_COLORS[categoria] || ""}`}>
            {categoria}
          </Badge>
        </div>
        <div className={`h-3 w-3 rounded-full ${semaforoColor}`} title={`Variazione: ${variazione?.toFixed(1) || 0}%`} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{formatVal(valore, unita)}</p>
        <div className="flex items-center gap-2 mt-1">
          {trend && variazione !== null && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              {variazione > 0 ? "+" : ""}{variazione.toFixed(1)}%
            </span>
          )}
          {valorePrec !== null && (
            <span className="text-xs text-muted-foreground">
              (prec: {formatVal(valorePrec, unita)})
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bi/kpi-detail-card.tsx
git commit -m "feat(fase3): add KpiDetailCard with semaforo and reverse-logic"
```

---

## Task 5: BI Dashboard Page

**Files:**
- Create: `src/app/(app)/bi/page.tsx`
- Create: `src/app/(app)/bi/bi-content.tsx`

- [ ] **Step 1: Read existing page pattern**

Read `src/app/(app)/salute-azienda/page.tsx` to match the server page pattern (getSessionUser, AuthenticatedLayout).

- [ ] **Step 2: Create server page**

```tsx
// src/app/(app)/bi/page.tsx
import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { BiContent } from "./bi-content";

export default async function BiPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Business Intelligence">
      <BiContent />
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 3: Create client content**

```tsx
// src/app/(app)/bi/bi-content.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodSelector } from "@/components/bi/period-selector";
import { KpiDetailCard } from "@/components/bi/kpi-detail-card";
import { ComparisonBarChart } from "@/components/bi/comparison-bar-chart";
import { TrendChart } from "@/components/bi/trend-chart";

interface KpiData {
  codice: string;
  nome: string;
  categoria: string;
  valore: number;
  valorePrec: number | null;
  variazione: number | null;
  trend: "up" | "down" | "stable" | null;
  unita: string;
}

interface ComparisonData {
  titolo: string;
  periodoCorrente: string;
  periodoPrecedente: string;
  righe: { label: string; valoreCorrente: number; valorePrecedente: number; delta: number; deltaPerc: number | null }[];
}

const CATEGORIES = ["ECONOMICO", "FINANZIARIO", "FISCALE", "OPERATIVO"];
const CATEGORY_LABELS: Record<string, string> = {
  ECONOMICO: "Economici",
  FINANZIARIO: "Finanziari",
  FISCALE: "Fiscali",
  OPERATIVO: "Operativi",
};

export function BiContent() {
  const now = new Date();
  const [anno, setAnno] = useState(now.getFullYear());
  const [periodo, setPeriodo] = useState(now.getMonth() + 1);
  const [periodoTipo, setPeriodoTipo] = useState("MESE");
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, compRes] = await Promise.all([
        fetch(`/api/bi/kpi?anno=${anno}&periodo=${periodo}&periodoTipo=${periodoTipo}`),
        fetch(`/api/bi/comparativa?anno=${anno}&periodo=${periodo}&periodoTipo=${periodoTipo}`),
      ]);
      if (kpiRes.ok) {
        const data = await kpiRes.json();
        setKpis(data.kpis || []);
      }
      if (compRes.ok) {
        setComparison(await compRes.json());
      }
    } catch (err) {
      console.error("[BI] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [anno, periodo, periodoTipo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const comparisonChartData = comparison?.righe
    .filter((r) => ["Ricavi", "Costi", "Margine Lordo", "EBITDA", "Utile Netto"].includes(r.label))
    .map((r) => ({ label: r.label, corrente: r.valoreCorrente, precedente: r.valorePrecedente })) || [];

  return (
    <div className="space-y-6">
      <PeriodSelector
        anno={anno}
        periodo={periodo}
        periodoTipo={periodoTipo}
        onAnnoChange={setAnno}
        onPeriodoChange={setPeriodo}
        onPeriodoTipoChange={setPeriodoTipo}
      />

      <Tabs defaultValue="kpi">
        <TabsList>
          <TabsTrigger value="kpi">KPI</TabsTrigger>
          <TabsTrigger value="confronto">Confronto</TabsTrigger>
        </TabsList>

        <TabsContent value="kpi" className="space-y-6 mt-4">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            CATEGORIES.map((cat) => {
              const catKpis = kpis.filter((k) => k.categoria === cat);
              if (catKpis.length === 0) return null;
              return (
                <div key={cat}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">{CATEGORY_LABELS[cat] || cat}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {catKpis.map((kpi) => (
                      <KpiDetailCard key={kpi.codice} {...kpi} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="confronto" className="space-y-6 mt-4">
          {comparison && comparisonChartData.length > 0 && (
            <ComparisonBarChart
              title={comparison.titolo}
              data={comparisonChartData}
              correnteLabel={comparison.periodoCorrente}
              precedenteLabel={comparison.periodoPrecedente}
            />
          )}

          {comparison?.righe && (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Voce</th>
                    <th className="text-right p-3 font-medium">{comparison.periodoCorrente}</th>
                    <th className="text-right p-3 font-medium">{comparison.periodoPrecedente}</th>
                    <th className="text-right p-3 font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.righe.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3 font-medium">{r.label}</td>
                      <td className="p-3 text-right">{r.valoreCorrente.toLocaleString("it-IT")}</td>
                      <td className="p-3 text-right">{r.valorePrecedente.toLocaleString("it-IT")}</td>
                      <td className={`p-3 text-right font-medium ${r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-red-600" : ""}`}>
                        {r.delta > 0 ? "+" : ""}{r.delta.toLocaleString("it-IT")}
                        {r.deltaPerc != null && ` (${r.deltaPerc > 0 ? "+" : ""}${r.deltaPerc.toFixed(1)}%)`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/bi/
git commit -m "feat(fase3): add BI dashboard page with KPI grid and comparison tab"
```

---

## Task 6: BudgetGrid Component

**Files:**
- Create: `src/components/bi/budget-grid.tsx`

- [ ] **Step 1: Create BudgetGrid**

```tsx
// src/components/bi/budget-grid.tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface BudgetRow {
  contoId: number;
  contoDescrizione: string;
  importi: number[]; // 12 months
}

interface BudgetGridProps {
  righe: BudgetRow[];
  readOnly?: boolean;
  onSave?: (righe: { contoId: number; mese: number; importo: number }[]) => void;
}

const MESI_SHORT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export function BudgetGrid({ righe: initialRighe, readOnly = false, onSave }: BudgetGridProps) {
  const [righe, setRighe] = useState(initialRighe);

  const updateCell = (rowIdx: number, meseIdx: number, value: string) => {
    const updated = [...righe];
    updated[rowIdx] = {
      ...updated[rowIdx],
      importi: updated[rowIdx].importi.map((v, i) => (i === meseIdx ? Number(value) || 0 : v)),
    };
    setRighe(updated);
  };

  const handleSave = () => {
    if (!onSave) return;
    const flat: { contoId: number; mese: number; importo: number }[] = [];
    for (const riga of righe) {
      for (let m = 0; m < 12; m++) {
        if (riga.importi[m] !== 0) {
          flat.push({ contoId: riga.contoId, mese: m + 1, importo: riga.importi[m] });
        }
      }
    }
    onSave(flat);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium min-w-[180px] sticky left-0 bg-muted/50">Conto</th>
              {MESI_SHORT.map((m) => (
                <th key={m} className="text-right p-2 font-medium min-w-[80px]">{m}</th>
              ))}
              <th className="text-right p-2 font-medium min-w-[90px]">Totale</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((riga, ri) => {
              const totale = riga.importi.reduce((s, v) => s + v, 0);
              return (
                <tr key={riga.contoId} className="border-t">
                  <td className="p-2 font-medium sticky left-0 bg-background">{riga.contoDescrizione}</td>
                  {riga.importi.map((val, mi) => (
                    <td key={mi} className="p-1 text-right">
                      {readOnly ? (
                        <span>{val.toLocaleString("it-IT")}</span>
                      ) : (
                        <Input
                          type="number"
                          value={val || ""}
                          onChange={(e) => updateCell(ri, mi, e.target.value)}
                          className="h-7 text-xs text-right w-full"
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-2 text-right font-bold">{totale.toLocaleString("it-IT")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && onSave && (
        <Button size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" /> Salva Budget
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bi/budget-grid.tsx
git commit -m "feat(fase3): add BudgetGrid editable component"
```

---

## Task 7: BudgetVsActualChart Component

**Files:**
- Create: `src/components/bi/budget-vs-actual-chart.tsx`

- [ ] **Step 1: Create chart**

```tsx
// src/components/bi/budget-vs-actual-chart.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

interface BvaDataPoint {
  label: string;
  budget: number;
  actual: number;
  delta: number;
}

interface BudgetVsActualChartProps {
  data: BvaDataPoint[];
  height?: number;
}

export function BudgetVsActualChart({ data, height = 350 }: BudgetVsActualChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Budget vs Consuntivo</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
            <Tooltip formatter={(value: number) => [`€ ${value.toLocaleString("it-IT")}`, ""]} />
            <Legend iconType="square" iconSize={10} />
            <ReferenceLine y={0} stroke="#666" />
            <Bar dataKey="budget" name="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="actual" name="Consuntivo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bi/budget-vs-actual-chart.tsx
git commit -m "feat(fase3): add BudgetVsActualChart component"
```

---

## Task 8: Budget Page

**Files:**
- Create: `src/app/(app)/bi/budget/page.tsx`
- Create: `src/app/(app)/bi/budget/budget-content.tsx`

- [ ] **Step 1: Create server page**

Read an existing `(app)` page for the pattern, then create:

```tsx
// src/app/(app)/bi/budget/page.tsx
import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { BudgetContent } from "./budget-content";

export default async function BudgetPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Budget">
      <BudgetContent />
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 2: Create client content**

```tsx
// src/app/(app)/bi/budget/budget-content.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { BudgetGrid } from "@/components/bi/budget-grid";
import { BudgetVsActualChart } from "@/components/bi/budget-vs-actual-chart";

interface BudgetItem {
  id: number;
  anno: number;
  nome: string;
  stato: string;
  createdAt: string;
}

export function BudgetContent() {
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [budgetDetail, setBudgetDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mese, setMese] = useState(new Date().getMonth() + 1);
  const [newName, setNewName] = useState("");
  const [newAnno, setNewAnno] = useState(String(new Date().getFullYear()));
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await fetch("/api/bi/budget");
      if (res.ok) {
        const data = await res.json();
        setBudgets(data.budgets || []);
      }
    } catch (err) {
      console.error("[Budget] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/bi/budget/${id}?mese=${mese}`);
      if (res.ok) setBudgetDetail(await res.json());
    } catch (err) {
      console.error("[Budget] Detail error:", err);
    }
  }, [mese]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);
  useEffect(() => { if (selectedId) fetchDetail(selectedId); }, [selectedId, fetchDetail]);

  const handleCreate = useCallback(async () => {
    if (!newName) return;
    try {
      const res = await fetch("/api/bi/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno: Number(newAnno), nome: newName }),
      });
      if (res.ok) {
        setNewName("");
        setDialogOpen(false);
        await fetchBudgets();
      }
    } catch (err) {
      console.error("[Budget] Create error:", err);
    }
  }, [newName, newAnno, fetchBudgets]);

  const compChartData = budgetDetail?.comparison?.righe?.map((r: any) => ({
    label: r.label.slice(0, 20),
    budget: r.valorePrecedente,
    actual: r.valoreCorrente,
    delta: r.delta,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Budget</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuovo Budget</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crea Budget</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Nome budget" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input type="number" placeholder="Anno" value={newAnno} onChange={(e) => setNewAnno(e.target.value)} />
              <Button onClick={handleCreate} disabled={!newName}>Crea</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : budgets.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nessun budget creato</p>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => (
            <Card
              key={b.id}
              className={`cursor-pointer transition-colors ${selectedId === b.id ? "border-blue-500" : "hover:bg-muted/50"}`}
              onClick={() => setSelectedId(b.id)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{b.nome}</p>
                  <p className="text-xs text-muted-foreground">Anno {b.anno}</p>
                </div>
                <Badge variant={b.stato === "APPROVATO" ? "default" : "secondary"}>{b.stato}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {budgetDetail && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold">Confronto Mese</h3>
            <Select value={String(mese)} onValueChange={(v) => setMese(Number(v))}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"].map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {compChartData.length > 0 && <BudgetVsActualChart data={compChartData} />}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/bi/budget/
git commit -m "feat(fase3): add budget management page with create, detail, and comparison"
```

---

## Task 9: Full Build Verification

- [ ] **Step 1: Run full project tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: TypeScript compiles successfully.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(fase3): address build issues"
```

---

## Summary

| Task | Component | Type |
|------|-----------|------|
| 1 | PeriodSelector | New component |
| 2 | TrendChart (LineChart) | New component |
| 3 | ComparisonBarChart | New component |
| 4 | KpiDetailCard with semaforo | New component |
| 5 | BI Dashboard page (/bi) | New page |
| 6 | BudgetGrid editable | New component |
| 7 | BudgetVsActualChart | New component |
| 8 | Budget page (/bi/budget) | New page |
| 9 | Full build verification | Verification |

**Total: 9 tasks, ~7 new components, 2 new pages, ~9 commits**
