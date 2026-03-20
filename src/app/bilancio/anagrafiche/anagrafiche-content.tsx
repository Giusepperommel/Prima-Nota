"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

// Types
interface Anagrafica {
  id: number;
  denominazione: string;
  partitaIva: string | null;
  codiceFiscale: string | null;
  tipoSoggetto: "AZIENDA" | "PERSONA_FISICA" | "PROFESSIONISTA";
  tipo: "FORNITORE" | "CLIENTE" | "ENTRAMBI";
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  soggettoARitenuta: boolean;
  regimeForfettario: boolean;
  tipoRitenuta: string | null;
  autoCreataOcr: boolean;
}

interface FormData {
  denominazione: string;
  partitaIva: string;
  codiceFiscale: string;
  tipoSoggetto: string;
  tipo: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
  soggettoARitenuta: boolean;
  regimeForfettario: boolean;
  tipoRitenuta: string;
}

const EMPTY_FORM: FormData = {
  denominazione: "",
  partitaIva: "",
  codiceFiscale: "",
  tipoSoggetto: "AZIENDA",
  tipo: "FORNITORE",
  indirizzo: "",
  cap: "",
  citta: "",
  provincia: "",
  soggettoARitenuta: false,
  regimeForfettario: false,
  tipoRitenuta: "",
};

const TIPO_BADGE_COLORS: Record<string, string> = {
  FORNITORE: "bg-blue-100 text-blue-800",
  CLIENTE: "bg-green-100 text-green-800",
  ENTRAMBI: "bg-purple-100 text-purple-800",
};

const SOGGETTO_LABELS: Record<string, string> = {
  AZIENDA: "Azienda",
  PERSONA_FISICA: "Persona Fisica",
  PROFESSIONISTA: "Professionista",
};

const TIPO_RITENUTA_OPTIONS = [
  { value: "LAVORO_AUTONOMO", label: "Lavoro Autonomo" },
  { value: "PROVVIGIONI", label: "Provvigioni" },
  { value: "OCCASIONALE", label: "Occasionale" },
  { value: "DIRITTI_AUTORE", label: "Diritti d'Autore" },
];

export function AnagraficheContent() {
  const [anagrafiche, setAnagrafiche] = useState<Anagrafica[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

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
      if (filtroTipo !== "ALL") params.set("tipo", filtroTipo);
      const res = await fetch(`/api/anagrafiche?${params.toString()}`);
      if (!res.ok) throw new Error("Errore nel caricamento");
      const json = await res.json();
      setAnagrafiche(json.data);
    } catch {
      toast.error("Errore nel caricamento delle anagrafiche");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filtroTipo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (a: Anagrafica) => {
    setEditingId(a.id);
    setForm({
      denominazione: a.denominazione,
      partitaIva: a.partitaIva ?? "",
      codiceFiscale: a.codiceFiscale ?? "",
      tipoSoggetto: a.tipoSoggetto,
      tipo: a.tipo,
      indirizzo: a.indirizzo ?? "",
      cap: a.cap ?? "",
      citta: a.citta ?? "",
      provincia: a.provincia ?? "",
      soggettoARitenuta: a.soggettoARitenuta,
      regimeForfettario: a.regimeForfettario,
      tipoRitenuta: a.tipoRitenuta ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.denominazione.trim()) {
      toast.error("La denominazione è obbligatoria");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        denominazione: form.denominazione.trim(),
        partitaIva: form.partitaIva || null,
        codiceFiscale: form.codiceFiscale || null,
        tipoSoggetto: form.tipoSoggetto,
        tipo: form.tipo,
        indirizzo: form.indirizzo || null,
        cap: form.cap || null,
        citta: form.citta || null,
        provincia: form.provincia || null,
        soggettoARitenuta: form.soggettoARitenuta,
        regimeForfettario: form.regimeForfettario,
        tipoRitenuta: form.soggettoARitenuta ? form.tipoRitenuta || null : null,
      };

      const url = editingId
        ? `/api/anagrafiche/${editingId}`
        : "/api/anagrafiche";
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

      toast.success(editingId ? "Anagrafica aggiornata" : "Anagrafica creata");
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
      const res = await fetch(`/api/anagrafiche/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Errore nell'eliminazione");
        return;
      }
      toast.success("Anagrafica eliminata");
      fetchData();
    } catch {
      toast.error("Errore nell'eliminazione");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const updateForm = (field: keyof FormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Anagrafiche</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuova Anagrafica
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per denominazione o P.IVA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtra per tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tutti</SelectItem>
            <SelectItem value="FORNITORE">Fornitori</SelectItem>
            <SelectItem value="CLIENTE">Clienti</SelectItem>
            <SelectItem value="ENTRAMBI">Entrambi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Denominazione</TableHead>
              <TableHead>P.IVA</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Soggetto</TableHead>
              <TableHead>Regime</TableHead>
              <TableHead>Ritenuta</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : anagrafiche.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nessuna anagrafica trovata
                </TableCell>
              </TableRow>
            ) : (
              anagrafiche.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.denominazione}
                    {a.autoCreataOcr && (
                      <Badge variant="outline" className="ml-2 bg-orange-100 text-orange-800 border-orange-300">
                        OCR
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {a.partitaIva || "\u2014"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={TIPO_BADGE_COLORS[a.tipo]}>
                      {a.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {SOGGETTO_LABELS[a.tipoSoggetto] || a.tipoSoggetto}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.regimeForfettario && (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        Forfettario
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {a.soggettoARitenuta && (
                      <Check className="h-4 w-4 text-green-600" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(a.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifica Anagrafica" : "Nuova Anagrafica"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Denominazione */}
            <div className="space-y-2">
              <Label htmlFor="denominazione">Denominazione *</Label>
              <Input
                id="denominazione"
                value={form.denominazione}
                onChange={(e) => updateForm("denominazione", e.target.value)}
                placeholder="Ragione sociale o nome"
              />
            </div>

            {/* P.IVA */}
            <div className="space-y-2">
              <Label htmlFor="partitaIva">Partita IVA</Label>
              <Input
                id="partitaIva"
                value={form.partitaIva}
                onChange={(e) => updateForm("partitaIva", e.target.value)}
                placeholder="12345678901"
                maxLength={11}
              />
            </div>

            {/* Codice Fiscale */}
            <div className="space-y-2">
              <Label htmlFor="codiceFiscale">Codice Fiscale</Label>
              <Input
                id="codiceFiscale"
                value={form.codiceFiscale}
                onChange={(e) => updateForm("codiceFiscale", e.target.value)}
                placeholder="RSSMRA80A01H501U"
                maxLength={16}
              />
            </div>

            {/* Tipo Soggetto */}
            <div className="space-y-2">
              <Label>Tipo Soggetto</Label>
              <Select
                value={form.tipoSoggetto}
                onValueChange={(v) => updateForm("tipoSoggetto", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AZIENDA">Azienda</SelectItem>
                  <SelectItem value="PERSONA_FISICA">Persona Fisica</SelectItem>
                  <SelectItem value="PROFESSIONISTA">Professionista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo Anagrafica */}
            <div className="space-y-2">
              <Label>Tipo Anagrafica</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => updateForm("tipo", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FORNITORE">Fornitore</SelectItem>
                  <SelectItem value="CLIENTE">Cliente</SelectItem>
                  <SelectItem value="ENTRAMBI">Entrambi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Indirizzo */}
            <div className="space-y-2">
              <Label htmlFor="indirizzo">Indirizzo</Label>
              <Input
                id="indirizzo"
                value={form.indirizzo}
                onChange={(e) => updateForm("indirizzo", e.target.value)}
                placeholder="Via/Piazza..."
              />
            </div>

            {/* CAP, Citta, Provincia */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cap">CAP</Label>
                <Input
                  id="cap"
                  value={form.cap}
                  onChange={(e) => updateForm("cap", e.target.value)}
                  placeholder="00100"
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="citta">Città</Label>
                <Input
                  id="citta"
                  value={form.citta}
                  onChange={(e) => updateForm("citta", e.target.value)}
                  placeholder="Roma"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provincia">Provincia</Label>
                <Input
                  id="provincia"
                  value={form.provincia}
                  onChange={(e) => updateForm("provincia", e.target.value)}
                  placeholder="RM"
                  maxLength={2}
                />
              </div>
            </div>

            {/* Soggetto a Ritenuta */}
            <div className="flex items-center justify-between">
              <Label htmlFor="soggettoARitenuta">Soggetto a Ritenuta</Label>
              <Switch
                id="soggettoARitenuta"
                checked={form.soggettoARitenuta}
                onCheckedChange={(v) => updateForm("soggettoARitenuta", v)}
              />
            </div>

            {/* Tipo Ritenuta - visible only if soggettoARitenuta */}
            {form.soggettoARitenuta && (
              <div className="space-y-2">
                <Label>Tipo Ritenuta</Label>
                <Select
                  value={form.tipoRitenuta}
                  onValueChange={(v) => updateForm("tipoRitenuta", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo ritenuta" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_RITENUTA_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Regime Forfettario */}
            <div className="flex items-center justify-between">
              <Label htmlFor="regimeForfettario">Regime Forfettario</Label>
              <Switch
                id="regimeForfettario"
                checked={form.regimeForfettario}
                onCheckedChange={(v) => updateForm("regimeForfettario", v)}
              />
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
            Sei sicuro di voler eliminare questa anagrafica? L&apos;operazione non può essere annullata.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
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
