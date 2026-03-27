# Fase 6: Configurazione Avanzata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build UI for alert rule customization, per-client portal permission matrix with presets, and portal branding configuration — completing the entire frontend roadmap.

**Architecture:** New components and pages integrating with existing APIs (`/api/configurazione/alert`, `/api/portale/permessi`, `/api/portale-config`). Alert rules page at `/configurazione/alert`. Permission matrix integrated into existing `/configurazione/accessi` or as standalone section. Portal branding in existing portale-config flow.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Card, Switch, Select, Input, Slider, Tabs, Badge, Table), Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-03-26-frontend-infrastruttura-roadmap.md` (Fase 6)

---

## File Structure

### New files
```
src/components/configurazione/
  alert-rule-list.tsx            — Alert rules grouped by category with toggle/edit
  alert-rule-editor.tsx          — Inline editor for rule thresholds/severity/channels
  permission-matrix.tsx          — Grid of sections × lettura/scrittura per client
  permission-presets.tsx         — Quick preset buttons (base, operativo, completo)
  portal-branding-form.tsx       — Logo, color, welcome message, footer

src/app/(app)/configurazione/alert/
  page.tsx                       — Alert config server page
  alert-config-content.tsx       — Alert config client content
```

---

## Task 1: AlertRuleEditor Component

**Files:**
- Create: `src/components/configurazione/alert-rule-editor.tsx`

- [ ] **Step 1: Create AlertRuleEditor**

```tsx
// src/components/configurazione/alert-rule-editor.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Save, X } from "lucide-react";

interface AlertRule {
  codice: string;
  descrizione: string;
  categoria: string;
  defaultGravita: string;
  defaultSogliaGiorni: number | null;
  defaultSogliaValore: number | null;
  // DB override values (if any)
  attiva?: boolean;
  gravita?: string;
  sogliaGiorni?: number | null;
  sogliaValore?: number | null;
  canali?: string[];
  ruoliDestinatari?: string[];
}

interface AlertRuleEditorProps {
  rule: AlertRule;
  onSave: (codice: string, updates: Record<string, unknown>) => Promise<void>;
}

const CANALI = ["IN_APP", "EMAIL"];
const RUOLI = ["ADMIN", "STANDARD", "COMMERCIALISTA"];

export function AlertRuleEditor({ rule, onSave }: AlertRuleEditorProps) {
  const [editing, setEditing] = useState(false);
  const [attiva, setAttiva] = useState(rule.attiva ?? true);
  const [gravita, setGravita] = useState(rule.gravita || rule.defaultGravita);
  const [sogliaGiorni, setSogliaGiorni] = useState(rule.sogliaGiorni ?? rule.defaultSogliaGiorni);
  const [sogliaValore, setSogliaValore] = useState(rule.sogliaValore ?? rule.defaultSogliaValore);
  const [canali, setCanali] = useState<string[]>(rule.canali || ["IN_APP"]);
  const [ruoli, setRuoli] = useState<string[]>(rule.ruoliDestinatari || ["ADMIN"]);
  const [saving, setSaving] = useState(false);

  const toggleCanale = (c: string) => setCanali((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  const toggleRuolo = (r: string) => setRuoli((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(rule.codice, { attiva, gravita, sogliaGiorni, sogliaValore, canali, ruoliDestinatari: ruoli });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const GRAVITA_COLORS: Record<string, string> = { CRITICAL: "destructive", WARNING: "secondary", INFO: "outline" };

  if (!editing) {
    return (
      <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 cursor-pointer" onClick={() => setEditing(true)}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${!attiva ? "line-through text-muted-foreground" : ""}`}>{rule.descrizione}</span>
            <Badge variant={(GRAVITA_COLORS[gravita] || "outline") as any} className="text-[10px]">{gravita}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sogliaGiorni != null ? `${sogliaGiorni} giorni` : ""}
            {sogliaValore != null ? `${sogliaGiorni != null ? " | " : ""}soglia: ${sogliaValore}` : ""}
            {" · "}{canali.join(", ")} · {ruoli.join(", ")}
          </p>
        </div>
        <Switch checked={attiva} onCheckedChange={(v) => { setAttiva(v); onSave(rule.codice, { attiva: v }); }} onClick={(e) => e.stopPropagation()} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{rule.descrizione}</p>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium">Gravità</label>
          <Select value={gravita} onValueChange={setGravita}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {rule.defaultSogliaGiorni != null && (
          <div>
            <label className="text-xs font-medium">Soglia Giorni</label>
            <Input type="number" className="h-8 text-xs" value={sogliaGiorni ?? ""} onChange={(e) => setSogliaGiorni(e.target.value ? Number(e.target.value) : null)} />
          </div>
        )}
        {rule.defaultSogliaValore != null && (
          <div>
            <label className="text-xs font-medium">Soglia Valore</label>
            <Input type="number" className="h-8 text-xs" value={sogliaValore ?? ""} onChange={(e) => setSogliaValore(e.target.value ? Number(e.target.value) : null)} />
          </div>
        )}
      </div>
      <div className="flex gap-6">
        <div>
          <label className="text-xs font-medium block mb-1">Canali</label>
          <div className="flex gap-3">
            {CANALI.map((c) => (
              <label key={c} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked={canali.includes(c)} onCheckedChange={() => toggleCanale(c)} /> {c}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Destinatari</label>
          <div className="flex gap-3">
            {RUOLI.map((r) => (
              <label key={r} className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked={ruoli.includes(r)} onCheckedChange={() => toggleRuolo(r)} /> {r}
              </label>
            ))}
          </div>
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        <Save className="h-3.5 w-3.5 mr-1" /> Salva
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/configurazione/alert-rule-editor.tsx
git commit -m "feat(fase6): add AlertRuleEditor component with inline editing"
```

---

## Task 2: AlertRuleList and Alert Config Page

**Files:**
- Create: `src/components/configurazione/alert-rule-list.tsx`
- Create: `src/app/(app)/configurazione/alert/page.tsx`
- Create: `src/app/(app)/configurazione/alert/alert-config-content.tsx`

- [ ] **Step 1: Create AlertRuleList**

```tsx
// src/components/configurazione/alert-rule-list.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertRuleEditor } from "./alert-rule-editor";

interface RuleData {
  codice: string;
  descrizione: string;
  categoria: string;
  defaultGravita: string;
  defaultSogliaGiorni: number | null;
  defaultSogliaValore: number | null;
  // DB overrides
  attiva?: boolean;
  gravita?: string;
  sogliaGiorni?: number | null;
  sogliaValore?: number | null;
  canali?: string[];
  ruoliDestinatari?: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  SCADENZE: "Scadenze",
  ANOMALIE_CONTABILI: "Anomalie Contabili",
  CASH_FLOW: "Cash Flow",
  COMPLIANCE: "Compliance",
  CONFRONTO: "Confronto",
  RICONCILIAZIONE: "Riconciliazione",
};

export function AlertRuleList() {
  const [rules, setRules] = useState<RuleData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/configurazione/alert");
      if (res.ok) {
        const data = await res.json();
        // Merge builtin rules with DB overrides
        const builtins: RuleData[] = data.regoleBuiltin || [];
        const dbRules: any[] = data.regole || [];

        const merged = builtins.map((b) => {
          const db = dbRules.find((d: any) => d.codice === b.codice);
          if (db) {
            return { ...b, attiva: db.attiva, gravita: db.gravita, sogliaGiorni: db.sogliaGiorni, sogliaValore: db.sogliaValore, canali: db.canali, ruoliDestinatari: db.ruoliDestinatari };
          }
          return b;
        });
        setRules(merged);
      }
    } catch (err) {
      console.error("[AlertRules] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleSave = useCallback(async (codice: string, updates: Record<string, unknown>) => {
    try {
      await fetch("/api/configurazione/alert", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codice, ...updates }),
      });
      fetchRules();
    } catch (err) {
      console.error("[AlertRules] Save error:", err);
    }
  }, [fetchRules]);

  // Group by category
  const grouped = rules.reduce<Record<string, RuleData[]>>((acc, rule) => {
    const cat = rule.categoria;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(rule);
    return acc;
  }, {});

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, catRules]) => (
        <Card key={cat}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{CATEGORY_LABELS[cat] || cat}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {catRules.map((rule) => (
              <AlertRuleEditor key={rule.codice} rule={rule} onSave={handleSave} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create alert config page**

Read `src/app/(app)/configurazione/api/page.tsx` for pattern, then:

```tsx
// src/app/(app)/configurazione/alert/page.tsx
import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { AlertConfigContent } from "./alert-config-content";

export default async function AlertConfigPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Configurazione Alert" user={user}>
      <AlertConfigContent />
    </AuthenticatedLayout>
  );
}
```

```tsx
// src/app/(app)/configurazione/alert/alert-config-content.tsx
"use client";

import { AlertRuleList } from "@/components/configurazione/alert-rule-list";

export function AlertConfigContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Personalizza soglie, gravità, canali e destinatari per ogni regola di alert. Le modifiche si applicano solo alla tua società.
      </p>
      <AlertRuleList />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/configurazione/alert-rule-list.tsx src/app/(app)/configurazione/alert/
git commit -m "feat(fase6): add alert rules configuration page with grouped editors"
```

---

## Task 3: PermissionMatrix and PermissionPresets Components

**Files:**
- Create: `src/components/configurazione/permission-matrix.tsx`
- Create: `src/components/configurazione/permission-presets.tsx`

- [ ] **Step 1: Create PermissionPresets**

```tsx
// src/components/configurazione/permission-presets.tsx
"use client";

import { Button } from "@/components/ui/button";

interface Permesso {
  sezione: string;
  lettura: boolean;
  scrittura: boolean;
}

const PRESETS: { nome: string; descrizione: string; permessi: Permesso[] }[] = [
  {
    nome: "Visualizzazione Base",
    descrizione: "Solo lettura su KPI, scadenze, fatture",
    permessi: [
      { sezione: "KPI", lettura: true, scrittura: false },
      { sezione: "PRIMA_NOTA", lettura: false, scrittura: false },
      { sezione: "DOCUMENTI", lettura: true, scrittura: false },
      { sezione: "CHAT", lettura: true, scrittura: true },
      { sezione: "IVA", lettura: true, scrittura: false },
      { sezione: "SCADENZARIO", lettura: true, scrittura: false },
      { sezione: "FATTURE", lettura: true, scrittura: false },
      { sezione: "F24", lettura: false, scrittura: false },
      { sezione: "BILANCIO", lettura: false, scrittura: false },
      { sezione: "REPORT", lettura: true, scrittura: false },
    ],
  },
  {
    nome: "Operativo",
    descrizione: "Lettura + scrittura su documenti, chat, prima nota",
    permessi: [
      { sezione: "KPI", lettura: true, scrittura: false },
      { sezione: "PRIMA_NOTA", lettura: true, scrittura: true },
      { sezione: "DOCUMENTI", lettura: true, scrittura: true },
      { sezione: "CHAT", lettura: true, scrittura: true },
      { sezione: "IVA", lettura: true, scrittura: false },
      { sezione: "SCADENZARIO", lettura: true, scrittura: false },
      { sezione: "FATTURE", lettura: true, scrittura: false },
      { sezione: "F24", lettura: true, scrittura: false },
      { sezione: "BILANCIO", lettura: false, scrittura: false },
      { sezione: "REPORT", lettura: true, scrittura: false },
    ],
  },
  {
    nome: "Completo",
    descrizione: "Accesso completo a tutte le sezioni",
    permessi: [
      { sezione: "KPI", lettura: true, scrittura: false },
      { sezione: "PRIMA_NOTA", lettura: true, scrittura: true },
      { sezione: "DOCUMENTI", lettura: true, scrittura: true },
      { sezione: "CHAT", lettura: true, scrittura: true },
      { sezione: "IVA", lettura: true, scrittura: false },
      { sezione: "SCADENZARIO", lettura: true, scrittura: true },
      { sezione: "FATTURE", lettura: true, scrittura: true },
      { sezione: "F24", lettura: true, scrittura: false },
      { sezione: "BILANCIO", lettura: true, scrittura: false },
      { sezione: "REPORT", lettura: true, scrittura: false },
    ],
  },
];

interface PermissionPresetsProps {
  onApply: (permessi: Permesso[]) => void;
}

export function PermissionPresets({ onApply }: PermissionPresetsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PRESETS.map((preset) => (
        <Button key={preset.nome} variant="outline" size="sm" onClick={() => onApply(preset.permessi)} title={preset.descrizione}>
          {preset.nome}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create PermissionMatrix**

```tsx
// src/components/configurazione/permission-matrix.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2 } from "lucide-react";
import { PermissionPresets } from "./permission-presets";

interface Permesso {
  sezione: string;
  lettura: boolean;
  scrittura: boolean;
}

interface ClienteOption {
  id: number;
  nome: string;
  email: string;
}

const SEZIONE_LABELS: Record<string, string> = {
  KPI: "KPI Dashboard",
  PRIMA_NOTA: "Prima Nota",
  DOCUMENTI: "Documenti",
  CHAT: "Messaggistica",
  IVA: "Situazione IVA",
  SCADENZARIO: "Scadenzario",
  FATTURE: "Fatture",
  F24: "F24",
  BILANCIO: "Bilancio",
  REPORT: "Report",
};

interface PermissionMatrixProps {
  clienti: ClienteOption[];
}

export function PermissionMatrix({ clienti }: PermissionMatrixProps) {
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [permessi, setPermessi] = useState<Permesso[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPermessi = useCallback(async (clienteId: string) => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/portale/permessi?clienteId=${clienteId}`);
      if (res.ok) {
        const data = await res.json();
        setPermessi(data.permessi || []);
      }
    } catch (err) {
      console.error("[Permessi] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClienteId) fetchPermessi(selectedClienteId);
  }, [selectedClienteId, fetchPermessi]);

  const togglePermesso = (sezione: string, campo: "lettura" | "scrittura") => {
    setPermessi((prev) => prev.map((p) => p.sezione === sezione ? { ...p, [campo]: !p[campo] } : p));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/portale/permessi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessoClienteId: Number(selectedClienteId), permessi }),
      });
    } catch (err) {
      console.error("[Permessi] Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Permessi Portale</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
          <SelectTrigger><SelectValue placeholder="Seleziona cliente..." /></SelectTrigger>
          <SelectContent>
            {clienti.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.nome} ({c.email})</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedClienteId && !loading && (
          <>
            <PermissionPresets onApply={setPermessi} />

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Sezione</th>
                    <th className="text-center p-3 font-medium w-24">Lettura</th>
                    <th className="text-center p-3 font-medium w-24">Scrittura</th>
                  </tr>
                </thead>
                <tbody>
                  {permessi.map((p) => (
                    <tr key={p.sezione} className="border-t">
                      <td className="p-3">{SEZIONE_LABELS[p.sezione] || p.sezione}</td>
                      <td className="p-3 text-center">
                        <Checkbox checked={p.lettura} onCheckedChange={() => togglePermesso(p.sezione, "lettura")} />
                      </td>
                      <td className="p-3 text-center">
                        <Checkbox checked={p.scrittura} onCheckedChange={() => togglePermesso(p.sezione, "scrittura")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salva Permessi
            </Button>
          </>
        )}

        {loading && <div className="h-40 bg-muted animate-pulse rounded-lg" />}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/configurazione/permission-matrix.tsx src/components/configurazione/permission-presets.tsx
git commit -m "feat(fase6): add PermissionMatrix and PermissionPresets components"
```

---

## Task 4: Portal Branding Form

**Files:**
- Create: `src/components/configurazione/portal-branding-form.tsx`

- [ ] **Step 1: Create PortalBrandingForm**

```tsx
// src/components/configurazione/portal-branding-form.tsx
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
            <p className="text-xs text-muted-foreground">Abilita/disabilita l'accesso al portale clienti</p>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/configurazione/portal-branding-form.tsx
git commit -m "feat(fase6): add portal branding form with config toggles"
```

---

## Task 5: Integrate into Existing Configuration Pages

**Files:**
- Modify: existing configurazione accessi page (or create integration point)

- [ ] **Step 1: Read existing config pages**

Read `src/app/(app)/configurazione/` to find the accessi page and portale-config page. Determine where to integrate PermissionMatrix and PortalBrandingForm.

- [ ] **Step 2: Integrate PermissionMatrix**

Add PermissionMatrix to the accessi configuration page. It needs to fetch clienti from `/api/portale-config/clienti` (existing endpoint). Add it as a new section or tab.

- [ ] **Step 3: Integrate PortalBrandingForm**

Add PortalBrandingForm to the existing portale configuration section, or create a standalone section in the configurazione area.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/configurazione/
git commit -m "feat(fase6): integrate permission matrix and branding into config pages"
```

---

## Task 6: Full Build Verification

- [ ] **Step 1: Run full project tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: TypeScript compiles successfully.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(fase6): address build issues"
```

---

## Summary

| Task | Component | Type |
|------|-----------|------|
| 1 | AlertRuleEditor (inline editing) | New component |
| 2 | AlertRuleList + Config page (/configurazione/alert) | New component + page |
| 3 | PermissionMatrix + PermissionPresets | New components |
| 4 | PortalBrandingForm | New component |
| 5 | Integration into existing config pages | Integration |
| 6 | Full build verification | Verification |

**Total: 6 tasks, ~6 new components, 1 new page, ~6 commits**
