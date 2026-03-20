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
  TableFooter,
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
import { Progress } from "@/components/ui/progress";

interface RegistroEntry {
  id: number;
  protocolloIva: number | null;
  dataRegistrazione: string | null;
  fornitore: { id: number; denominazione: string; partitaIva: string | null; nazione: string | null } | null;
  cliente: { id: number; denominazione: string; partitaIva: string | null; nazione: string | null } | null;
  descrizione: string;
  importoImponibile: number | null;
  aliquotaIva: number | null;
  importoIva: number | null;
  naturaOperazioneIva: string | null;
  tipoDocumentoSdi: string | null;
  doppiaRegistrazione: boolean | null;
}

interface PlafondData {
  id: number;
  anno: number;
  metodo: string;
  importoDisponibile: number;
  importoUtilizzato: number;
}

type RegistroTab = "ACQUISTI" | "VENDITE" | "CORRISPETTIVI";

const REVERSE_CHARGE_TIPI = ["TD16", "TD17", "TD18", "TD19"];

const MESI = [
  { value: "ALL", label: "Tutti i mesi" },
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("it-IT");
}

function formatCurrency(value: number | null): string {
  if (value == null) return "\u2014";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function getNazione(entry: RegistroEntry, tab: RegistroTab): string | null {
  if (tab === "ACQUISTI") {
    return entry.fornitore?.nazione ?? null;
  }
  return entry.cliente?.nazione ?? null;
}

export function RegistriIvaContent() {
  const currentYear = new Date().getFullYear();
  const { data: session } = useSession();
  const modalitaAvanzata = (session?.user as any)?.modalitaAvanzata ?? false;

  const [tab, setTab] = useState<RegistroTab>("ACQUISTI");
  const [anno, setAnno] = useState<string>(String(currentYear));
  const [mese, setMese] = useState<string>("ALL");
  const [entries, setEntries] = useState<RegistroEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtroEstere, setFiltroEstere] = useState(false);
  const [filtroReverseCharge, setFiltroReverseCharge] = useState(false);

  // Plafond
  const [plafond, setPlafond] = useState<PlafondData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        registroIva: tab,
        anno,
      });
      if (mese !== "ALL") params.set("mese", mese);
      const res = await fetch(`/api/registri-iva?${params.toString()}`);
      if (!res.ok) throw new Error("Errore nel caricamento");
      const json = await res.json();
      setEntries(json.data);
    } catch {
      toast.error("Errore nel caricamento del registro IVA");
    } finally {
      setLoading(false);
    }
  }, [tab, anno, mese]);

  const fetchPlafond = useCallback(async () => {
    try {
      const res = await fetch(`/api/plafond?anno=${anno}`);
      if (!res.ok) {
        setPlafond(null);
        return;
      }
      const json = await res.json();
      setPlafond(json.data ?? null);
    } catch {
      setPlafond(null);
    }
  }, [anno]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (modalitaAvanzata) {
      fetchPlafond();
    }
  }, [modalitaAvanzata, fetchPlafond]);

  // Apply client-side filters
  const filteredEntries = entries.filter((entry) => {
    if (filtroEstere) {
      const nazione = getNazione(entry, tab);
      if (!nazione || nazione === "IT") return false;
    }
    if (filtroReverseCharge) {
      const isRC = entry.doppiaRegistrazione === true ||
        (entry.tipoDocumentoSdi && REVERSE_CHARGE_TIPI.includes(entry.tipoDocumentoSdi));
      if (!isRC) return false;
    }
    return true;
  });

  const totaleImponibile = filteredEntries.reduce((sum, e) => sum + (e.importoImponibile ?? 0), 0);
  const totaleIva = filteredEntries.reduce((sum, e) => sum + (e.importoIva ?? 0), 0);

  const getSoggettoLabel = (entry: RegistroEntry): string => {
    if (tab === "ACQUISTI") {
      return entry.fornitore?.denominazione ?? "\u2014";
    }
    return entry.cliente?.denominazione ?? "\u2014";
  };

  const soggettoHeader = tab === "ACQUISTI" ? "Fornitore" : "Cliente";

  const plafondPercentuale = plafond && plafond.importoDisponibile > 0
    ? Math.round((plafond.importoUtilizzato / plafond.importoDisponibile) * 100)
    : 0;
  const plafondAlert = plafondPercentuale > 80;

  const colCount = 10; // updated column count

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Registri IVA</h1>

      {/* Plafond widget — only in modalita avanzata */}
      {modalitaAvanzata && plafond && (
        <div className={`rounded-lg border p-4 ${plafondAlert ? "border-red-400 bg-red-50 dark:bg-red-950/20" : "border-border bg-muted/30"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Plafond {plafond.anno} ({plafond.metodo})
            </span>
            <span className={`text-sm font-semibold ${plafondAlert ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
              {plafondPercentuale}%
            </span>
          </div>
          <Progress
            value={Math.min(plafondPercentuale, 100)}
            className={`h-3 ${plafondAlert ? "[&>[data-slot=progress-indicator]]:bg-red-500" : ""}`}
          />
          <p className={`text-xs mt-1.5 ${plafondAlert ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
            Plafond {plafond.anno}: {formatCurrency(plafond.importoUtilizzato)} / {formatCurrency(plafond.importoDisponibile)} ({plafondPercentuale}%)
          </p>
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as RegistroTab)}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="tabs-scrollable">
            <TabsList className="w-max">
              <TabsTrigger value="ACQUISTI">Registro Acquisti</TabsTrigger>
              <TabsTrigger value="VENDITE">Registro Vendite</TabsTrigger>
              <TabsTrigger value="CORRISPETTIVI">Corrispettivi</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex items-center gap-3">
            <Select value={anno} onValueChange={setAnno}>
              <SelectTrigger className="w-[100px] sm:w-[120px]">
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

            <Select value={mese} onValueChange={setMese}>
              <SelectTrigger className="w-[140px] sm:w-[160px]">
                <SelectValue placeholder="Mese" />
              </SelectTrigger>
              <SelectContent>
                {MESI.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Client-side filter toggles */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Button
            variant={filtroEstere ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroEstere((v) => !v)}
          >
            Solo operazioni estere
          </Button>
          <Button
            variant={filtroReverseCharge ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroReverseCharge((v) => !v)}
          >
            Solo reverse charge
          </Button>
          {(filtroEstere || filtroReverseCharge) && (
            <span className="text-xs text-muted-foreground ml-2">
              {filteredEntries.length} / {entries.length} registrazioni
            </span>
          )}
        </div>

        {/* All three tabs share the same table structure */}
        {(["ACQUISTI", "VENDITE", "CORRISPETTIVI"] as RegistroTab[]).map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue}>
            <div className="border rounded-md table-responsive">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden sm:table-cell w-[100px]">Prot.</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>{soggettoHeader}</TableHead>
                    <TableHead className="hidden lg:table-cell">Tipo Doc.</TableHead>
                    <TableHead className="hidden lg:table-cell">Nazione</TableHead>
                    <TableHead className="hidden md:table-cell">Descrizione</TableHead>
                    <TableHead className="text-right">Imponibile</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Aliquota</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="hidden md:table-cell">Natura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                        Caricamento...
                      </TableCell>
                    </TableRow>
                  ) : filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                        Nessuna registrazione trovata
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono hidden sm:table-cell">
                          {entry.protocolloIva ?? "\u2014"}
                        </TableCell>
                        <TableCell>{formatDate(entry.dataRegistrazione)}</TableCell>
                        <TableCell className="font-medium">
                          {getSoggettoLabel(entry)}
                        </TableCell>
                        <TableCell className="font-mono text-xs hidden lg:table-cell">
                          {entry.tipoDocumentoSdi ?? "\u2014"}
                        </TableCell>
                        <TableCell className="font-mono text-xs hidden lg:table-cell">
                          {getNazione(entry, tab) ?? "\u2014"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate hidden md:table-cell">
                          {entry.descrizione}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(entry.importoImponibile)}
                        </TableCell>
                        <TableCell className="text-right font-mono hidden sm:table-cell">
                          {entry.aliquotaIva != null ? `${entry.aliquotaIva}%` : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(entry.importoIva)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                          {entry.naturaOperazioneIva ?? "\u2014"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!loading && filteredEntries.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} className="font-semibold">
                        Totali
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(totaleImponibile)}
                      </TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(totaleIva)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
