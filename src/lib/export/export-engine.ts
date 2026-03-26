import { format as formatDate } from "date-fns";
import type {
  EntityType,
  ExportFormat,
  ExportFieldConfig,
  ExportResult,
} from "./types";
import { getEntityConfig } from "./entity-configs";
import { exportToCsv } from "./csv-exporter";
import { exportToJson } from "./json-exporter";

// ─── Filename & MIME ──────────────────────────────────────────────────────────

export function buildExportFilename(
  entityType: EntityType,
  format: ExportFormat
): string {
  const dateStr = formatDate(new Date(), "yyyy-MM-dd");
  return `${entityType}_${dateStr}.${format}`;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

export function getExportMimeType(format: ExportFormat): string {
  return MIME_TYPES[format];
}

// ─── Export Dispatcher ────────────────────────────────────────────────────────

export async function exportData(
  data: Record<string, unknown>[],
  entityType: EntityType,
  format: ExportFormat,
  selectedFields?: string[]
): Promise<ExportResult> {
  const config = getEntityConfig(entityType);

  // Filter fields if specified
  const fields: ExportFieldConfig[] = selectedFields
    ? config.fields.filter((f) => selectedFields.includes(f.key))
    : config.fields;

  let exportedData: string | Buffer;

  switch (format) {
    case "csv":
      exportedData = exportToCsv(data, fields);
      break;
    case "json":
      exportedData = exportToJson(data, fields);
      break;
    case "xlsx": {
      // Dynamic import to avoid loading xlsx module unless needed
      const { exportToExcel } = await import("./excel-exporter");
      exportedData = exportToExcel(data, fields, config.displayName);
      break;
    }
    case "pdf":
      // PDF fallback to JSON for now
      exportedData = exportToJson(data, fields);
      break;
    default:
      throw new Error(`Formato non supportato: ${format}`);
  }

  return {
    data: exportedData,
    filename: buildExportFilename(entityType, format),
    mimeType: getExportMimeType(format),
    rowCount: data.length,
  };
}
