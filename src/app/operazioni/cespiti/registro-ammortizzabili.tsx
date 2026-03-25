"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/business-utils";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type RigaRegistro = {
  cespiteId: number;
  descrizione: string;
  dataAcquisto: string;
  annoAcquisto: number;
  costoStorico: number;
  aliquotaAmmortamento: number;
  stato: string;
  quotaCivilistico: number;
  fondoCivilistico: number;
  quotaFiscale: number;
  fondoFiscale: number;
  valoreResiduoCivilistico: number;
  valoreResiduoFiscale: number;
  veicolo?: {
    marca: string;
    modello: string;
    targa: string;
  } | null;
};

type Registro = {
  anno: number;
  righe: RigaRegistro[];
  totali: {
    costoStorico: number;
    quotaCivilistico: number;
    fondoCivilistico: number;
    quotaFiscale: number;
    fondoFiscale: number;
    valoreResiduoCivilistico: number;
    valoreResiduoFiscale: number;
  };
};

function formatDate(isoString: string): string {
  const [y, m, d] = isoString.split("-");
  return `${d}/${m}/${y}`;
}

function formatPercent(value: number): string {
  return (
    new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + "%"
  );
}

export function RegistroAmmortizzabili() {
  const currentYear = new Date().getFullYear();
  const [anno, setAnno] = useState(String(currentYear));
  const [registro, setRegistro] = useState<Registro | null>(null);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);

  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  const fetchRegistro = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cespiti/registro-ammortizzabili?anno=${anno}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel caricamento");
      }
      setRegistro(await res.json());
    } catch (error: any) {
      toast.error(error.message || "Errore nel caricamento del registro");
    } finally {
      setLoading(false);
    }
  }, [anno]);

  useEffect(() => {
    fetchRegistro();
  }, [fetchRegistro]);

  const handleExport = () => {
    if (!registro) return;
    // Build CSV for PDF-ready export
    const headers = [
      "Descrizione",
      "Data Acquisto",
      "Costo Storico",
      "Aliq. %",
      "Quota Civ.",
      "Fondo Civ.",
      "Quota Fisc.",
      "Fondo Fisc.",
      "Res. Civ.",
      "Res. Fisc.",
    ];
    const rows = registro.righe.map((r) => [
      r.descrizione,
      formatDate(r.dataAcquisto),
      r.costoStorico.toFixed(2),
      r.aliquotaAmmortamento.toFixed(2),
      r.quotaCivilistico.toFixed(2),
      r.fondoCivilistico.toFixed(2),
      r.quotaFiscale.toFixed(2),
      r.fondoFiscale.toFixed(2),
      r.valoreResiduoCivilistico.toFixed(2),
      r.valoreResiduoFiscale.toFixed(2),
    ]);
    rows.push([
      "TOTALE",
      "",
      registro.totali.costoStorico.toFixed(2),
      "",
      registro.totali.quotaCivilistico.toFixed(2),
      registro.totali.fondoCivilistico.toFixed(2),
      registro.totali.quotaFiscale.toFixed(2),
      registro.totali.fondoFiscale.toFixed(2),
      registro.totali.valoreResiduoCivilistico.toFixed(2),
      registro.totali.valoreResiduoFiscale.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registro-ammortizzabili-${anno}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Registro Beni Ammortizzabili (art. 16 DPR 600/73)
        </h3>
        <div className="flex items-center gap-3">
          <Select value={anno} onValueChange={setAnno}>
            <SelectTrigger className="w-32">
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
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!registro?.righe.length}>
            <Download className="h-4 w-4 mr-2" />
            Esporta CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border" ref={tableRef}>
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !registro || registro.righe.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nessun cespite trovato per l&apos;anno {anno}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="w-[100px]">Data Acq.</TableHead>
                  <TableHead className="text-right w-[120px]">Costo Storico</TableHead>
                  <TableHead className="text-right w-[70px]">Aliq.</TableHead>
                  <TableHead className="text-right w-[110px]">Quota Civ.</TableHead>
                  <TableHead className="text-right w-[110px]">Fondo Civ.</TableHead>
                  <TableHead className="text-right w-[110px]">Quota Fisc.</TableHead>
                  <TableHead className="text-right w-[110px]">Fondo Fisc.</TableHead>
                  <TableHead className="text-right w-[110px]">Res. Civ.</TableHead>
                  <TableHead className="text-right w-[110px]">Res. Fisc.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registro.righe.map((r) => (
                  <TableRow key={r.cespiteId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{r.descrizione}</p>
                        {r.veicolo && (
                          <p className="text-xs text-muted-foreground">
                            {r.veicolo.marca} {r.veicolo.modello} - {r.veicolo.targa}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatDate(r.dataAcquisto)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(r.costoStorico)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatPercent(r.aliquotaAmmortamento)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(r.quotaCivilistico)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(r.fondoCivilistico)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(r.quotaFiscale)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(r.fondoFiscale)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(r.valoreResiduoCivilistico)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(r.valoreResiduoFiscale)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="font-bold border-t-2">
                  <TableCell>TOTALE</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono">
                    {formatCurrency(registro.totali.costoStorico)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono">
                    {formatCurrency(registro.totali.quotaCivilistico)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(registro.totali.fondoCivilistico)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(registro.totali.quotaFiscale)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(registro.totali.fondoFiscale)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(registro.totali.valoreResiduoCivilistico)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(registro.totali.valoreResiduoFiscale)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
