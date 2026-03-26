"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle } from "lucide-react";

interface PreviewRow {
  [key: string]: unknown;
}

interface ValidationError {
  rowNumber: number;
  field: string;
  message: string;
}

interface ImportPreviewProps {
  rows: PreviewRow[];
  fields: string[];
  errors: ValidationError[];
  totalRows: number;
  validRows: number;
}

export function ImportPreview({ rows, fields, errors, totalRows, validRows }: ImportPreviewProps) {
  const errorRows = new Set(errors.map((e) => e.rowNumber));

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Card className="flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold">{validRows}</p>
              <p className="text-xs text-muted-foreground">righe valide</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold">{totalRows - validRows}</p>
              <p className="text-xs text-muted-foreground">righe con errori</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {errors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600">Errori rilevati</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {errors.slice(0, 20).map((e, i) => (
                <p key={i} className="text-xs">
                  <Badge variant="outline" className="text-[10px] mr-1">Riga {e.rowNumber}</Badge>
                  {e.field}: {e.message}
                </p>
              ))}
              {errors.length > 20 && (
                <p className="text-xs text-muted-foreground">...e altri {errors.length - 20} errori</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Anteprima (prime {Math.min(rows.length, 10)} righe)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  {fields.map((f) => (
                    <TableHead key={f} className="text-xs">{f}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 10).map((row, i) => (
                  <TableRow key={i} className={errorRows.has(i + 1) ? "bg-red-50" : ""}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    {fields.map((f) => (
                      <TableCell key={f} className="text-xs truncate max-w-[120px]">
                        {row[f] != null ? String(row[f]) : "\u2014"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
