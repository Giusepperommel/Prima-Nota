import { startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from "date-fns";
import type { PeriodRange } from "./types";

interface OperazioneImporti {
  importoImponibile: number | null;
  importoTotale: number;
  aliquotaIva: number | null;
}

export function calcolaImportoNetto(op: OperazioneImporti): number {
  if (op.importoImponibile != null) return Number(op.importoImponibile);
  if (op.aliquotaIva != null && Number(op.aliquotaIva) > 0) {
    return Number(op.importoTotale) / (1 + Number(op.aliquotaIva) / 100);
  }
  return Number(op.importoTotale);
}

export function calcolaVariazione(corrente: number, precedente: number): number | null {
  if (precedente === 0) return null;
  return ((corrente - precedente) / Math.abs(precedente)) * 100;
}

export function determinaTrend(variazione: number | null): "up" | "down" | "stable" | null {
  if (variazione === null) return null;
  if (variazione > 1) return "up";
  if (variazione < -1) return "down";
  return "stable";
}

export function buildPeriodRange(anno: number, periodo: number, tipo: string): PeriodRange {
  switch (tipo) {
    case "MESE": {
      const date = new Date(anno, periodo - 1, 1);
      return { da: startOfMonth(date), a: endOfMonth(date), label: `${anno}-${String(periodo).padStart(2, "0")}` };
    }
    case "TRIMESTRE": {
      const date = new Date(anno, (periodo - 1) * 3, 1);
      return { da: startOfQuarter(date), a: endOfQuarter(date), label: `${anno}-Q${periodo}` };
    }
    case "ANNO":
    default: {
      const date = new Date(anno, 0, 1);
      return { da: startOfYear(date), a: endOfYear(date), label: `${anno}` };
    }
  }
}
