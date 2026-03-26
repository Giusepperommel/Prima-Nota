// src/lib/bi/comparativa/__tests__/periodo.test.ts
import { describe, it, expect } from "vitest";
import { buildComparisonRow } from "../periodo";

describe("periodo comparison", () => {
  it("builds comparison row with delta", () => {
    const row = buildComparisonRow("Ricavi", 1200, 1000);
    expect(row.label).toBe("Ricavi");
    expect(row.valoreCorrente).toBe(1200);
    expect(row.valorePrecedente).toBe(1000);
    expect(row.delta).toBe(200);
    expect(row.deltaPerc).toBeCloseTo(20);
  });

  it("handles zero previous value", () => {
    const row = buildComparisonRow("Ricavi", 100, 0);
    expect(row.delta).toBe(100);
    expect(row.deltaPerc).toBeNull();
  });
});
