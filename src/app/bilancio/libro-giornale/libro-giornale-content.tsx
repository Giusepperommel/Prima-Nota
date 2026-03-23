"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/business-utils";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Movimento = {
  id: number;
  contoId: number;
  importoDare: number;
  importoAvere: number;
  descrizione: string | null;
  ordine: number;
  conto: { codice: string; descrizione: string };
};

type Scrittura = {
  id: number;
  dataRegistrazione: string;
  dataCompetenza: string;
  numeroProtocollo: number;
  anno: number;
  descrizione: string;
  causale: string;
  tipoScrittura: string;
  stato: string;
  totaleDare: number;
  totaleAvere: number;
  operazione: { id: number; tipoOperazione: string; numeroDocumento: string | null } | null;
  movimenti: Movimento[];
};

type Props = {
  isCommercialista: boolean;
};

const CAUSALE_LABELS: Record<string, string> = {
  FV: "Fatt. Vendita",
  FVS: "Fatt. Vend. Split",
  NCV: "NC Emessa",
  NDV: "ND Emessa",
  FA: "Fatt. Acquisto",
  NCA: "NC Ricevuta",
  NDA: "ND Ricevuta",
  FAUE: "Fatt. Acq. UE",
  FARE: "Fatt. Acq. RC",
  PG: "Pagamento",
  IN: "Incasso",
  AM: "Ammortamento",
  F24: "Pag. F24",
  LQ: "Liq. IVA",
  DIV: "Dividendi",
  CA: "Comp. Amm.",
  SC: "Chiusura",
  SA: "Apertura",
  SAS: "Assestamento",
  ST: "Storno",
  OG: "Op. Generica",
};

const CAUSALE_COLORS: Record<string, string> = {
  FV: "bg-green-500/15 text-green-400 border-green-500/25",
  FVS: "bg-green-500/15 text-green-400 border-green-500/25",
  NCV: "bg-green-500/15 text-green-400 border-green-500/25",
  NDV: "bg-green-500/15 text-green-400 border-green-500/25",
  FA: "bg-red-500/15 text-red-400 border-red-500/25",
  NCA: "bg-red-500/15 text-red-400 border-red-500/25",
  NDA: "bg-red-500/15 text-red-400 border-red-500/25",
  FAUE: "bg-red-500/15 text-red-400 border-red-500/25",
  FARE: "bg-red-500/15 text-red-400 border-red-500/25",
  PG: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  IN: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  AM: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  F24: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  LQ: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  SC: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  SA: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  SAS: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  ST: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  OG: "bg-gray-500/15 text-gray-400 border-gray-500/25",
};

const STATO_LABELS: Record<string, string> = {
  DEFINITIVA: "Definitiva",
  PROVVISORIA: "Provvisoria",
};

const MESI = [
  { value: "1", label: "Gennaio" },
  { value: "2", label: "Febbraio" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Aprile" },
  { value: "5", label: "Maggio" },
  { value: "6", label: "Giugno" },
  { value: "7", label: "Luglio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Settembre" },
  { value: "10", label: "Ottobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Dicembre" },
];

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function CausaleBadge({ causale }: { causale: string }) {
  return (
    <Badge variant="outline" className={CAUSALE_COLORS[causale] || ""}>
      {CAUSALE_LABELS[causale] || causale}
    </Badge>
  );
}

function StatoBadge({ stato }: { stato: string }) {
  const color =
    stato === "DEFINITIVA"
      ? "bg-green-500/15 text-green-400 border-green-500/25"
      : "bg-yellow-500/15 text-yellow-400 border-yellow-500/25";
  return (
    <Badge variant="outline" className={color}>
      {STATO_LABELS[stato] || stato}
    </Badge>
  );
}

export function LibroGiornaleContent({ isCommercialista }: Props) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [scritture, setScritture] = useState<Scrittura[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totaliPagina, setTotaliPagina] = useState({ dare: 0, avere: 0 });
  const [contatoreRegistrazioni, setContatoreRegistrazioni] = useState(0);

  // Filters
  const [anno, setAnno] = useState(String(currentYear));
  const [mese, setMese] = useState("");
  const [causale, setCausale] = useState("");
  const [stato, setStato] = useState("");

  // Expanded rows
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scritturaToDelete, setScritturaToDelete] = useState<Scrittura | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fetchScritture = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("anno", anno);
      params.set("page", String(page));
      params.set("pageSize", "50");
      if (mese) params.set("mese", mese);
      if (causale) params.set("causale", causale);
      if (stato) params.set("stato", stato);

      const res = await fetch(`/api/libro-giornale?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel caricamento");
      }
      const json = await res.json();
      setScritture(json.scritture);
      setTotalPages(json.pagination.totalPages);
      setTotal(json.pagination.total);
      setTotaliPagina(json.totaliPagina);
      setContatoreRegistrazioni(json.contatoreRegistrazioni);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Errore nel caricamento del libro giornale");
    } finally {
      setLoading(false);
    }
  }, [anno, mese, causale, stato, page]);

  useEffect(() => {
    fetchScritture();
  }, [fetchScritture]);

  const handleFilterChange = () => {
    setPage(1);
    setExpanded(new Set());
  };

  const handleDelete = async () => {
    if (!scritturaToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/scritture-contabili/${scritturaToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'eliminazione");
      }
      toast.success("Scrittura eliminata");
      setDeleteDialogOpen(false);
      setScritturaToDelete(null);
      fetchScritture();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Errore nell'eliminazione");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Anno</label>
              <Select
                value={anno}
                onValueChange={(v) => {
                  setAnno(v);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mese</label>
              <Select
                value={mese}
                onValueChange={(v) => {
                  setMese(v === "all" ? "" : v);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {MESI.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Causale</label>
              <Select
                value={causale}
                onValueChange={(v) => {
                  setCausale(v === "all" ? "" : v);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tutte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  {Object.entries(CAUSALE_LABELS).map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Stato</label>
              <Select
                value={stato}
                onValueChange={(v) => {
                  setStato(v === "all" ? "" : v);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tutti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="DEFINITIVA">Definitiva</SelectItem>
                  <SelectItem value="PROVVISORIA">Provvisoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" />

            {isCommercialista && (
              <Button asChild>
                <a href="/bilancio/libro-giornale/nuova">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuova scrittura
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Registration counter for bollo */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          Registrazioni: <strong>{contatoreRegistrazioni}</strong>
          {contatoreRegistrazioni > 0 && (
            <span className="ml-2">
              (Bollo: {Math.ceil(contatoreRegistrazioni / 100)} marche da 16,00)
            </span>
          )}
        </span>
        <span>
          Pagina {page} di {totalPages || 1} ({total} risultati)
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead className="w-[80px]">Prot.</TableHead>
              <TableHead className="w-[100px]">Data</TableHead>
              <TableHead className="w-[120px]">Causale</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="w-[90px]">Stato</TableHead>
              <TableHead className="w-[90px]">Tipo</TableHead>
              <TableHead className="text-right w-[120px]">Dare</TableHead>
              <TableHead className="text-right w-[120px]">Avere</TableHead>
              {isCommercialista && <TableHead className="w-[80px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isCommercialista ? 10 : 9} className="text-center py-8">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : scritture.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isCommercialista ? 10 : 9} className="text-center py-8 text-muted-foreground">
                  Nessuna scrittura trovata
                </TableCell>
              </TableRow>
            ) : (
              scritture.map((s) => (
                <ScritturaRow
                  key={s.id}
                  scrittura={s}
                  isExpanded={expanded.has(s.id)}
                  onToggle={() => toggleExpanded(s.id)}
                  isCommercialista={isCommercialista}
                  onDelete={() => {
                    setScritturaToDelete(s);
                    setDeleteDialogOpen(true);
                  }}
                />
              ))
            )}

            {/* Page totals */}
            {!loading && scritture.length > 0 && (
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={isCommercialista ? 7 : 7} className="text-right">
                  Totali pagina:
                </TableCell>
                <TableCell className="text-right">{formatCurrency(totaliPagina.dare)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totaliPagina.avere)}</TableCell>
                {isCommercialista && <TableCell />}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminare la scrittura?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stai per eliminare la scrittura manuale n. {scritturaToDelete?.numeroProtocollo}
            {scritturaToDelete && ` — "${scritturaToDelete.descrizione}"`}.
            Questa azione non puo essere annullata.
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
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Eliminazione..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScritturaRow({
  scrittura,
  isExpanded,
  onToggle,
  isCommercialista,
  onDelete,
}: {
  scrittura: Scrittura;
  isExpanded: boolean;
  onToggle: () => void;
  isCommercialista: boolean;
  onDelete: () => void;
}) {
  const tipoLabel =
    scrittura.tipoScrittura === "AUTO"
      ? "Auto"
      : scrittura.tipoScrittura === "MANUALE"
        ? "Manuale"
        : scrittura.tipoScrittura.charAt(0) + scrittura.tipoScrittura.slice(1).toLowerCase();

  const canDelete = isCommercialista && scrittura.tipoScrittura === "MANUALE";
  const canEdit =
    isCommercialista &&
    (scrittura.tipoScrittura === "MANUALE" ||
      (scrittura.stato === "PROVVISORIA"));

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-mono text-sm">{scrittura.numeroProtocollo}</TableCell>
        <TableCell className="text-sm">{formatDate(scrittura.dataRegistrazione)}</TableCell>
        <TableCell>
          <CausaleBadge causale={scrittura.causale} />
        </TableCell>
        <TableCell className="text-sm max-w-[300px] truncate">{scrittura.descrizione}</TableCell>
        <TableCell>
          <StatoBadge stato={scrittura.stato} />
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="text-xs">
            {tipoLabel}
          </Badge>
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {formatCurrency(scrittura.totaleDare)}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {formatCurrency(scrittura.totaleAvere)}
        </TableCell>
        {isCommercialista && (
          <TableCell>
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {canEdit && (
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <a href={`/bilancio/libro-giornale/${scrittura.id}/modifica`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>
      {isExpanded &&
        scrittura.movimenti.map((mov) => (
          <TableRow key={mov.id} className="bg-muted/30">
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="font-mono text-xs text-muted-foreground">
              {mov.conto.codice}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {mov.conto.descrizione}
              {mov.descrizione && (
                <span className="ml-2 text-xs italic">({mov.descrizione})</span>
              )}
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="text-right font-mono text-sm text-muted-foreground">
              {mov.importoDare > 0 ? formatCurrency(mov.importoDare) : ""}
            </TableCell>
            <TableCell className="text-right font-mono text-sm text-muted-foreground">
              {mov.importoAvere > 0 ? formatCurrency(mov.importoAvere) : ""}
            </TableCell>
            {isCommercialista && <TableCell />}
          </TableRow>
        ))}
    </>
  );
}
