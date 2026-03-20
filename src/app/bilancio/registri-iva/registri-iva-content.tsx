"use client";

import { useState, useEffect, useCallback } from "react";
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

interface RegistroEntry {
  id: number;
  protocolloIva: number | null;
  dataRegistrazione: string | null;
  fornitore: { id: number; denominazione: string; partitaIva: string | null } | null;
  cliente: { id: number; denominazione: string; partitaIva: string | null } | null;
  descrizione: string;
  importoImponibile: number | null;
  aliquotaIva: number | null;
  importoIva: number | null;
  naturaOperazioneIva: string | null;
  tipoDocumentoSdi: string | null;
}

type RegistroTab = "ACQUISTI" | "VENDITE" | "CORRISPETTIVI";

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

export function RegistriIvaContent() {
  const currentYear = new Date().getFullYear();
  const [tab, setTab] = useState<RegistroTab>("ACQUISTI");
  const [anno, setAnno] = useState<string>(String(currentYear));
  const [mese, setMese] = useState<string>("ALL");
  const [entries, setEntries] = useState<RegistroEntry[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totaleImponibile = entries.reduce((sum, e) => sum + (e.importoImponibile ?? 0), 0);
  const totaleIva = entries.reduce((sum, e) => sum + (e.importoIva ?? 0), 0);

  const getSoggettoLabel = (entry: RegistroEntry): string => {
    if (tab === "ACQUISTI") {
      return entry.fornitore?.denominazione ?? "\u2014";
    }
    return entry.cliente?.denominazione ?? "\u2014";
  };

  const soggettoHeader = tab === "ACQUISTI" ? "Fornitore" : "Cliente";

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Registri IVA</h1>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as RegistroTab)}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="ACQUISTI">Registro Acquisti</TabsTrigger>
            <TabsTrigger value="VENDITE">Registro Vendite</TabsTrigger>
            <TabsTrigger value="CORRISPETTIVI">Corrispettivi</TabsTrigger>
          </TabsList>

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

            <Select value={mese} onValueChange={setMese}>
              <SelectTrigger className="w-[160px]">
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

        {/* All three tabs share the same table structure */}
        {(["ACQUISTI", "VENDITE", "CORRISPETTIVI"] as RegistroTab[]).map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue}>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Protocollo IVA</TableHead>
                    <TableHead>Data Registrazione</TableHead>
                    <TableHead>{soggettoHeader}</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right">Imponibile</TableHead>
                    <TableHead className="text-right">Aliquota IVA</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead>Natura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Caricamento...
                      </TableCell>
                    </TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nessuna registrazione trovata
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono">
                          {entry.protocolloIva ?? "\u2014"}
                        </TableCell>
                        <TableCell>{formatDate(entry.dataRegistrazione)}</TableCell>
                        <TableCell className="font-medium">
                          {getSoggettoLabel(entry)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {entry.descrizione}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(entry.importoImponibile)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.aliquotaIva != null ? `${entry.aliquotaIva}%` : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(entry.importoIva)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {entry.naturaOperazioneIva ?? "\u2014"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!loading && entries.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-semibold">
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
