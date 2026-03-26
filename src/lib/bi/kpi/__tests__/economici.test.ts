// src/lib/bi/kpi/__tests__/economici.test.ts
import { describe, it, expect } from "vitest";
import { kpiEconomici } from "../economici";

describe("kpi economici", () => {
  it("exports 5 KPI calculators", () => {
    expect(kpiEconomici).toHaveLength(5);
  });

  it("has correct codes", () => {
    const codes = kpiEconomici.map((k) => k.codice);
    expect(codes).toEqual(["RICAVI", "COSTI", "MARGINE_LORDO", "EBITDA", "UTILE_NETTO"]);
  });

  it("all have ECONOMICO category and EUR unit", () => {
    for (const kpi of kpiEconomici) {
      expect(kpi.categoria).toBe("ECONOMICO");
      expect(kpi.unita).toBe("€");
    }
  });

  it("all calculators are functions", () => {
    for (const kpi of kpiEconomici) {
      expect(typeof kpi.calculate).toBe("function");
    }
  });
});
