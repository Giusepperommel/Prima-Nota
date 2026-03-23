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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, XCircle } from "lucide-react";

type Riga = {
  contoId: number;
  codice: string;
  descrizione: string;
  tipo: string;
  totaleDare: number;
  totaleAvere: number;
  saldo: number;
  segno: "D" | "A";
};

type ApiResponse = {
  righe: Riga[];
  totali: { dare: number; avere: number };
  quadra: boolean;
  anno: number;
};

const TIPO_LABELS: Record<string, string> = {
  PATRIMONIALE_ATTIVO: "Patrimoniale - Attivo",
  PATRIMONIALE_PASSIVO: "Patrimoniale - Passivo",
  ECONOMICO_COSTO: "Economico - Costi",
  ECONOMICO_RICAVO: "Economico - Ricavi",
};

const TIPO_ORDER = [
  "PATRIMONIALE_ATTIVO",
  "PATRIMONIALE_PASSIVO",
  "ECONOMICO_COSTO",
  "ECONOMICO_RICAVO",
];

export function BilancioVerificaContent() {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const [righe, setRighe] = useState<Riga[]>([]);
  const [totali, setTotali] = useState({ dare: 0, avere: 0 });
  const [quadra, setQuadra] = useState(true);
  const [loading, setLoading] = useState(true);

  const [anno, setAnno] = useState(String(currentYear));
  const [nascondiSaldoZero, setNascondiSaldoZero] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("anno", anno);
      if (nascondiSaldoZero) params.set("nascondiSaldoZero", "true");

      const res = await fetch(`/api/bilancio-verifica?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel caricamento");
      }
      const json: ApiResponse = await res.json();
      setRighe(json.righe);
      setTotali(json.totali);
      setQuadra(json.quadra);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Errore nel caricamento del bilancio di verifica"
      );
    } finally {
      setLoading(false);
    }
  }, [anno, nascondiSaldoZero]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group rows by tipo conto
  const grouped = TIPO_ORDER.map((tipo) => ({
    tipo,
    label: TIPO_LABELS[tipo] || tipo,
    righe: righe.filter((r) => r.tipo === tipo),
  })).filter((g) => g.righe.length > 0);

  const totalRegistrazioni = righe.length;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
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

            <div className="flex items-center gap-2 pb-1">
              <Checkbox
                id="nascondiSaldoZero"
                checked={nascondiSaldoZero}
                onCheckedChange={(checked) =>
                  setNascondiSaldoZero(checked === true)
                }
              />
              <label
                htmlFor="nascondiSaldoZero"
                className="text-sm text-muted-foreground cursor-pointer select-none"
              >
                Nascondi conti con saldo zero
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary card */}
      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          Conti movimentati: <strong>{totalRegistrazioni}</strong>
          {totalRegistrazioni > 0 && (
            <span className="ml-2">
              (Bollo: {Math.ceil(totalRegistrazioni / 100)} marche da 16,00)
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          Quadratura:{" "}
          {quadra ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Codice</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="text-right w-[140px]">
                Totale Dare
              </TableHead>
              <TableHead className="text-right w-[140px]">
                Totale Avere
              </TableHead>
              <TableHead className="text-right w-[140px]">Saldo</TableHead>
              <TableHead className="text-center w-[60px]">D/A</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : righe.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  Nessun conto movimentato per l&apos;anno selezionato
                </TableCell>
              </TableRow>
            ) : (
              <>
                {grouped.map((group) => (
                  <GroupRows key={group.tipo} group={group} />
                ))}

                {/* Grand total row */}
                <TableRow className="bg-muted/50 font-bold border-t-2">
                  <TableCell colSpan={2} className="text-right">
                    Totali generali:
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(totali.dare)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(totali.avere)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(
                      Math.abs(totali.dare - totali.avere)
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {quadra ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function GroupRows({
  group,
}: {
  group: { tipo: string; label: string; righe: Riga[] };
}) {
  const subtotalDare = group.righe.reduce((s, r) => s + r.totaleDare, 0);
  const subtotalAvere = group.righe.reduce((s, r) => s + r.totaleAvere, 0);

  return (
    <>
      {/* Group header */}
      <TableRow className="bg-muted/30">
        <TableCell
          colSpan={6}
          className="font-semibold text-sm text-muted-foreground uppercase tracking-wide py-2"
        >
          {group.label}
        </TableCell>
      </TableRow>

      {/* Data rows */}
      {group.righe.map((r) => (
        <TableRow key={r.contoId}>
          <TableCell className="font-mono text-sm">{r.codice}</TableCell>
          <TableCell className="text-sm">{r.descrizione}</TableCell>
          <TableCell className="text-right font-mono text-sm">
            {formatCurrency(r.totaleDare)}
          </TableCell>
          <TableCell className="text-right font-mono text-sm">
            {formatCurrency(r.totaleAvere)}
          </TableCell>
          <TableCell className="text-right font-mono text-sm">
            {formatCurrency(Math.abs(r.saldo))}
          </TableCell>
          <TableCell className="text-center text-sm font-medium">
            <span
              className={
                r.segno === "D" ? "text-blue-500" : "text-orange-500"
              }
            >
              {r.segno}
            </span>
          </TableCell>
        </TableRow>
      ))}

      {/* Subtotal row */}
      <TableRow className="bg-muted/20 font-semibold border-b">
        <TableCell />
        <TableCell className="text-right text-sm">
          Subtotale {group.label}:
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {formatCurrency(subtotalDare)}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {formatCurrency(subtotalAvere)}
        </TableCell>
        <TableCell />
        <TableCell />
      </TableRow>
    </>
  );
}
