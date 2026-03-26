# Fase 2: Dashboard Principale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the existing main dashboard with real-time alert notifications, daily todo widget, KPI mini-cards with sparklines, and a report viewer with on-demand generation and PDF download.

**Architecture:** New React client components under `src/components/` following existing patterns (shadcn/ui Card + Tailwind, useCallback+fetch for data, Recharts for charts). Components integrate into existing `dashboard-content.tsx` and `authenticated-layout.tsx`. Report page evolves existing `/report` with new BI data.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Card, Badge, Progress, Tabs), Recharts (AreaChart, BarChart), Tailwind CSS 4, existing fetch pattern (useCallback+useState+useEffect).

**Spec:** `docs/superpowers/specs/2026-03-26-frontend-infrastruttura-roadmap.md` (Fase 2)

---

## File Structure

### New files
```
src/components/intelligence/
  alert-bell.tsx               — Notification bell with unread badge for header
  alert-card.tsx               — Single alert card (severity icon, message, actions)
  alert-list.tsx               — Alert list with filters (stato, categoria)
  todo-widget.tsx              — Today's todo list with inline completion

src/components/bi/
  kpi-card.tsx                 — Mini KPI card with value, trend arrow, variation
  kpi-sparkline.tsx            — Tiny area chart for KPI trend (Recharts)
  kpi-grid.tsx                 — Grid of KPI cards with period selector
  report-list.tsx              — Report list table with generate/download actions
  report-detail.tsx            — Report detail view with sections rendered
  report-section.tsx           — Single report section renderer (KPI, comparison, health, alert, text)

src/app/(app)/notifiche/page.tsx           — Full notifications/alert page
src/app/(app)/notifiche/notifiche-content.tsx
```

### Modified files
```
src/components/layout/authenticated-layout.tsx  — Add AlertBell to header
src/app/dashboard/dashboard-content.tsx          — Add KPI cards + todo widget sections
src/app/report/page.tsx                          — Evolve with BI report integration
```

---

## Task 1: KpiCard and KpiSparkline Components

**Files:**
- Create: `src/components/bi/kpi-card.tsx`
- Create: `src/components/bi/kpi-sparkline.tsx`

- [ ] **Step 1: Create KpiSparkline**

```tsx
// src/components/bi/kpi-sparkline.tsx
"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";

interface KpiSparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function KpiSparkline({ data, color = "#3b82f6", height = 40 }: KpiSparklineProps) {
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`gradient-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#gradient-${color.replace("#", "")})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create KpiCard**

```tsx
// src/components/bi/kpi-card.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { KpiSparkline } from "./kpi-sparkline";

interface KpiCardProps {
  nome: string;
  valore: number;
  unita: string;
  variazione: number | null;
  trend: "up" | "down" | "stable" | null;
  sparklineData?: number[];
}

function formatValue(valore: number, unita: string): string {
  if (unita === "€" || unita === "€/mese") {
    return `€ ${valore.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (unita === "%") return `${valore.toFixed(1)}%`;
  if (unita === "giorni") return `${Math.round(valore)} gg`;
  return String(Math.round(valore));
}

function TrendIcon({ trend, variazione }: { trend: string | null; variazione: number | null }) {
  if (!trend || !variazione) return null;

  const isPositive = trend === "up";
  const color = isPositive ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-gray-400";
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {variazione > 0 ? "+" : ""}{variazione.toFixed(1)}%
    </span>
  );
}

export function KpiCard({ nome, valore, unita, variazione, trend, sparklineData }: KpiCardProps) {
  const trendColor = trend === "up" ? "#10b981" : trend === "down" ? "#ef4444" : "#6b7280";

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{nome}</p>
            <p className="text-2xl font-bold tracking-tight">{formatValue(valore, unita)}</p>
            <TrendIcon trend={trend} variazione={variazione} />
          </div>
          {sparklineData && sparklineData.length > 1 && (
            <div className="w-20">
              <KpiSparkline data={sparklineData} color={trendColor} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bi/kpi-card.tsx src/components/bi/kpi-sparkline.tsx
git commit -m "feat(fase2): add KpiCard and KpiSparkline components"
```

---

## Task 2: AlertCard and AlertBell Components

**Files:**
- Create: `src/components/intelligence/alert-card.tsx`
- Create: `src/components/intelligence/alert-bell.tsx`

- [ ] **Step 1: Create AlertCard**

```tsx
// src/components/intelligence/alert-card.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, AlertCircle, Eye, Clock, Check } from "lucide-react";

interface AlertCardProps {
  id: number;
  messaggio: string;
  gravita: "INFO" | "WARNING" | "CRITICAL";
  categoria: string;
  linkAzione?: string;
  stato: string;
  createdAt: string;
  onAction?: (id: number, azione: "visto" | "snooze" | "risolvi") => void;
}

const SEVERITY_CONFIG = {
  CRITICAL: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", badge: "destructive" as const },
  WARNING: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", badge: "secondary" as const },
  INFO: { icon: Info, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", badge: "outline" as const },
};

export function AlertCard({ id, messaggio, gravita, categoria, linkAzione, stato, createdAt, onAction }: AlertCardProps) {
  const config = SEVERITY_CONFIG[gravita] || SEVERITY_CONFIG.INFO;
  const Icon = config.icon;
  const timeAgo = getTimeAgo(createdAt);

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${config.bg}`}>
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={config.badge} className="text-[10px]">{categoria.replace(/_/g, " ")}</Badge>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <p className="text-sm leading-snug">{messaggio}</p>
        {stato === "NUOVO" && onAction && (
          <div className="flex gap-1 mt-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAction(id, "visto")}>
              <Eye className="h-3 w-3 mr-1" /> Visto
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAction(id, "snooze")}>
              <Clock className="h-3 w-3 mr-1" /> Rinvia
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAction(id, "risolvi")}>
              <Check className="h-3 w-3 mr-1" /> Risolto
            </Button>
          </div>
        )}
      </div>
      {linkAzione && (
        <a href={linkAzione} className="shrink-0 text-xs text-blue-600 hover:underline mt-0.5">Vai</a>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  return `${days}g fa`;
}
```

- [ ] **Step 2: Create AlertBell**

```tsx
// src/components/intelligence/alert-bell.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCard } from "./alert-card";

interface AlertData {
  id: number;
  messaggio: string;
  gravita: "INFO" | "WARNING" | "CRITICAL";
  tipo: string;
  linkAzione?: string;
  stato: string;
  createdAt: string;
}

export function AlertBell() {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [countNuovi, setCountNuovi] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alert?stato=NUOVO");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts?.slice(0, 8) || []);
        const nuovi = data.conteggi?.find((c: any) => c.stato === "NUOVO");
        setCountNuovi(nuovi?._count || 0);
      }
    } catch (err) {
      console.error("[AlertBell] Fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000); // Poll every 60s
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleAction = useCallback(async (id: number, azione: "visto" | "snooze" | "risolvi") => {
    try {
      await fetch(`/api/alert/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione }),
      });
      fetchAlerts();
    } catch (err) {
      console.error("[AlertBell] Action error:", err);
    }
  }, [fetchAlerts]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {countNuovi > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {countNuovi > 9 ? "9+" : countNuovi}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="border-b p-3">
          <h4 className="text-sm font-semibold">Notifiche ({countNuovi} nuove)</h4>
        </div>
        <div className="max-h-96 overflow-y-auto p-2 space-y-2">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nessuna notifica</p>
          ) : (
            alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                id={alert.id}
                messaggio={alert.messaggio}
                gravita={alert.gravita}
                categoria={alert.tipo}
                linkAzione={alert.linkAzione || undefined}
                stato={alert.stato}
                createdAt={alert.createdAt}
                onAction={handleAction}
              />
            ))
          )}
        </div>
        {alerts.length > 0 && (
          <div className="border-t p-2 text-center">
            <a href="/notifiche" className="text-xs text-blue-600 hover:underline">Vedi tutte le notifiche</a>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/intelligence/
git commit -m "feat(fase2): add AlertCard and AlertBell notification components"
```

---

## Task 3: TodoWidget Component

**Files:**
- Create: `src/components/intelligence/todo-widget.tsx`

- [ ] **Step 1: Create TodoWidget**

```tsx
// src/components/intelligence/todo-widget.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ListTodo, ExternalLink } from "lucide-react";

interface TodoData {
  id: number;
  titolo: string;
  descrizione?: string;
  priorita: number;
  linkAzione?: string;
  fonte: string;
  stato: string;
}

const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-blue-100 text-blue-800",
  4: "bg-gray-100 text-gray-800",
  5: "bg-gray-50 text-gray-600",
};

const FONTE_LABELS: Record<string, string> = {
  SCADENZA: "Scadenza",
  ANOMALIA: "Anomalia",
  BOZZA: "Bozza",
  RICONCILIAZIONE: "Riconciliazione",
  FATTURA: "Fattura",
  PORTALE: "Portale",
  ALTRO: "Altro",
};

export function TodoWidget() {
  const [todos, setTodos] = useState<TodoData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todo");
      if (res.ok) {
        const data = await res.json();
        setTodos(data.todos || []);
      }
    } catch (err) {
      console.error("[TodoWidget] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleComplete = useCallback(async (id: number) => {
    try {
      await fetch(`/api/todo/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato: "COMPLETATA" }),
      });
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("[TodoWidget] Complete error:", err);
    }
  }, []);

  const activeTodos = todos.filter((t) => t.stato === "DA_FARE" || t.stato === "IN_CORSO");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4" />
          Da fare oggi
          {activeTodos.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{activeTodos.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : activeTodos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Tutto fatto per oggi!</p>
        ) : (
          <div className="space-y-2">
            {activeTodos.slice(0, 8).map((todo) => (
              <div key={todo.id} className="flex items-start gap-3 py-1.5">
                <Checkbox
                  className="mt-0.5"
                  onCheckedChange={() => handleComplete(todo.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-snug">{todo.titolo}</span>
                    {todo.linkAzione && (
                      <a href={todo.linkAzione} className="shrink-0">
                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[todo.priorita] || ""}`}>
                      P{todo.priorita}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {FONTE_LABELS[todo.fonte] || todo.fonte}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/intelligence/todo-widget.tsx
git commit -m "feat(fase2): add TodoWidget component with inline completion"
```

---

## Task 4: KpiGrid Component

**Files:**
- Create: `src/components/bi/kpi-grid.tsx`

- [ ] **Step 1: Create KpiGrid**

```tsx
// src/components/bi/kpi-grid.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { KpiCard } from "./kpi-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface KpiData {
  codice: string;
  nome: string;
  categoria: string;
  valore: number;
  variazione: number | null;
  trend: "up" | "down" | "stable" | null;
  unita: string;
}

interface KpiGridProps {
  /** If provided, only show KPIs matching these codes */
  filterCodes?: string[];
  /** If provided, only show this category */
  filterCategoria?: string;
  /** Show period selector */
  showPeriodSelector?: boolean;
}

export function KpiGrid({ filterCodes, filterCategoria, showPeriodSelector = false }: KpiGridProps) {
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoTipo, setPeriodoTipo] = useState("MESE");

  const fetchKpis = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const anno = now.getFullYear();
      const periodo = periodoTipo === "TRIMESTRE" ? Math.ceil((now.getMonth() + 1) / 3) :
                      periodoTipo === "ANNO" ? 1 : now.getMonth() + 1;

      const res = await fetch(`/api/bi/kpi?anno=${anno}&periodo=${periodo}&periodoTipo=${periodoTipo}`);
      if (res.ok) {
        const data = await res.json();
        setKpis(data.kpis || []);
      }
    } catch (err) {
      console.error("[KpiGrid] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [periodoTipo]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  let filtered = kpis;
  if (filterCodes) filtered = filtered.filter((k) => filterCodes.includes(k.codice));
  if (filterCategoria) filtered = filtered.filter((k) => k.categoria === filterCategoria);

  return (
    <div>
      {showPeriodSelector && (
        <div className="flex justify-end mb-3">
          <Select value={periodoTipo} onValueChange={setPeriodoTipo}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MESE">Mensile</SelectItem>
              <SelectItem value="TRIMESTRE">Trimestrale</SelectItem>
              <SelectItem value="ANNO">Annuale</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {filtered.map((kpi) => (
            <KpiCard
              key={kpi.codice}
              nome={kpi.nome}
              valore={kpi.valore}
              unita={kpi.unita}
              variazione={kpi.variazione}
              trend={kpi.trend}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bi/kpi-grid.tsx
git commit -m "feat(fase2): add KpiGrid component with period selector"
```

---

## Task 5: Integrate AlertBell into Layout Header

**Files:**
- Modify: `src/components/layout/authenticated-layout.tsx`

- [ ] **Step 1: Read the existing layout file**

Read `src/components/layout/authenticated-layout.tsx` to understand its structure. Find the header section that contains `SidebarTrigger` and `Separator`.

- [ ] **Step 2: Add AlertBell import and insert into header**

Add the AlertBell import at the top:
```typescript
import { AlertBell } from "@/components/intelligence/alert-bell";
```

Find the header section (between `<SidebarInset>` and main content). Insert `<AlertBell />` after the page title breadcrumb, aligned right. The exact edit depends on the current structure — place it within the header `<div>` as the last element, using `ml-auto` for right alignment.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/authenticated-layout.tsx
git commit -m "feat(fase2): integrate AlertBell notification icon into layout header"
```

---

## Task 6: Integrate KPI + Todo into Dashboard

**Files:**
- Modify: `src/app/dashboard/dashboard-content.tsx`

- [ ] **Step 1: Read the existing dashboard content**

Read `src/app/dashboard/dashboard-content.tsx` to understand its structure and what sections it already shows.

- [ ] **Step 2: Add imports and new sections**

Add imports at the top:
```typescript
import { KpiGrid } from "@/components/bi/kpi-grid";
import { TodoWidget } from "@/components/intelligence/todo-widget";
```

Add new sections to the dashboard content. Insert after existing summary cards and before the existing operations table:

```tsx
{/* KPI Overview */}
<section className="space-y-2">
  <h2 className="text-lg font-semibold">Indicatori Chiave</h2>
  <KpiGrid filterCodes={["RICAVI", "COSTI", "MARGINE_LORDO", "EBITDA"]} />
</section>

{/* Todo Widget */}
<section>
  <TodoWidget />
</section>
```

The exact placement depends on the current layout. Insert in a logical position in the dashboard grid.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/dashboard-content.tsx
git commit -m "feat(fase2): integrate KPI cards and todo widget into main dashboard"
```

---

## Task 7: Report Components

**Files:**
- Create: `src/components/bi/report-section.tsx`
- Create: `src/components/bi/report-list.tsx`
- Create: `src/components/bi/report-detail.tsx`

- [ ] **Step 1: Create ReportSection renderer**

```tsx
// src/components/bi/report-section.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ReportSectionProps {
  titolo: string;
  tipo: string;
  dati: any;
}

export function ReportSection({ titolo, tipo, dati }: ReportSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{titolo}</CardTitle>
      </CardHeader>
      <CardContent>
        {tipo === "kpi_summary" || tipo === "kpi_table" ? (
          <KpiTable kpis={Array.isArray(dati) ? dati : []} />
        ) : tipo === "comparison" ? (
          <ComparisonTable data={dati} />
        ) : tipo === "health_score" ? (
          <HealthScoreView data={dati} />
        ) : tipo === "alert_summary" ? (
          <AlertSummary alerts={Array.isArray(dati) ? dati : []} />
        ) : tipo === "text" ? (
          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{dati?.narrativaAI || dati?.testo || "Nessun contenuto"}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sezione non supportata</p>
        )}
      </CardContent>
    </Card>
  );
}

function KpiTable({ kpis }: { kpis: any[] }) {
  if (kpis.length === 0) return <p className="text-sm text-muted-foreground">Nessun dato</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>KPI</TableHead>
          <TableHead className="text-right">Valore</TableHead>
          <TableHead className="text-right">Var. %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {kpis.map((kpi: any, i: number) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{kpi.nome || kpi.codice}</TableCell>
            <TableCell className="text-right">{kpi.valore != null ? Number(kpi.valore).toLocaleString("it-IT") : "—"} {kpi.unita || ""}</TableCell>
            <TableCell className="text-right">
              {kpi.variazione != null ? (
                <span className={kpi.variazione > 0 ? "text-emerald-600" : kpi.variazione < 0 ? "text-red-600" : ""}>
                  {kpi.variazione > 0 ? "+" : ""}{Number(kpi.variazione).toFixed(1)}%
                </span>
              ) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ComparisonTable({ data }: { data: any }) {
  if (!data?.righe) return <p className="text-sm text-muted-foreground">Nessun dato</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Voce</TableHead>
          <TableHead className="text-right">{data.periodoCorrente || "Corrente"}</TableHead>
          <TableHead className="text-right">{data.periodoPrecedente || "Precedente"}</TableHead>
          <TableHead className="text-right">Delta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.righe.map((r: any, i: number) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{r.label}</TableCell>
            <TableCell className="text-right">{Number(r.valoreCorrente).toLocaleString("it-IT")}</TableCell>
            <TableCell className="text-right">{Number(r.valorePrecedente).toLocaleString("it-IT")}</TableCell>
            <TableCell className="text-right">
              <span className={r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-red-600" : ""}>
                {r.delta > 0 ? "+" : ""}{Number(r.delta).toLocaleString("it-IT")}
                {r.deltaPerc != null ? ` (${r.deltaPerc > 0 ? "+" : ""}${Number(r.deltaPerc).toFixed(1)}%)` : ""}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function HealthScoreView({ data }: { data: any }) {
  if (!data) return <p className="text-sm text-muted-foreground">Nessun dato</p>;
  const areas = [
    { label: "Contabilit\u00e0", value: data.areaContabilita },
    { label: "IVA", value: data.areaIva },
    { label: "Scadenze", value: data.areaScadenze },
    { label: "Documentale", value: data.areaDocumentale },
    { label: "Banca", value: data.areaBanca },
  ];
  return (
    <div className="space-y-3">
      <div className="text-center">
        <span className="text-3xl font-bold">{data.scoreComplessivo}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
      {areas.map((a) => (
        <div key={a.label} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>{a.label}</span>
            <span className="font-medium">{a.value ?? 0}%</span>
          </div>
          <Progress value={a.value ?? 0} className="h-2" />
        </div>
      ))}
    </div>
  );
}

function AlertSummary({ alerts }: { alerts: any[] }) {
  if (alerts.length === 0) return <p className="text-sm text-muted-foreground">Nessun alert attivo</p>;
  return (
    <div className="space-y-2">
      {alerts.slice(0, 5).map((a: any) => (
        <div key={a.id} className="flex items-center gap-2 text-sm">
          <Badge variant={a.gravita === "CRITICAL" ? "destructive" : "secondary"} className="text-[10px]">
            {a.gravita}
          </Badge>
          <span className="truncate">{a.messaggio}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create ReportList**

```tsx
// src/components/bi/report-list.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Plus, Loader2 } from "lucide-react";

interface ReportItem {
  id: number;
  periodo: string;
  stato: string;
  generatoAt: string;
  template: { nome: string; tipo: string };
}

interface TemplateOption {
  tipo: string;
  nome: string;
  descrizione: string;
}

export function ReportList({ onSelectReport }: { onSelectReport?: (id: number) => void }) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/bi/report");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setTemplates(data.templateDisponibili || []);
      }
    } catch (err) {
      console.error("[ReportList] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/bi/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: selectedTemplate }),
      });
      if (res.ok) {
        await fetchReports();
        setSelectedTemplate("");
      }
    } catch (err) {
      console.error("[ReportList] Generate error:", err);
    } finally {
      setGenerating(false);
    }
  }, [selectedTemplate, fetchReports]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="flex-1 h-9">
              <SelectValue placeholder="Seleziona tipo report..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.tipo} value={t.tipo}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleGenerate} disabled={!selectedTemplate || generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">Genera</span>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun report generato</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => onSelectReport?.(r.id)}>
                  <TableCell className="font-medium">{r.template.nome}</TableCell>
                  <TableCell>{r.periodo}</TableCell>
                  <TableCell>
                    <Badge variant={r.stato === "GENERATO" ? "secondary" : "outline"}>{r.stato}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.generatoAt).toLocaleDateString("it-IT")}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild onClick={(e) => e.stopPropagation()}>
                      <a href={`/api/bi/report/${r.id}/pdf`} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create ReportDetail**

```tsx
// src/components/bi/report-detail.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { ReportSection } from "./report-section";

interface ReportDetailProps {
  reportId: number;
  onBack: () => void;
}

export function ReportDetail({ reportId, onBack }: ReportDetailProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/bi/report/${reportId}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
      }
    } catch (err) {
      console.error("[ReportDetail] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}</div>;
  }

  if (!report) {
    return <p className="text-center text-muted-foreground py-8">Report non trovato</p>;
  }

  const reportData = report.dati;
  const sezioni = reportData?.sezioni || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/bi/report/${reportId}/pdf`} download>
            <Download className="h-4 w-4 mr-1" /> Scarica PDF
          </a>
        </Button>
      </div>

      <div>
        <h2 className="text-xl font-semibold">{report.template?.nome || "Report"}</h2>
        <p className="text-sm text-muted-foreground">
          Periodo: {reportData?.periodo || report.periodo} — Generato: {new Date(report.generatoAt).toLocaleDateString("it-IT")}
        </p>
      </div>

      {sezioni.map((sezione: any, i: number) => (
        <ReportSection key={i} titolo={sezione.titolo} tipo={sezione.tipo} dati={sezione.dati} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/bi/report-section.tsx src/components/bi/report-list.tsx src/components/bi/report-detail.tsx
git commit -m "feat(fase2): add ReportList, ReportDetail, and ReportSection components"
```

---

## Task 8: Notifications Page

**Files:**
- Create: `src/app/(app)/notifiche/page.tsx`
- Create: `src/app/(app)/notifiche/notifiche-content.tsx`

- [ ] **Step 1: Create server page**

First read `src/app/(app)/salute-azienda/page.tsx` (or any existing `(app)` page) to understand the exact server page pattern (imports, getSessionUser, AuthenticatedLayout usage).

```tsx
// src/app/(app)/notifiche/page.tsx
import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { NotificheContent } from "./notifiche-content";

export default async function NotifichePage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Notifiche">
      <NotificheContent />
    </AuthenticatedLayout>
  );
}
```

- [ ] **Step 2: Create client content**

```tsx
// src/app/(app)/notifiche/notifiche-content.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCard } from "@/components/intelligence/alert-card";

interface AlertData {
  id: number;
  messaggio: string;
  gravita: "INFO" | "WARNING" | "CRITICAL";
  tipo: string;
  linkAzione?: string;
  stato: string;
  createdAt: string;
}

export function NotificheContent() {
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("NUOVO");

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab !== "TUTTI" ? `?stato=${tab}` : "";
      const res = await fetch(`/api/alert${params}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error("[Notifiche] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAction = useCallback(async (id: number, azione: "visto" | "snooze" | "risolvi") => {
    try {
      await fetch(`/api/alert/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione }),
      });
      fetchAlerts();
    } catch (err) {
      console.error("[Notifiche] Action error:", err);
    }
  }, [fetchAlerts]);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="NUOVO">Nuovi</TabsTrigger>
          <TabsTrigger value="VISTO">Visti</TabsTrigger>
          <TabsTrigger value="SNOOZED">Rinviati</TabsTrigger>
          <TabsTrigger value="RISOLTO">Risolti</TabsTrigger>
          <TabsTrigger value="TUTTI">Tutti</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nessuna notifica</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              id={alert.id}
              messaggio={alert.messaggio}
              gravita={alert.gravita}
              categoria={alert.tipo}
              linkAzione={alert.linkAzione || undefined}
              stato={alert.stato}
              createdAt={alert.createdAt}
              onAction={handleAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/notifiche/
git commit -m "feat(fase2): add full notifications page with tabs and alert actions"
```

---

## Task 9: Report Page Evolution

**Files:**
- Modify: `src/app/report/page.tsx` or create new report page integrating BI reports

- [ ] **Step 1: Read existing report page**

Read `src/app/report/page.tsx` to understand current structure. Then add a section for BI reports.

- [ ] **Step 2: Add BI report integration**

Add the ReportList and ReportDetail components to the report page. The exact integration depends on the existing page structure. Add a new tab or section "Report BI" that renders:

```tsx
import { ReportList } from "@/components/bi/report-list";
import { ReportDetail } from "@/components/bi/report-detail";

// In the client component, add state:
const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

// In the render:
{selectedReportId ? (
  <ReportDetail reportId={selectedReportId} onBack={() => setSelectedReportId(null)} />
) : (
  <ReportList onSelectReport={setSelectedReportId} />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/report/
git commit -m "feat(fase2): integrate BI report list and detail into report page"
```

---

## Task 10: Full Build Verification

- [ ] **Step 1: Run full project tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: TypeScript compiles successfully (Resend key error is pre-existing and not related).

- [ ] **Step 3: Commit any fixes**

If any TypeScript errors, fix and commit:
```bash
git add -A
git commit -m "fix(fase2): address build issues"
```

---

## Summary

| Task | Component | Type |
|------|-----------|------|
| 1 | KpiCard + KpiSparkline | New component |
| 2 | AlertCard + AlertBell | New component |
| 3 | TodoWidget | New component |
| 4 | KpiGrid | New component |
| 5 | AlertBell in layout header | Integration |
| 6 | KPI + Todo in dashboard | Integration |
| 7 | ReportSection + ReportList + ReportDetail | New component |
| 8 | Notifications page (/notifiche) | New page |
| 9 | Report page evolution | Integration |
| 10 | Full build verification | Verification |

**Total: 10 tasks, ~10 new components, 1 new page, ~10 commits**
