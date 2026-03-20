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

  // Advanced mode fields from XML (FatturaPA)
  tipoDocumentoSdi?: string;
  naturaIva?: string;
  splitPayment?: boolean;
  cedentePrestatore?: {
    denominazione?: string;
    partitaIva?: string;
    codiceFiscale?: string;
    regimeFiscale?: string;
    nazione?: string;
  };
  datiRitenuta?: {
    tipoRitenuta?: string;
    aliquota?: number;
    importoRitenuta?: number;
  };
  cassaPrevidenziale?: number;
  dataPagamento?: string;
  fornitoreId?: number;
};

export type OcrStatus = "idle" | "loading" | "processing" | "parsing" | "done" | "error";

export type OcrFieldsSet = Set<keyof ParsedDocument>;

export type ParsedTransaction = {
  dataOperazione: string | null;  // ISO YYYY-MM-DD
  descrizione: string;
  importoTotale: number;
  categoriaId?: number | null;
  tipoOperazione?: "COSTO" | "FATTURA_ATTIVA";
};

export type OcrParseResult = {
  type: "single";
  document: ParsedDocument;
} | {
  type: "multi";
  transactions: ParsedTransaction[];
};
