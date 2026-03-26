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
