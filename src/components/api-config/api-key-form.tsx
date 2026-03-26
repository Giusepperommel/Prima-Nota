"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

const SCOPE_GROUPS = [
  { label: "Operazioni", scopes: ["read:operazioni", "write:operazioni"] },
  { label: "Anagrafiche", scopes: ["read:anagrafiche", "write:anagrafiche"] },
  { label: "Scritture", scopes: ["read:scritture", "write:scritture"] },
  { label: "Fatture", scopes: ["read:fatture", "write:fatture"] },
  { label: "Registri IVA", scopes: ["read:registri-iva"] },
  { label: "Liquidazioni", scopes: ["read:liquidazioni"] },
  { label: "F24", scopes: ["read:f24"] },
  { label: "Piano Conti", scopes: ["read:piano-conti", "write:piano-conti"] },
  { label: "Alert", scopes: ["read:alert"] },
  { label: "Todo", scopes: ["read:todo"] },
  { label: "KPI", scopes: ["read:kpi"] },
  { label: "Report", scopes: ["read:report"] },
  { label: "Webhook", scopes: ["webhook:manage"] },
];

interface ApiKeyFormProps {
  onCreated: () => void;
}

export function ApiKeyForm({ onCreated }: ApiKeyFormProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/configurazione/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, scopes: selectedScopes }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.rawKey);
        onCreated();
      }
    } catch (err) {
      console.error("[ApiKey] Create error:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setNome("");
    setSelectedScopes([]);
    setCreatedKey(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuova Chiave</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{createdKey ? "Chiave Creata" : "Crea Chiave API"}</DialogTitle></DialogHeader>
        {createdKey ? (
          <div className="space-y-3">
            <p className="text-sm text-amber-600 font-medium">Salva questa chiave — non verr&agrave; pi&ugrave; mostrata.</p>
            <code className="block p-3 bg-muted rounded text-xs break-all">{createdKey}</code>
            <Button onClick={handleClose}>Chiudi</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input placeholder="Nome chiave" value={nome} onChange={(e) => setNome(e.target.value)} />
            <div className="space-y-2">
              <p className="text-sm font-medium">Permessi (scopes)</p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {SCOPE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{group.label}</p>
                    {group.scopes.map((scope) => (
                      <label key={scope} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                        <Checkbox
                          checked={selectedScopes.includes(scope)}
                          onCheckedChange={() => toggleScope(scope)}
                        />
                        {scope}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={!nome || selectedScopes.length === 0 || creating}>Crea</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
