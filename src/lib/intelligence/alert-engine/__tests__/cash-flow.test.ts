import { describe, it, expect } from "vitest";
import { cashFlowRules } from "../rules/cash-flow";

describe("cash flow alert rules", () => {
  it("exports exactly 2 rules", () => {
    expect(cashFlowRules).toHaveLength(2);
  });

  it("has CF_INCASSI_RITARDO rule with correct defaults", () => {
    const rule = cashFlowRules.find((r) => r.codice === "CF_INCASSI_RITARDO");
    expect(rule).toBeDefined();
    expect(rule!.categoria).toBe("CASH_FLOW");
    expect(rule!.defaultGravita).toBe("WARNING");
    expect(rule!.defaultSogliaGiorni).toBe(30);
    expect(rule!.defaultSogliaValore).toBe(10000);
    expect(typeof rule!.evaluate).toBe("function");
  });

  it("has CF_SALDO_NEGATIVO_PREVISTO rule with correct defaults", () => {
    const rule = cashFlowRules.find((r) => r.codice === "CF_SALDO_NEGATIVO_PREVISTO");
    expect(rule).toBeDefined();
    expect(rule!.categoria).toBe("CASH_FLOW");
    expect(rule!.defaultGravita).toBe("CRITICAL");
    expect(rule!.defaultSogliaGiorni).toBe(15);
    expect(typeof rule!.evaluate).toBe("function");
  });

  it("all rules have unique codice values", () => {
    const codici = cashFlowRules.map((r) => r.codice);
    expect(new Set(codici).size).toBe(codici.length);
  });

  it("all rules have descrizione set", () => {
    for (const rule of cashFlowRules) {
      expect(rule.descrizione).toBeTruthy();
    }
  });
});
