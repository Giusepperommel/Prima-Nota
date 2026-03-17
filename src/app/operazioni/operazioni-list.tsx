"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/business-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";

type Socio = {
  id: number;
  nome: string;
  cognome: string;
  quotaPercentuale: number;
};

type Categoria = {
  id: number;
  nome: string;
};

type Ripartizione = {
  id: number;
  socioId: number;
  percentuale: number;
  importoCalcolato: number;
  socio: { id: number; nome: string; cognome: string; quotaPercentuale: number };
};

type Operazione = {
  id: number;
  tipoOperazione: string;
  dataOperazione: string;
  numeroDocumento: string | null;
  descrizione: string;
  importoTotale: number;
  importoDeducibile: number;
  percentualeDeducibilita: number;
  tipoRipartizione: string;
  categoriaId: number | null;
  createdByUserId: number;
  categoria: { id: number; nome: string } | null;
  ripartizioni: Ripartizione[];
  createdBy: {
    id: number;
    socio: { id: number; nome: string; cognome: string };
  };
};

type Props = {
  soci: Socio[];
  categorie: Categoria[];
  ruolo: string;
  userId: number;
};

const TIPO_OPERAZIONE_LABELS: Record<string, string> = {
  FATTURA_ATTIVA: "Fattura Attiva",
  COSTO: "Costo",
  CESPITE: "Cespite",
  PAGAMENTO_IMPOSTE: "Pag. Imposte",
  DISTRIBUZIONE_DIVIDENDI: "Dividendi",
  COMPENSO_AMMINISTRATORE: "Comp. Amm.",
};

const TIPO_RIPARTIZIONE_LABELS: Record<string, string> = {
  COMUNE: "Comune",
  SINGOLO: "Singolo",
  CUSTOM: "Custom",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function TipoBadge({ tipo }: { tipo: string }) {
  const colorMap: Record<string, string> = {
    FATTURA_ATTIVA: "bg-green-500/15 text-green-400 border-green-500/25",
    COSTO: "bg-red-500/15 text-red-400 border-red-500/25",
    CESPITE: "bg-violet-500/15 text-violet-400 border-violet-500/25",
    PAGAMENTO_IMPOSTE: "bg-orange-100 text-orange-800 border-orange-200",
    DISTRIBUZIONE_DIVIDENDI: "bg-purple-100 text-purple-800 border-purple-200",
    COMPENSO_AMMINISTRATORE: "bg-sky-100 text-sky-800 border-sky-200",
  };
  return (
    <Badge variant="outline" className={colorMap[tipo] || ""}>
      {TIPO_OPERAZIONE_LABELS[tipo] || tipo}
    </Badge>
  );
}

function RipartizioneBadge({ tipo }: { tipo: string }) {
  const colorMap: Record<string, string> = {
    COMUNE: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    SINGOLO: "bg-purple-500/15 text-purple-400 border-purple-500/25",
    CUSTOM: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  };
  return (
    <Badge variant="outline" className={colorMap[tipo] || ""}>
      {TIPO_RIPARTIZIONE_LABELS[tipo] || tipo}
    </Badge>
  );
}

export function OperazioniList({ soci, categorie, ruolo, userId }: Props) {
  const router = useRouter();
  const [operazioni, setOperazioni] = useState<Operazione[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [loading, setLoading] = useState(true);

  // Filters
  const [da, setDa] = useState("");
  const [a, setA] = useState("");
  const [tipo, setTipo] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [socioId, setSocioId] = useState("");
  const [tipoRipartizione, setTipoRipartizione] = useState("");
  const [q, setQ] = useState("");
  const [searchText, setSearchText] = useState("");

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [operazioneToDelete, setOperazioneToDelete] = useState<Operazione | null>(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = ruolo === "ADMIN";

  const fetchOperazioni = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(perPage));
      if (da) params.set("da", da);
      if (a) params.set("a", a);
      if (tipo) params.set("tipo", tipo);
      if (categoriaId) params.set("categoriaId", categoriaId);
      if (socioId) params.set("socioId", socioId);
      if (tipoRipartizione) params.set("tipoRipartizione", tipoRipartizione);
      if (q) params.set("q", q);

      const res = await fetch(`/api/operazioni?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel caricamento");
      }
      const json = await res.json();
      setOperazioni(json.data);
      setTotal(json.total);
    } catch (error: any) {
      toast.error(error.message || "Errore nel caricamento delle operazioni");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, da, a, tipo, categoriaId, socioId, tipoRipartizione, q]);

  useEffect(() => {
    fetchOperazioni();
    setSelected(new Set());
  }, [fetchOperazioni]);

  const handleSearch = () => {
    setQ(searchText);
    setPage(1);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleDelete = async () => {
    if (!operazioneToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/operazioni/${operazioneToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'eliminazione");
      }
      toast.success("Operazione eliminata con successo");
      setDeleteDialogOpen(false);
      setOperazioneToDelete(null);
      fetchOperazioni();
    } catch (error: any) {
      toast.error(error.message || "Errore nell'eliminazione dell'operazione");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      let deleted = 0;
      for (const id of selected) {
        const res = await fetch(`/api/operazioni/${id}`, { method: "DELETE" });
        if (res.ok) deleted++;
      }
      toast.success(`${deleted} operazion${deleted === 1 ? "e eliminata" : "i eliminate"}`);
      setSelected(new Set());
      setBulkDeleteMode(false);
      setDeleteDialogOpen(false);
      fetchOperazioni();
    } catch (error: any) {
      toast.error(error.message || "Errore nell'eliminazione");
    } finally {
      setDeleting(false);
    }
  };

  const canModify = (op: Operazione) => {
    return isAdmin || op.createdByUserId === userId;
  };

  const selectableOps = operazioni.filter(canModify);

  const totalPages = Math.ceil(total / perPage);

  const resetFilters = () => {
    setDa("");
    setA("");
    setTipo("");
    setCategoriaId("");
    setSocioId("");
    setTipoRipartizione("");
    setQ("");
    setSearchText("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {total} operazion{total === 1 ? "e" : "i"} trovate
          </p>
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setBulkDeleteMode(true);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Elimina selezionate ({selected.size})
            </Button>
          )}
        </div>
        <Button onClick={() => router.push("/operazioni/nuova")}>
          <Plus className="mr-2 h-4 w-4" />
          Nuova Operazione
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* Date range */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Data da
            </label>
            <Input
              type="date"
              value={da}
              onChange={(e) => { setDa(e.target.value); setPage(1); }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Data a
            </label>
            <Input
              type="date"
              value={a}
              onChange={(e) => { setA(e.target.value); setPage(1); }}
            />
          </div>

          {/* Tipo operazione */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Tipo
            </label>
            <Select value={tipo} onValueChange={(val) => { setTipo(val === "ALL" ? "" : val); setPage(1); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tutti i tipi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tutti i tipi</SelectItem>
                <SelectItem value="FATTURA_ATTIVA">Fattura Attiva</SelectItem>
                <SelectItem value="COSTO">Costo</SelectItem>
                <SelectItem value="CESPITE">Cespite</SelectItem>
                <SelectItem value="PAGAMENTO_IMPOSTE">Pag. Imposte</SelectItem>
                <SelectItem value="DISTRIBUZIONE_DIVIDENDI">Dividendi</SelectItem>
                <SelectItem value="COMPENSO_AMMINISTRATORE">Comp. Amm.</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Categoria
            </label>
            <Select value={categoriaId} onValueChange={(val) => { setCategoriaId(val === "ALL" ? "" : val); setPage(1); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tutte le categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tutte le categorie</SelectItem>
                {categorie.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo ripartizione */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Ripartizione
            </label>
            <Select value={tipoRipartizione} onValueChange={(val) => { setTipoRipartizione(val === "ALL" ? "" : val); setPage(1); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tutte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tutte</SelectItem>
                <SelectItem value="COMUNE">Comune</SelectItem>
                <SelectItem value="SINGOLO">Singolo</SelectItem>
                <SelectItem value="CUSTOM">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Socio filter (admin only) */}
          {isAdmin && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Socio
              </label>
              <Select value={socioId} onValueChange={(val) => { setSocioId(val === "ALL" ? "" : val); setPage(1); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tutti i soci" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tutti i soci</SelectItem>
                  {soci.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.cognome} {s.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Search */}
          <div className={isAdmin ? "" : "sm:col-span-2"}>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Cerca
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Descrizione o N. Documento..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <Button variant="outline" size="icon" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Reset filters */}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Azzera filtri
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectableOps.length > 0 && selectableOps.every((op) => selected.has(op.id))}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelected(new Set(selectableOps.map((op) => op.id)));
                    } else {
                      setSelected(new Set());
                    }
                  }}
                />
              </TableHead>
              <TableHead className="w-[100px]">Data</TableHead>
              <TableHead className="w-[100px]">N. Doc.</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-[130px]">Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right w-[120px]">Importo</TableHead>
              <TableHead className="text-right w-[120px]">Deducibile</TableHead>
              <TableHead className="w-[110px]">Ripartizione</TableHead>
              <TableHead className="w-[80px] text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : operazioni.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nessuna operazione trovata
                </TableCell>
              </TableRow>
            ) : (
              operazioni.map((op) => (
                <TableRow
                  key={op.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/operazioni/${op.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canModify(op) && (
                      <Checkbox
                        checked={selected.has(op.id)}
                        onCheckedChange={(checked) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(op.id);
                            else next.delete(op.id);
                            return next;
                          });
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatDate(op.dataOperazione)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {op.numeroDocumento || "-"}
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate text-sm">
                    {op.descrizione}
                  </TableCell>
                  <TableCell>
                    <TipoBadge tipo={op.tipoOperazione} />
                  </TableCell>
                  <TableCell className="text-sm">{op.categoria?.nome ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(op.importoTotale)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(op.importoDeducibile)}
                  </TableCell>
                  <TableCell>
                    <RipartizioneBadge tipo={op.tipoRipartizione} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div
                      className="flex justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canModify(op) && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => router.push(`/operazioni/${op.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setOperazioneToDelete(op);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Pagina {page} di {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Precedente
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Successiva
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setBulkDeleteMode(false);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma eliminazione</DialogTitle>
          </DialogHeader>
          {bulkDeleteMode ? (
            <p className="text-sm text-muted-foreground">
              Sei sicuro di voler eliminare <strong>{selected.size} operazion{selected.size === 1 ? "e" : "i"}</strong>?
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sei sicuro di voler eliminare l&apos;operazione{" "}
              <strong>
                {operazioneToDelete?.descrizione}
              </strong>
              {operazioneToDelete?.numeroDocumento
                ? ` (${operazioneToDelete.numeroDocumento})`
                : ""}
              ?
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Le operazioni non verranno eliminate definitivamente ma saranno contrassegnate come eliminate.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={bulkDeleteMode ? handleBulkDelete : handleDelete}
              disabled={deleting}
            >
              {deleting ? "Eliminazione..." : bulkDeleteMode ? `Elimina ${selected.size}` : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
