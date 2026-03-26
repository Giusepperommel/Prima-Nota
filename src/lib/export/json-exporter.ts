import type { ExportFieldConfig } from "./types";

export function exportToJson(
  data: Record<string, unknown>[],
  fields: ExportFieldConfig[]
): string {
  const fieldKeys = fields.map((f) => f.key);

  const filtered = data.map((record) => {
    const obj: Record<string, unknown> = {};
    for (const key of fieldKeys) {
      if (key in record) {
        obj[key] = record[key];
      }
    }
    return obj;
  });

  return JSON.stringify(filtered, null, 2);
}
