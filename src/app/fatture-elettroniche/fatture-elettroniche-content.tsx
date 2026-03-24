"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Plus, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Fattura = {
  id: number;
  numero: string;
  annoRiferimento: number;
  nomeFile: string;
  stato: string;
  tipoDocumento: string;
  importoTotale: number;
  dataDocumento: string;
  dataGenerazione: string;
  dataInvio: string | null;
  operazione: {
    id: number;
    numeroDocumento: string | null;
    descrizione: string;
    cliente: {
      id: number;
      denominazione: string;
    } | null;
  } | null;
  sezionale: {
    codice: string;
    descrizione: string;
  } | null;
};

type PaginationInfo = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

const STATO_COLORS: Record<string, string> = {
  BOZZA: "bg-gray-100 text-gray-700",
  GENERATA: "bg-blue-100 text-blue-700",
  INVIATA: "bg-yellow-100 text-yellow-700",
  CONSEGNATA: "bg-green-100 text-green-700",
  SCARTATA: "bg-red-100 text-red-700",
  MANCATA_CONSEGNA: "bg-orange-100 text-orange-700",
  IMPOSSIBILITA_RECAPITO: "bg-orange-100 text-orange-700",
  ANNULLATA: "bg-gray-100 text-gray-500",
};

const STATO_LABELS: Record<string, string> = {
  BOZZA: "Bozza",
  GENERATA: "Generata",
  INVIATA: "Inviata",
  CONSEGNATA: "Consegnata",
  SCARTATA: "Scartata",
  MANCATA_CONSEGNA: "Mancata consegna",
  IMPOSSIBILITA_RECAPITO: "Impossibilita recapito",
  ANNULLATA: "Annullata",
};

const TIPO_DOC_LABELS: Record<string, string> = {
  TD01: "Fattura",
  TD04: "Nota credito",
  TD05: "Nota debito",
  TD06: "Parcella",
  TD24: "Fattura differita",
  TD25: "Fattura differita",
};

export function FattureElettronicheContent() {
  const [fatture, setFatture] = useState<Fattura[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [annoFilter, setAnnoFilter] = useState<string>(
    String(new Date().getFullYear())
  );
  const [statoFilter, setStatoFilter] = useState<string>("all");

  // Genera dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [operazioneId, setOperazioneId] = useState("");
  const [generating, setGenerating] = useState(false);

  const loadFatture = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (annoFilter && annoFilter !== "all")
        params.set("anno", annoFilter);
      if (statoFilter && statoFilter !== "all")
        params.set("stato", statoFilter);
      params.set("page", String(pagination.page));
      params.set("perPage", String(pagination.perPage));

      const res = await fetch(`/api/fatture-elettroniche?${params}`);
      if (!res.ok) throw new Error("Errore nel caricamento");
      const data = await res.json();
      setFatture(data.fatture);
      setPagination(data.pagination);
    } catch {
      toast.error("Errore nel caricamento delle fatture");
    } finally {
      setLoading(false);
    }
  }, [annoFilter, statoFilter, pagination.page, pagination.perPage]);

  useEffect(() => {
    loadFatture();
  }, [loadFatture]);

  const handleDownload = async (id: number, nomeFile: string) => {
    try {
      const res = await fetch(`/api/fatture-elettroniche/${id}/xml`);
      if (!res.ok) throw new Error("Errore download");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeFile;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Errore nel download del file XML");
    }
  };

  const handleGenera = async () => {
    const id = parseInt(operazioneId, 10);
    if (isNaN(id)) {
      toast.error("Inserisci un ID operazione valido");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/fatture-elettroniche/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operazioneId: id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore nella generazione");
      }

      toast.success(`Fattura ${data.fattura.numero} generata con successo`);
      setDialogOpen(false);
      setOperazioneId("");
      loadFatture();
    } catch (error: any) {
      toast.error(error.message || "Errore nella generazione della fattura");
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("it-IT");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) =>
    String(currentYear - i)
  );

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fatture Elettroniche</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Genera Fattura
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Genera Fattura Elettronica</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="operazioneId">ID Operazione (Fattura Attiva)</Label>
                <Input
                  id="operazioneId"
                  type="number"
                  placeholder="Inserisci l'ID dell'operazione..."
                  value={operazioneId}
                  onChange={(e) => setOperazioneId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Seleziona una operazione di tipo FATTURA_ATTIVA per generare il file XML FatturaPA.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleGenera} disabled={generating || !operazioneId}>
                {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Genera XML
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Anno</Label>
              <Select value={annoFilter} onValueChange={setAnnoFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Stato</Label>
              <Select value={statoFilter} onValueChange={setStatoFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {Object.entries(STATO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {pagination.total} fatture trovate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : fatture.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nessuna fattura elettronica trovata
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fatture.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-sm">
                        {f.numero}
                      </TableCell>
                      <TableCell>{formatDate(f.dataDocumento)}</TableCell>
                      <TableCell>
                        {f.operazione?.cliente?.denominazione || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(f.importoTotale)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {TIPO_DOC_LABELS[f.tipoDocumento] || f.tipoDocumento}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATO_COLORS[f.stato] || ""}
                        >
                          {STATO_LABELS[f.stato] || f.stato}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(f.id, f.nomeFile)}
                          title="Scarica XML"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Pagina {pagination.page} di {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() =>
                        setPagination((p) => ({ ...p, page: p.page - 1 }))
                      }
                    >
                      Precedente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() =>
                        setPagination((p) => ({ ...p, page: p.page + 1 }))
                      }
                    >
                      Successiva
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
