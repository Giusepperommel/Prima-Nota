import type { ImportField } from "./import-types";

/**
 * Maps a source data row to target keys using field mapping definitions.
 * Applies optional transform functions to values.
 */
export function mapRow(
  data: Record<string, string>,
  fields: ImportField[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const sourceValue = data[field.sourceKey];

    if (sourceValue === undefined || sourceValue === null) {
      result[field.targetKey] = undefined;
      continue;
    }

    if (field.transform) {
      result[field.targetKey] = field.transform(sourceValue);
    } else {
      result[field.targetKey] = sourceValue;
    }
  }

  return result;
}
