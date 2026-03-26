"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PeriodSelectorProps {
  anno: number;
  periodo: number;
  periodoTipo: string;
  onAnnoChange: (anno: number) => void;
  onPeriodoChange: (periodo: number) => void;
  onPeriodoTipoChange: (tipo: string) => void;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];
const quarters = ["Q1 (Gen-Mar)", "Q2 (Apr-Giu)", "Q3 (Lug-Set)", "Q4 (Ott-Dic)"];

export function PeriodSelector({ anno, periodo, periodoTipo, onAnnoChange, onPeriodoChange, onPeriodoTipoChange }: PeriodSelectorProps) {
  const periodOptions = periodoTipo === "MESE" ? months : periodoTipo === "TRIMESTRE" ? quarters : ["Intero anno"];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={periodoTipo} onValueChange={onPeriodoTipoChange}>
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="MESE">Mensile</SelectItem>
          <SelectItem value="TRIMESTRE">Trimestrale</SelectItem>
          <SelectItem value="ANNO">Annuale</SelectItem>
        </SelectContent>
      </Select>
      <Select value={String(anno)} onValueChange={(v) => onAnnoChange(Number(v))}>
        <SelectTrigger className="w-24 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {periodoTipo !== "ANNO" && (
        <Select value={String(periodo)} onValueChange={(v) => onPeriodoChange(Number(v))}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map((label, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
