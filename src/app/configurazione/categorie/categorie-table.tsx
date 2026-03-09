"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CategoriaSpesa = {
  id: number;
  societaId: number;
  nome: string;
  percentualeDeducibilita: number;
  descrizione: string | null;
  tipoCategoria: string | null;
  attiva: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormData = {
  nome: string;
  percentualeDeducibilita: string;
  descrizione: string;
  tipoCategoria: string;
};

const TIPI_CATEGORIA = [
  "Costi di gestione",
  "Costi del personale",
  "Utenze",
  "Consulenze",
  "Tasse e imposte",
  "Ammortamenti",
  "Spese di rappresentanza",
  "Spese di viaggio",
  "Assicurazioni",
  "Altro",
] as const;

const emptyFormData: FormData = {
  nome: "",
  percentualeDeducibilita: "100",
  descrizione: "",
  tipoCategoria: "",
};

function getDeducibilitaBadge(percentuale: number) {
  const label = `${percentuale}%`;
  if (percentuale === 100) {
    return (
      <Badge className="bg-green-500/15 text-green-400 hover:bg-green-500/20">
        {label}
      </Badge>
    );
  }
  if (percentuale === 0) {
    return (
      <Badge className="bg-red-500/15 text-red-400 hover:bg-red-500/20">
        {label}
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/20">
      {label}
    </Badge>
  );
}

export function CategorieTable({
  initialData,
}: {
  initialData: CategoriaSpesa[];
}) {
  const router = useRouter();
  const [categorie, setCategorie] = useState<CategoriaSpesa[]>(initialData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());

  function openCreateDialog() {
    setEditingId(null);
    setFormData(emptyFormData);
    setDialogOpen(true);
  }

  function openEditDialog(categoria: CategoriaSpesa) {
    setEditingId(categoria.id);
    setFormData({
      nome: categoria.nome,
      percentualeDeducibilita: String(categoria.percentualeDeducibilita),
      descrizione: categoria.descrizione || "",
      tipoCategoria: categoria.tipoCategoria || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        nome: formData.nome.trim(),
        percentualeDeducibilita: Number(formData.percentualeDeducibilita),
        descrizione: formData.descrizione.trim() || null,
        tipoCategoria: formData.tipoCategoria || null,
      };

      if (!payload.nome) {
        toast.error("Il nome della categoria e obbligatorio");
        setIsSubmitting(false);
        return;
      }

      const percentuale = payload.percentualeDeducibilita;
      if (isNaN(percentuale) || percentuale < 0 || percentuale > 100) {
        toast.error("La percentuale deve essere compresa tra 0 e 100");
        setIsSubmitting(false);
        return;
      }

      let response: Response;

      if (editingId) {
        response = await fetch(`/api/categorie-spesa/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch("/api/categorie-spesa", {
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

      const savedCategoria: CategoriaSpesa = await response.json();

      if (editingId) {
        setCategorie((prev) =>
          prev.map((c) => (c.id === editingId ? savedCategoria : c))
        );
        toast.success("Categoria aggiornata con successo");
      } else {
        setCategorie((prev) => [...prev, savedCategoria]);
        toast.success("Categoria creata con successo");
      }

      setDialogOpen(false);
      setFormData(emptyFormData);
      setEditingId(null);
      router.refresh();
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(id: number) {
    setTogglingIds((prev) => new Set(prev).add(id));

    try {
      const response = await fetch(`/api/categorie-spesa/${id}`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Errore durante l'aggiornamento");
        return;
      }

      const updated: CategoriaSpesa = await response.json();
      setCategorie((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast.success(
        updated.attiva ? "Categoria attivata" : "Categoria disattivata"
      );
      router.refresh();
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Categorie di Spesa</CardTitle>
            <CardDescription>
              Gestisci le categorie di spesa e le relative percentuali di
              deducibilita fiscale.
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nuova Categoria
          </Button>
        </CardHeader>
        <CardContent>
          {categorie.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground text-sm">
                Nessuna categoria di spesa configurata.
              </p>
              <Button variant="outline" className="mt-4" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Crea la prima categoria
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Deducibilita</TableHead>
                  <TableHead>Tipo Categoria</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorie.map((cat) => (
                  <TableRow
                    key={cat.id}
                    className={
                      !cat.attiva ? "opacity-50" : undefined
                    }
                  >
                    <TableCell className="font-medium">
                      <span className={!cat.attiva ? "line-through" : undefined}>
                        {cat.nome}
                      </span>
                      {cat.descrizione && (
                        <p className="text-muted-foreground text-xs mt-0.5 font-normal">
                          {cat.descrizione}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {getDeducibilitaBadge(cat.percentualeDeducibilita)}
                    </TableCell>
                    <TableCell>
                      {cat.tipoCategoria ? (
                        <Badge variant="outline">{cat.tipoCategoria}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={cat.attiva}
                          onCheckedChange={() => handleToggle(cat.id)}
                          disabled={togglingIds.has(cat.id)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {cat.attiva ? "Attiva" : "Inattiva"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(cat)}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Modifica</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifica Categoria" : "Nuova Categoria di Spesa"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Modifica i dati della categoria di spesa."
                : "Inserisci i dati per creare una nuova categoria di spesa."}
            </DialogDescription>
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
                  placeholder="Es. Carburante, Cancelleria..."
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="percentualeDeducibilita">
                  Percentuale Deducibilita (%) *
                </Label>
                <Input
                  id="percentualeDeducibilita"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.percentualeDeducibilita}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      percentualeDeducibilita: e.target.value,
                    }))
                  }
                  placeholder="Es. 100, 50, 0..."
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tipoCategoria">Tipo Categoria</Label>
                <Select
                  value={formData.tipoCategoria}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      tipoCategoria: value === "__none__" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona un tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessun tipo</SelectItem>
                    {TIPI_CATEGORIA.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="descrizione">Descrizione</Label>
                <Textarea
                  id="descrizione"
                  value={formData.descrizione}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      descrizione: e.target.value,
                    }))
                  }
                  placeholder="Descrizione opzionale della categoria..."
                  rows={3}
                />
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Salvataggio..."
                  : editingId
                    ? "Salva Modifiche"
                    : "Crea Categoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
