"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/business-utils";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Conto = {
  id: number;
  codice: string;
  descrizione: string;
  tipo: string;
  naturaSaldo: string;
};

type MovimentoMastro = {
  id: number;
  importoDare: number;
  importoAvere: number;
  descrizione: string | null;
  saldoProgressivo: number;
  scrittura: {
    id: number;
    dataRegistrazione: string;
    numeroProtocollo: number;
    descrizione: string;
    causale: string;
  };
};

type LibroMastroResponse = {
  conto: { codice: string; descrizione: string; tipo: string; naturaSaldo: string } | null;
  movimenti: MovimentoMastro[];
  saldoFinale: number;
  totaleDare: number;
  totaleAvere: number;
};

const CAUSALE_LABELS: Record<string, string> = {
  FV: "Fatt. Vendita",
  FVS: "Fatt. Vend. Split",
  NCV: "NC Emessa",
  NDV: "ND Emessa",
  FA: "Fatt. Acquisto",
  NCA: "NC Ricevuta",
  NDA: "ND Ricevuta",
  FAUE: "Fatt. Acq. UE",
  FARE: "Fatt. Acq. RC",
  PG: "Pagamento",
  IN: "Incasso",
  AM: "Ammortamento",
  F24: "Pag. F24",
  LQ: "Liq. IVA",
  DIV: "Dividendi",
  CA: "Comp. Amm.",
  SC: "Chiusura",
  SA: "Apertura",
  SAS: "Assestamento",
  ST: "Storno",
  OG: "Op. Generica",
};

const CAUSALE_COLORS: Record<string, string> = {
  FV: "bg-green-500/15 text-green-400 border-green-500/25",
  FVS: "bg-green-500/15 text-green-400 border-green-500/25",
  NCV: "bg-green-500/15 text-green-400 border-green-500/25",
  NDV: "bg-green-500/15 text-green-400 border-green-500/25",
  FA: "bg-red-500/15 text-red-400 border-red-500/25",
  NCA: "bg-red-500/15 text-red-400 border-red-500/25",
  NDA: "bg-red-500/15 text-red-400 border-red-500/25",
  FAUE: "bg-red-500/15 text-red-400 border-red-500/25",
  FARE: "bg-red-500/15 text-red-400 border-red-500/25",
  PG: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  IN: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  AM: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  F24: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  LQ: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  SC: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  SA: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  SAS: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  ST: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  OG: "bg-gray-500/15 text-gray-400 border-gray-500/25",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function CausaleBadge({ causale }: { causale: string }) {
  return (
    <Badge variant="outline" className={CAUSALE_COLORS[causale] || ""}>
      {CAUSALE_LABELS[causale] || causale}
    </Badge>
  );
}

export function LibroMastroContent() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [anno, setAnno] = useState(String(currentYear));
  const [contoId, setContoId] = useState<number | null>(null);
  const [conti, setConti] = useState<Conto[]>([]);
  const [contiLoading, setContiLoading] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);

  const [data, setData] = useState<LibroMastroResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch piano dei conti for combobox
  const fetchConti = useCallback(async () => {
    setContiLoading(true);
    try {
      const res = await fetch("/api/piano-dei-conti");
      if (!res.ok) throw new Error("Errore nel caricamento conti");
      const json = await res.json();
      setConti(json);
    } catch {
      toast.error("Errore nel caricamento del piano dei conti");
    } finally {
      setContiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConti();
  }, [fetchConti]);

  // Fetch libro mastro data
  const fetchMastro = useCallback(async () => {
    if (!contoId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("contoId", String(contoId));
      params.set("anno", anno);

      const res = await fetch(`/api/libro-mastro?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel caricamento");
      }
      const json: LibroMastroResponse = await res.json();
      setData(json);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Errore nel caricamento del libro mastro");
    } finally {
      setLoading(false);
    }
  }, [contoId, anno]);

  useEffect(() => {
    fetchMastro();
  }, [fetchMastro]);

  const selectedConto = conti.find((c) => c.id === contoId);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Conto</label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-[400px] justify-between font-normal"
                  >
                    {selectedConto
                      ? `${selectedConto.codice} — ${selectedConto.descrizione}`
                      : contiLoading
                        ? "Caricamento..."
                        : "Seleziona un conto..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Cerca codice o descrizione..." />
                    <CommandList>
                      <CommandEmpty>Nessun conto trovato.</CommandEmpty>
                      <CommandGroup>
                        {conti.map((conto) => (
                          <CommandItem
                            key={conto.id}
                            value={`${conto.codice} ${conto.descrizione}`}
                            onSelect={() => {
                              setContoId(conto.id === contoId ? null : conto.id);
                              setComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                contoId === conto.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="font-mono text-xs mr-2">{conto.codice}</span>
                            <span className="truncate">{conto.descrizione}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

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
          </div>
        </CardContent>
      </Card>

      {/* Account info */}
      {data?.conto && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground px-1">
          <span>
            Conto: <strong>{data.conto.codice}</strong> — {data.conto.descrizione}
          </span>
          <Badge variant="secondary" className="text-xs">
            {data.conto.tipo.replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Natura: {data.conto.naturaSaldo}
          </Badge>
          <span className="ml-auto">
            {data.movimenti.length} moviment{data.movimenti.length === 1 ? "o" : "i"}
          </span>
        </div>
      )}

      {/* No account selected */}
      {!contoId && (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Seleziona un conto per visualizzare il libro mastro.
        </div>
      )}

      {/* Table */}
      {contoId && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead className="w-[80px]">N. Prot.</TableHead>
                <TableHead className="w-[120px]">Causale</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead className="text-right w-[120px]">Dare</TableHead>
                <TableHead className="text-right w-[120px]">Avere</TableHead>
                <TableHead className="text-right w-[140px]">Saldo Progr.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Caricamento...
                  </TableCell>
                </TableRow>
              ) : !data || data.movimenti.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nessun movimento trovato per questo conto nel {anno}.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {data.movimenti.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="text-sm">
                        {formatDate(mov.scrittura.dataRegistrazione)}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <Link
                          href={`/bilancio/libro-giornale?protocollo=${mov.scrittura.numeroProtocollo}`}
                          className="text-primary hover:underline"
                        >
                          {mov.scrittura.numeroProtocollo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <CausaleBadge causale={mov.scrittura.causale} />
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">
                        {mov.scrittura.descrizione}
                        {mov.descrizione && (
                          <span className="ml-2 text-xs text-muted-foreground italic">
                            ({mov.descrizione})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {mov.importoDare > 0 ? formatCurrency(mov.importoDare) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {mov.importoAvere > 0 ? formatCurrency(mov.importoAvere) : ""}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-sm font-medium",
                          mov.saldoProgressivo >= 0 ? "text-green-500" : "text-red-500"
                        )}
                      >
                        {formatCurrency(Math.abs(mov.saldoProgressivo))}
                        {mov.saldoProgressivo >= 0 ? " D" : " A"}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={4} className="text-right">
                      Totali:
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(data.totaleDare)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(data.totaleAvere)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono font-bold",
                        data.saldoFinale >= 0 ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {formatCurrency(Math.abs(data.saldoFinale))}
                      {data.saldoFinale >= 0 ? " D" : " A"}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
