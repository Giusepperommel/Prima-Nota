"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface WebhookOption { id: number; url: string; attivo: boolean }
interface Delivery { id: number; evento: string; statoHttp: number | null; stato: string; tentativo: number; payload: any; risposta: string | null; createdAt: string }

export function DeliveryContent() {
  const [webhooks, setWebhooks] = useState<WebhookOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/configurazione/api/webhook");
      if (res.ok) { const data = await res.json(); setWebhooks(data.endpoints || []); }
    } catch (err) { console.error(err); }
  }, []);

  const fetchDeliveries = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/configurazione/api/webhook?endpointId=${id}`);
      if (res.ok) { const data = await res.json(); setDeliveries(data.deliveries || []); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);
  useEffect(() => { if (selectedId) fetchDeliveries(selectedId); }, [selectedId, fetchDeliveries]);

  return (
    <div className="space-y-4">
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger><SelectValue placeholder="Seleziona webhook endpoint..." /></SelectTrigger>
        <SelectContent>
          {webhooks.map((wh) => (
            <SelectItem key={wh.id} value={String(wh.id)}>
              {wh.url} {!wh.attivo && "(disattivo)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
      ) : deliveries.length === 0 ? (
        selectedId ? <p className="text-sm text-muted-foreground text-center py-8">Nessuna consegna</p> : null
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Storico Consegne</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {deliveries.map((d) => (
                <Collapsible key={d.id}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 text-left">
                      <div className="flex items-center gap-3">
                        <Badge variant={d.stato === "CONSEGNATO" ? "default" : "destructive"} className="text-[10px]">{d.stato}</Badge>
                        <span className="text-sm font-mono">{d.evento}</span>
                        <span className="text-xs text-muted-foreground">HTTP {d.statoHttp || "—"}</span>
                        <span className="text-xs text-muted-foreground">Tentativo {d.tentativo}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString("it-IT")}</span>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mx-3 mb-2 rounded border bg-muted/30 p-3 space-y-2">
                      <div>
                        <p className="text-xs font-medium mb-1">Payload</p>
                        <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-32">{JSON.stringify(d.payload, null, 2)}</pre>
                      </div>
                      {d.risposta && (
                        <div>
                          <p className="text-xs font-medium mb-1">Risposta</p>
                          <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-32">{d.risposta}</pre>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
