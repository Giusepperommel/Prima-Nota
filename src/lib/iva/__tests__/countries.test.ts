import { describe, it, expect } from "vitest";
import { isEU, isExtraEU, isSanMarino, getCountryGroup } from "../countries";

describe("countries", () => {
  it("classifica IT come non-EU per scopi IVA engine (domestico)", () => {
    expect(isEU("IT")).toBe(false);
    expect(getCountryGroup("IT")).toBe("IT");
  });

  it("classifica paesi UE correttamente", () => {
    expect(isEU("DE")).toBe(true);
    expect(isEU("FR")).toBe(true);
    expect(isEU("ES")).toBe(true);
    expect(getCountryGroup("DE")).toBe("UE");
  });

  it("classifica paesi extra-UE", () => {
    expect(isExtraEU("US")).toBe(true);
    expect(isExtraEU("CN")).toBe(true);
    expect(getCountryGroup("US")).toBe("EXTRA_UE");
  });

  it("classifica San Marino separatamente", () => {
    expect(isSanMarino("SM")).toBe(true);
    expect(getCountryGroup("SM")).toBe("SAN_MARINO");
  });

  it("gestisce codici lowercase", () => {
    expect(isEU("de")).toBe(true);
    expect(getCountryGroup("it")).toBe("IT");
  });

  it("gestisce codici nulli/vuoti come IT", () => {
    expect(getCountryGroup("")).toBe("IT");
    expect(getCountryGroup(null as any)).toBe("IT");
    expect(getCountryGroup(undefined as any)).toBe("IT");
  });
});
