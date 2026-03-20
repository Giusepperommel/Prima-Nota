"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Scissors, Calendar, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
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

interface Ritenuta {
  id: number;
  codiceTributo: string | null;
  aliquota: number;
  percentualeImponibile: number;
  importoLordo: number;
  baseImponibile: number;
  importoRitenuta: number;
  importoNetto: number;
  rivalsaInps: number | null;
  cassaPrevidenza: number | null;
  importoVersato: number | null;
  statoVersamento: "DA_VERSARE" | "VERSATO" | "SCADUTO";
  meseCompetenza: number;
  annoCompetenza: number;
  dataVersamento: string | null;
  operazione: {
    id: number;
    descrizione: string;
    dataOperazione: string;
    importoTotale: number;
  };
  anagrafica: {
    id: number;
    denominazione: string;
  } | null;
}

type FiltroStato = "TUTTE" | "DA_VERSARE" | "VERSATO" | "SCADUTO";

function computeScadenzaF24(meseCompetenza: number, annoCompetenza: number): Date {
  // Scadenza: 16 del mese successivo
  if (meseCompetenza === 12) {
    return new Date(annoCompetenza + 1, 0, 16); // Jan 16 next year
  }
  return new Date(annoCompetenza, meseCompetenza, 16); // month+1 (0-indexed: meseCompetenza is already 1-based, so it maps to next month)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("it-IT");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

const STATO_BADGE: Record<string, { className: string; label: string }> = {
  DA_VERSARE: { className: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "Da Versare" },
  VERSATO: { className: "bg-green-100 text-green-800 border-green-300", label: "Versato" },
  SCADUTO: { className: "bg-red-100 text-red-800 border-red-300", label: "Scaduto" },
};

export function RitenuteContent() {
  const currentYear = new Date().getFullYear();
  const [ritenute, setRitenute] = useState<Ritenuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStato, setFiltroStato] = useState<FiltroStato>("TUTTE");
  const [anno, setAnno] = useState<string>(String(currentYear));

  // Versa dialog
  const [versaDialogOpen, setVersaDialogOpen] = useState(false);
  const [versaRitenutaId, setVersaRitenutaId] = useState<number | null>(null);
  const [versaDataVersamento, setVersaDataVersamento] = useState("");
  const [versaImporto, setVersaImporto] = useState("");
  const [versaSaving, setVersaSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroStato !== "TUTTE") params.set("stato", filtroStato);
      if (anno) params.set("anno", anno);
      const res = await fetch(`/api/ritenute?${params.toString()}`);
      if (!res.ok) throw new Error("Errore nel caricamento");
      const data = await res.json();
      setRitenute(data);
    } catch {
      toast.error("Errore nel caricamento delle ritenute");
    } finally {
      setLoading(false);
    }
  }, [filtroStato, anno]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check for ritenute in scadenza (within 7 days)
  const oggi = new Date();
  const tra7giorni = new Date();
  tra7giorni.setDate(tra7giorni.getDate() + 7);

  const ritenuteInScadenza = ritenute.filter((r) => {
    if (r.statoVersamento !== "DA_VERSARE") return false;
    const scadenza = computeScadenzaF24(r.meseCompetenza, r.annoCompetenza);
    return scadenza >= oggi && scadenza <= tra7giorni;
  });

  const openVersaDialog = (r: Ritenuta) => {
    setVersaRitenutaId(r.id);
    setVersaImporto(String(r.importoRitenuta));
    setVersaDataVersamento(new Date().toISOString().split("T")[0]);
    setVersaDialogOpen(true);
  };

  const handleVersa = async () => {
    if (!versaRitenutaId || !versaDataVersamento || !versaImporto) {
      toast.error("Compilare tutti i campi");
      return;
    }
    setVersaSaving(true);
    try {
      const res = await fetch(`/api/ritenute/${versaRitenutaId}/versa`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataVersamento: versaDataVersamento,
          importoVersato: parseFloat(versaImporto),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel versamento");
      }
      toast.success("Ritenuta segnata come versata");
      setVersaDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Errore nel versamento");
    } finally {
      setVersaSaving(false);
    }
  };

  // Monthly summary grouped by codiceTributo
  const monthlySummary = ritenute.reduce(
    (acc, r) => {
      const key = r.codiceTributo || "N/D";
      if (!acc[key]) {
        acc[key] = { codiceTributo: key, totaleRitenuta: 0, totaleVersato: 0, count: 0 };
      }
      acc[key].totaleRitenuta += r.importoRitenuta;
      acc[key].totaleVersato += r.importoVersato ?? 0;
      acc[key].count += 1;
      return acc;
    },
    {} as Record<string, { codiceTributo: string; totaleRitenuta: number; totaleVersato: number; count: number }>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scissors className="h-6 w-6" />
          Ritenute d&apos;Acconto
        </h1>
      </div>

      {/* Alert for ritenute in scadenza */}
      {ritenuteInScadenza.length > 0 && (
        <Alert variant="destructive">
          <Calendar className="h-4 w-4" />
          <AlertTitle>Ritenute in scadenza</AlertTitle>
          <AlertDescription>
            {ritenuteInScadenza.length} ritenuta/e con scadenza F24 entro 7 giorni.
            Verifica e procedi al versamento.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {(["TUTTE", "DA_VERSARE", "VERSATO", "SCADUTO"] as FiltroStato[]).map((stato) => (
            <Button
              key={stato}
              variant={filtroStato === stato ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroStato(stato)}
            >
              {stato === "TUTTE" ? "Tutte" : STATO_BADGE[stato]?.label || stato}
            </Button>
          ))}
        </div>
        <Select value={anno} onValueChange={setAnno}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Anno" />
          </SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Percipiente</TableHead>
              <TableHead>Data Operazione</TableHead>
              <TableHead className="text-right">Lordo</TableHead>
              <TableHead className="text-right">Ritenuta</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead>Scadenza F24</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : ritenute.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nessuna ritenuta trovata
                </TableCell>
              </TableRow>
            ) : (
              ritenute.map((r) => {
                const scadenza = computeScadenzaF24(r.meseCompetenza, r.annoCompetenza);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.anagrafica?.denominazione ?? "N/D"}
                    </TableCell>
                    <TableCell>{formatDate(r.operazione.dataOperazione)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(r.importoLordo)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(r.importoRitenuta)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(r.importoNetto)}
                    </TableCell>
                    <TableCell>{scadenza.toLocaleDateString("it-IT")}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATO_BADGE[r.statoVersamento]?.className}
                      >
                        {STATO_BADGE[r.statoVersamento]?.label || r.statoVersamento}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.statoVersamento === "DA_VERSARE" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openVersaDialog(r)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Versa
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Monthly Summary */}
      {Object.keys(monthlySummary).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Riepilogo per Codice Tributo</h2>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice Tributo</TableHead>
                  <TableHead className="text-right">N. Ritenute</TableHead>
                  <TableHead className="text-right">Totale Ritenuta</TableHead>
                  <TableHead className="text-right">Totale Versato</TableHead>
                  <TableHead className="text-right">Da Versare</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.values(monthlySummary).map((row) => (
                  <TableRow key={row.codiceTributo}>
                    <TableCell className="font-mono font-medium">{row.codiceTributo}</TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.totaleRitenuta)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.totaleVersato)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(row.totaleRitenuta - row.totaleVersato)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Totale</TableCell>
                  <TableCell className="text-right font-semibold">
                    {Object.values(monthlySummary).reduce((s, r) => s + r.count, 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(Object.values(monthlySummary).reduce((s, r) => s + r.totaleRitenuta, 0))}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(Object.values(monthlySummary).reduce((s, r) => s + r.totaleVersato, 0))}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {formatCurrency(
                      Object.values(monthlySummary).reduce((s, r) => s + (r.totaleRitenuta - r.totaleVersato), 0)
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}

      {/* Versa Dialog */}
      <Dialog open={versaDialogOpen} onOpenChange={setVersaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Segna come Versato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dataVersamento">Data Versamento</Label>
              <Input
                id="dataVersamento"
                type="date"
                value={versaDataVersamento}
                onChange={(e) => setVersaDataVersamento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="importoVersato">Importo Versato</Label>
              <Input
                id="importoVersato"
                type="number"
                step="0.01"
                value={versaImporto}
                onChange={(e) => setVersaImporto(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersaDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleVersa} disabled={versaSaving}>
              {versaSaving ? "Salvataggio..." : "Conferma Versamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
