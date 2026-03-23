"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LogIn,
  TrendingUp,
  TrendingDown,
  Percent,
  Bell,
  CalendarClock,
  StickyNote,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Circle,
} from "lucide-react";
import type { Azienda, Scadenza, Nota } from "./aziende-content";

// ---------- Helpers ----------

function formatCurrency(value: number): string {
  return value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  if (!isFinite(value)) return "N/D";
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + "%";
}

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

const TIPO_BADGE_COLORS: Record<string, string> = {
  FISCALE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  CONTABILE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  GENERICA: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const PRIORITA_ICON: Record<string, string> = {
  ALTA: "text-red-500",
  MEDIA: "text-yellow-500",
  BASSA: "text-gray-400",
};

const NOTE_COLORS = [
  { value: "blue", label: "Blu", css: "border-l-blue-500" },
  { value: "green", label: "Verde", css: "border-l-green-500" },
  { value: "yellow", label: "Giallo", css: "border-l-yellow-500" },
  { value: "red", label: "Rosso", css: "border-l-red-500" },
  { value: "purple", label: "Viola", css: "border-l-purple-500" },
  { value: "gray", label: "Grigio", css: "border-l-gray-400" },
];

function getNoteBorderClass(colore: string | null): string {
  const found = NOTE_COLORS.find((c) => c.value === colore);
  return found ? found.css : "border-l-gray-400";
}

const COLOR_DOT_CLASSES: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  gray: "bg-gray-400",
};

// ---------- Card ----------

type Props = {
  azienda: Azienda;
  onUpdate: () => void;
};

export function AziendaCard({ azienda, onUpdate }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [switching, setSwitching] = useState(false);

  const { societa, ruolo, fatturatoYTD, costiYTD, alertNonLetti, scadenze, note } = azienda;
  const margine = fatturatoYTD > 0 ? ((fatturatoYTD - costiYTD) / fatturatoYTD) * 100 : 0;

  async function handleEntra() {
    setSwitching(true);
    try {
      const res = await fetch("/api/auth/switch-societa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ societaId: societa.id }),
      });
      if (!res.ok) throw new Error();
      await update({ societaId: societa.id });
      router.push("/dashboard");
    } catch {
      setSwitching(false);
    }
  }

  return (
    <Card className="flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg truncate">{societa.ragioneSociale}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{societa.tipoAttivita}</span>
              <span className="text-xs text-muted-foreground">P.IVA {societa.partitaIva}</span>
              <Badge variant="outline" className="text-xs">
                {ruolo}
              </Badge>
            </div>
          </div>
          <Button size="sm" onClick={handleEntra} disabled={switching}>
            {switching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-1" />
                Entra
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 pt-0">
        {/* KPI Section */}
        <div className="grid grid-cols-3 gap-3">
          <KpiMini
            icon={<TrendingUp className="h-3.5 w-3.5 text-green-600" />}
            label="Fatturato YTD"
            value={formatCurrency(fatturatoYTD)}
          />
          <KpiMini
            icon={<TrendingDown className="h-3.5 w-3.5 text-red-600" />}
            label="Costi YTD"
            value={formatCurrency(costiYTD)}
          />
          <KpiMini
            icon={<Percent className="h-3.5 w-3.5 text-blue-600" />}
            label="Margine"
            value={formatPercent(margine)}
          />
        </div>

        {/* Alert */}
        {alertNonLetti > 0 && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm">
            <Bell className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-amber-800 dark:text-amber-400">
              <strong>{alertNonLetti}</strong> alert non {alertNonLetti === 1 ? "letto" : "letti"}
            </span>
          </div>
        )}

        {/* Scadenze */}
        <ScadenzeSection
          scadenze={scadenze}
          societaId={societa.id}
          onUpdate={onUpdate}
        />

        {/* Note */}
        <NoteSection
          note={note}
          utenteAziendaId={azienda.utenteAziendaId}
          onUpdate={onUpdate}
        />
      </CardContent>
    </Card>
  );
}

// ---------- KPI Mini ----------

function KpiMini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border p-2.5 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}

// ---------- Scadenze Section ----------

function ScadenzeSection({
  scadenze: initialScadenze,
  onUpdate,
}: {
  scadenze: Scadenza[];
  societaId: number;
  onUpdate: () => void;
}) {
  const [scadenze, setScadenze] = useState(initialScadenze);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    descrizione: "",
    dataScadenza: "",
    tipoScadenza: "GENERICA",
    priorita: "MEDIA",
  });

  async function handleToggle(id: number, completata: boolean) {
    // Optimistic update
    setScadenze((prev) => prev.filter((s) => s.id !== id));

    try {
      await fetch(`/api/scadenze/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completata }),
      });
      onUpdate();
    } catch {
      // Revert on error
      onUpdate();
    }
  }

  async function handleAdd() {
    if (!formData.descrizione.trim() || !formData.dataScadenza) return;
    setSaving(true);
    try {
      const res = await fetch("/api/scadenze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          // The API uses session societaId; we need to switch first or handle differently.
          // For now the scadenza is created in the current session context.
          // We rely on onUpdate to refresh data.
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setScadenze((prev) => [
          ...prev,
          {
            id: created.id,
            descrizione: created.descrizione,
            dataScadenza: created.dataScadenza,
            tipoScadenza: created.tipoScadenza,
            priorita: created.priorita,
            completata: false,
          },
        ]);
        setFormData({ descrizione: "", dataScadenza: "", tipoScadenza: "GENERICA", priorita: "MEDIA" });
        setShowForm(false);
        onUpdate();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Scadenze</span>
        {scadenze.length > 0 && (
          <Badge variant="secondary" className="text-xs ml-auto">
            {scadenze.length}
          </Badge>
        )}
      </div>

      {scadenze.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground mb-2">Nessuna scadenza in sospeso</p>
      )}

      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {scadenze.map((s) => {
          const overdue = isOverdue(s.dataScadenza);
          return (
            <div
              key={s.id}
              className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm ${
                overdue ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20" : ""
              }`}
            >
              <Checkbox
                className="mt-0.5 shrink-0"
                onCheckedChange={() => handleToggle(s.id, true)}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-tight ${overdue ? "text-red-700 dark:text-red-400" : ""}`}>
                  {s.descrizione}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className={`text-xs ${overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                    {new Date(s.dataScadenza + "T00:00:00").toLocaleDateString("it-IT")}
                  </span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${TIPO_BADGE_COLORS[s.tipoScadenza]}`}>
                    {s.tipoScadenza}
                  </span>
                  {s.priorita === "ALTA" && (
                    <AlertTriangle className={`h-3 w-3 ${PRIORITA_ICON[s.priorita]}`} />
                  )}
                  {s.priorita === "MEDIA" && (
                    <Circle className={`h-3 w-3 fill-current ${PRIORITA_ICON[s.priorita]}`} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add scadenza form */}
      {showForm ? (
        <div className="mt-2 space-y-2 rounded-md border p-2.5">
          <Input
            placeholder="Descrizione"
            value={formData.descrizione}
            onChange={(e) => setFormData((p) => ({ ...p, descrizione: e.target.value }))}
            className="h-8 text-sm"
          />
          <Input
            type="date"
            value={formData.dataScadenza}
            onChange={(e) => setFormData((p) => ({ ...p, dataScadenza: e.target.value }))}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Select
              value={formData.tipoScadenza}
              onValueChange={(v) => setFormData((p) => ({ ...p, tipoScadenza: v }))}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FISCALE">Fiscale</SelectItem>
                <SelectItem value="CONTABILE">Contabile</SelectItem>
                <SelectItem value="GENERICA">Generica</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={formData.priorita}
              onValueChange={(v) => setFormData((p) => ({ ...p, priorita: v }))}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALTA">Alta</SelectItem>
                <SelectItem value="MEDIA">Media</SelectItem>
                <SelectItem value="BASSA">Bassa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowForm(false)}
            >
              <X className="h-3 w-3 mr-1" />
              Annulla
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAdd}
              disabled={saving || !formData.descrizione.trim() || !formData.dataScadenza}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Salva
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-7 text-xs text-muted-foreground"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Aggiungi scadenza
        </Button>
      )}
    </div>
  );
}

// ---------- Note Section ----------

function NoteSection({
  note: initialNote,
  onUpdate,
}: {
  note: Nota[];
  utenteAziendaId: number;
  onUpdate: () => void;
}) {
  const [note, setNote] = useState(initialNote);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editColor, setEditColor] = useState("gray");
  const [formData, setFormData] = useState({ testo: "", colore: "gray" });

  async function handleAdd() {
    if (!formData.testo.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/note-azienda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo: formData.testo, colore: formData.colore }),
      });
      if (res.ok) {
        const created = await res.json();
        setNote((prev) => [created, ...prev]);
        setFormData({ testo: "", colore: "gray" });
        setShowForm(false);
        onUpdate();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setNote((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch(`/api/note-azienda/${id}`, { method: "DELETE" });
      onUpdate();
    } catch {
      onUpdate();
    }
  }

  function startEdit(n: Nota) {
    setEditingId(n.id);
    setEditText(n.testo);
    setEditColor(n.colore || "gray");
  }

  async function handleSaveEdit() {
    if (!editingId || !editText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/note-azienda/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo: editText, colore: editColor }),
      });
      if (res.ok) {
        const updated = await res.json();
        setNote((prev) => prev.map((n) => (n.id === editingId ? updated : n)));
        setEditingId(null);
        onUpdate();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <StickyNote className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Note</span>
        {note.length > 0 && (
          <Badge variant="secondary" className="text-xs ml-auto">
            {note.length}
          </Badge>
        )}
      </div>

      {note.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground mb-2">Nessuna nota</p>
      )}

      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {note.map((n) =>
          editingId === n.id ? (
            <div key={n.id} className="rounded-md border p-2 space-y-2">
              <Input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="h-8 text-sm"
              />
              <ColorPicker value={editColor} onChange={setEditColor} />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEditingId(null)}
                >
                  <X className="h-3 w-3 mr-1" />
                  Annulla
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSaveEdit}
                  disabled={saving || !editText.trim()}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                  Salva
                </Button>
              </div>
            </div>
          ) : (
            <div
              key={n.id}
              className={`flex items-start gap-2 rounded-md border-l-4 border bg-card px-2.5 py-1.5 ${getNoteBorderClass(n.colore)}`}
            >
              <p className="text-sm flex-1 min-w-0 leading-tight">{n.testo}</p>
              <div className="flex gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => startEdit(n)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive"
                  onClick={() => handleDelete(n.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Add note form */}
      {showForm ? (
        <div className="mt-2 space-y-2 rounded-md border p-2.5">
          <Input
            placeholder="Testo della nota"
            value={formData.testo}
            onChange={(e) => setFormData((p) => ({ ...p, testo: e.target.value }))}
            className="h-8 text-sm"
          />
          <ColorPicker
            value={formData.colore}
            onChange={(v) => setFormData((p) => ({ ...p, colore: v }))}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowForm(false)}
            >
              <X className="h-3 w-3 mr-1" />
              Annulla
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAdd}
              disabled={saving || !formData.testo.trim()}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Salva
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-7 text-xs text-muted-foreground"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Aggiungi nota
        </Button>
      )}
    </div>
  );
}

// ---------- Color Picker ----------

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
          <span
            className={`inline-block h-3 w-3 rounded-full ${COLOR_DOT_CLASSES[value] || "bg-gray-400"}`}
          />
          Colore
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="flex gap-1.5">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange(c.value)}
              className={`h-6 w-6 rounded-full ${COLOR_DOT_CLASSES[c.value]} ring-offset-background transition-all ${
                value === c.value ? "ring-2 ring-ring ring-offset-2" : ""
              }`}
              title={c.label}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
