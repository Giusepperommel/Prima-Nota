"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/business-utils";

type Ricorrenza = {
  id: number;
  attiva: boolean;
  descrizione: string;
  importoTotale: number;
  giornoDelMese: number;
  tipoContratto: string | null;
  dataInizio: string;
  dataFine: string | null;
  prossimaGenerazione: string;
  categoria: { id: number; nome: string };
  createdBy: { id: number; socio: { nome: string; cognome: string } };
};

type EditFormData = {
  descrizione: string;
  importoTotale: string;
  dataFine: string;
};

function formatDate(isoString: string | null): string {
  if (!isoString) return "-";
  const date = new Date(isoString);
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getTipoContrattoBadge(tipo: string | null) {
  if (!tipo) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }
  if (tipo === "LEASING") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 hover:bg-blue-500/20">
        Leasing
      </Badge>
    );
  }
  if (tipo === "NLT") {
    return (
      <Badge className="bg-purple-500/15 text-purple-400 hover:bg-purple-500/20">
        NLT
      </Badge>
    );
  }
  return <Badge variant="outline">{tipo}</Badge>;
}

export function RicorrenzeTable() {
  const [ricorrenze, setRicorrenze] = useState<Ricorrenza[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRicorrenza, setEditingRicorrenza] =
    useState<Ricorrenza | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    descrizione: "",
    importoTotale: "",
    dataFine: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRicorrenza, setDeletingRicorrenza] =
    useState<Ricorrenza | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchRicorrenze = useCallback(async () => {
    try {
      const response = await fetch("/api/operazioni-ricorrenti");
      if (!response.ok) {
        toast.error("Errore nel caricamento delle ricorrenze");
        return;
      }
      const json = await response.json();
      setRicorrenze(json.data);
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRicorrenze();
  }, [fetchRicorrenze]);

  async function handleToggle(ricorrenza: Ricorrenza) {
    const id = ricorrenza.id;
    setTogglingIds((prev) => new Set(prev).add(id));

    try {
      const response = await fetch(`/api/operazioni-ricorrenti/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attiva: !ricorrenza.attiva }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Errore durante l'aggiornamento");
        return;
      }

      setRicorrenze((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, attiva: !ricorrenza.attiva } : r
        )
      );
      toast.success(
        ricorrenza.attiva ? "Ricorrenza disattivata" : "Ricorrenza attivata"
      );
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function openEditDialog(ricorrenza: Ricorrenza) {
    setEditingRicorrenza(ricorrenza);
    setEditFormData({
      descrizione: ricorrenza.descrizione,
      importoTotale: String(ricorrenza.importoTotale),
      dataFine: ricorrenza.dataFine
        ? ricorrenza.dataFine.substring(0, 10)
        : "",
    });
    setEditDialogOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRicorrenza) return;

    const descrizione = editFormData.descrizione.trim();
    if (!descrizione) {
      toast.error("La descrizione è obbligatoria");
      return;
    }

    const importo = parseFloat(editFormData.importoTotale);
    if (isNaN(importo) || importo <= 0) {
      toast.error("L'importo deve essere maggiore di zero");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        descrizione,
        importoTotale: importo,
        dataFine: editFormData.dataFine || null,
      };

      const response = await fetch(
        `/api/operazioni-ricorrenti/${editingRicorrenza.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Errore durante il salvataggio");
        return;
      }

      // Re-fetch to get full data with relations
      await fetchRicorrenze();
      toast.success("Ricorrenza aggiornata con successo");
      setEditDialogOpen(false);
      setEditingRicorrenza(null);
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openDeleteDialog(ricorrenza: Ricorrenza) {
    setDeletingRicorrenza(ricorrenza);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingRicorrenza) return;
    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/operazioni-ricorrenti/${deletingRicorrenza.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Errore durante l'eliminazione");
        return;
      }

      setRicorrenze((prev) =>
        prev.filter((r) => r.id !== deletingRicorrenza.id)
      );
      toast.success("Ricorrenza eliminata con successo");
      setDeleteDialogOpen(false);
      setDeletingRicorrenza(null);
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Operazioni Ricorrenti</CardTitle>
          <CardDescription>Caricamento in corso...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Operazioni Ricorrenti</CardTitle>
            <CardDescription>
              Gestisci le spese ricorrenti, attiva o disattiva la generazione
              automatica.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {ricorrenze.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground text-sm">
                Nessuna operazione ricorrente configurata.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Importo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Giorno del mese</TableHead>
                  <TableHead>Tipo contratto</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ricorrenze.map((ric) => (
                  <TableRow
                    key={ric.id}
                    className={!ric.attiva ? "opacity-50" : undefined}
                  >
                    <TableCell className="font-medium">
                      <span
                        className={!ric.attiva ? "line-through" : undefined}
                      >
                        {ric.descrizione}
                      </span>
                      {ric.dataFine && (
                        <p className="text-muted-foreground text-xs mt-0.5 font-normal">
                          Scadenza: {formatDate(ric.dataFine)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(ric.importoTotale)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ric.categoria.nome}</Badge>
                    </TableCell>
                    <TableCell>{ric.giornoDelMese}</TableCell>
                    <TableCell>{getTipoContrattoBadge(ric.tipoContratto)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={ric.attiva}
                          onCheckedChange={() => handleToggle(ric)}
                          disabled={togglingIds.has(ric.id)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {ric.attiva ? (
                            <Badge className="bg-green-500/15 text-green-400 hover:bg-green-500/20">
                              Attiva
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-500/15 text-gray-400 hover:bg-gray-500/20">
                              Disattiva
                            </Badge>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(ric)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifica</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(ric)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Elimina</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifica Ricorrenza</DialogTitle>
            <DialogDescription>
              Modifica i dati dell&apos;operazione ricorrente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-descrizione">Descrizione *</Label>
                <Input
                  id="edit-descrizione"
                  value={editFormData.descrizione}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      descrizione: e.target.value,
                    }))
                  }
                  placeholder="Descrizione dell'operazione"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-importo">Importo Totale *</Label>
                <Input
                  id="edit-importo"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editFormData.importoTotale}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      importoTotale: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-dataFine">Data Fine</Label>
                <Input
                  id="edit-dataFine"
                  type="date"
                  value={editFormData.dataFine}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      dataFine: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvataggio..." : "Salva Modifiche"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare la ricorrenza{" "}
              <strong>&quot;{deletingRicorrenza?.descrizione}&quot;</strong>?
              Questa azione non può essere annullata. Le bozze associate
              verranno eliminate e le operazioni confermate verranno scollegate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminazione..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
