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
