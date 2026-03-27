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
            <Badge variant={(GRAVITA_COLORS[gravita] || "outline") as "destructive" | "secondary" | "outline"} className="text-[10px]">{gravita}</Badge>
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
          <label className="text-xs font-medium">Gravita</label>
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
