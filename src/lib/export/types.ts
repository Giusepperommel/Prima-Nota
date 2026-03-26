export type ExportFormat = "csv" | "json" | "xlsx" | "pdf";

export type EntityType =
  | "operazioni"
  | "scritture-contabili"
  | "piano-dei-conti"
  | "anagrafiche"
  | "fatture-elettroniche"
  | "registri-iva"
  | "liquidazioni-iva"
  | "f24"
  | "cu"
  | "cespiti"
  | "movimenti-bancari"
  | "scadenzario";

export interface ExportFieldConfig {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

export interface EntityConfig {
  entityType: EntityType;
  displayName: string;
  fields: ExportFieldConfig[];
  prismaModel: string;
  defaultOrderBy: Record<string, "asc" | "desc">;
}

export interface ExportOptions {
  entityType: EntityType;
  format: ExportFormat;
  societaId: number;
  filters?: Record<string, unknown>;
  fields?: string[];
  limit?: number;
  offset?: number;
}

export interface ExportResult {
  data: Buffer | string;
  filename: string;
  mimeType: string;
  rowCount: number;
}
