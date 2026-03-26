import * as XLSX from "xlsx";
import type { ExportFieldConfig } from "./types";

const MAX_ROWS = 100_000;

function formatValue(
  record: Record<string, unknown>,
  field: ExportFieldConfig
): unknown {
  const value = record[field.key];
  if (value == null) return "";
  if (field.format) return field.format(value);
  return value;
}

export function exportToExcel(
  data: Record<string, unknown>[],
  fields: ExportFieldConfig[],
  sheetName: string = "Export"
): Buffer {
  const rows = data.slice(0, MAX_ROWS);

  // Build array-of-arrays: header row + data rows
  const aoa: unknown[][] = [fields.map((f) => f.label)];

  for (const record of rows) {
    aoa.push(fields.map((field) => formatValue(record, field)));
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Auto-size columns based on header length (rough heuristic)
  worksheet["!cols"] = fields.map((f) => ({
    wch: Math.max(f.label.length + 2, 12),
  }));

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return buffer;
}
