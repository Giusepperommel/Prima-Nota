import { describe, it, expect } from "vitest";
import { confrontoRules } from "../rules/confronto";

describe("confronto alert rules", () => {
  it("exports 2 rules for YoY comparison", () => {
    expect(confrontoRules).toHaveLength(2);
    expect(confrontoRules[0].codice).toBe("CONF_RICAVI_CALO");
    expect(confrontoRules[1].codice).toBe("CONF_COSTI_ANOMALI");
  });

  it("has correct defaults for revenue drop rule", () => {
    expect(confrontoRules[0].categoria).toBe("CONFRONTO");
    expect(confrontoRules[0].defaultSogliaValore).toBe(20);
    expect(confrontoRules[0].defaultGravita).toBe("WARNING");
  });

  it("has correct defaults for cost spike rule", () => {
    expect(confrontoRules[1].categoria).toBe("CONFRONTO");
    expect(confrontoRules[1].defaultSogliaValore).toBe(30);
    expect(confrontoRules[1].defaultGravita).toBe("WARNING");
  });
});
