"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/business-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Car, ExternalLink, HandCoins } from "lucide-react";
import {
  TIPO_VEICOLO_LABELS,
  USO_VEICOLO_LABELS,
  MODALITA_ACQUISTO_LABELS,
  calcolaCessione,
  type CalcoloCessione,
} from "@/lib/calcoli-veicoli";

type QuotaAmmortamento = {
  anno: number;
  aliquotaApplicata: number;
  importoQuota: number;
  fondoProgressivo: number;
  valoreResiduo: number;
};

type Ripartizione = {
  socioId: number;
  percentuale: number;
  importoCalcolato: number;
  nome: string;
  cognome: string;
  quotaPercentuale: number;
};

type VeicoloDetail = {
  id: number;
  tipoVeicolo: string;
  usoVeicolo: string;
  modalitaAcquisto: string;
  marca: string;
  modello: string;
  targa: string;
  limiteFiscale: number;
  percentualeDeducibilita: number;
  percentualeDetraibilitaIva: number;
  finanziamento: {
    importoFinanziato: number;
    anticipo: number;
    numeroRate: number;
    importoRata: number;
    tan: number | null;
    dataPrimaRata: string;
    operazioneRicorrente: {
      id: number;
      attiva: boolean;
      rateRimanenti: number | null;
    } | null;
  } | null;
  cessione: {
    dataCessione: string;
    prezzoVendita: number;
    valoreResiduoContabile: number;
    plusvalenza: number;
    plusvalenzaImponibile: number;
    minusvalenza: number;
    minusvalenzaDeducibile: number;
  } | null;
};

type CespiteDetail = {
  id: number;
  descrizione: string;
  valoreIniziale: number;
  aliquotaAmmortamento: number;
  dataAcquisto: string;
  annoInizio: number;
  stato: string;
  fondoAmmortamento: number;
  valoreResiduo: number;
  operazioneId: number;
  categoria: { id: number; nome: string };
  tipoRipartizione: string;
  ripartizioni: Ripartizione[];
  quoteAmmortamento: QuotaAmmortamento[];
  veicolo: VeicoloDetail | null;
};

const STATO_LABELS: Record<string, string> = {
  IN_AMMORTAMENTO: "In Ammortamento",
  COMPLETATO: "Completato",
  CEDUTO: "Ceduto",
};

const STATO_BADGE_CLASSES: Record<string, string> = {
  IN_AMMORTAMENTO: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  COMPLETATO: "bg-green-500/15 text-green-400 border-green-500/25",
  CEDUTO: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatPercentuale(value: number): string {
  return (
    new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + "%"
  );
}

export default function DettaglioCespitePage() {
  const params = useParams();
  const router = useRouter();
  const [cespite, setCespite] = useState<CespiteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();

  const [showCessione, setShowCessione] = useState(false);
  const [dataCessione, setDataCessione] = useState(new Date().toISOString().split("T")[0]);
  const [prezzoVendita, setPrezzoVendita] = useState("");
  const [cessionePreview, setCessionePreview] = useState<CalcoloCessione | null>(null);
  const [cessioneLoading, setCessioneLoading] = useState(false);

  // Live preview of cessione calculation
  useEffect(() => {
    if (cespite?.veicolo && prezzoVendita) {
      const prezzo = parseFloat(prezzoVendita);
      if (!isNaN(prezzo) && prezzo >= 0) {
        const result = calcolaCessione(
          prezzo,
          cespite.valoreIniziale,
          cespite.fondoAmmortamento,
          cespite.veicolo.percentualeDeducibilita
        );
        setCessionePreview(result);
      }
    } else {
      setCessionePreview(null);
    }
  }, [prezzoVendita, cespite]);

  async function handleCessione() {
    if (!cespite) return;
    setCessioneLoading(true);
    try {
      const res = await fetch(`/api/cespiti/${cespite.id}/cessione`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataCessione,
          prezzoVendita: parseFloat(prezzoVendita),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore nella cessione");
      }
      toast.success("Cessione registrata con successo");
      setShowCessione(false);
      // Reload data
      const resData = await fetch(`/api/cespiti/${cespite.id}`);
      const data = await resData.json();
      setCespite(data);
    } catch (error: any) {
      toast.error(error.message || "Errore nella registrazione della cessione");
    } finally {
      setCessioneLoading(false);
    }
  }

  useEffect(() => {
    async function fetchCespite() {
      setLoading(true);
      try {
        const res = await fetch(`/api/cespiti/${params.id}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Errore nel caricamento");
        }
        const data = await res.json();
        setCespite(data);
      } catch (error: any) {
        toast.error(error.message || "Errore nel caricamento del cespite");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchCespite();
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!cespite) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Cespite non trovato
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/operazioni/cespiti")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna alla lista
        </Button>
      </div>

      {/* Card: Riepilogo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Riepilogo Cespite</CardTitle>
            <Badge
              variant="outline"
              className={STATO_BADGE_CLASSES[cespite.stato] || ""}
            >
              {STATO_LABELS[cespite.stato] || cespite.stato}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Descrizione</p>
              <p className="font-medium">{cespite.descrizione}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data Acquisto</p>
              <p className="font-medium font-mono">
                {formatDate(cespite.dataAcquisto)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Categoria</p>
              <p className="font-medium">{cespite.categoria.nome}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valore Iniziale</p>
              <p className="font-medium font-mono">
                {formatCurrency(cespite.valoreIniziale)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aliquota Ammortamento</p>
              <p className="font-medium">
                {formatPercentuale(cespite.aliquotaAmmortamento)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Anno Inizio</p>
              <p className="font-medium">{cespite.annoInizio}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Fondo Ammortamento
              </p>
              <p className="font-medium font-mono">
                {formatCurrency(cespite.fondoAmmortamento)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valore Residuo</p>
              <p className="font-medium font-mono">
                {formatCurrency(cespite.valoreResiduo)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Operazione</p>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`/operazioni/${cespite.operazioneId}`)
                }
              >
                #{cespite.operazioneId}
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card: Dati Veicolo */}
      {cespite.veicolo && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Dati Veicolo
              </CardTitle>
              {cespite.stato === "IN_AMMORTAMENTO" && (
                <Dialog open={showCessione} onOpenChange={(open) => { setShowCessione(open); if (!open) { setPrezzoVendita(""); setCessionePreview(null); } }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <HandCoins className="mr-2 h-4 w-4" />
                      Registra Cessione
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cessione Veicolo</DialogTitle>
                      <DialogDescription>
                        Registra la vendita di {cespite.veicolo.marca} {cespite.veicolo.modello} ({cespite.veicolo.targa})
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Data Cessione</Label>
                        <Input type="date" value={dataCessione} onChange={(e) => setDataCessione(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Prezzo di Vendita</Label>
                        <Input type="number" step="0.01" min="0" value={prezzoVendita} onChange={(e) => setPrezzoVendita(e.target.value)} placeholder="0.00" />
                      </div>
                      {cessionePreview && (
                        <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Valore residuo contabile:</span>
                            <span className="font-mono">{formatCurrency(cessionePreview.valoreResiduoContabile)}</span>
                          </div>
                          {cessionePreview.plusvalenza > 0 && (
                            <>
                              <div className="flex justify-between text-green-500">
                                <span>Plusvalenza:</span>
                                <span className="font-mono">{formatCurrency(cessionePreview.plusvalenza)}</span>
                              </div>
                              <div className="flex justify-between text-green-500">
                                <span>Plusvalenza imponibile:</span>
                                <span className="font-mono font-medium">{formatCurrency(cessionePreview.plusvalenzaImponibile)}</span>
                              </div>
                            </>
                          )}
                          {cessionePreview.minusvalenza > 0 && (
                            <>
                              <div className="flex justify-between text-red-500">
                                <span>Minusvalenza:</span>
                                <span className="font-mono">{formatCurrency(cessionePreview.minusvalenza)}</span>
                              </div>
                              <div className="flex justify-between text-red-500">
                                <span>Minusvalenza deducibile:</span>
                                <span className="font-mono font-medium">{formatCurrency(cessionePreview.minusvalenzaDeducibile)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCessione(false)}>Annulla</Button>
                      <Button onClick={handleCessione} disabled={cessioneLoading || !prezzoVendita}>
                        {cessioneLoading ? "Registrazione..." : "Conferma Cessione"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Veicolo</p>
                <p className="font-medium">{cespite.veicolo.marca} {cespite.veicolo.modello}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Targa</p>
                <p className="font-medium font-mono">{cespite.veicolo.targa}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">{TIPO_VEICOLO_LABELS[cespite.veicolo.tipoVeicolo as keyof typeof TIPO_VEICOLO_LABELS] || cespite.veicolo.tipoVeicolo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uso</p>
                <p className="font-medium">{USO_VEICOLO_LABELS[cespite.veicolo.usoVeicolo as keyof typeof USO_VEICOLO_LABELS] || cespite.veicolo.usoVeicolo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deducibilità</p>
                <p className="font-medium">{formatPercentuale(cespite.veicolo.percentualeDeducibilita)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">IVA Detraibile</p>
                <p className="font-medium">{formatPercentuale(cespite.veicolo.percentualeDetraibilitaIva)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modalità Acquisto</p>
                <p className="font-medium">{MODALITA_ACQUISTO_LABELS[cespite.veicolo.modalitaAcquisto as keyof typeof MODALITA_ACQUISTO_LABELS] || cespite.veicolo.modalitaAcquisto}</p>
              </div>
              {isFinite(cespite.veicolo.limiteFiscale) && (
                <div>
                  <p className="text-sm text-muted-foreground">Limite Fiscale</p>
                  <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.limiteFiscale)}</p>
                </div>
              )}
            </div>

            {/* Financing info */}
            {cespite.veicolo.finanziamento && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-sm font-medium">Finanziamento</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Importo Finanziato</p>
                    <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.finanziamento.importoFinanziato)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Anticipo</p>
                    <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.finanziamento.anticipo)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rata Mensile</p>
                    <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.finanziamento.importoRata)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Numero Rate</p>
                    <p className="font-medium">{cespite.veicolo.finanziamento.numeroRate}</p>
                  </div>
                  {cespite.veicolo.finanziamento.tan != null && (
                    <div>
                      <p className="text-sm text-muted-foreground">TAN</p>
                      <p className="font-medium">{formatPercentuale(cespite.veicolo.finanziamento.tan)}</p>
                    </div>
                  )}
                  {cespite.veicolo.finanziamento.operazioneRicorrente && (
                    <div>
                      <p className="text-sm text-muted-foreground">Rate Rimanenti</p>
                      <p className="font-medium">
                        {cespite.veicolo.finanziamento.operazioneRicorrente.rateRimanenti ?? "N/D"}
                        {!cespite.veicolo.finanziamento.operazioneRicorrente.attiva && (
                          <Badge variant="outline" className="ml-2 text-xs">Terminato</Badge>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cessione info (if sold) */}
            {cespite.veicolo.cessione && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-sm font-medium">Cessione</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Data Cessione</p>
                    <p className="font-medium font-mono">{formatDate(cespite.veicolo.cessione.dataCessione)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prezzo Vendita</p>
                    <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.cessione.prezzoVendita)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valore Residuo</p>
                    <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.cessione.valoreResiduoContabile)}</p>
                  </div>
                  {cespite.veicolo.cessione.plusvalenza > 0 && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Plusvalenza</p>
                        <p className="font-medium font-mono text-green-500">{formatCurrency(cespite.veicolo.cessione.plusvalenza)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Plusvalenza Imponibile</p>
                        <p className="font-medium font-mono text-green-500">{formatCurrency(cespite.veicolo.cessione.plusvalenzaImponibile)}</p>
                      </div>
                    </>
                  )}
                  {cespite.veicolo.cessione.minusvalenza > 0 && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Minusvalenza</p>
                        <p className="font-medium font-mono text-red-500">{formatCurrency(cespite.veicolo.cessione.minusvalenza)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Minusvalenza Deducibile</p>
                        <p className="font-medium font-mono text-red-500">{formatCurrency(cespite.veicolo.cessione.minusvalenzaDeducibile)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card: Attribuzione */}
      <Card>
        <CardHeader>
          <CardTitle>Attribuzione Soci</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead className="text-right">Quota Societaria</TableHead>
                <TableHead className="text-right">% Ripartizione</TableHead>
                <TableHead className="text-right">Importo Cespite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cespite.ripartizioni.map((r) => (
                <TableRow key={r.socioId}>
                  <TableCell className="font-medium">
                    {r.cognome} {r.nome}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(r.quotaPercentuale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(r.percentuale)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(r.importoCalcolato)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Card: Piano Ammortamento */}
      <Card>
        <CardHeader>
          <CardTitle>Piano Ammortamento</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Anno</TableHead>
                <TableHead className="text-right">Aliquota</TableHead>
                <TableHead className="text-right">Quota Annua</TableHead>
                <TableHead className="text-right">Fondo Progressivo</TableHead>
                <TableHead className="text-right">Valore Residuo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cespite.quoteAmmortamento.map((q) => (
                <TableRow
                  key={q.anno}
                  className={
                    q.anno === currentYear
                      ? "bg-primary/10 font-medium"
                      : ""
                  }
                >
                  <TableCell className="font-mono">
                    {q.anno}
                    {q.anno === currentYear && (
                      <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                        corrente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(q.aliquotaApplicata)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(q.importoQuota)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(q.fondoProgressivo)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(q.valoreResiduo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
