import { describe, it, expect } from "vitest";
import {
  generaNumeroFattura,
  generaNomeFileSdi,
  generaProgressivoInvio,
} from "../sezionale";

describe("generaNumeroFattura", () => {
  it("generates FT-0048 from prefisso FT, separatore -, padding 4, ultimo 47", () => {
    const result = generaNumeroFattura({
      prefisso: "FT",
      separatore: "-",
      paddingCifre: 4,
      ultimoNumero: 47,
    });
    expect(result).toBe("FT-0048");
  });

  it("generates FV/001 from prefisso FV, separatore /, padding 3, ultimo 0", () => {
    const result = generaNumeroFattura({
      prefisso: "FV",
      separatore: "/",
      paddingCifre: 3,
      ultimoNumero: 0,
    });
    expect(result).toBe("FV/001");
  });

  it("handles no padding (paddingCifre = 1)", () => {
    const result = generaNumeroFattura({
      prefisso: "NC",
      separatore: "/",
      paddingCifre: 1,
      ultimoNumero: 9,
    });
    expect(result).toBe("NC/10");
  });

  it("handles empty prefisso and separatore", () => {
    const result = generaNumeroFattura({
      prefisso: "",
      separatore: "",
      paddingCifre: 5,
      ultimoNumero: 0,
    });
    expect(result).toBe("00001");
  });

  it("does not truncate numbers exceeding padding width", () => {
    const result = generaNumeroFattura({
      prefisso: "FV",
      separatore: "/",
      paddingCifre: 3,
      ultimoNumero: 999,
    });
    expect(result).toBe("FV/1000");
  });
});

describe("generaNomeFileSdi", () => {
  it("generates correct SDI file name", () => {
    expect(generaNomeFileSdi("01234567890", "00001")).toBe(
      "IT01234567890_00001.xml"
    );
  });

  it("works with alphanumeric progressivo", () => {
    expect(generaNomeFileSdi("12345678901", "0000A")).toBe(
      "IT12345678901_0000A.xml"
    );
  });
});

describe("generaProgressivoInvio", () => {
  it("returns a 5-character string", () => {
    const result = generaProgressivoInvio();
    expect(result).toHaveLength(5);
  });

  it("contains only uppercase letters and digits", () => {
    for (let i = 0; i < 50; i++) {
      const result = generaProgressivoInvio();
      expect(result).toMatch(/^[A-Z0-9]{5}$/);
    }
  });

  it("generates different values (probabilistic)", () => {
    const results = new Set<string>();
    for (let i = 0; i < 100; i++) {
      results.add(generaProgressivoInvio());
    }
    // With 36^5 = ~60M possibilities, 100 calls should all be unique
    expect(results.size).toBeGreaterThan(90);
  });
});
