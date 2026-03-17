"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/business-utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";

// ── Types ───────────────────────────────────────────────────────────────────

type KpiData = {
  fatturato: number;
  costi: number;
  ammortamento: number;
  utile: number;
  numOperazioni: number;
  capitaleSociale: number | null;
};

type TrendItem = {
  mese: number;
  fatturato: number;
  costi: number;
  ammortamento: number;
};

type BreakdownItem = {
  socioId: number;
  nome: string;
  cognome: string;
  fatturato: number;
  costi: number;
  ammortamento: number;
  utile: number;
};

type Operazione = {
  id: number;
  tipoOperazione: string;
  dataOperazione: string;
  descrizione: string;
  importoTotale: number;
  numeroDocumento?: string;
};

type Bozza = {
  id: number;
  dataOperazione: string;
  descrizione: string;
  importoTotale: number;
  categoria: { id: number; nome: string } | null;
  tipoOperazione: string;
  tipoContratto: string | null;
};

type PeriodoPreset = "mese" | "anno" | "custom";

type CassaMensile = {
  mese: number;
  meseLabel: string;
  entrate: number;
  uscite: number;
  usciteDettaglio: {
    costiOperativi: number;
    cespiti: number;
    imposte: number;
    dividendi: number;
    compensiAmm: number;
  };
  saldoProgressivo: number;
};

type CassaData = {
  anno: number;
  saldoIniziale: number;
  mensile: CassaMensile[];
  totali: {
    entrate: number;
    uscite: number;
    saldoFinale: number;
  };
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const MESI_LABEL = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

const TIPO_LABELS: Record<string, string> = {
  FATTURA_ATTIVA: "Fattura Attiva",
  COSTO: "Costo",
  CESPITE: "Cespite",
  PAGAMENTO_IMPOSTE: "Pag. Imposte",
  DISTRIBUZIONE_DIVIDENDI: "Dividendi",
  COMPENSO_AMMINISTRATORE: "Comp. Amm.",
};

function getDefaultDates(preset: PeriodoPreset): { da: string; a: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === "mese") {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      da: formatDate(firstDay),
      a: formatDate(lastDay),
    };
  }

  // anno or custom default
  return {
    da: `${year}-01-01`,
    a: `${year}-12-31`,
  };
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDataItaliana(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Custom Recharts Tooltip ─────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="text-sm">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

type Props = {
  ruolo: string;
  nome: string;
};

export function DashboardContent({ ruolo, nome }: Props) {
  const isAdmin = ruolo === "ADMIN";
  const router = useRouter();

  // Period state
  const [periodo, setPeriodo] = useState<PeriodoPreset>("mese");
  const [dates, setDates] = useState(() => getDefaultDates("mese"));

  // Data state
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [recentOps, setRecentOps] = useState<Operazione[]>([]);

  // Bozze state
  const [bozze, setBozze] = useState<Bozza[]>([]);
  const [loadingBozze, setLoadingBozze] = useState(true);
  const [editingBozza, setEditingBozza] = useState<number | null>(null);
  const [editImporto, setEditImporto] = useState("");
  const [confermando, setConfermando] = useState<number | null>(null);

  // Loading state
  const [loadingKpi, setLoadingKpi] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [loadingBreakdown, setLoadingBreakdown] = useState(true);
  const [loadingOps, setLoadingOps] = useState(true);

  // Cassa state
  const [cassaAnno, setCassaAnno] = useState(new Date().getFullYear());
  const [cassaData, setCassaData] = useState<CassaData | null>(null);
  const [loadingCassa, setLoadingCassa] = useState(false);

  // ── Fetchers ────────────────────────────────────────────────────────────

  const fetchKpi = useCallback(async (da: string, a: string) => {
    setLoadingKpi(true);
    try {
      const res = await fetch(`/api/dashboard/kpi?da=${da}&a=${a}`);
      if (res.ok) {
        const data = await res.json();
        setKpi(data);
      }
    } catch (err) {
      console.error("Errore KPI:", err);
    } finally {
      setLoadingKpi(false);
    }
  }, []);

  const fetchTrend = useCallback(async (anno: number) => {
    setLoadingTrend(true);
    try {
      const res = await fetch(`/api/dashboard/trend?anno=${anno}`);
      if (res.ok) {
        const data: TrendItem[] = await res.json();
        setTrend(
          data.map((item) => ({
            ...item,
            label: MESI_LABEL[item.mese - 1],
          }))
        );
      }
    } catch (err) {
      console.error("Errore trend:", err);
    } finally {
      setLoadingTrend(false);
    }
  }, []);

  const fetchBreakdown = useCallback(
    async (da: string, a: string) => {
      if (!isAdmin) return;
      setLoadingBreakdown(true);
      try {
        const res = await fetch(`/api/dashboard/breakdown?da=${da}&a=${a}`);
        if (res.ok) {
          const data = await res.json();
          setBreakdown(data);
        }
      } catch (err) {
        console.error("Errore breakdown:", err);
      } finally {
        setLoadingBreakdown(false);
      }
    },
    [isAdmin]
  );

  const fetchRecentOps = useCallback(async () => {
    setLoadingOps(true);
    try {
      const res = await fetch("/api/operazioni?perPage=10");
      if (res.ok) {
        const data = await res.json();
        // The operazioni API may return { data: [...], ... } or [...]
        const ops = Array.isArray(data) ? data : data.data ?? [];
        setRecentOps(ops);
      }
    } catch (err) {
      console.error("Errore operazioni recenti:", err);
    } finally {
      setLoadingOps(false);
    }
  }, []);

  const fetchCassa = useCallback(async (anno: number) => {
    setLoadingCassa(true);
    try {
      const res = await fetch(`/api/dashboard/cassa?anno=${anno}`);
      if (res.ok) {
        const data = await res.json();
        setCassaData(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingCassa(false);
    }
  }, []);

  const fetchBozze = useCallback(async () => {
    setLoadingBozze(true);
    try {
      // First generate any pending drafts
      await fetch("/api/operazioni-ricorrenti/genera", { method: "POST" });
      // Then fetch drafts
      const res = await fetch("/api/bozze");
      if (res.ok) {
        const data = await res.json();
        setBozze(data);
      }
    } catch (err) {
      console.error("Errore bozze:", err);
    } finally {
      setLoadingBozze(false);
    }
  }, []);

  async function confermaBozza(id: number, importo?: number) {
    setConfermando(id);
    try {
      const body = importo !== undefined ? { importoTotale: importo } : {};
      const res = await fetch(`/api/bozze/${id}/conferma`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setBozze((prev) => prev.filter((b) => b.id !== id));
        setEditingBozza(null);
        fetchKpi(dates.da, dates.a);
        fetchRecentOps();
      }
    } finally {
      setConfermando(null);
    }
  }

  async function confermaTutte() {
    setConfermando(-1);
    try {
      const res = await fetch("/api/bozze/conferma-tutte", { method: "POST" });
      if (res.ok) {
        setBozze([]);
        fetchKpi(dates.da, dates.a);
        fetchRecentOps();
      }
    } finally {
      setConfermando(null);
    }
  }

  // ── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchKpi(dates.da, dates.a);
    fetchBreakdown(dates.da, dates.a);
  }, [dates, fetchKpi, fetchBreakdown]);

  useEffect(() => {
    const anno = new Date(dates.da).getFullYear();
    fetchTrend(anno);
  }, [dates.da, fetchTrend]);

  useEffect(() => {
    fetchRecentOps();
  }, [fetchRecentOps]);

  useEffect(() => {
    fetchBozze();
  }, [fetchBozze]);

  useEffect(() => {
    fetchCassa(cassaAnno);
  }, [cassaAnno, fetchCassa]);

  // ── Period handlers ─────────────────────────────────────────────────────

  function handlePeriodoChange(preset: PeriodoPreset) {
    setPeriodo(preset);
    if (preset !== "custom") {
      setDates(getDefaultDates(preset));
    }
  }

  // ── Chart data ──────────────────────────────────────────────────────────

  const chartData = trend.map((item) => ({
    name: MESI_LABEL[item.mese - 1],
    Fatturato: item.fatturato,
    Costi: item.costi,
    Ammortamento: item.ammortamento,
  }));

  // ── Render ──────────────────────────────────────────────────────────────

  const periodoLabel =
    periodo === "mese"
      ? "Mese corrente"
      : periodo === "anno"
        ? "Anno corrente"
        : `${formatDataItaliana(dates.da)} - ${formatDataItaliana(dates.a)}`;

  return (
    <div className="space-y-6">
      {/* ── Banner Bozze Ricorrenti ──────────────────────────────────── */}
      {!loadingBozze && bozze.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Hai {bozze.length} {bozze.length === 1 ? "spesa ricorrente" : "spese ricorrenti"} da confermare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bozze.map((bozza) => (
                <div key={bozza.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDataItaliana(bozza.dataOperazione)}
                    </span>
                    <span className="text-sm font-medium truncate">{bozza.descrizione}</span>
                    <Badge variant="outline" className="text-xs shrink-0">{bozza.categoria?.nome ?? "—"}</Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {editingBozza === bozza.id ? (
                      <>
                        <Input
                          type="number"
                          step="0.01"
                          value={editImporto}
                          onChange={(e) => setEditImporto(e.target.value)}
                          className="h-8 w-28"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => confermaBozza(bozza.id, parseFloat(editImporto))}
                          disabled={confermando === bozza.id}
                        >
                          Salva
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingBozza(null)}
                        >
                          Annulla
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium w-24 text-right">
                          {formatCurrency(bozza.importoTotale)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => confermaBozza(bozza.id)}
                          disabled={confermando !== null}
                        >
                          Conferma
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/operazioni/${bozza.id}`)}
                        >
                          Modifica
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {bozze.length > 1 && (
              <div className="flex justify-end mt-3">
                <Button
                  size="sm"
                  onClick={confermaTutte}
                  disabled={confermando !== null}
                >
                  Conferma tutte
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Period Selector ──────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex gap-2">
              <Button
                variant={periodo === "mese" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodoChange("mese")}
              >
                Mese Corrente
              </Button>
              <Button
                variant={periodo === "anno" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodoChange("anno")}
              >
                Anno Corrente
              </Button>
              <Button
                variant={periodo === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodoChange("custom")}
              >
                Custom
              </Button>
            </div>

            {periodo === "custom" && (
              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="da" className="text-xs">
                    Da
                  </Label>
                  <Input
                    id="da"
                    type="date"
                    value={dates.da}
                    onChange={(e) =>
                      setDates((prev) => ({ ...prev, da: e.target.value }))
                    }
                    className="h-9 w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="a" className="text-xs">
                    A
                  </Label>
                  <Input
                    id="a"
                    type="date"
                    value={dates.a}
                    onChange={(e) =>
                      setDates((prev) => ({ ...prev, a: e.target.value }))
                    }
                    className="h-9 w-40"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      {/* ── Capitale Sociale ────────────────────────────────────────── */}
      {kpi?.capitaleSociale != null && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Capitale Sociale</p>
                <p className="text-2xl font-bold">{formatCurrency(kpi.capitaleSociale)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Fatturato Totale */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Fatturato Totale
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingKpi ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(kpi?.fatturato ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{periodoLabel}</p>
          </CardContent>
        </Card>

        {/* Costi Totali */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costi Totali</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingKpi ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(kpi?.costi ?? 0)}
                </div>
                {(kpi?.ammortamento ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    di cui ammortamento: {formatCurrency(kpi!.ammortamento)}
                  </p>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">{periodoLabel}</p>
          </CardContent>
        </Card>

        {/* Utile / Perdita */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Utile / Perdita
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingKpi ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div
                className={`text-2xl font-bold ${
                  (kpi?.utile ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {formatCurrency(kpi?.utile ?? 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{periodoLabel}</p>
          </CardContent>
        </Card>

        {/* N. Operazioni */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              N. Operazioni
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingKpi ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">
                {kpi?.numOperazioni ?? 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{periodoLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Trend Chart ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Andamento Mensile</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTrend ? (
            <Skeleton className="h-[350px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="Fatturato"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Costi"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Ammortamento"
                  fill="#a78bfa"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Breakdown per Socio (Admin only) ─────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Ripartizione per Socio</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingBreakdown ? (
              <Skeleton className="h-32 w-full" />
            ) : breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun dato disponibile per il periodo selezionato.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Socio</TableHead>
                    <TableHead className="text-right">Fatturato</TableHead>
                    <TableHead className="text-right">Costi</TableHead>
                    <TableHead className="text-right">Ammortamento</TableHead>
                    <TableHead className="text-right">Utile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.map((item) => (
                    <TableRow key={item.socioId}>
                      <TableCell className="font-medium">
                        {item.cognome} {item.nome}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.fatturato)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.costi)}
                      </TableCell>
                      <TableCell className="text-right text-violet-400">
                        {formatCurrency(item.ammortamento)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          item.utile >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {formatCurrency(item.utile)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Simulazione Cassa ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Simulazione Cassa</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="cassa-anno" className="text-sm">Anno</Label>
            <Input
              id="cassa-anno"
              type="number"
              value={cassaAnno}
              onChange={(e) => setCassaAnno(parseInt(e.target.value, 10) || new Date().getFullYear())}
              className="w-24 h-8 text-sm"
              min={2000}
              max={2100}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loadingCassa ? (
            <Skeleton className="h-64 w-full" />
          ) : !cassaData || (cassaData.totali.entrate === 0 && cassaData.totali.uscite === 0 && cassaData.saldoIniziale === 0) ? (
            <p className="text-sm text-muted-foreground">Nessun movimento registrato per questo anno.</p>
          ) : (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Saldo Iniziale Anno</p>
                    <p className="text-lg font-semibold mt-1">{formatCurrency(cassaData.saldoIniziale)}</p>
                  </CardContent>
                </Card>
                <Card className="border-green-500/30">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Entrate Lorde</p>
                    <p className="text-lg font-semibold mt-1 text-green-400">{formatCurrency(cassaData.totali.entrate)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-500/30">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Uscite Lorde</p>
                    <p className="text-lg font-semibold mt-1 text-red-400">{formatCurrency(cassaData.totali.uscite)}</p>
                  </CardContent>
                </Card>
                <Card className={cassaData.totali.saldoFinale >= 0 ? "border-green-500/30" : "border-red-500/30"}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Saldo Finale Anno</p>
                    <p className={`text-lg font-semibold mt-1 ${cassaData.totali.saldoFinale >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(cassaData.totali.saldoFinale)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Line chart — saldo progressivo */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cassaData.mensile} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cassaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="meseLabel" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value, name) => [formatCurrency(value as number), (name as string) === "saldoProgressivo" ? "Saldo" : (name as string)]}
                      labelFormatter={(label) => `${label} ${cassaAnno}`}
                    />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                    <Area
                      type="monotone"
                      dataKey="saldoProgressivo"
                      name="saldoProgressivo"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#cassaGradient)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Breakdown uscite */}
              <div>
                <p className="text-sm font-medium mb-2">Dettaglio Uscite</p>
                <Table>
                  <TableBody>
                    {[
                      { label: "Costi operativi", value: cassaData.mensile.reduce((s, m) => s + m.usciteDettaglio.costiOperativi, 0) },
                      { label: "Cespiti", value: cassaData.mensile.reduce((s, m) => s + m.usciteDettaglio.cespiti, 0) },
                      { label: "Imposte pagate", value: cassaData.mensile.reduce((s, m) => s + m.usciteDettaglio.imposte, 0) },
                      { label: "Dividendi distribuiti", value: cassaData.mensile.reduce((s, m) => s + m.usciteDettaglio.dividendi, 0) },
                      { label: "Compensi amministratore", value: cassaData.mensile.reduce((s, m) => s + m.usciteDettaglio.compensiAmm, 0) },
                    ].filter((r) => r.value > 0).map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="text-sm text-muted-foreground">{row.label}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-red-400">{formatCurrency(row.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Ultime Operazioni ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Ultime Operazioni</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingOps ? (
            <Skeleton className="h-48 w-full" />
          ) : recentOps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna operazione registrata.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>N. Documento</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOps.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>
                      {formatDataItaliana(op.dataOperazione)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TIPO_LABELS[op.tipoOperazione] ?? op.tipoOperazione}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {op.descrizione}
                    </TableCell>
                    <TableCell>{op.numeroDocumento ?? "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(
                        typeof op.importoTotale === "number"
                          ? op.importoTotale
                          : Number(op.importoTotale)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
