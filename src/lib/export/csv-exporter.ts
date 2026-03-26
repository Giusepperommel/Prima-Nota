import type { ExportFieldConfig } from "./types";

const SEPARATOR = ";";

function escapeField(value: string): string {
  if (
    value.includes(SEPARATOR) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(
  record: Record<string, unknown>,
  field: ExportFieldConfig
): string {
  const value = record[field.key];
  if (value == null) return "";
  if (field.format) return field.format(value);
  return String(value);
}

export function exportToCsv(
  data: Record<string, unknown>[],
  fields: ExportFieldConfig[]
): string {
  const header = fields.map((f) => escapeField(f.label)).join(SEPARATOR);

  if (data.length === 0) return header;

  const rows = data.map((record) =>
    fields.map((field) => escapeField(formatValue(record, field))).join(SEPARATOR)
  );

  return [header, ...rows].join("\n");
}
