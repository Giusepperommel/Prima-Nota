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
        const nuovi = data.conteggi?.find((c: { stato: string; _count: number }) => c.stato === "NUOVO");
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
