"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2 } from "lucide-react";

interface PortalConfig {
  portaleAttivo: boolean;
  logoUrl: string | null;
  firmaEmail: string | null;
  reportAutomatici: boolean;
  invioEmailAutomatico: boolean;
  clientePuoCaricareFatture: boolean;
  clienteVedeSituazioneIva: boolean;
  clienteVedeSaldo: boolean;
  clienteVedeScadenze: boolean;
}

export function PortalBrandingForm() {
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/portale-config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.configurazione || data);
      }
    } catch (err) {
      console.error("[Branding] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await fetch("/api/portale-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } catch (err) {
      console.error("[Branding] Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) return <div className="h-60 bg-muted animate-pulse rounded-xl" />;

  const update = (field: keyof PortalConfig, value: unknown) => setConfig({ ...config, [field]: value });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profilo Portale</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Portale Attivo</p>
            <p className="text-xs text-muted-foreground">Abilita/disabilita l&apos;accesso al portale clienti</p>
          </div>
          <Switch checked={config.portaleAttivo} onCheckedChange={(v) => update("portaleAttivo", v)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">URL Logo</label>
          <Input placeholder="https://example.com/logo.png" value={config.logoUrl || ""} onChange={(e) => update("logoUrl", e.target.value || null)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Firma Email</label>
          <Textarea placeholder="Firma personalizzata per le email del portale..." value={config.firmaEmail || ""} onChange={(e) => update("firmaEmail", e.target.value || null)} rows={3} />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Opzioni</p>
          {[
            { field: "reportAutomatici" as const, label: "Report automatici", desc: "Genera e invia report periodici ai clienti" },
            { field: "invioEmailAutomatico" as const, label: "Email automatiche", desc: "Invia email di notifica ai clienti" },
            { field: "clientePuoCaricareFatture" as const, label: "Upload fatture", desc: "I clienti possono caricare fatture" },
            { field: "clienteVedeSituazioneIva" as const, label: "Mostra IVA", desc: "I clienti vedono la situazione IVA" },
            { field: "clienteVedeSaldo" as const, label: "Mostra saldo", desc: "I clienti vedono il saldo" },
            { field: "clienteVedeScadenze" as const, label: "Mostra scadenze", desc: "I clienti vedono le scadenze" },
          ].map((opt) => (
            <div key={opt.field} className="flex items-center justify-between">
              <div>
                <p className="text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
              <Switch checked={config[opt.field] as boolean} onCheckedChange={(v) => update(opt.field, v)} />
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Salva Configurazione
        </Button>
      </CardContent>
    </Card>
  );
}
