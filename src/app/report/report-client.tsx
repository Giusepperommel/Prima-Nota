"use client";

import { useState, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import { ReportList } from "@/components/bi/report-list";
import { ReportDetail } from "@/components/bi/report-detail";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercentuale } from "@/lib/business-utils";
import {
  RendicontoPdf,
  type RendicontoData,
} from "@/components/report/rendiconto-pdf";
import { SocioPdf, type SocioReportData } from "@/components/report/socio-pdf";
import {
  StimaFiscaleSocietaPdf,
  type StimaFiscaleSocietaData,
} from "@/components/report/stima-fiscale-societa-pdf";
import {
  StimaFiscaleSocioPdf,
  type StimaFiscaleSocioData,
} from "@/components/report/stima-fiscale-socio-pdf";
import {
  RiepilogoIvaPdf,
  type RiepilogoIvaData,
} from "@/components/report/riepilogo-iva-pdf";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SocioOption = {
  id: number;
  nome: string;
  cognome: string;
  quotaPercentuale: number;
};

type Props = {
  ruolo: string;
  socioId: number | null;
  soci: SocioOption[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentYearRange(): { da: string; a: string } {
  const year = new Date().getFullYear();
  return {
    da: `${year}-01-01`,
    a: `${year}-12-31`,
  };
}

function fmtDateDisplay(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const tipoLabel: Record<string, string> = {
  FATTURA_ATTIVA: "Fattura Attiva",
  COSTO: "Costo",
  CESPITE: "Cespite",
};

const tipoBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  FATTURA_ATTIVA: "default",
  COSTO: "secondary",
  CESPITE: "outline",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportClient({ ruolo, socioId, soci }: Props) {
  const isAdmin = ruolo === "ADMIN";
  const defaults = currentYearRange();

  // Rendiconto state
  const [rendicontoDa, setRendicontoDa] = useState(defaults.da);
  const [rendicontoA, setRendicontoA] = useState(defaults.a);
  const [rendicontoData, setRendicontoData] = useState<RendicontoData | null>(null);
  const [rendicontoLoading, setRendicontoLoading] = useState(false);
  const [rendicontoError, setRendicontoError] = useState<string | null>(null);
  const [rendicontoPdfLoading, setRendicontoPdfLoading] = useState(false);

  // Socio report state
  const [socioDa, setSocioDa] = useState(defaults.da);
  const [socioA, setSocioA] = useState(defaults.a);
  const [selectedSocioId, setSelectedSocioId] = useState<string>(
    String(socioId)
  );
  const [socioReportData, setSocioReportData] = useState<SocioReportData | null>(null);
  const [socioLoading, setSocioLoading] = useState(false);
  const [socioError, setSocioError] = useState<string | null>(null);
  const [socioPdfLoading, setSocioPdfLoading] = useState(false);

  // Stima Fiscale Societa state
  const [stimaSocietaAnno, setStimaSocietaAnno] = useState(String(new Date().getFullYear()));
  const [stimaSocietaData, setStimaSocietaData] = useState<StimaFiscaleSocietaData | null>(null);
  const [stimaSocietaLoading, setStimaSocietaLoading] = useState(false);
  const [stimaSocietaError, setStimaSocietaError] = useState<string | null>(null);
  const [stimaSocietaPdfLoading, setStimaSocietaPdfLoading] = useState(false);

  // Stima Fiscale Socio state
  const [stimaSocioAnno, setStimaSocioAnno] = useState(String(new Date().getFullYear()));
  const [stimaSocioSelectedId, setStimaSocioSelectedId] = useState<string>(String(socioId));
  const [stimaSocioData, setStimaSocioData] = useState<StimaFiscaleSocioData | null>(null);
  const [stimaSocioLoading, setStimaSocioLoading] = useState(false);
  const [stimaSocioError, setStimaSocioError] = useState<string | null>(null);
  const [stimaSocioPdfLoading, setStimaSocioPdfLoading] = useState(false);

  // Riepilogo IVA state
  const [ivaAnno, setIvaAnno] = useState(String(new Date().getFullYear()));
  const [ivaData, setIvaData] = useState<RiepilogoIvaData | null>(null);
  const [ivaLoading, setIvaLoading] = useState(false);
  const [ivaError, setIvaError] = useState<string | null>(null);
  const [ivaPdfLoading, setIvaPdfLoading] = useState(false);

  // BI Report state
  const [selectedBiReportId, setSelectedBiReportId] = useState<number | null>(null);

  // Fetch rendiconto
  const fetchRendiconto = useCallback(async () => {
    setRendicontoLoading(true);
    setRendicontoError(null);
    setRendicontoData(null);

    try {
      const params = new URLSearchParams({ da: rendicontoDa, a: rendicontoA });
      const res = await fetch(`/api/report/rendiconto?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Errore nel caricamento del rendiconto");
      }
      const data: RendicontoData = await res.json();
      setRendicontoData(data);
    } catch (err) {
      setRendicontoError(
        err instanceof Error ? err.message : "Errore sconosciuto"
      );
    } finally {
      setRendicontoLoading(false);
    }
  }, [rendicontoDa, rendicontoA]);

  // Fetch socio report
  const fetchSocioReport = useCallback(async () => {
    setSocioLoading(true);
    setSocioError(null);
    setSocioReportData(null);

    try {
      const params = new URLSearchParams({ da: socioDa, a: socioA });
      if (isAdmin && selectedSocioId) {
        params.set("socioId", selectedSocioId);
      }
      const res = await fetch(`/api/report/socio?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Errore nel caricamento del report");
      }
      const data: SocioReportData = await res.json();
      setSocioReportData(data);
    } catch (err) {
      setSocioError(
        err instanceof Error ? err.message : "Errore sconosciuto"
      );
    } finally {
      setSocioLoading(false);
    }
  }, [socioDa, socioA, isAdmin, selectedSocioId]);

  // Download rendiconto PDF
  const downloadRendicontoPdf = useCallback(async () => {
    if (!rendicontoData) return;
    setRendicontoPdfLoading(true);

    try {
      const blob = await pdf(<RendicontoPdf data={rendicontoData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rendiconto_${rendicontoDa}_${rendicontoA}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Errore nella generazione del PDF:", err);
    } finally {
      setRendicontoPdfLoading(false);
    }
  }, [rendicontoData, rendicontoDa, rendicontoA]);

  // Download socio PDF
  const downloadSocioPdf = useCallback(async () => {
    if (!socioReportData) return;
    setSocioPdfLoading(true);

    try {
      const blob = await pdf(<SocioPdf data={socioReportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const socioName = `${socioReportData.socio.cognome}_${socioReportData.socio.nome}`.toLowerCase();
      a.download = `report_socio_${socioName}_${socioDa}_${socioA}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Errore nella generazione del PDF:", err);
    } finally {
      setSocioPdfLoading(false);
    }
  }, [socioReportData, socioDa, socioA]);

  // Fetch stima fiscale societa
  const fetchStimaSocieta = useCallback(async () => {
    setStimaSocietaLoading(true);
    setStimaSocietaError(null);
    setStimaSocietaData(null);
    try {
      const params = new URLSearchParams({ anno: stimaSocietaAnno });
      const res = await fetch(`/api/report/stima-fiscale?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Errore nel caricamento della stima");
      }
      const data: StimaFiscaleSocietaData = await res.json();
      setStimaSocietaData(data);
    } catch (err) {
      setStimaSocietaError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setStimaSocietaLoading(false);
    }
  }, [stimaSocietaAnno]);

  // Download stima societa PDF
  const downloadStimaSocietaPdf = useCallback(async () => {
    if (!stimaSocietaData) return;
    setStimaSocietaPdfLoading(true);
    try {
      const blob = await pdf(<StimaFiscaleSocietaPdf data={stimaSocietaData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stima_fiscale_societa_${stimaSocietaAnno}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Errore nella generazione del PDF:", err);
    } finally {
      setStimaSocietaPdfLoading(false);
    }
  }, [stimaSocietaData, stimaSocietaAnno]);

  // Fetch stima fiscale socio
  const fetchStimaSocio = useCallback(async () => {
    setStimaSocioLoading(true);
    setStimaSocioError(null);
    setStimaSocioData(null);
    try {
      const params = new URLSearchParams({ anno: stimaSocioAnno });
      if (isAdmin && stimaSocioSelectedId) {
        params.set("socioId", stimaSocioSelectedId);
      }
      const res = await fetch(`/api/report/stima-fiscale-socio?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Errore nel caricamento della stima");
      }
      const data: StimaFiscaleSocioData = await res.json();
      setStimaSocioData(data);
    } catch (err) {
      setStimaSocioError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setStimaSocioLoading(false);
    }
  }, [stimaSocioAnno, isAdmin, stimaSocioSelectedId]);

  // Download stima socio PDF
  const downloadStimaSocioPdf = useCallback(async () => {
    if (!stimaSocioData) return;
    setStimaSocioPdfLoading(true);
    try {
      const blob = await pdf(<StimaFiscaleSocioPdf data={stimaSocioData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = `${stimaSocioData.socio.cognome}_${stimaSocioData.socio.nome}`.toLowerCase();
      a.download = `stima_fiscale_${name}_${stimaSocioAnno}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Errore nella generazione del PDF:", err);
    } finally {
      setStimaSocioPdfLoading(false);
    }
  }, [stimaSocioData, stimaSocioAnno]);

  // Fetch riepilogo IVA
  const fetchIva = useCallback(async () => {
    setIvaLoading(true);
    setIvaError(null);
    setIvaData(null);

    try {
      const params = new URLSearchParams({ anno: ivaAnno });
      const res = await fetch(`/api/report/iva?${params}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Errore nel caricamento del riepilogo IVA");
      }
      const data: RiepilogoIvaData = await res.json();
      setIvaData(data);
    } catch (err) {
      setIvaError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setIvaLoading(false);
    }
  }, [ivaAnno]);

  // Download PDF IVA
  const downloadIvaPdf = useCallback(async () => {
    if (!ivaData) return;
    setIvaPdfLoading(true);
    try {
      const blob = await pdf(<RiepilogoIvaPdf data={ivaData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `riepilogo-iva-${ivaData.anno}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Errore nella generazione del PDF:", err);
    } finally {
      setIvaPdfLoading(false);
    }
  }, [ivaData]);

  return (
    <Tabs defaultValue="rendiconto" className="space-y-4">
      <div className="tabs-scrollable">
        <TabsList className="w-max">
          <TabsTrigger value="rendiconto">Rendiconto Societario</TabsTrigger>
          <TabsTrigger value="socio">Report per Socio</TabsTrigger>
          <TabsTrigger value="stima-societa">Stima Fiscale Societa</TabsTrigger>
          <TabsTrigger value="stima-socio">Stima Fiscale Socio</TabsTrigger>
          <TabsTrigger value="iva">Riepilogo IVA</TabsTrigger>
          <TabsTrigger value="bi">Report BI</TabsTrigger>
        </TabsList>
      </div>

      {/* ================================================================= */}
      {/* TAB: Rendiconto Societario                                        */}
      {/* ================================================================= */}
      <TabsContent value="rendiconto">
        <Card>
          <CardHeader>
            <CardTitle>Rendiconto Societario</CardTitle>
            <CardDescription>
              Genera il rendiconto generale della societa per il periodo
              selezionato.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="rendiconto-da">Data Inizio</Label>
                <Input
                  id="rendiconto-da"
                  type="date"
                  value={rendicontoDa}
                  onChange={(e) => setRendicontoDa(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rendiconto-a">Data Fine</Label>
                <Input
                  id="rendiconto-a"
                  type="date"
                  value={rendicontoA}
                  onChange={(e) => setRendicontoA(e.target.value)}
                  className="w-44"
                />
              </div>
              <Button onClick={fetchRendiconto} disabled={rendicontoLoading}>
                {rendicontoLoading ? "Caricamento..." : "Genera Anteprima"}
              </Button>
              {rendicontoData && (
                <Button
                  variant="outline"
                  onClick={downloadRendicontoPdf}
                  disabled={rendicontoPdfLoading}
                >
                  {rendicontoPdfLoading ? "Generazione PDF..." : "Scarica PDF"}
                </Button>
              )}
            </div>

            {/* Error */}
            {rendicontoError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {rendicontoError}
              </div>
            )}

            {/* Loading */}
            {rendicontoLoading && (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}

            {/* Preview */}
            {rendicontoData && !rendicontoLoading && (
              <RendicontoPreview data={rendicontoData} />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ================================================================= */}
      {/* TAB: Report per Socio                                             */}
      {/* ================================================================= */}
      <TabsContent value="socio">
        <Card>
          <CardHeader>
            <CardTitle>Report per Socio</CardTitle>
            <CardDescription>
              Genera il report dettagliato per un singolo socio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="socio-da">Data Inizio</Label>
                <Input
                  id="socio-da"
                  type="date"
                  value={socioDa}
                  onChange={(e) => setSocioDa(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="socio-a">Data Fine</Label>
                <Input
                  id="socio-a"
                  type="date"
                  value={socioA}
                  onChange={(e) => setSocioA(e.target.value)}
                  className="w-44"
                />
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Socio</Label>
                  <Select
                    value={selectedSocioId}
                    onValueChange={setSelectedSocioId}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Seleziona socio" />
                    </SelectTrigger>
                    <SelectContent>
                      {soci.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.cognome} {s.nome} ({formatPercentuale(s.quotaPercentuale)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!isAdmin && (
                <div className="space-y-2">
                  <Label>Socio</Label>
                  <Input
                    value={
                      soci.find((s) => s.id === socioId)
                        ? `${soci.find((s) => s.id === socioId)!.cognome} ${soci.find((s) => s.id === socioId)!.nome}`
                        : "Socio corrente"
                    }
                    disabled
                    className="w-56"
                  />
                </div>
              )}
              <Button onClick={fetchSocioReport} disabled={socioLoading}>
                {socioLoading ? "Caricamento..." : "Genera Anteprima"}
              </Button>
              {socioReportData && (
                <Button
                  variant="outline"
                  onClick={downloadSocioPdf}
                  disabled={socioPdfLoading}
                >
                  {socioPdfLoading ? "Generazione PDF..." : "Scarica PDF"}
                </Button>
              )}
            </div>

            {/* Error */}
            {socioError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {socioError}
              </div>
            )}

            {/* Loading */}
            {socioLoading && (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-60 w-full" />
              </div>
            )}

            {/* Preview */}
            {socioReportData && !socioLoading && (
              <SocioReportPreview data={socioReportData} />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ================================================================= */}
      {/* TAB: Stima Fiscale Societa                                        */}
      {/* ================================================================= */}
      <TabsContent value="stima-societa">
        <Card>
          <CardHeader>
            <CardTitle>Stima Fiscale Societa</CardTitle>
            <CardDescription>
              Prospetto di stima delle imposte societarie (IRES, IRAP) per l&apos;anno selezionato.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="stima-societa-anno">Anno Fiscale</Label>
                <Input
                  id="stima-societa-anno"
                  type="number"
                  min="2000"
                  max="2100"
                  value={stimaSocietaAnno}
                  onChange={(e) => setStimaSocietaAnno(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={fetchStimaSocieta} disabled={stimaSocietaLoading}>
                {stimaSocietaLoading ? "Caricamento..." : "Genera Stima"}
              </Button>
              {stimaSocietaData && (
                <Button
                  variant="outline"
                  onClick={downloadStimaSocietaPdf}
                  disabled={stimaSocietaPdfLoading}
                >
                  {stimaSocietaPdfLoading ? "Generazione PDF..." : "Scarica PDF"}
                </Button>
              )}
            </div>

            {stimaSocietaError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {stimaSocietaError}
              </div>
            )}

            {stimaSocietaLoading && (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}

            {stimaSocietaData && !stimaSocietaLoading && (
              <StimaSocietaPreview data={stimaSocietaData} />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ================================================================= */}
      {/* TAB: Stima Fiscale Socio                                          */}
      {/* ================================================================= */}
      <TabsContent value="stima-socio">
        <Card>
          <CardHeader>
            <CardTitle>Stima Fiscale per Socio</CardTitle>
            <CardDescription>
              Prospetto di stima del carico fiscale personale basato sul fatturato e costi reali del socio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="stima-socio-anno">Anno Fiscale</Label>
                <Input
                  id="stima-socio-anno"
                  type="number"
                  min="2000"
                  max="2100"
                  value={stimaSocioAnno}
                  onChange={(e) => setStimaSocioAnno(e.target.value)}
                  className="w-32"
                />
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Socio</Label>
                  <Select
                    value={stimaSocioSelectedId}
                    onValueChange={setStimaSocioSelectedId}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Seleziona socio" />
                    </SelectTrigger>
                    <SelectContent>
                      {soci.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.cognome} {s.nome} ({formatPercentuale(s.quotaPercentuale)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!isAdmin && (
                <div className="space-y-2">
                  <Label>Socio</Label>
                  <Input
                    value={
                      soci.find((s) => s.id === socioId)
                        ? `${soci.find((s) => s.id === socioId)!.cognome} ${soci.find((s) => s.id === socioId)!.nome}`
                        : "Socio corrente"
                    }
                    disabled
                    className="w-56"
                  />
                </div>
              )}
              <Button onClick={fetchStimaSocio} disabled={stimaSocioLoading}>
                {stimaSocioLoading ? "Caricamento..." : "Genera Stima"}
              </Button>
              {stimaSocioData && (
                <Button
                  variant="outline"
                  onClick={downloadStimaSocioPdf}
                  disabled={stimaSocioPdfLoading}
                >
                  {stimaSocioPdfLoading ? "Generazione PDF..." : "Scarica PDF"}
                </Button>
              )}
            </div>

            {stimaSocioError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {stimaSocioError}
              </div>
            )}

            {stimaSocioLoading && (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}

            {stimaSocioData && !stimaSocioLoading && (
              <StimaSocioPreview data={stimaSocioData} />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ================================================================= */}
      {/* TAB: Riepilogo IVA                                                */}
      {/* ================================================================= */}
      <TabsContent value="iva">
        <Card>
          <CardHeader>
            <CardTitle>Riepilogo IVA</CardTitle>
            <CardDescription>
              Prospetto riepilogativo IVA a debito e IVA a credito per l&apos;anno selezionato.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="iva-anno">Anno</Label>
                <Input
                  id="iva-anno"
                  type="number"
                  min="2000"
                  max="2100"
                  value={ivaAnno}
                  onChange={(e) => setIvaAnno(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={fetchIva} disabled={ivaLoading}>
                {ivaLoading ? "Caricamento..." : "Genera Riepilogo"}
              </Button>
              {ivaData && (
                <Button
                  variant="outline"
                  onClick={downloadIvaPdf}
                  disabled={ivaPdfLoading}
                >
                  {ivaPdfLoading ? "Generazione PDF..." : "Scarica PDF"}
                </Button>
              )}
            </div>

            {ivaError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {ivaError}
              </div>
            )}

            {ivaLoading && (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}

            {ivaData && !ivaLoading && (
              <RiepilogoIvaPreview data={ivaData} />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ================================================================= */}
      {/* TAB: Report BI                                                    */}
      {/* ================================================================= */}
      <TabsContent value="bi">
        {selectedBiReportId ? (
          <ReportDetail reportId={selectedBiReportId} onBack={() => setSelectedBiReportId(null)} />
        ) : (
          <ReportList onSelectReport={setSelectedBiReportId} />
        )}
      </TabsContent>
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// Rendiconto Preview
// ---------------------------------------------------------------------------

function RendicontoPreview({ data }: { data: RendicontoData }) {
  const { societa, periodo, riepilogo, dettaglioPerCategoria, dettaglioAmmortamento, ripartizioneSoci } =
    data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="text-lg font-semibold">{societa.ragioneSociale}</h3>
        <p className="text-sm text-muted-foreground">
          P.IVA: {societa.partitaIva} | C.F.: {societa.codiceFiscale}
        </p>
        <p className="mt-1 text-sm font-medium">
          Periodo: {fmtDateDisplay(periodo.da)} - {fmtDateDisplay(periodo.a)}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Fatturato" value={formatCurrency(riepilogo.fatturato)} />
        <SummaryCard label="Costi" value={formatCurrency(riepilogo.costi)} />
        <SummaryCard
          label={riepilogo.utile >= 0 ? "Utile" : "Perdita"}
          value={formatCurrency(riepilogo.utile)}
          className={
            riepilogo.utile >= 0 ? "text-green-400" : "text-red-400"
          }
        />
        <SummaryCard
          label="N. Operazioni"
          value={String(riepilogo.numOperazioni)}
        />
      </div>

      {/* Dettaglio per Categoria */}
      <div>
        <h4 className="mb-3 text-sm font-semibold">
          Dettaglio per Categoria
        </h4>
        <div className="table-responsive"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Fatturato</TableHead>
              <TableHead className="text-right">Costi</TableHead>
              <TableHead className="text-right">Totale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dettaglioPerCategoria.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nessun dato disponibile
                </TableCell>
              </TableRow>
            ) : (
              dettaglioPerCategoria.map((cat, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{cat.categoria}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(cat.fatturato)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(cat.costi)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${cat.totale >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {formatCurrency(cat.totale)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </div>

      {/* Ammortamento Cespiti */}
      {dettaglioAmmortamento && dettaglioAmmortamento.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold">
            Ammortamento Cespiti ({formatCurrency(riepilogo.ammortamento ?? 0)})
          </h4>
          <div className="table-responsive"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cespite</TableHead>
                <TableHead className="text-right">Valore Iniziale</TableHead>
                <TableHead className="text-right">Aliquota</TableHead>
                <TableHead className="text-right">Quota Periodo</TableHead>
                <TableHead>Attribuzione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dettaglioAmmortamento.map((c: any) => (
                <TableRow key={c.cespiteId}>
                  <TableCell className="font-medium">{c.descrizione}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(c.valoreIniziale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(c.aliquota)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-violet-400">
                    {formatCurrency(c.quotaAnnua)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.attribuzione
                      ?.map((a: any) => `${a.cognome} ${a.nome} (${formatPercentuale(a.percentuale)})`)
                      .join(", ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        </div>
      )}

      {/* Ripartizione Soci */}
      <div>
        <h4 className="mb-3 text-sm font-semibold">
          Ripartizione tra i Soci
        </h4>
        <div className="table-responsive"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Socio</TableHead>
              <TableHead className="text-right">Quota %</TableHead>
              <TableHead className="text-right">Fatturato</TableHead>
              <TableHead className="text-right">Costi</TableHead>
              <TableHead className="text-right">Ammortamento</TableHead>
              <TableHead className="text-right">Utile/Perdita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ripartizioneSoci.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nessun dato disponibile
                </TableCell>
              </TableRow>
            ) : (
              ripartizioneSoci.map((s: any) => (
                <TableRow key={s.socioId}>
                  <TableCell className="font-medium">
                    {s.cognome} {s.nome}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(s.quotaPercentuale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(s.fatturato)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(s.costi)}
                  </TableCell>
                  <TableCell className="text-right text-violet-400">
                    {formatCurrency(s.ammortamento ?? 0)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${s.utile >= 0 ? "text-green-400" : "text-red-400"}`}
                  >
                    {formatCurrency(s.utile)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Socio Report Preview
// ---------------------------------------------------------------------------

function SocioReportPreview({ data }: { data: SocioReportData }) {
  const { socio, societa, periodo, riepilogo, dettaglioOperazioni, dettaglioAmmortamento } = data as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="text-lg font-semibold">{societa.ragioneSociale}</h3>
        <p className="text-sm font-medium">
          Socio: {socio.cognome} {socio.nome} -{" "}
          Quota: {formatPercentuale(socio.quotaPercentuale)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Periodo: {fmtDateDisplay(periodo.da)} - {fmtDateDisplay(periodo.a)}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Fatturato" value={formatCurrency(riepilogo.fatturato)} />
        <SummaryCard label="Costi" value={formatCurrency(riepilogo.costi)} />
        {(riepilogo.ammortamento ?? 0) > 0 && (
          <SummaryCard label="Ammortamento" value={formatCurrency(riepilogo.ammortamento)} />
        )}
        <SummaryCard
          label={riepilogo.utile >= 0 ? "Utile" : "Perdita"}
          value={formatCurrency(riepilogo.utile)}
          className={
            riepilogo.utile >= 0 ? "text-green-400" : "text-red-400"
          }
        />
      </div>

      {/* Dettaglio Operazioni */}
      <div>
        <h4 className="mb-3 text-sm font-semibold">
          Dettaglio Operazioni ({dettaglioOperazioni.length})
        </h4>
        <div className="table-responsive"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Imp. Totale</TableHead>
              <TableHead className="text-right">% Socio</TableHead>
              <TableHead className="text-right">Imp. Socio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dettaglioOperazioni.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nessuna operazione nel periodo selezionato
                </TableCell>
              </TableRow>
            ) : (
              dettaglioOperazioni.map((op: any) => (
                <TableRow key={op.id}>
                  <TableCell>{fmtDateDisplay(op.data)}</TableCell>
                  <TableCell>
                    <Badge variant={tipoBadgeVariant[op.tipo] || "outline"}>
                      {tipoLabel[op.tipo] || op.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {op.descrizione}
                  </TableCell>
                  <TableCell>{op.categoria}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(op.importoTotale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(op.percentuale)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(op.importoSocio)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table></div>
      </div>

      {/* Dettaglio Ammortamento Socio */}
      {dettaglioAmmortamento && dettaglioAmmortamento.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold">
            Ammortamento Cespiti ({formatCurrency(riepilogo.ammortamento ?? 0)})
          </h4>
          <div className="table-responsive"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cespite</TableHead>
                <TableHead className="text-right">Valore Iniziale</TableHead>
                <TableHead className="text-right">Aliquota</TableHead>
                <TableHead className="text-right">Quota Annua Tot.</TableHead>
                <TableHead className="text-right">% Socio</TableHead>
                <TableHead className="text-right">Quota Socio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dettaglioAmmortamento.map((c: any) => (
                <TableRow key={c.cespiteId}>
                  <TableCell className="font-medium">{c.descrizione}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(c.valoreIniziale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(c.aliquota)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(c.quotaAnnua)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(c.percentualeSocio)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-violet-400">
                    {formatCurrency(c.quotaSocio)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stima Fiscale Societa Preview
// ---------------------------------------------------------------------------

function StimaSocietaPreview({ data }: { data: StimaFiscaleSocietaData }) {
  const regimeLabel = data.regime === "TRASPARENZA"
    ? "Trasparenza (Art. 116 TUIR)"
    : "Ordinario (IRES)";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="text-lg font-semibold">{data.societa.ragioneSociale}</h3>
        <p className="text-sm text-muted-foreground">
          Anno Fiscale: {data.anno} | Regime: {regimeLabel}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Utile Ante Imposte" value={formatCurrency(data.utileAnteImposte)} />
        <SummaryCard label="IRES" value={data.regime === "ORDINARIO" ? formatCurrency(data.ires) : "N/A"} />
        <SummaryCard label={`IRAP (${formatPercentuale(data.aliquotaIrap)})`} value={formatCurrency(data.irap)} />
        <SummaryCard
          label="Totale Imposte Societa"
          value={formatCurrency(data.totaleImposteSocieta)}
          className="text-red-400"
        />
      </div>

      {/* Dettaglio Imposte */}
      <div>
        <h4 className="mb-3 text-sm font-semibold">Dettaglio Imposte Societa</h4>
        <div className="table-responsive"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voce</TableHead>
              <TableHead className="text-right">Base Imponibile</TableHead>
              <TableHead className="text-right">Aliquota</TableHead>
              <TableHead className="text-right">Importo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">IRES</TableCell>
              <TableCell className="text-right">
                {data.regime === "ORDINARIO" ? formatCurrency(data.utileAnteImposte) : "-"}
              </TableCell>
              <TableCell className="text-right">
                {data.regime === "ORDINARIO" ? "24,00%" : "-"}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {data.regime === "ORDINARIO" ? formatCurrency(data.ires) : "N/A - Trasparenza"}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">IRAP</TableCell>
              <TableCell className="text-right">{formatCurrency(data.utileAnteImposte)}</TableCell>
              <TableCell className="text-right">{formatPercentuale(data.aliquotaIrap)}</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(data.irap)}</TableCell>
            </TableRow>
          </TableBody>
        </Table></div>
      </div>

      {/* Carico per Socio */}
      {data.dettaglioSoci.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold">Carico Fiscale per Socio</h4>
          <div className="table-responsive"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead className="text-right">Quota %</TableHead>
                <TableHead className="text-right">Quota Utile</TableHead>
                <TableHead className="text-right">
                  {data.regime === "ORDINARIO" ? "Ritenuta Div." : "IRPEF"}
                </TableHead>
                <TableHead className="text-right">INPS</TableHead>
                <TableHead className="text-right">Carico Totale</TableHead>
                <TableHead className="text-right">Netto Stimato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.dettaglioSoci.map((s: any) => (
                <TableRow key={s.socioId}>
                  <TableCell className="font-medium">{s.cognome} {s.nome}</TableCell>
                  <TableCell className="text-right">{formatPercentuale(s.quotaPercentuale)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(s.quotaUtile)}</TableCell>
                  <TableCell className="text-right text-red-400">
                    {data.regime === "ORDINARIO"
                      ? formatCurrency(s.ritenutaDividendi)
                      : formatCurrency(s.irpef)}
                  </TableCell>
                  <TableCell className="text-right text-orange-400">
                    {s.inps > 0 ? formatCurrency(s.inps) : "-"}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-400">
                    {formatCurrency(s.totaleCaricoFiscale)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-400">
                    {formatCurrency(s.nettoStimato)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        </div>
      )}

      {/* Riepilogo Complessivo */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <h4 className="text-sm font-semibold">Riepilogo Complessivo</h4>
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <div>
            <span className="text-muted-foreground">Imposte Societa:</span>{" "}
            <span className="font-semibold">{formatCurrency(data.riepilogoComplessivo.totaleImposteSocieta)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Carico Soci:</span>{" "}
            <span className="font-semibold">{formatCurrency(data.riepilogoComplessivo.totaleCaricoSoci)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Pressione Fiscale:</span>{" "}
            <span className="font-semibold">{formatPercentuale(data.riepilogoComplessivo.pressioneFiscaleEffettiva)}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Stima indicativa a fini di pianificazione. Non sostituisce la consulenza del commercialista.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stima Fiscale Socio Preview
// ---------------------------------------------------------------------------

function StimaSocioPreview({ data }: { data: StimaFiscaleSocioData }) {
  const regimeLabel = data.regime === "TRASPARENZA"
    ? "Trasparenza (Art. 116 TUIR)"
    : "Ordinario (IRES)";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="text-lg font-semibold">{data.societa.ragioneSociale}</h3>
        <p className="text-sm font-medium">
          Socio: {data.socio.cognome} {data.socio.nome} - Quota: {formatPercentuale(data.socio.quotaPercentuale)}
          {data.socio.socioLavoratore && (
            <Badge variant="outline" className="ml-2 bg-violet-500/15 text-violet-400 border-violet-500/25">
              Lavoratore
            </Badge>
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Anno Fiscale: {data.anno} | Regime: {regimeLabel}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Fatturato Socio" value={formatCurrency(data.fatturato)} />
        <SummaryCard label="Costi Socio" value={formatCurrency(data.costi)} />
        <SummaryCard
          label="Utile Ante Imposte"
          value={formatCurrency(data.utileAnteImposte)}
          className={data.utileAnteImposte >= 0 ? "text-green-400" : "text-red-400"}
        />
        <SummaryCard
          label="Netto Stimato"
          value={formatCurrency(data.nettoStimato)}
          className="text-green-400"
        />
      </div>

      {/* Dettaglio Imposte */}
      <div>
        <h4 className="mb-3 text-sm font-semibold">Dettaglio Imposte</h4>
        <div className="table-responsive"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voce</TableHead>
              <TableHead className="text-right">Importo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">IRES (pro-quota)</TableCell>
              <TableCell className="text-right">
                {data.regime === "ORDINARIO" ? formatCurrency(data.iresProQuota) : "N/A - Trasparenza"}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">IRAP (pro-quota)</TableCell>
              <TableCell className="text-right">{formatCurrency(data.irapProQuota)}</TableCell>
            </TableRow>
            {data.regime === "ORDINARIO" ? (
              <TableRow>
                <TableCell className="font-medium">Ritenuta Dividendi (26%)</TableCell>
                <TableCell className="text-right text-red-400">{formatCurrency(data.ritenutaDividendi)}</TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell className="font-medium">IRPEF</TableCell>
                <TableCell className="text-right text-red-400">{formatCurrency(data.irpef)}</TableCell>
              </TableRow>
            )}
            {data.inps > 0 && (
              <TableRow>
                <TableCell className="font-medium">INPS Gestione Commercianti</TableCell>
                <TableCell className="text-right text-orange-400">{formatCurrency(data.inps)}</TableCell>
              </TableRow>
            )}
            <TableRow className="border-t-2">
              <TableCell className="font-bold">Totale Carico Fiscale</TableCell>
              <TableCell className="text-right font-bold text-red-400">
                {formatCurrency(data.totaleCaricoFiscalePersonale)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table></div>
      </div>

      {/* Dettaglio IRPEF scaglioni (solo trasparenza) */}
      {data.regime === "TRASPARENZA" && data.dettaglioIrpef && data.dettaglioIrpef.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold">Dettaglio Scaglioni IRPEF</h4>
          <div className="table-responsive"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scaglione</TableHead>
                <TableHead className="text-right">Imponibile</TableHead>
                <TableHead className="text-right">Aliquota</TableHead>
                <TableHead className="text-right">Imposta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.dettaglioIrpef.map((s: any, i: number) => (
                <TableRow key={i}>
                  <TableCell>{s.scaglione}</TableCell>
                  <TableCell className="text-right">{formatCurrency(s.imponibile)}</TableCell>
                  <TableCell className="text-right">{formatPercentuale(s.aliquota)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(s.imposta)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Stima indicativa a fini di pianificazione. Non sostituisce la consulenza del commercialista.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Card helper
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${className || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Riepilogo IVA Preview
// ---------------------------------------------------------------------------

function RiepilogoIvaPreview({ data }: { data: RiepilogoIvaData }) {
  const saldoColor = data.totali.saldoIva > 0 ? "text-red-400" : "text-green-400";
  const saldoLabel = data.totali.saldoIva > 0 ? "IVA Dovuta" : "IVA a Credito";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="text-lg font-semibold">{data.societa.ragioneSociale}</h3>
        <p className="text-sm text-muted-foreground">
          Anno: {data.anno}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="IVA a Debito" value={formatCurrency(data.totali.ivaDebito)} />
        <SummaryCard label="IVA a Credito" value={formatCurrency(data.totali.ivaCredito)} />
        <SummaryCard
          label={saldoLabel}
          value={formatCurrency(Math.abs(data.totali.saldoIva))}
          className={saldoColor}
        />
      </div>

      {/* Chart */}
      <div>
        <h4 className="mb-3 text-sm font-semibold">Andamento Mensile</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data.andamentoMensile}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="meseLabel" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                color: "hsl(var(--popover-foreground))",
              }}
              formatter={(value) => formatCurrency(Number(value))}
            />
            <Legend />
            <Bar dataKey="ivaDebito" name="IVA Debito" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ivaCredito" name="IVA Credito" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail table */}
      <div>
        <h4 className="mb-3 text-sm font-semibold">Dettaglio</h4>
        <div className="table-responsive"><Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voce</TableHead>
              <TableHead className="text-right">Importo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">IVA su fatture attive (debito)</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totali.ivaDebito)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">IVA su costi detraibile (credito)</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totali.ivaCredito)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">IVA su costi indetraibile</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totali.ivaIndetraibile)}</TableCell>
            </TableRow>
            <TableRow className="border-t-2">
              <TableCell className="font-bold">{saldoLabel}</TableCell>
              <TableCell className={`text-right font-bold ${saldoColor}`}>
                {formatCurrency(Math.abs(data.totali.saldoIva))}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table></div>
      </div>
    </div>
  );
}
