"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ListTree,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Types
interface Conto {
  id: number;
  codice: string;
  descrizione: string;
  tipo: string;
  voceSp: string | null;
  voceCe: string | null;
  naturaSaldo: string;
  attivo: boolean;
  preConfigurato: boolean;
  modificabile: boolean;
}

interface ContoFormData {
  codice: string;
  descrizione: string;
  tipo: string;
  voceSp: string;
  voceCe: string;
  naturaSaldo: string;
}

const EMPTY_FORM: ContoFormData = {
  codice: "",
  descrizione: "",
  tipo: "PATRIMONIALE_ATTIVO",
  voceSp: "",
  voceCe: "",
  naturaSaldo: "DARE",
};

const TIPO_LABELS: Record<string, string> = {
  PATRIMONIALE_ATTIVO: "Patrimoniale Attivo",
  PATRIMONIALE_PASSIVO: "Patrimoniale Passivo",
  ECONOMICO_COSTO: "Economico Costo",
  ECONOMICO_RICAVO: "Economico Ricavo",
};

const TIPO_ORDER: string[] = [
  "PATRIMONIALE_ATTIVO",
  "PATRIMONIALE_PASSIVO",
  "ECONOMICO_COSTO",
  "ECONOMICO_RICAVO",
];

const NATURA_SALDO_LABELS: Record<string, string> = {
  DARE: "Dare",
  AVERE: "Avere",
};

export default function PianoDeiContiPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const isCommercialista = user?.modalitaCommercialista === true;

  const [conti, setConti] = useState<Conto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ContoFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [initializing, setInitializing] = useState(false);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    PATRIMONIALE_ATTIVO: true,
    PATRIMONIALE_PASSIVO: true,
    ECONOMICO_COSTO: true,
    ECONOMICO_RICAVO: true,
  });

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/piano-dei-conti?${params.toString()}`);
      if (!res.ok) throw new Error("Errore nel caricamento");
      const json = await res.json();
      setConti(json);
    } catch {
      toast.error("Errore nel caricamento del piano dei conti");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      const res = await fetch("/api/piano-dei-conti/inizializza", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'inizializzazione");
      }
      toast.success("Piano dei conti inizializzato con successo");
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Errore nell'inizializzazione");
    } finally {
      setInitializing(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (conto: Conto) => {
    setEditingId(conto.id);
    setForm({
      codice: conto.codice,
      descrizione: conto.descrizione,
      tipo: conto.tipo,
      voceSp: conto.voceSp ?? "",
      voceCe: conto.voceCe ?? "",
      naturaSaldo: conto.naturaSaldo,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.codice.trim() || !form.descrizione.trim()) {
      toast.error("Codice e descrizione sono obbligatori");
      return;
    }

    const codiceRegex = /^\d{3}\.\d{3}$/;
    if (!codiceRegex.test(form.codice)) {
      toast.error("Il codice deve essere nel formato NNN.NNN (es. 310.090)");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codice: form.codice.trim(),
        descrizione: form.descrizione.trim(),
        tipo: form.tipo,
        voceSp: form.voceSp || null,
        voceCe: form.voceCe || null,
        naturaSaldo: form.naturaSaldo,
      };

      const url = editingId
        ? `/api/piano-dei-conti/${editingId}`
        : "/api/piano-dei-conti";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }

      toast.success(editingId ? "Conto aggiornato" : "Conto creato");
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/piano-dei-conti/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Errore nell'eliminazione");
        return;
      }
      toast.success("Conto eliminato");
      fetchData();
    } catch {
      toast.error("Errore nell'eliminazione");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const updateForm = (field: keyof ContoFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSection = (tipo: string) => {
    setOpenSections((prev) => ({ ...prev, [tipo]: !prev[tipo] }));
  };

  // Group conti by tipo
  const groupedConti = TIPO_ORDER.reduce(
    (acc, tipo) => {
      acc[tipo] = conti.filter((c) => c.tipo === tipo);
      return acc;
    },
    {} as Record<string, Conto[]>
  );

  // Show initialization wizard when no conti and not loading
  if (!loading && conti.length === 0 && !debouncedSearch) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ListTree className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Inizializza Piano dei Conti</CardTitle>
            <CardDescription>
              Il piano dei conti non è ancora configurato. Inizializza con il
              piano standard CEE per SRL di servizi.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Verranno creati ~75 conti pre-configurati
            </p>
            <Button
              onClick={handleInitialize}
              disabled={initializing}
              className="w-full"
            >
              <ListTree className="h-4 w-4 mr-2" />
              {initializing
                ? "Inizializzazione in corso..."
                : "Inizializza Piano dei Conti"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Piano dei Conti</h1>
        {isCommercialista && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi Conto
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per codice o descrizione..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Grouped sections */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Caricamento...
        </div>
      ) : (
        <div className="space-y-4">
          {TIPO_ORDER.map((tipo) => {
            const items = groupedConti[tipo] || [];
            return (
              <Collapsible
                key={tipo}
                open={openSections[tipo]}
                onOpenChange={() => toggleSection(tipo)}
              >
                <div className="border rounded-md">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            openSections[tipo] ? "" : "-rotate-90"
                          }`}
                        />
                        <span className="font-semibold">
                          {TIPO_LABELS[tipo] || tipo}
                        </span>
                        <Badge variant="secondary">{items.length}</Badge>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {items.length === 0 ? (
                      <div className="px-4 py-4 text-sm text-muted-foreground border-t">
                        Nessun conto in questa sezione
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[60px]"></TableHead>
                            <TableHead className="w-[120px]">Codice</TableHead>
                            <TableHead>Descrizione</TableHead>
                            <TableHead>Voce SP</TableHead>
                            <TableHead>Voce CE</TableHead>
                            <TableHead>Natura Saldo</TableHead>
                            {isCommercialista && (
                              <TableHead className="text-right">
                                Azioni
                              </TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((conto) => (
                            <TableRow key={conto.id}>
                              <TableCell>
                                <span
                                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                                    conto.attivo
                                      ? "bg-green-500"
                                      : "bg-gray-400"
                                  }`}
                                  title={
                                    conto.attivo ? "Attivo" : "Non attivo"
                                  }
                                />
                              </TableCell>
                              <TableCell className="font-mono text-sm font-medium">
                                {conto.codice}
                              </TableCell>
                              <TableCell>{conto.descrizione}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {conto.voceSp || "\u2014"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {conto.voceCe || "\u2014"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {NATURA_SALDO_LABELS[conto.naturaSaldo] ||
                                    conto.naturaSaldo}
                                </Badge>
                              </TableCell>
                              {isCommercialista && (
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEdit(conto)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setDeleteConfirmId(conto.id)
                                      }
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifica Conto" : "Nuovo Conto"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Codice */}
            <div className="space-y-2">
              <Label htmlFor="codice">Codice *</Label>
              <Input
                id="codice"
                value={form.codice}
                onChange={(e) => updateForm("codice", e.target.value)}
                placeholder="310.090"
                maxLength={7}
                disabled={editingId !== null}
              />
              <p className="text-xs text-muted-foreground">
                Formato: NNN.NNN (es. 310.090)
              </p>
            </div>

            {/* Descrizione */}
            <div className="space-y-2">
              <Label htmlFor="descrizione">Descrizione *</Label>
              <Input
                id="descrizione"
                value={form.descrizione}
                onChange={(e) => updateForm("descrizione", e.target.value)}
                placeholder="Nome del conto"
              />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => updateForm("tipo", v)}
                disabled={editingId !== null}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_ORDER.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {TIPO_LABELS[tipo]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Voce SP */}
            <div className="space-y-2">
              <Label htmlFor="voceSp">Voce Stato Patrimoniale</Label>
              <Input
                id="voceSp"
                value={form.voceSp}
                onChange={(e) => updateForm("voceSp", e.target.value)}
                placeholder="es. B.II.4"
              />
            </div>

            {/* Voce CE */}
            <div className="space-y-2">
              <Label htmlFor="voceCe">Voce Conto Economico</Label>
              <Input
                id="voceCe"
                value={form.voceCe}
                onChange={(e) => updateForm("voceCe", e.target.value)}
                placeholder="es. B.7"
              />
            </div>

            {/* Natura Saldo */}
            <div className="space-y-2">
              <Label>Natura Saldo *</Label>
              <Select
                value={form.naturaSaldo}
                onValueChange={(v) => updateForm("naturaSaldo", v)}
                disabled={editingId !== null}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DARE">Dare</SelectItem>
                  <SelectItem value="AVERE">Avere</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvataggio..." : editingId ? "Aggiorna" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma eliminazione</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sei sicuro di voler eliminare questo conto? L&apos;operazione non
            può essere annullata.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
