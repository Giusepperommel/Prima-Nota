import type { ImportField, ParsedRow, ValidationError, ValidationResult } from "./import-types";

/**
 * Validates import rows against field definitions.
 * Checks that required fields are present and non-empty.
 */
export function validateImportRows(
  rows: ParsedRow[],
  fields: ImportField[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const requiredFields = fields.filter((f) => f.required);

  for (const row of rows) {
    for (const field of requiredFields) {
      const value = row.data[field.sourceKey];
      if (value === undefined || value === null || value.trim() === "") {
        errors.push({
          rowNumber: row.rowNumber,
          field: field.sourceKey,
          message: `Il campo obbligatorio "${field.sourceKey}" è mancante o vuoto`,
          value: value ?? undefined,
        });
      }
    }
  }

  const rowsWithErrors = new Set(errors.map((e) => e.rowNumber));
  const validRows = rows.length - rowsWithErrors.size;

  return {
    valid: errors.length === 0,
    errors,
    validRows,
    totalRows: rows.length,
  };
}
