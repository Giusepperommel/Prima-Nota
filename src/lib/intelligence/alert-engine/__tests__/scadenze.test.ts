import { describe, it, expect } from "vitest";
import { scadenzeRules } from "../rules/scadenze";

describe("scadenze alert rules", () => {
  it("exports exactly 3 rules", () => {
    expect(scadenzeRules).toHaveLength(3);
  });

  it("has SCAD_IVA_TRIMESTRALE rule with correct defaults", () => {
    const rule = scadenzeRules.find((r) => r.codice === "SCAD_IVA_TRIMESTRALE");
    expect(rule).toBeDefined();
    expect(rule!.categoria).toBe("SCADENZE");
    expect(rule!.defaultGravita).toBe("WARNING");
    expect(rule!.defaultSogliaGiorni).toBe(7);
    expect(typeof rule!.evaluate).toBe("function");
  });

  it("has SCAD_F24 rule with correct defaults", () => {
    const rule = scadenzeRules.find((r) => r.codice === "SCAD_F24");
    expect(rule).toBeDefined();
    expect(rule!.categoria).toBe("SCADENZE");
    expect(rule!.defaultGravita).toBe("CRITICAL");
    expect(rule!.defaultSogliaGiorni).toBe(3);
    expect(typeof rule!.evaluate).toBe("function");
  });

  it("has SCAD_CU_GENERAZIONE rule with correct defaults", () => {
    const rule = scadenzeRules.find((r) => r.codice === "SCAD_CU_GENERAZIONE");
    expect(rule).toBeDefined();
    expect(rule!.categoria).toBe("SCADENZE");
    expect(rule!.defaultGravita).toBe("WARNING");
    expect(rule!.defaultSogliaGiorni).toBe(14);
    expect(typeof rule!.evaluate).toBe("function");
  });

  it("all rules have unique codice values", () => {
    const codici = scadenzeRules.map((r) => r.codice);
    expect(new Set(codici).size).toBe(codici.length);
  });

  it("all rules have descrizione set", () => {
    for (const rule of scadenzeRules) {
      expect(rule.descrizione).toBeTruthy();
    }
  });
});
