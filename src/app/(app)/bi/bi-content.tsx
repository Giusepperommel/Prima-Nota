"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodSelector } from "@/components/bi/period-selector";
import { KpiDetailCard } from "@/components/bi/kpi-detail-card";
import { ComparisonBarChart } from "@/components/bi/comparison-bar-chart";

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
