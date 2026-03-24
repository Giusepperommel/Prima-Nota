"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/business-utils";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Download, FileText, FileCode } from "lucide-react";

// ─── Types matching API response ───

type ContoAggregato = {
  contoId: number;
  codice: string;
  descrizione: string;
  saldo: number;
};

type VoceBilancio = {
  codice: string;
  descrizione: string;
  importo: number;
  conti?: ContoAggregato[];
};

type SottoclasseSP = {
  codice: string;
  descrizione: string;
  importo: number;
  voci: VoceBilancio[];
};

type ClasseSP = {
  codice: string;
  descrizione: string;
  importo: number;
  sottoclassi: SottoclasseSP[];
  vociDirette: VoceBilancio[];
};

type SezioneSP = {
  nome: "ATTIVO" | "PASSIVO";
  classi: ClasseSP[];
  totale: number;
};

type StatoPatrimoniale = {
  attivo: SezioneSP;
  passivo: SezioneSP;
};

type SottovoceCE = {
  codice: string;
  descrizione: string;
  importo: number;
};

type VoceCE = {
  codice: string;
  descrizione: string;
  importo: number;
  sottovoci: SottovoceCE[];
};

type SezioneCE = {
  codice: string;
  descrizione: string;
  importo: number;
  voci: VoceCE[];
};

type ContoEconomico = {
  sezioni: SezioneCE[];
  differenzaAB: number;
  totaleC: number;
  totaleD: number;
  risultatoPrimaImposte: number;
  imposte: number;
  utilePerditaEsercizio: number;
};

type BilancioResponse = {
  anno: number;
  tipo: string;
  dataGenerazione: string;
  statoPatrimoniale: StatoPatrimoniale;
  contoEconomico: ContoEconomico;
  totaleAttivo: number;
  totalePassivo: number;
  utileEsercizio: number;
};

export function BilancioCivilisticoContent() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [anno, setAnno] = useState(String(currentYear));
  const [bilancio, setBilancio] = useState<BilancioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchBilancio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bilancio-civilistico/${anno}`);
      if (res.status === 404) {
        setBilancio(null);
        return;
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel caricamento");
      }
      const json: BilancioResponse = await res.json();
      setBilancio(json);
    } catch (error: unknown) {
      if (error instanceof Error && !error.message.includes("404")) {
        toast.error(error.message);
      }
      setBilancio(null);
    } finally {
      setLoading(false);
    }
  }, [anno]);

  useEffect(() => {
    fetchBilancio();
  }, [fetchBilancio]);

  const handleGenera = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/bilancio-civilistico/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anno: parseInt(anno) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella generazione");
      }
      toast.success("Bilancio civilistico generato con successo");
      await fetchBilancio();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Errore nella generazione"
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleExportXbrl = async () => {
    try {
      const res = await fetch(`/api/bilancio-civilistico/${anno}/xbrl`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'export XBRL");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bilancio_${anno}.xbrl`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("File XBRL scaricato");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Errore nell'export"
      );
    }
  };

  const handleExportPdf = async () => {
    toast.info("Export PDF non ancora implementato. Utilizzare XBRL.");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Anno</label>
              <Select value={anno} onValueChange={setAnno}>
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

            <Button onClick={handleGenera} disabled={generating}>
              <RefreshCw
                className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`}
              />
              {bilancio ? "Rigenera" : "Genera"} Bilancio
            </Button>

            {bilancio && (
              <>
                <Button variant="outline" onClick={handleExportPdf}>
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                <Button variant="outline" onClick={handleExportXbrl}>
                  <FileCode className="mr-2 h-4 w-4" />
                  XBRL
                </Button>
              </>
            )}

            {bilancio && (
              <div className="ml-auto text-xs text-muted-foreground">
                Generato il:{" "}
                {new Date(bilancio.dataGenerazione).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {bilancio && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Totale Attivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold font-mono">
                {formatCurrency(bilancio.totaleAttivo)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Totale Passivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold font-mono">
                {formatCurrency(bilancio.totalePassivo)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Utile (Perdita) d&apos;Esercizio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span
                className={`text-2xl font-bold font-mono ${
                  bilancio.utileEsercizio >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {formatCurrency(bilancio.utileEsercizio)}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main content */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Caricamento...
          </CardContent>
        </Card>
      ) : !bilancio ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nessun bilancio generato per l&apos;anno {anno}. Clicca
            &quot;Genera Bilancio&quot; per crearlo.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="sp">
          <TabsList>
            <TabsTrigger value="sp">Stato Patrimoniale</TabsTrigger>
            <TabsTrigger value="ce">Conto Economico</TabsTrigger>
          </TabsList>

          <TabsContent value="sp" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SPSection
                sezione={bilancio.statoPatrimoniale.attivo}
                title="ATTIVO"
              />
              <SPSection
                sezione={bilancio.statoPatrimoniale.passivo}
                title="PASSIVO"
              />
            </div>
          </TabsContent>

          <TabsContent value="ce" className="mt-4">
            <CESection ce={bilancio.contoEconomico} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─── Stato Patrimoniale Section ───

function SPSection({
  sezione,
  title,
}: {
  sezione: SezioneSP;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voce</TableHead>
                <TableHead className="text-right w-[140px]">Importo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sezione.classi.map((classe) => (
                <SPClasseRows key={classe.codice} classe={classe} />
              ))}
              <TableRow className="bg-muted/50 font-bold border-t-2">
                <TableCell>TOTALE {title}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(sezione.totale)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SPClasseRows({ classe }: { classe: ClasseSP }) {
  const hasContent =
    Math.abs(classe.importo) > 0.005 ||
    classe.sottoclassi.some((sc) => Math.abs(sc.importo) > 0.005) ||
    classe.vociDirette.some((v) => Math.abs(v.importo) > 0.005);

  if (!hasContent) return null;

  return (
    <>
      {/* Classe header */}
      <TableRow className="bg-muted/30">
        <TableCell className="font-semibold">
          {classe.codice}) {classe.descrizione}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold">
          {formatCurrency(classe.importo)}
        </TableCell>
      </TableRow>

      {/* Sottoclassi */}
      {classe.sottoclassi.map(
        (sc) =>
          Math.abs(sc.importo) > 0.005 && (
            <SPSottoclasseRows
              key={`${classe.codice}.${sc.codice}`}
              classe={classe.codice}
              sottoclasse={sc}
            />
          )
      )}

      {/* Voci dirette */}
      {classe.vociDirette.map(
        (voce, i) =>
          Math.abs(voce.importo) > 0.005 && (
            <TableRow key={`dir-${i}`}>
              <TableCell className="pl-8 text-sm">{voce.descrizione}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(voce.importo)}
              </TableCell>
            </TableRow>
          )
      )}
    </>
  );
}

function SPSottoclasseRows({
  classe,
  sottoclasse,
}: {
  classe: string;
  sottoclasse: SottoclasseSP;
}) {
  return (
    <>
      <TableRow>
        <TableCell className="pl-6 font-medium text-sm">
          {sottoclasse.codice}) {sottoclasse.descrizione}
        </TableCell>
        <TableCell className="text-right font-mono text-sm font-medium">
          {formatCurrency(sottoclasse.importo)}
        </TableCell>
      </TableRow>
      {sottoclasse.voci.map(
        (voce, i) =>
          Math.abs(voce.importo) > 0.005 && (
            <TableRow key={`${classe}.${sottoclasse.codice}.${voce.codice}-${i}`}>
              <TableCell className="pl-10 text-sm text-muted-foreground">
                {voce.codice ? `${voce.codice}) ` : ""}
                {voce.descrizione}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(voce.importo)}
              </TableCell>
            </TableRow>
          )
      )}
    </>
  );
}

// ─── Conto Economico Section ───

function CESection({ ce }: { ce: ContoEconomico }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conto Economico</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voce</TableHead>
                <TableHead className="text-right w-[140px]">Importo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ce.sezioni.map((sezione) => (
                <CESectionRows key={sezione.codice} sezione={sezione} />
              ))}

              {/* Differenza A - B */}
              <TableRow className="bg-muted/40 font-bold">
                <TableCell>Differenza tra valore e costi della produzione (A - B)</TableCell>
                <TableCell
                  className={`text-right font-mono ${
                    ce.differenzaAB >= 0 ? "" : "text-red-600"
                  }`}
                >
                  {formatCurrency(ce.differenzaAB)}
                </TableCell>
              </TableRow>

              {/* Risultato prima delle imposte */}
              <TableRow className="bg-muted/40 font-bold">
                <TableCell>Risultato prima delle imposte (A - B +/- C +/- D)</TableCell>
                <TableCell
                  className={`text-right font-mono ${
                    ce.risultatoPrimaImposte >= 0 ? "" : "text-red-600"
                  }`}
                >
                  {formatCurrency(ce.risultatoPrimaImposte)}
                </TableCell>
              </TableRow>

              {/* Imposte */}
              <TableRow>
                <TableCell className="font-semibold">
                  20) Imposte sul reddito dell&apos;esercizio
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(ce.imposte)}
                </TableCell>
              </TableRow>

              {/* Utile/Perdita */}
              <TableRow className="bg-muted/50 font-bold border-t-2">
                <TableCell>
                  21) Utile (perdita) dell&apos;esercizio
                </TableCell>
                <TableCell
                  className={`text-right font-mono ${
                    ce.utilePerditaEsercizio >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(ce.utilePerditaEsercizio)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function CESectionRows({ sezione }: { sezione: SezioneCE }) {
  return (
    <>
      {/* Section header */}
      <TableRow className="bg-muted/30">
        <TableCell className="font-semibold">
          {sezione.codice}) {sezione.descrizione}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold">
          {formatCurrency(sezione.importo)}
        </TableCell>
      </TableRow>

      {/* Voci */}
      {sezione.voci.map((voce) => (
        <CEVoceRows
          key={`${sezione.codice}.${voce.codice}`}
          sezione={sezione.codice}
          voce={voce}
        />
      ))}
    </>
  );
}

function CEVoceRows({
  sezione,
  voce,
}: {
  sezione: string;
  voce: VoceCE;
}) {
  if (Math.abs(voce.importo) < 0.005 && voce.sottovoci.every(sv => Math.abs(sv.importo) < 0.005)) {
    return null;
  }

  return (
    <>
      <TableRow>
        <TableCell className="pl-6 text-sm">
          {voce.codice}) {voce.descrizione}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {formatCurrency(voce.importo)}
        </TableCell>
      </TableRow>
      {voce.sottovoci.map(
        (sv) =>
          Math.abs(sv.importo) > 0.005 && (
            <TableRow key={`${sezione}.${voce.codice}.${sv.codice}`}>
              <TableCell className="pl-10 text-sm text-muted-foreground">
                {sv.codice}) {sv.descrizione}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatCurrency(sv.importo)}
              </TableCell>
            </TableRow>
          )
      )}
    </>
  );
}
