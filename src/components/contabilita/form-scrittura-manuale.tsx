"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { CAUSALI_DEFAULT } from "@/lib/contabilita/causali";

// Only show causali that make sense for manual entry
const CAUSALI_MANUALI = CAUSALI_DEFAULT.filter((c) =>
  ["OG", "SAS", "ST", "SC", "SA", "AM", "LQ", "DIV", "CA", "PG", "IN", "F24"].includes(c.codice)
);

interface Conto {
  id: number;
  codice: string;
  descrizione: string;
}

interface MovimentoRow {
  key: string;
  contoId: number | null;
  contoLabel: string;
  importoDare: string;
  importoAvere: string;
  descrizione: string;
}

function emptyRow(): MovimentoRow {
  return {
    key: crypto.randomUUID(),
    contoId: null,
    contoLabel: "",
    importoDare: "",
    importoAvere: "",
    descrizione: "",
  };
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface FormScritturaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function FormScritturaManuale({
  open,
  onOpenChange,
  onSuccess,
}: FormScritturaProps) {
  const [dataRegistrazione, setDataRegistrazione] = useState(todayISO());
  const [dataCompetenza, setDataCompetenza] = useState(todayISO());
  const [causale, setCausale] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [movimenti, setMovimenti] = useState<MovimentoRow[]>([
    emptyRow(),
    emptyRow(),
  ]);
  const [saving, setSaving] = useState(false);

  // Piano dei conti
  const [conti, setConti] = useState<Conto[]>([]);
  const [contiLoading, setContiLoading] = useState(false);
  const contiLoadedRef = useRef(false);

  const fetchConti = useCallback(async () => {
    if (contiLoadedRef.current) return;
    setContiLoading(true);
    try {
      const res = await fetch("/api/piano-dei-conti");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConti(data);
      contiLoadedRef.current = true;
    } catch {
      toast.error("Errore nel caricamento del piano dei conti");
    } finally {
      setContiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchConti();
    }
  }, [open, fetchConti]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setDataRegistrazione(todayISO());
      setDataCompetenza(todayISO());
      setCausale("");
      setDescrizione("");
      setMovimenti([emptyRow(), emptyRow()]);
      setSaving(false);
    }
  }, [open]);

  // Totals
  const totaleDare = movimenti.reduce(
    (sum, m) => sum + (parseFloat(m.importoDare) || 0),
    0
  );
  const totaleAvere = movimenti.reduce(
    (sum, m) => sum + (parseFloat(m.importoAvere) || 0),
    0
  );
  const differenza = Math.round((totaleDare - totaleAvere) * 100) / 100;
  const isBalanced = differenza === 0 && totaleDare > 0;

  const canSave =
    isBalanced &&
    causale !== "" &&
    descrizione.trim().length > 0 &&
    dataRegistrazione !== "" &&
    movimenti.length >= 2 &&
    movimenti.every(
      (m) =>
        m.contoId !== null &&
        ((parseFloat(m.importoDare) || 0) > 0 ||
          (parseFloat(m.importoAvere) || 0) > 0)
    );

  const addRow = () => {
    setMovimenti((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (key: string) => {
    setMovimenti((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((m) => m.key !== key);
    });
  };

  const updateRow = (key: string, field: keyof MovimentoRow, value: string | number | null) => {
    setMovimenti((prev) =>
      prev.map((m) => (m.key === key ? { ...m, [field]: value } : m))
    );
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        dataRegistrazione,
        dataCompetenza,
        causale,
        descrizione: descrizione.trim(),
        stato: "PROVVISORIA",
        movimenti: movimenti.map((m) => ({
          contoId: m.contoId,
          importoDare: parseFloat(m.importoDare) || 0,
          importoAvere: parseFloat(m.importoAvere) || 0,
          descrizione: m.descrizione.trim() || null,
        })),
      };

      const res = await fetch("/api/scritture-contabili", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }

      toast.success("Scrittura contabile creata");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Errore nel salvataggio"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova Scrittura Contabile</DialogTitle>
          <DialogDescription>
            Inserisci una scrittura manuale in partita doppia.
          </DialogDescription>
        </DialogHeader>

        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Data registrazione</label>
            <Input
              type="date"
              value={dataRegistrazione}
              onChange={(e) => setDataRegistrazione(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Data competenza</label>
            <Input
              type="date"
              value={dataCompetenza}
              onChange={(e) => setDataCompetenza(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Causale</label>
            <Select value={causale} onValueChange={setCausale}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona..." />
              </SelectTrigger>
              <SelectContent>
                {CAUSALI_MANUALI.map((c) => (
                  <SelectItem key={c.codice} value={c.codice}>
                    {c.codice} - {c.descrizione}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descrizione</label>
            <Input
              placeholder="Descrizione della scrittura"
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
            />
          </div>
        </div>

        {/* Movimenti table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Movimenti</h3>
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Aggiungi riga
            </Button>
          </div>

          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Conto</th>
                  <th className="text-right p-2 font-medium w-[140px]">Dare</th>
                  <th className="text-right p-2 font-medium w-[140px]">Avere</th>
                  <th className="text-left p-2 font-medium w-[180px]">Descrizione</th>
                  <th className="p-2 w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {movimenti.map((mov) => (
                  <MovimentoRowInput
                    key={mov.key}
                    movimento={mov}
                    conti={conti}
                    contiLoading={contiLoading}
                    onUpdate={(field, value) => updateRow(mov.key, field, value)}
                    onRemove={() => removeRow(mov.key)}
                    canRemove={movimenti.length > 2}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50 font-semibold">
                  <td className="p-2 text-right">Totali:</td>
                  <td className="p-2 text-right font-mono">
                    {totaleDare.toFixed(2)}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {totaleAvere.toFixed(2)}
                  </td>
                  <td colSpan={2} className="p-2">
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded",
                        isBalanced
                          ? "bg-green-500/15 text-green-600 dark:text-green-400"
                          : "bg-red-500/15 text-red-600 dark:text-red-400"
                      )}
                    >
                      {isBalanced
                        ? "Bilanciata"
                        : `Differenza: ${differenza.toFixed(2)}`}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovimentoRowInput({
  movimento,
  conti,
  contiLoading,
  onUpdate,
  onRemove,
  canRemove,
}: {
  movimento: MovimentoRow;
  conti: Conto[];
  contiLoading: boolean;
  onUpdate: (field: keyof MovimentoRow, value: string | number | null) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [comboOpen, setComboOpen] = useState(false);

  return (
    <tr className="border-b last:border-b-0">
      <td className="p-2">
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={comboOpen}
              className="w-full justify-between font-normal h-9 text-sm"
            >
              <span className="truncate">
                {movimento.contoId
                  ? movimento.contoLabel
                  : "Seleziona conto..."}
              </span>
              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder={contiLoading ? "Caricamento..." : "Cerca conto..."}
              />
              <CommandList>
                <CommandEmpty>Nessun conto trovato.</CommandEmpty>
                <CommandGroup>
                  {conti.map((conto) => (
                    <CommandItem
                      key={conto.id}
                      value={`${conto.codice} ${conto.descrizione}`}
                      onSelect={() => {
                        onUpdate("contoId", conto.id);
                        onUpdate(
                          "contoLabel",
                          `${conto.codice} - ${conto.descrizione}`
                        );
                        setComboOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          movimento.contoId === conto.id
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <span className="font-mono text-xs mr-2">
                        {conto.codice}
                      </span>
                      <span className="truncate">{conto.descrizione}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </td>
      <td className="p-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          className="text-right font-mono h-9"
          value={movimento.importoDare}
          onChange={(e) => onUpdate("importoDare", e.target.value)}
        />
      </td>
      <td className="p-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          className="text-right font-mono h-9"
          value={movimento.importoAvere}
          onChange={(e) => onUpdate("importoAvere", e.target.value)}
        />
      </td>
      <td className="p-2">
        <Input
          placeholder="Nota"
          className="h-9"
          value={movimento.descrizione}
          onChange={(e) => onUpdate("descrizione", e.target.value)}
        />
      </td>
      <td className="p-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}
