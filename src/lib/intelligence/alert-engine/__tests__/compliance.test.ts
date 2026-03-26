import { describe, it, expect } from "vitest";
import { complianceRules } from "../rules/compliance";

describe("compliance alert rules", () => {
  it("exports exactly 2 rules", () => {
    expect(complianceRules).toHaveLength(2);
  });

  it("has COMPL_FATTURA_NON_INVIATA rule with correct defaults", () => {
    const rule = complianceRules.find((r) => r.codice === "COMPL_FATTURA_NON_INVIATA");
    expect(rule).toBeDefined();
    expect(rule!.categoria).toBe("COMPLIANCE");
    expect(rule!.defaultGravita).toBe("WARNING");
    expect(rule!.defaultSogliaGiorni).toBe(5);
    expect(typeof rule!.evaluate).toBe("function");
  });

  it("has COMPL_LIPE_SCADUTA rule with correct defaults", () => {
    const rule = complianceRules.find((r) => r.codice === "COMPL_LIPE_SCADUTA");
    expect(rule).toBeDefined();
    expect(rule!.categoria).toBe("COMPLIANCE");
    expect(rule!.defaultGravita).toBe("CRITICAL");
    expect(typeof rule!.evaluate).toBe("function");
  });

  it("all rules have unique codice values", () => {
    const codici = complianceRules.map((r) => r.codice);
    expect(new Set(codici).size).toBe(codici.length);
  });

  it("all rules have descrizione set", () => {
    for (const rule of complianceRules) {
      expect(rule.descrizione).toBeTruthy();
    }
  });
});
