import { describe, it, expect } from "vitest";
import { riconciliazioneRules } from "../rules/riconciliazione";

describe("riconciliazione alert rules", () => {
  it("exports exactly 1 rule", () => {
    expect(riconciliazioneRules).toHaveLength(1);
  });

  it("has RICONC_MOVIMENTI_PENDING rule with correct defaults", () => {
    const rule = riconciliazioneRules.find((r) => r.codice === "RICONC_MOVIMENTI_PENDING");
    expect(rule).toBeDefined();
    expect(rule!.categoria).toBe("RICONCILIAZIONE");
    expect(rule!.defaultGravita).toBe("INFO");
    expect(rule!.defaultSogliaGiorni).toBe(7);
    expect(rule!.defaultSogliaValore).toBe(20);
    expect(typeof rule!.evaluate).toBe("function");
  });

  it("all rules have descrizione set", () => {
    for (const rule of riconciliazioneRules) {
      expect(rule.descrizione).toBeTruthy();
    }
  });
});
