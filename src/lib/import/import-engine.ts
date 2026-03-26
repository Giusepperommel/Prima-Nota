import type { ImportSource, ImportEntityType, ImportField, ParsedRow } from "./import-types";
import { parseDaneaXml } from "./parsers/danea";
import { parseTeamSystemCsv } from "./parsers/teamsystem";

// ─── Parser types ──────────────────────────────────────────────────────────

type XmlParser = (xml: string) => ParsedRow[];
type CsvParser = (csv: string) => ParsedRow[];
type Parser = XmlParser | CsvParser;

// ─── Parser registry ───────────────────────────────────────────────────────

const parserRegistry: Record<ImportSource, Parser> = {
  danea: parseDaneaXml,
  teamsystem: parseTeamSystemCsv,
  zucchetti: parseTeamSystemCsv,   // Zucchetti uses similar CSV format
  passcom: parseTeamSystemCsv,     // Passcom uses similar CSV format
  "fatture-in-cloud": parseTeamSystemCsv, // FIC exports CSV
};

/**
 * Returns the parser function for a given import source.
 * Throws if the source is not supported.
 */
export function getParserForSource(source: ImportSource): Parser {
  const parser = parserRegistry[source];
  if (!parser) {
    throw new Error(`Sorgente di importazione non supportata: "${source}"`);
  }
  return parser;
}

// ─── Helper functions ──────────────────────────────────────────────────────

/**
 * Parses an Italian date string (DD/MM/YYYY) into a Date object.
 */
export function parseDateIT(value: string): Date {
  const [day, month, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Maps Danea document type codes to internal operation types.
 */
export function mapDaneaDocType(code: string): string {
  const mapping: Record<string, string> = {
    C: "FATTURA_VENDITA",
    D: "NOTA_CREDITO",
    I: "FATTURA_ACQUISTO",
    P: "FATTURA_PROFORMA",
    O: "ORDINE",
    B: "DDT",
  };
  return mapping[code] ?? "ALTRO";
}

// ─── Default mapping configurations ────────────────────────────────────────

type MappingKey = `${ImportSource}:${ImportEntityType}`;

const defaultMappings: Record<MappingKey, ImportField[]> = {
  "danea:anagrafiche": [
    { sourceKey: "CustomerName", targetKey: "denominazione", required: true },
    { sourceKey: "CustomerFiscalCode", targetKey: "codiceFiscale" },
    { sourceKey: "CustomerVatCode", targetKey: "partitaIva" },
    { sourceKey: "CustomerAddress", targetKey: "indirizzo" },
    { sourceKey: "CustomerCity", targetKey: "citta" },
    { sourceKey: "CustomerPostCode", targetKey: "cap" },
    { sourceKey: "CustomerProvince", targetKey: "provincia" },
    { sourceKey: "CustomerCountry", targetKey: "paese" },
    { sourceKey: "CustomerTel", targetKey: "telefono" },
    { sourceKey: "CustomerEmail", targetKey: "email" },
  ],
  "danea:operazioni": [
    { sourceKey: "Number", targetKey: "numero", required: true },
    {
      sourceKey: "Date",
      targetKey: "dataOperazione",
      required: true,
      transform: (v) => parseDateIT(v),
    },
    {
      sourceKey: "DocumentType",
      targetKey: "tipoDocumento",
      transform: (v) => mapDaneaDocType(v),
    },
    { sourceKey: "CustomerName", targetKey: "denominazioneCliente", required: true },
    { sourceKey: "CustomerFiscalCode", targetKey: "codiceFiscaleCliente" },
    {
      sourceKey: "Total",
      targetKey: "importoTotale",
      required: true,
      transform: (v) => parseFloat(v),
    },
    {
      sourceKey: "TotalWithoutTax",
      targetKey: "imponibile",
      transform: (v) => parseFloat(v),
    },
    {
      sourceKey: "VatAmount",
      targetKey: "importoIva",
      transform: (v) => parseFloat(v),
    },
  ],
  "teamsystem:piano-dei-conti": [
    { sourceKey: "Codice", targetKey: "codice", required: true },
    { sourceKey: "Descrizione", targetKey: "descrizione", required: true },
    { sourceKey: "Tipo", targetKey: "tipo" },
    { sourceKey: "Gruppo", targetKey: "gruppo" },
    { sourceKey: "Mastro", targetKey: "mastro" },
    { sourceKey: "Conto", targetKey: "conto" },
    { sourceKey: "Sottoconto", targetKey: "sottoconto" },
  ],
  "teamsystem:anagrafiche": [
    { sourceKey: "RagioneSociale", targetKey: "denominazione", required: true },
    { sourceKey: "CodiceFiscale", targetKey: "codiceFiscale" },
    { sourceKey: "PartitaIva", targetKey: "partitaIva" },
    { sourceKey: "Indirizzo", targetKey: "indirizzo" },
    { sourceKey: "Cap", targetKey: "cap" },
    { sourceKey: "Citta", targetKey: "citta" },
    { sourceKey: "Provincia", targetKey: "provincia" },
    { sourceKey: "Telefono", targetKey: "telefono" },
    { sourceKey: "Email", targetKey: "email" },
  ],
};

/**
 * Returns the default field mappings for a given source and entity type.
 * Falls back to an empty array if no default mapping is defined.
 */
export function getDefaultMappings(
  source: ImportSource,
  entity: ImportEntityType
): ImportField[] {
  const key: MappingKey = `${source}:${entity}`;
  return defaultMappings[key] ?? [];
}
