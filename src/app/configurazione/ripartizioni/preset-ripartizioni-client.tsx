"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { formatPercentuale } from "@/lib/business-utils";

type Socio = {
  id: number;
  nome: string;
  cognome: string;
  attivo: boolean;
};

type PresetSocio = {
  id: number;
  presetRipartizioneId: number;
  socioId: number;
  percentuale: number;
  socio: Socio;
};

type Preset = {
  id: number;
  societaId: number;
  nome: string;
  tipiOperazione: string[];
  ordinamento: number;
  soci: PresetSocio[];
  createdAt: string;
  updatedAt: string;
};

const TIPI_OPERAZIONE_LABELS: Record<string, string> = {
  FATTURA_ATTIVA: "Fattura Attiva",
  COSTO: "Costo",
  CESPITE: "Cespite",
};

const TIPI_OPERAZIONE = ["FATTURA_ATTIVA", "COSTO", "CESPITE"] as const;

type FormData = {
  nome: string;
  tipiOperazione: string[];
  soci: { socioId: number; percentuale: string }[];
};

function getEmptyFormData(soci: Socio[]): FormData {
  return {
    nome: "",
    tipiOperazione: [],
    soci: soci.map((s) => ({ socioId: s.id, percentuale: "" })),
  };
}

export function PresetRipartizioniClient({
  initialPresets,
  soci,
}: {
  initialPresets: Preset[];
  soci: Socio[];
}) {
  const router = useRouter();
  const [presets, setPresets] = useState<Preset[]>(initialPresets);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(getEmptyFormData(soci));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletePreset, setDeletePreset] = useState<Preset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const sommaPercentuali = formData.soci.reduce(
    (sum, s) => sum + (parseFloat(s.percentuale) || 0),
    0
  );
  const isSommaValida = Math.abs(sommaPercentuali - 100) < 0.01;
  const isFormValid =
    formData.nome.trim() !== "" &&
    formData.tipiOperazione.length > 0 &&
    isSommaValida &&
    formData.soci.some((s) => parseFloat(s.percentuale) > 0);

  function openCreateDialog() {
    setEditingId(null);
    setFormData(getEmptyFormData(soci));
    setDialogOpen(true);
  }

  function openEditDialog(preset: Preset) {
    setEditingId(preset.id);
    setFormData({
      nome: preset.nome,
      tipiOperazione: [...preset.tipiOperazione],
      soci: soci.map((s) => {
        const existing = preset.soci.find((ps) => ps.socioId === s.id);
        return {
          socioId: s.id,
          percentuale: existing ? String(existing.percentuale) : "",
        };
      }),
    });
    setDialogOpen(true);
  }

  function handleTipoChange(tipo: string, checked: boolean) {
    setFormData((prev) => ({
      ...prev,
      tipiOperazione: checked
        ? [...prev.tipiOperazione, tipo]
        : prev.tipiOperazione.filter((t) => t !== tipo),
    }));
  }

  function handlePercentualeChange(socioId: number, value: string) {
    setFormData((prev) => ({
      ...prev,
      soci: prev.soci.map((s) =>
        s.socioId === socioId ? { ...s, percentuale: value } : s
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;
    setIsSubmitting(true);

    try {
      const payload = {
        nome: formData.nome.trim(),
        tipiOperazione: formData.tipiOperazione,
        soci: formData.soci
          .filter((s) => parseFloat(s.percentuale) > 0)
          .map((s) => ({
            socioId: s.socioId,
            percentuale: parseFloat(s.percentuale),
          })),
      };

      let response: Response;

      if (editingId) {
        response = await fetch(`/api/preset-ripartizioni/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch("/api/preset-ripartizioni", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Errore durante il salvataggio");
        setIsSubmitting(false);
        return;
      }

      const savedPreset: Preset = await response.json();

      if (editingId) {
        setPresets((prev) =>
          prev.map((p) => (p.id === editingId ? savedPreset : p))
        );
        toast.success("Preset aggiornato con successo");
      } else {
        setPresets((prev) => [...prev, savedPreset]);
        toast.success("Preset creato con successo");
      }

      setDialogOpen(false);
      setFormData(getEmptyFormData(soci));
      setEditingId(null);
      router.refresh();
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletePreset) return;
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/preset-ripartizioni/${deletePreset.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Errore durante l'eliminazione");
        return;
      }

      setPresets((prev) => prev.filter((p) => p.id !== deletePreset.id));
      toast.success("Preset eliminato con successo");
      setDeletePreset(null);
      router.refresh();
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleReorder(presetId: number, direction: "up" | "down") {
    const idx = presets.findIndex((p) => p.id === presetId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === presets.length - 1) return;

    setIsReordering(true);

    const newPresets = [...presets];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newPresets[idx], newPresets[swapIdx]] = [
      newPresets[swapIdx],
      newPresets[idx],
    ];

    const ordine = newPresets.map((p, i) => ({
      id: p.id,
      ordinamento: i + 1,
    }));

    // Optimistically update
    setPresets(newPresets);

    try {
      const response = await fetch("/api/preset-ripartizioni/riordina", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordine }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Errore durante il riordinamento");
        setPresets(presets); // Revert
        return;
      }

      router.refresh();
    } catch {
      toast.error("Errore di connessione al server");
      setPresets(presets); // Revert
    } finally {
      setIsReordering(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Preset di Ripartizione</CardTitle>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Preset
          </Button>
        </CardHeader>
        <CardContent>
          {presets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground text-sm">
                Nessun preset di ripartizione configurato.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={openCreateDialog}
              >
                <Plus className="mr-2 h-4 w-4" />
                Crea il primo preset
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {presets.map((preset, index) => {
                const hasInactiveSocio = preset.soci.some(
                  (s) => !s.socio.attivo
                );

                return (
                  <Card key={preset.id} className="border">
                    <CardContent className="flex items-start justify-between gap-4 pt-6">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base">
                            {preset.nome}
                          </h3>
                          {hasInactiveSocio && (
                            <Badge className="bg-orange-500/15 text-orange-400 hover:bg-orange-500/20">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Socio inattivo
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {preset.tipiOperazione.map((tipo) => (
                            <Badge key={tipo} variant="outline">
                              {TIPI_OPERAZIONE_LABELS[tipo] || tipo}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          {preset.soci.map((ps) => (
                            <span
                              key={ps.id}
                              className={!ps.socio.attivo ? "line-through" : ""}
                            >
                              {ps.socio.cognome} {ps.socio.nome}:{" "}
                              {formatPercentuale(ps.percentuale)}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorder(preset.id, "up")}
                          disabled={index === 0 || isReordering}
                        >
                          <ArrowUp className="h-4 w-4" />
                          <span className="sr-only">Sposta su</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReorder(preset.id, "down")}
                          disabled={
                            index === presets.length - 1 || isReordering
                          }
                        >
                          <ArrowDown className="h-4 w-4" />
                          <span className="sr-only">Sposta giu</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(preset)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifica</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletePreset(preset)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Elimina</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifica Preset" : "Nuovo Preset di Ripartizione"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nome: e.target.value }))
                  }
                  placeholder="Es. Ripartizione 50/50, Ripartizione standard..."
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label>Tipi Operazione *</Label>
                <div className="flex flex-wrap gap-4">
                  {TIPI_OPERAZIONE.map((tipo) => (
                    <div key={tipo} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tipo-${tipo}`}
                        checked={formData.tipiOperazione.includes(tipo)}
                        onCheckedChange={(checked) =>
                          handleTipoChange(tipo, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`tipo-${tipo}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {TIPI_OPERAZIONE_LABELS[tipo]}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Ripartizione Soci *</Label>
                  <Badge
                    className={
                      isSommaValida
                        ? "bg-green-500/15 text-green-400 hover:bg-green-500/20"
                        : "bg-red-500/15 text-red-400 hover:bg-red-500/20"
                    }
                  >
                    Totale: {sommaPercentuali.toFixed(2)}%
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Socio</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="w-[120px]">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {soci.map((socio) => {
                      const socioForm = formData.soci.find(
                        (s) => s.socioId === socio.id
                      );
                      return (
                        <TableRow
                          key={socio.id}
                          className={!socio.attivo ? "opacity-50" : undefined}
                        >
                          <TableCell className="font-medium">
                            {socio.cognome} {socio.nome}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                socio.attivo
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {socio.attivo ? "Attivo" : "Inattivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={socioForm?.percentuale ?? ""}
                              onChange={(e) =>
                                handlePercentualeChange(
                                  socio.id,
                                  e.target.value
                                )
                              }
                              placeholder="0"
                              className="w-[100px]"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={isSubmitting || !isFormValid}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : editingId ? (
                  "Salva Modifiche"
                ) : (
                  "Crea Preset"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletePreset}
        onOpenChange={(open: boolean) => !open && setDeletePreset(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare il preset &quot;{deletePreset?.nome}
              &quot;? Questa azione non puo essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                "Elimina"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
