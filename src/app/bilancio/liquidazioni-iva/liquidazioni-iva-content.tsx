"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Liquidazione {
  id: number;
  tipo: string;
  periodo: number;
  anno: number;
  ivaEsigibile: number;
  ivaDetraibile: number;
  saldo: number;
  totaleOperazioniAttive: number;
  totaleOperazioniPassive: number;
  debitoPeriodoPrecedente: number;
  creditoPeriodoPrecedente: number;
  creditoAnnoPrecedente: number;
  versamentiAutoUE: number;
  creditiImposta: number;
  interessiDovuti: number;
  accontoVersato: number;
  importoVersato: number | null;
  codiceTributo: string | null;
  dataVersamento: string | null;
  statoVersamento: string;
  metodoAcconto: number | null;
  scadenzaVersamento: string;
}

interface LipeInvio {
  id: number;
  anno: number;
  trimestre: number;
  nomeFile: string;
  stato: string;
  dataGenerazione: string;
  dataInvio: string | null;
  scadenzaInvio: string;
}

function formatCurrency(value: number | null): string {
  if (value == null) return "\u2014";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("it-IT");
}

const MESI_LABEL: Record<number, string> = {
  1: "Gennaio",
  2: "Febbraio",
  3: "Marzo",
  4: "Aprile",
  5: "Maggio",
  6: "Giugno",
  7: "Luglio",
  8: "Agosto",
  9: "Settembre",
  10: "Ottobre",
  11: "Novembre",
  12: "Dicembre",
};

const TRIMESTRI_LABEL: Record<number, string> = {
  1: "I Trimestre (Gen-Mar)",
  2: "II Trimestre (Apr-Giu)",
  3: "III Trimestre (Lug-Set)",
  4: "IV Trimestre (Ott-Dic)",
};

function getStatoBadge(stato: string, scadenza: string) {
  const isScaduto = new Date(scadenza) < new Date() && stato === "DA_VERSARE";
  if (stato === "VERSATO") return <Badge variant="default" className="bg-green-600">Versato</Badge>;
  if (isScaduto) return <Badge variant="destructive">Scaduto</Badge>;
  return <Badge variant="secondary">Da versare</Badge>;
}

function getLipeStatoBadge(stato: string) {
  switch (stato) {
    case "INVIATA":
      return <Badge variant="default" className="bg-green-600">Inviata</Badge>;
    case "GENERATA":
      return <Badge variant="secondary">Generata</Badge>;
    case "BOZZA":
      return <Badge variant="outline">Bozza</Badge>;
    default:
      return <Badge variant="outline">Non generata</Badge>;
  }
}

export function LiquidazioniIvaContent() {
  const currentYear = new Date().getFullYear();
  const { data: session } = useSession();
  const modalitaAvanzata = (session?.user as any)?.modalitaAvanzata ?? false;
  const modalitaCommercialista = (session?.user as any)?.modalitaCommercialista ?? false;

  const [anno, setAnno] = useState<string>(String(currentYear));
  const [liquidazioni, setLiquidazioni] = useState<Liquidazione[]>([]);
  const [lipeInvii, setLipeInvii] = useState<LipeInvio[]>([]);
  const [loading, setLoading] = useState(true);
  const [calcLoading, setCalcLoading] = useState(false);
  const [selectedLiq, setSelectedLiq] = useState<Liquidazione | null>(null);
  const [activeTab, setActiveTab] = useState("liquidazioni");

  const fetchLiquidazioni = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/liquidazioni-iva?anno=${anno}`);
      if (!res.ok) throw new Error("Errore");
      const json = await res.json();
      setLiquidazioni(json.data);
    } catch {
      toast.error("Errore nel caricamento delle liquidazioni");
    } finally {
      setLoading(false);
    }
  }, [anno]);

  const fetchLipe = useCallback(async () => {
    try {
      const res = await fetch(`/api/lipe?anno=${anno}`);
      if (!res.ok) return;
      const json = await res.json();
      setLipeInvii(json.data);
    } catch {
      // Ignore
    }
  }, [anno]);

  useEffect(() => {
    fetchLiquidazioni();
    if (modalitaCommercialista) fetchLipe();
  }, [fetchLiquidazioni, fetchLipe, modalitaCommercialista]);

  const handleRicalcola = async (tipo: string, periodo: number) => {
    setCalcLoading(true);
    try {
      const res = await fetch("/api/liquidazioni-iva/calcola", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, periodo, anno: parseInt(anno) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel calcolo");
      }
      toast.success(`Liquidazione ${periodo} ricalcolata`);
      await fetchLiquidazioni();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nel calcolo della liquidazione");
    } finally {
      setCalcLoading(false);
    }
  };

  const handleRicalcolaTutte = async () => {
    setCalcLoading(true);
    try {
      // Calculate all 12 monthly periods
      for (let p = 1; p <= 12; p++) {
        await fetch("/api/liquidazioni-iva/calcola", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: "MENSILE", periodo: p, anno: parseInt(anno) }),
        });
      }
      toast.success("Tutte le liquidazioni ricalcolate");
      await fetchLiquidazioni();
    } catch {
      toast.error("Errore nel ricalcolo");
    } finally {
      setCalcLoading(false);
    }
  };

  const handleCalcolaAcconto = async (metodo: number = 1) => {
    setCalcLoading(true);
    try {
      const res = await fetch("/api/liquidazioni-iva/acconto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno: parseInt(anno), metodo }),
      });
      if (!res.ok) throw new Error("Errore");
      const json = await res.json();
      if (json.data.dovuto) {
        toast.success(`Acconto IVA: ${formatCurrency(json.data.importo)}`);
      } else {
        toast.info("Acconto IVA non dovuto");
      }
      await fetchLiquidazioni();
    } catch {
      toast.error("Errore nel calcolo dell'acconto");
    } finally {
      setCalcLoading(false);
    }
  };

  const handleGeneraLipe = async (trimestre: number) => {
    setCalcLoading(true);
    try {
      const res = await fetch("/api/lipe/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno: parseInt(anno), trimestre }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore");
      }
      toast.success(`LIPE Q${trimestre} generata`);
      await fetchLipe();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nella generazione LIPE");
    } finally {
      setCalcLoading(false);
    }
  };

  const handleDownloadLipe = async (id: number, nomeFile: string) => {
    try {
      const res = await fetch(`/api/lipe/${id}?download=true`);
      if (!res.ok) throw new Error("Errore");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeFile;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Errore nel download");
    }
  };

  const handleSegnaInviata = async (id: number) => {
    try {
      const res = await fetch(`/api/lipe/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato: "INVIATA" }),
      });
      if (!res.ok) throw new Error("Errore");
      toast.success("LIPE segnata come inviata");
      await fetchLipe();
    } catch {
      toast.error("Errore nell'aggiornamento");
    }
  };

  // Calculate importo finale from liquidazione data
  const getImportoFinale = (liq: Liquidazione): number => {
    return (
      liq.saldo +
      liq.debitoPeriodoPrecedente -
      liq.creditoPeriodoPrecedente -
      liq.creditoAnnoPrecedente -
      liq.versamentiAutoUE -
      liq.creditiImposta +
      liq.interessiDovuti -
      liq.accontoVersato
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Liquidazioni IVA</h1>
        <div className="flex items-center gap-3">
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
          <Button
            onClick={handleRicalcolaTutte}
            disabled={calcLoading}
            variant="outline"
            size="sm"
          >
            {calcLoading ? "Calcolo..." : "Ricalcola tutte"}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="liquidazioni">Liquidazioni</TabsTrigger>
          {modalitaCommercialista && (
            <TabsTrigger value="lipe">LIPE</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="liquidazioni">
          <div className="border rounded-md table-responsive">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">IVA vendite (VP4)</TableHead>
                  <TableHead className="text-right">IVA acquisti (VP5)</TableHead>
                  <TableHead className="text-right">Saldo (VP6)</TableHead>
                  <TableHead className="text-right">Importo finale (VP14)</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Scadenza</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : liquidazioni.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nessuna liquidazione trovata. Clicca &quot;Ricalcola tutte&quot; per calcolare.
                    </TableCell>
                  </TableRow>
                ) : (
                  liquidazioni.map((liq) => {
                    const importoFinale = getImportoFinale(liq);
                    return (
                      <TableRow
                        key={liq.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLiq(liq)}
                      >
                        <TableCell className="font-medium">
                          {liq.tipo === "MENSILE"
                            ? MESI_LABEL[liq.periodo] ?? `Mese ${liq.periodo}`
                            : TRIMESTRI_LABEL[liq.periodo] ?? `Q${liq.periodo}`}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(liq.ivaEsigibile)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(liq.ivaDetraibile)}
                        </TableCell>
                        <TableCell className={`text-right font-mono ${liq.saldo >= 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCurrency(liq.saldo)}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${importoFinale >= 0 ? "text-red-600" : "text-green-600"}`}>
                          {formatCurrency(importoFinale)}
                        </TableCell>
                        <TableCell>
                          {getStatoBadge(liq.statoVersamento, liq.scadenzaVersamento)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatDate(liq.scadenzaVersamento)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={calcLoading}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRicalcola(liq.tipo, liq.periodo);
                            }}
                          >
                            Ricalcola
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Acconto section — commercialista only */}
          {modalitaCommercialista && (
            <div className="mt-6 rounded-lg border p-4">
              <h3 className="text-sm font-semibold mb-3">Acconto IVA (Dicembre)</h3>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={calcLoading}
                  onClick={() => handleCalcolaAcconto(1)}
                >
                  Metodo storico (88%)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={calcLoading}
                  onClick={() => handleCalcolaAcconto(3)}
                >
                  Metodo analitico
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* LIPE tab — commercialista only */}
        {modalitaCommercialista && (
          <TabsContent value="lipe">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((trimestre) => {
                const invio = lipeInvii.find((l) => l.trimestre === trimestre);
                return (
                  <div key={trimestre} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">
                        {TRIMESTRI_LABEL[trimestre]}
                      </h3>
                      {invio ? getLipeStatoBadge(invio.stato) : <Badge variant="outline">Non generata</Badge>}
                    </div>

                    {invio && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>File: {invio.nomeFile}</p>
                        <p>Generata: {formatDate(invio.dataGenerazione)}</p>
                        <p>Scadenza invio: {formatDate(invio.scadenzaInvio)}</p>
                        {invio.dataInvio && <p>Inviata: {formatDate(invio.dataInvio)}</p>}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={calcLoading}
                        onClick={() => handleGeneraLipe(trimestre)}
                      >
                        {invio ? "Rigenera" : "Genera LIPE"}
                      </Button>
                      {invio && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadLipe(invio.id, invio.nomeFile)}
                          >
                            Scarica XML
                          </Button>
                          {invio.stato !== "INVIATA" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSegnaInviata(invio.id)}
                            >
                              Segna inviata
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!selectedLiq} onOpenChange={() => setSelectedLiq(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Dettaglio Liquidazione{" "}
              {selectedLiq?.tipo === "MENSILE"
                ? MESI_LABEL[selectedLiq?.periodo ?? 0]
                : TRIMESTRI_LABEL[selectedLiq?.periodo ?? 0]}{" "}
              {selectedLiq?.anno}
            </DialogTitle>
            <DialogDescription>
              Campi VP della comunicazione periodica IVA
            </DialogDescription>
          </DialogHeader>
          {selectedLiq && (
            <div className="space-y-2 text-sm">
              <VPRow label="VP2 - Operazioni attive" value={selectedLiq.totaleOperazioniAttive} />
              <VPRow label="VP3 - Operazioni passive" value={selectedLiq.totaleOperazioniPassive} />
              <VPRow label="VP4 - IVA esigibile" value={selectedLiq.ivaEsigibile} />
              <VPRow label="VP5 - IVA detraibile" value={selectedLiq.ivaDetraibile} />
              <VPRow label="VP6 - Saldo" value={selectedLiq.saldo} highlight />
              <VPRow label="VP7 - Debito precedente" value={selectedLiq.debitoPeriodoPrecedente} />
              <VPRow label="VP8 - Credito precedente" value={selectedLiq.creditoPeriodoPrecedente} />
              <VPRow label="VP9 - Credito anno prec." value={selectedLiq.creditoAnnoPrecedente} />
              <VPRow label="VP10 - Versamenti auto UE" value={selectedLiq.versamentiAutoUE} />
              <VPRow label="VP11 - Crediti d'imposta" value={selectedLiq.creditiImposta} />
              <VPRow label="VP12 - Interessi dovuti" value={selectedLiq.interessiDovuti} />
              <VPRow label="VP13 - Acconto versato" value={selectedLiq.accontoVersato} />
              <VPRow label="VP14 - Importo finale" value={getImportoFinale(selectedLiq)} highlight />
              <div className="pt-2 border-t">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Codice tributo</span>
                  <span className="font-mono">{selectedLiq.codiceTributo ?? "\u2014"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stato</span>
                  <span>{getStatoBadge(selectedLiq.statoVersamento, selectedLiq.scadenzaVersamento)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VPRow({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${highlight ? "font-semibold border-t border-b" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${value > 0 ? "text-red-600" : value < 0 ? "text-green-600" : ""}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
