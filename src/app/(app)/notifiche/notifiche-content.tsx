"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
