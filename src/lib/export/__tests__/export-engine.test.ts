import { describe, it, expect } from "vitest";
import { buildExportFilename, getExportMimeType } from "../export-engine";

describe("export-engine", () => {
  describe("buildExportFilename", () => {
    it("builds filename with entity, date, and format", () => {
      const filename = buildExportFilename("operazioni", "csv");
      expect(filename).toMatch(/^operazioni_\d{4}-\d{2}-\d{2}\.csv$/);
    });
    it("works for all formats", () => {
      expect(buildExportFilename("anagrafiche", "json")).toMatch(/\.json$/);
      expect(buildExportFilename("anagrafiche", "xlsx")).toMatch(/\.xlsx$/);
      expect(buildExportFilename("anagrafiche", "pdf")).toMatch(/\.pdf$/);
    });
  });
  describe("getExportMimeType", () => {
    it("returns correct MIME types", () => {
      expect(getExportMimeType("csv")).toBe("text/csv; charset=utf-8");
      expect(getExportMimeType("json")).toBe("application/json");
      expect(getExportMimeType("xlsx")).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(getExportMimeType("pdf")).toBe("application/pdf");
    });
  });
});
