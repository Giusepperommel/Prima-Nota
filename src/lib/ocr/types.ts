// src/lib/ocr/types.ts

export type OcrResult = {
  rawText: string;
  confidence: number;
};

export type ParsedDocument = {
  dataOperazione: string | null;       // ISO date string YYYY-MM-DD
  numeroDocumento: string | null;
  descrizione: string | null;
  importoTotale: number | null;
  imponibile: number | null;
  aliquotaIva: string | null;          // "22", "10", "4"
  importoIva: number | null;
  tipoOperazione: "COSTO" | "FATTURA_ATTIVA" | null;
  fornitore: string | null;
};

export type OcrStatus = "idle" | "loading" | "processing" | "parsing" | "done" | "error";

export type OcrFieldsSet = Set<keyof ParsedDocument>;

export type ParsedTransaction = {
  dataOperazione: string | null;  // ISO YYYY-MM-DD
  descrizione: string;
  importoTotale: number;
};

export type OcrParseResult = {
  type: "single";
  document: ParsedDocument;
} | {
  type: "multi";
  transactions: ParsedTransaction[];
};
