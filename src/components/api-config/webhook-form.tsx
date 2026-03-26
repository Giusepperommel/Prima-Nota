"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

const EVENTS = [
  "operazione.created", "operazione.updated", "operazione.deleted",
  "fattura.inviata", "fattura.consegnata", "fattura.rifiutata",
  "scadenza.imminente", "alert.created", "portale.messaggio", "portale.operazione",
  "*",
];

interface WebhookFormProps {
  onCreated: () => void;
}

export function WebhookForm({ onCreated }: WebhookFormProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["*"]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const toggleEvent = (event: string) => {
    if (event === "*") { setSelectedEvents(["*"]); return; }
    setSelectedEvents((prev) => {
      const without = prev.filter((e) => e !== "*");
      return without.includes(event) ? without.filter((e) => e !== event) : [...without, event];
    });
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/configurazione/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, eventi: selectedEvents }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedSecret(data.secret);
        onCreated();
      }
    } catch (err) { console.error(err); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) setOpen(true); else { setOpen(false); setCreatedSecret(null); setUrl(""); } }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuovo Webhook</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{createdSecret ? "Webhook Creato" : "Crea Webhook"}</DialogTitle></DialogHeader>
        {createdSecret ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-600 font-medium">Salva il secret — non verr&agrave; pi&ugrave; mostrato.</p>
            <code className="block p-3 bg-muted rounded text-xs break-all">{createdSecret}</code>
            <Button onClick={() => { setOpen(false); setCreatedSecret(null); }}>Chiudi</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input placeholder="https://example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="space-y-2">
              <p className="text-sm font-medium">Eventi</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                    <Checkbox checked={selectedEvents.includes(ev)} onCheckedChange={() => toggleEvent(ev)} />
                    {ev === "*" ? "Tutti gli eventi (*)" : ev}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={!url}>Crea</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
