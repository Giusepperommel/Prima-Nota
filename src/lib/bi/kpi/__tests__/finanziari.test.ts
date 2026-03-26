// src/lib/bi/kpi/__tests__/finanziari.test.ts
import { describe, it, expect } from "vitest";
import { kpiFinanziari } from "../finanziari";

describe("kpi finanziari", () => {
  it("exports 3 KPI calculators", () => {
    expect(kpiFinanziari).toHaveLength(3);
  });

  it("has correct codes", () => {
    const codes = kpiFinanziari.map((k) => k.codice);
    expect(codes).toEqual(["DSO", "DPO", "CASH_BURN_RATE"]);
  });

  it("DSO and DPO use giorni unit", () => {
    expect(kpiFinanziari[0].unita).toBe("giorni");
    expect(kpiFinanziari[1].unita).toBe("giorni");
  });

  it("CASH_BURN_RATE uses EUR unit", () => {
    expect(kpiFinanziari[2].unita).toBe("€/mese");
  });
});
