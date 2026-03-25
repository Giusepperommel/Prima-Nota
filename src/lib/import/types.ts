import type { FatturaImportata } from "@/lib/providers/types";

export type ImportResult = {
  totali: number;
  importate: number;
  duplicate: number;
  errori: number;
  bozzeCreate: number;
  dettagli: ImportDetail[];
};

export type ImportDetail = {
  nomeFile: string;
  stato: "IMPORTATA" | "DUPLICATA" | "ERRORE";
  errore?: string;
  bozzaId?: number;
  confidence?: number;
  fornitoreNoto: boolean;
};

export type ClassificazioneResult = {
  categoriaId: number | null;
  codiceContoId: number | null;
  tipoOperazione: string;
  fornitoreId: number | null;
  fornitoreNuovo: boolean;
  confidence: number;
  motivazione: string;
};

export type BatchConfirmResult = {
  confermate: number;
  saltate: number;
  ids: number[];
};
