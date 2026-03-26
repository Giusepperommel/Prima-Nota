"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthBadge } from "@/components/portale/health-badge";
import { KpiSummary } from "@/components/portale/kpi-summary";
import { ScadenzaCountdown } from "@/components/portale/scadenza-countdown";
import { AlertTriangle, Bell, TrendingUp, Calendar } from "lucide-react";

interface KpiItem {
  codice: string;
  nome: string;
  categoria: string;
  valore: number;
  variazione: number | null;
  trend: string | null;
}

interface Scadenza {
  id: number;
  tipo: string;
  scadenza: string;
  stato: string;
  percentualeCompletamento: number;
}

interface Alert {
  id: number;
  tipo: string;
  gravita: string;
  messaggio: string;
  stato: string;
  createdAt: string;
}

interface KpiData {
  healthScore: { punteggio: number } | null;
  kpis: KpiItem[];
  scadenze: Scadenza[];
  alerts: Alert[];
}

const GRAVITA_VARIANT: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
  CRITICA: "destructive",
  ALTA: "destructive",
  MEDIA: "secondary",
  BASSA: "outline",
};

export function DashboardContent() {
  const router = useRouter();
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("portale_token");
    if (!token) {
      router.push("/portale/login");
      return null;
    }
    return token;
  }, [router]);

  const fetchKpiData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch("/api/portale/kpi", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem("portale_token");
        localStorage.removeItem("portale_nome");
        localStorage.removeItem("portale_ruolo");
        router.push("/portale/login");
        return;
      }

      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("[Dashboard] Error fetching KPI data:", error);
    } finally {
      setLoading(false);
    }
  }, [getToken, router]);

  useEffect(() => {
    fetchKpiData();
  }, [fetchKpiData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Impossibile caricare i dati della dashboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health Score + KPI Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HealthBadge score={data.healthScore?.punteggio ?? null} />

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Indicatori Principali
            </CardTitle>
          </CardHeader>
          <CardContent>
            <KpiSummary kpis={data.kpis} />
          </CardContent>
        </Card>
      </div>

      {/* Scadenze + Alerts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scadenze */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Prossime Scadenze
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScadenzaCountdown scadenze={data.scadenze} />
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Avvisi Recenti
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessun avviso attivo
              </p>
            ) : (
              <div className="space-y-2">
                {data.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <AlertTriangle
                      className={`h-4 w-4 mt-0.5 shrink-0 ${
                        alert.gravita === "CRITICA" || alert.gravita === "ALTA"
                          ? "text-red-500"
                          : alert.gravita === "MEDIA"
                            ? "text-amber-500"
                            : "text-gray-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={GRAVITA_VARIANT[alert.gravita] || "outline"}
                          className="text-[10px]"
                        >
                          {alert.gravita}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(alert.createdAt).toLocaleDateString("it-IT")}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{alert.messaggio}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
