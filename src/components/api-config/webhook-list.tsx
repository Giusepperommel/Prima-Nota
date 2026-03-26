"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Webhook, ChevronDown } from "lucide-react";
import { WebhookForm } from "./webhook-form";
import { DeliveryHistory } from "./delivery-history";

interface WebhookData {
  id: number;
  url: string;
  eventi: string[];
  attivo: boolean;
  consecutiviFalliti: number;
  ultimaConsegna: string | null;
  createdAt: string;
}

export function WebhookList() {
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/configurazione/api/webhook");
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.endpoints || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Webhook</CardTitle>
        <WebhookForm onCreated={fetchWebhooks} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun webhook configurato</p>
        ) : (
          <div className="space-y-2">
            {webhooks.map((wh) => (
              <Collapsible key={wh.id}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                    <div>
                      <p className="text-sm font-mono truncate max-w-[300px]">{wh.url}</p>
                      <div className="flex gap-1 mt-1">
                        <Badge variant={wh.attivo ? "default" : "destructive"} className="text-[10px]">
                          {wh.attivo ? "Attivo" : "Disattivo"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{wh.eventi.length === 1 && wh.eventi[0] === "*" ? "Tutti" : `${wh.eventi.length} eventi`}</Badge>
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <DeliveryHistory endpointId={wh.id} />
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
