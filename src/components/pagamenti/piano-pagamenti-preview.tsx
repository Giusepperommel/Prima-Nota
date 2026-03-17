"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/business-utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { RataPagamento } from "@/lib/calcoli-pagamenti";

type Props = {
  rate: RataPagamento[];
  totaleInteressi: number;
  anticipo?: number;
};

export function PianoPagamentiPreview({ rate, totaleInteressi, anticipo }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 text-sm text-muted-foreground">
        {anticipo != null && anticipo > 0 && (
          <span>Anticipo: <strong>{formatCurrency(anticipo)}</strong></span>
        )}
        <span>Totale interessi: <strong>{formatCurrency(totaleInteressi)}</strong></span>
        <span>Rata: <strong>{rate.length > 0 ? formatCurrency(rate[0].importo) : "\u2014"}</strong></span>
      </div>

      <div className="max-h-60 overflow-y-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Capitale</TableHead>
              <TableHead className="text-right">Interessi</TableHead>
              <TableHead className="text-right">Totale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rate.map((r) => (
              <TableRow key={r.numeroPagamento}>
                <TableCell>{r.numeroPagamento}</TableCell>
                <TableCell>{format(r.data, "dd MMM yyyy", { locale: it })}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.quotaCapitale)}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.quotaInteressi)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(r.importo)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
