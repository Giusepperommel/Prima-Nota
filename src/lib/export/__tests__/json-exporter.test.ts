import { describe, it, expect } from "vitest";
import { exportToJson } from "../json-exporter";
import type { ExportFieldConfig } from "../types";

const fields: ExportFieldConfig[] = [
  { key: "id", label: "ID" },
  { key: "nome", label: "Nome" },
];

describe("json-exporter", () => {
  it("exports data as JSON with selected fields", () => {
    const data = [{ id: 1, nome: "Test", extra: "ignored" }];
    const result = exportToJson(data, fields);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ id: 1, nome: "Test" });
    expect(parsed[0]).not.toHaveProperty("extra");
  });

  it("handles empty data", () => {
    const result = exportToJson([], fields);
    expect(JSON.parse(result)).toEqual([]);
  });
});
