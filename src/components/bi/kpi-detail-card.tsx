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
