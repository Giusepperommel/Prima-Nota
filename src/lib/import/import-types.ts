export type ImportSource = "teamsystem" | "zucchetti" | "passcom" | "fatture-in-cloud" | "danea";

export type ImportEntityType = "piano-dei-conti" | "anagrafiche" | "operazioni" | "saldi-iniziali";

export interface ImportField {
  sourceKey: string;
  targetKey: string;
  transform?: (value: string) => unknown;
  required?: boolean;
}

export interface MappingConfig {
  source: ImportSource;
  entity: ImportEntityType;
  fieldMappings: ImportField[];
}

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
}

export interface ValidationError {
  rowNumber: number;
  field: string;
  message: string;
  value?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  validRows: number;
  totalRows: number;
}

export interface ImportPreview {
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  mappingConfig: MappingConfig;
  validationResult: ValidationResult;
}
