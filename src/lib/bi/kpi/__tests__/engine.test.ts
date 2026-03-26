// src/lib/bi/kpi/__tests__/engine.test.ts
import { describe, it, expect } from "vitest";
import { getAllKpiCalculators } from "../engine";

describe("kpi engine", () => {
  it("returns all registered KPI calculators", () => {
    const all = getAllKpiCalculators();
    expect(all.length).toBeGreaterThanOrEqual(12);
  });

  it("has unique codes", () => {
    const all = getAllKpiCalculators();
    const codes = all.map((k) => k.codice);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("covers all categories", () => {
    const all = getAllKpiCalculators();
    const categories = new Set(all.map((k) => k.categoria));
    expect(categories).toContain("ECONOMICO");
    expect(categories).toContain("FINANZIARIO");
    expect(categories).toContain("FISCALE");
    expect(categories).toContain("OPERATIVO");
  });
});
