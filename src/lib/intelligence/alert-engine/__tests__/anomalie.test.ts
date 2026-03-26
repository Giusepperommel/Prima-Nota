import { describe, it, expect } from "vitest";
import { anomalieRules } from "../rules/anomalie";

describe("anomalie alert rules", () => {
  it("exports exactly 2 rules", () => {
    expect(anomalieRules).toHaveLength(2);
  });

  it("has ANOM_APERTE_ACCUMULO rule with correct defaults", () => {
    const rule = anomalieRules.find((r) => r.codice === "ANOM_APERTE_ACCUMULO");
    expect(rule).toBeDefined();
    expect(rule!.categoria).toBe("ANOMALIE_CONTABILI");
    expect(rule!.defaultGravita).toBe("WARNING");
    expect(rule!.defaultSogliaValore).toBe(5);
    expect(typeof rule!.evaluate).toBe("function");
  });

  it("has ANOM_CRITICA_NUOVA rule with correct defaults", () => {
    const rule = anomalieRules.find((r) => r.codice === "ANOM_CRITICA_NUOVA");
    expect(rule).toBeDefined();
    expect(rule!.categoria).toBe("ANOMALIE_CONTABILI");
    expect(rule!.defaultGravita).toBe("CRITICAL");
    expect(rule!.defaultSogliaGiorni).toBe(1);
    expect(typeof rule!.evaluate).toBe("function");
  });

  it("all rules have unique codice values", () => {
    const codici = anomalieRules.map((r) => r.codice);
    expect(new Set(codici).size).toBe(codici.length);
  });

  it("all rules have descrizione set", () => {
    for (const rule of anomalieRules) {
      expect(rule.descrizione).toBeTruthy();
    }
  });
});
