"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScadenzaCountdown } from "@/components/portale/scadenza-countdown";
import { Download, FileText, Calculator, Calendar, BarChart3 } from "lucide-react";

interface LiquidazioneIva {
  id: number;
  periodo: string;
  ivaDebito: number;
  ivaCredito: number;
  saldo: number;
  stato: string;
}

interface Scadenza {
  id: number;
  tipo: string;
  scadenza: string;
  stato: string;
  percentualeCompletamento: number;
}

interface Fattura {
  id: number;
  numero: string;
  annoRiferimento: number;
  stato: string;
  importoTotale: number;
  dataDocumento: string;
}

interface Report {
  id: number;
  generatoAt: string;
  fileUrl: string | null;
  template: { nome: string; tipo: string };
}

interface FiscaleData {
  liquidazioniIva?: LiquidazioneIva[];
  scadenze?: Scadenza[];
  fatture?: Fattura[];
  reports?: Report[];
}

const STATO_FATTURA_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  INVIATA: "default",
  ACCETTATA: "default",
  CONSEGNATA: "default",
  RIFIUTATA: "destructive",
  BOZZA: "secondary",
  ERRORE: "destructive",
};

export function FiscaleContent() {
  const router = useRouter();
  const [data, setData] = useState<FiscaleData>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("iva");

  const getToken = useCallback(() => {
    const token = localStorage.getItem("portale_token");
    if (!token) {
      router.push("/portale/login");
      return null;
    }
    return token;
  }, [router]);

  const handleAuthError = useCallback(() => {
    localStorage.removeItem("portale_token");
    localStorage.removeItem("portale_nome");
    localStorage.removeItem("portale_ruolo");
    router.push("/portale/login");
  }, [router]);

  const fetchData = useCallback(async (sezione?: string) => {
    const token = getToken();
    if (!token) return;

    try {
      const url = sezione
        ? `/api/portale/fiscale?sezione=${sezione}`
        : "/api/portale/fiscale";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) { handleAuthError(); return; }

      if (res.ok) {
        const json = await res.json();
        setData((prev) => ({ ...prev, ...json }));
      }
    } catch (error) {
      console.error("[Fiscale] Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [getToken, handleAuthError]);

  // Load all sections on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reload when tab changes
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    fetchData(tab);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="iva" className="flex items-center gap-1.5">
          <Calculator className="h-4 w-4" /> IVA
        </TabsTrigger>
        <TabsTrigger value="scadenzario" className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" /> Scadenzario
        </TabsTrigger>
        <TabsTrigger value="fatture" className="flex items-center gap-1.5">
          <FileText className="h-4 w-4" /> Fatture
        </TabsTrigger>
        <TabsTrigger value="report" className="flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" /> Report
        </TabsTrigger>
      </TabsList>

      {/* IVA Tab */}
      <TabsContent value="iva">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Liquidazioni IVA</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.liquidazioniIva || data.liquidazioniIva.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessuna liquidazione IVA disponibile
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periodo</TableHead>
                    <TableHead className="text-right">IVA Debito</TableHead>
                    <TableHead className="text-right">IVA Credito</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.liquidazioniIva.map((liq) => (
                    <TableRow key={liq.id}>
                      <TableCell className="font-medium">{liq.periodo}</TableCell>
                      <TableCell className="text-right">
                        {Number(liq.ivaDebito).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(liq.ivaCredito).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${Number(liq.saldo) >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {Number(liq.saldo).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={liq.stato === "DEFINITIVA" ? "default" : "secondary"} className="text-[10px]">
                          {liq.stato}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Scadenzario Tab */}
      <TabsContent value="scadenzario">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scadenze Fiscali</CardTitle>
          </CardHeader>
          <CardContent>
            <ScadenzaCountdown scadenze={data.scadenze || []} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Fatture Tab */}
      <TabsContent value="fatture">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fatture Elettroniche</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.fatture || data.fatture.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessuna fattura disponibile
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.fatture.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.numero}</TableCell>
                      <TableCell>
                        {new Date(f.dataDocumento).toLocaleDateString("it-IT")}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(f.importoTotale).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={STATO_FATTURA_VARIANT[f.stato] || "outline"}
                          className="text-[10px]"
                        >
                          {f.stato}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Report Tab */}
      <TabsContent value="report">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report Disponibili</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.reports || data.reports.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nessun report disponibile
              </p>
            ) : (
              <div className="space-y-2">
                {data.reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{report.template.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">{report.template.tipo}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(report.generatoAt).toLocaleDateString("it-IT")}
                        </span>
                      </div>
                    </div>
                    {report.fileUrl && (
                      <a
                        href={report.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        <Download className="h-4 w-4" />
                        Scarica
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
