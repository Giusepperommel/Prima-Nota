// src/lib/bi/comparativa/__tests__/budget.test.ts
import { describe, it, expect } from "vitest";
import { buildBudgetComparisonRow } from "../budget";

describe("budget comparison", () => {
  it("builds budget vs actual row", () => {
    const row = buildBudgetComparisonRow("Ricavi", 1200, 1000);
    expect(row.label).toBe("Ricavi");
    expect(row.valoreCorrente).toBe(1200); // actual
    expect(row.valorePrecedente).toBe(1000); // budget
    expect(row.delta).toBe(200);
    expect(row.deltaPerc).toBeCloseTo(20);
  });
});
