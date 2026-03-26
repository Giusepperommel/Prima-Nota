import { describe, it, expect } from "vitest";
import { mapRow } from "../mapper";
import type { ImportField } from "../import-types";

describe("mapRow", () => {
  const fields: ImportField[] = [
    { sourceKey: "nome", targetKey: "denominazione" },
    { sourceKey: "importo", targetKey: "importoTotale", transform: (v) => parseFloat(v) },
    { sourceKey: "data", targetKey: "dataOperazione", transform: (v) => new Date(v) },
  ];

  it("maps source keys to target keys", () => {
    const result = mapRow({ nome: "Test", importo: "100.50", data: "2026-01-15" }, fields);
    expect(result.denominazione).toBe("Test");
    expect(result.importoTotale).toBe(100.5);
    expect(result.dataOperazione).toBeInstanceOf(Date);
  });

  it("handles missing source keys", () => {
    const result = mapRow({ nome: "Test" }, fields);
    expect(result.denominazione).toBe("Test");
    expect(result.importoTotale).toBeUndefined();
  });
});
