import { describe, it, expect } from "vitest";
import { validateImportRows } from "../validator";
import type { ImportField, ParsedRow } from "../import-types";

const fields: ImportField[] = [
  { sourceKey: "nome", targetKey: "denominazione", required: true },
  { sourceKey: "piva", targetKey: "partitaIva", required: true },
  { sourceKey: "email", targetKey: "email" },
];

describe("validateImportRows", () => {
  it("passes valid rows", () => {
    const rows: ParsedRow[] = [
      { rowNumber: 1, data: { nome: "Acme", piva: "12345678901", email: "a@b.it" } },
    ];
    const result = validateImportRows(rows, fields);
    expect(result.valid).toBe(true);
    expect(result.validRows).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("detects missing required fields", () => {
    const rows: ParsedRow[] = [
      { rowNumber: 1, data: { nome: "", piva: "12345678901" } },
      { rowNumber: 2, data: { nome: "Test", piva: "" } },
    ];
    const result = validateImportRows(rows, fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].field).toBe("nome");
    expect(result.errors[1].field).toBe("piva");
  });

  it("allows missing optional fields", () => {
    const rows: ParsedRow[] = [
      { rowNumber: 1, data: { nome: "Acme", piva: "12345678901" } },
    ];
    const result = validateImportRows(rows, fields);
    expect(result.valid).toBe(true);
  });
});
