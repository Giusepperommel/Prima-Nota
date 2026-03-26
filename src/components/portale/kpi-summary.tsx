"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiItem {
  codice: string;
  nome: string;
  valore: number;
  variazione: number | null;
  trend: string | null;
}

interface KpiSummaryProps {
  kpis: KpiItem[];
}

export function KpiSummary({ kpis }: KpiSummaryProps) {
  const display = kpis.filter((k) => ["RICAVI", "COSTI", "MARGINE_LORDO", "UTILE_NETTO"].includes(k.codice));

  return (
    <div className="grid grid-cols-2 gap-3">
      {display.map((kpi) => {
        const Icon = kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : Minus;
        const trendColor = kpi.trend === "up" ? "text-emerald-600" : kpi.trend === "down" ? "text-red-600" : "text-gray-400";
        return (
          <Card key={kpi.codice}>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">{kpi.nome}</p>
              <p className="text-xl font-bold">€ {kpi.valore.toLocaleString("it-IT", { maximumFractionDigits: 0 })}</p>
              {kpi.variazione !== null && (
                <span className={`inline-flex items-center gap-1 text-xs ${trendColor}`}>
                  <Icon className="h-3 w-3" />
                  {kpi.variazione > 0 ? "+" : ""}{kpi.variazione.toFixed(1)}%
                </span>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
