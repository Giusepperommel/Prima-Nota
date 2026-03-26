import { describe, it, expect } from "vitest";
import { exportToCsv } from "../csv-exporter";
import type { ExportFieldConfig } from "../types";

const fields: ExportFieldConfig[] = [
  { key: "id", label: "ID" },
  { key: "nome", label: "Nome" },
  { key: "importo", label: "Importo", format: (v) => Number(v).toFixed(2) },
];

describe("csv-exporter", () => {
  it("generates CSV with headers and rows", () => {
    const data = [
      { id: 1, nome: "Test", importo: 100.5 },
      { id: 2, nome: "Prova", importo: 200 },
    ];
    const result = exportToCsv(data, fields);
    const lines = result.split("\n");
    expect(lines[0]).toBe("ID;Nome;Importo");
    expect(lines[1]).toBe("1;Test;100.50");
    expect(lines[2]).toBe("2;Prova;200.00");
  });

  it("handles empty data", () => {
    const result = exportToCsv([], fields);
    expect(result).toBe("ID;Nome;Importo");
  });

  it("escapes semicolons and quotes in values", () => {
    const data = [{ id: 1, nome: 'Foo;Bar "Baz"', importo: 0 }];
    const result = exportToCsv(data, fields);
    const lines = result.split("\n");
    expect(lines[1]).toBe('1;"Foo;Bar ""Baz""";0.00');
  });

  it("handles null and undefined values", () => {
    const data = [{ id: 1, nome: null, importo: undefined }];
    const result = exportToCsv(data, fields);
    const lines = result.split("\n");
    expect(lines[1]).toBe("1;;");
  });
});
