"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface MappingRow {
  sourceKey: string;
  targetKey: string;
  required?: boolean;
  sampleValue?: string;
}

interface FieldMapperProps {
  mappings: MappingRow[];
  availableTargets: string[];
  onMappingChange: (index: number, targetKey: string) => void;
}

export function FieldMapper({ mappings, availableTargets, onMappingChange }: FieldMapperProps) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campo sorgente</TableHead>
            <TableHead>Esempio</TableHead>
            <TableHead>Campo destinazione</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map((m, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-sm">{m.sourceKey}</TableCell>
              <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{m.sampleValue || "\u2014"}</TableCell>
              <TableCell>
                <Select value={m.targetKey} onValueChange={(v) => onMappingChange(i, v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">&mdash; Ignora &mdash;</SelectItem>
                    {availableTargets.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {m.required && <Badge variant="destructive" className="text-[10px]">Obbligatorio</Badge>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
