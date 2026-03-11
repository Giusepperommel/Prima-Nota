"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/business-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Car, Eye } from "lucide-react";

type Ripartizione = {
  socioId: number;
  percentuale: number;
  nome: string;
  cognome: string;
};

type Cespite = {
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
  ripartizioni: Ripartizione[];
  veicolo: {
    marca: string;
    modello: string;
    targa: string;
    tipoVeicolo: string;
    usoVeicolo: string;
    modalitaAcquisto: string;
  } | null;
};

type Props = {
  ruolo: string;
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

export function CespitiList({ ruolo }: Props) {
  const router = useRouter();
  const [cespiti, setCespiti] = useState<Cespite[]>([]);
  const [loading, setLoading] = useState(true);
  const [statoFilter, setStatoFilter] = useState("");

  const fetchCespiti = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statoFilter) params.set("stato", statoFilter);

      const res = await fetch(`/api/cespiti?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel caricamento");
      }
      const data = await res.json();
      setCespiti(data);
    } catch (error: any) {
      toast.error(error.message || "Errore nel caricamento dei cespiti");
    } finally {
      setLoading(false);
    }
  }, [statoFilter]);

  useEffect(() => {
    fetchCespiti();
  }, [fetchCespiti]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cespiti.length} cespit{cespiti.length === 1 ? "e" : "i"} trovati
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Stato
            </label>
            <Select
              value={statoFilter}
              onValueChange={(val) => setStatoFilter(val === "ALL" ? "" : val)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tutti gli stati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tutti gli stati</SelectItem>
                <SelectItem value="IN_AMMORTAMENTO">In Ammortamento</SelectItem>
                <SelectItem value="COMPLETATO">Completato</SelectItem>
                <SelectItem value="CEDUTO">Ceduto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : cespiti.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nessun cespite trovato
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrizione</TableHead>
                <TableHead className="w-[110px]">Data Acquisto</TableHead>
                <TableHead className="text-right w-[130px]">Valore Iniziale</TableHead>
                <TableHead className="text-right w-[80px]">Aliquota</TableHead>
                <TableHead className="text-right w-[130px]">Fondo Amm.</TableHead>
                <TableHead className="text-right w-[130px]">Valore Residuo</TableHead>
                <TableHead className="w-[140px]">Stato</TableHead>
                <TableHead>Attribuzione</TableHead>
                <TableHead className="w-[60px] text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cespiti.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/operazioni/cespiti/${c.id}`)}
                >
                  <TableCell className="max-w-[200px]">
                    <div className="flex items-center gap-2">
                      {c.veicolo && <Car className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.descrizione}</p>
                        {c.veicolo && (
                          <p className="text-xs text-muted-foreground truncate">
                            {c.veicolo.marca} {c.veicolo.modello} - {c.veicolo.targa}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatDate(c.dataAcquisto)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(c.valoreIniziale)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatPercentuale(c.aliquotaAmmortamento)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(c.fondoAmmortamento)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatCurrency(c.valoreResiduo)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATO_BADGE_CLASSES[c.stato] || ""}
                    >
                      {STATO_LABELS[c.stato] || c.stato}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.ripartizioni
                      .map((r) => `${r.cognome} ${r.nome}`)
                      .join(", ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/operazioni/cespiti/${c.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
