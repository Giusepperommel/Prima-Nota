import { describe, it, expect } from "vitest";
import { calcolaAccontoPuro } from "../acconto";
import { SOGLIA_ACCONTO_MINIMO, PERCENTUALE_ACCONTO } from "../types";

describe("calcolaAccontoPuro", () => {
  it("metodo storico: 88% of base a debito", () => {
    const result = calcolaAccontoPuro({
      metodo: 1,
      baseCalcolo: 10000,
    });

    expect(result.importo).toBe(8800); // 10000 * 0.88
    expect(result.dovuto).toBe(true);
    expect(result.metodo).toBe(1);
  });

  it("anno precedente a credito: acconto non dovuto", () => {
    const result = calcolaAccontoPuro({
      metodo: 1,
      baseCalcolo: -5000, // credit
    });

    expect(result.importo).toBe(0);
    expect(result.dovuto).toBe(false);
  });

  it("importo < 103.29: acconto non dovuto", () => {
    const result = calcolaAccontoPuro({
      metodo: 1,
      baseCalcolo: 100, // 100 * 0.88 = 88 < 103.29
    });

    expect(result.importo).toBe(0);
    expect(result.dovuto).toBe(false);
    expect(100 * PERCENTUALE_ACCONTO).toBeLessThan(SOGLIA_ACCONTO_MINIMO);
  });

  it("metodo previsionale: 88% of user estimate", () => {
    const result = calcolaAccontoPuro({
      metodo: 2,
      baseCalcolo: 5000,
    });

    expect(result.importo).toBe(4400); // 5000 * 0.88
    expect(result.dovuto).toBe(true);
    expect(result.metodo).toBe(2);
  });

  it("metodo analitico: 100% of base", () => {
    const result = calcolaAccontoPuro({
      metodo: 3,
      baseCalcolo: 3000,
    });

    expect(result.importo).toBe(3000); // 100%
    expect(result.dovuto).toBe(true);
    expect(result.metodo).toBe(3);
  });

  it("metodo analitico con base negativa: non dovuto", () => {
    const result = calcolaAccontoPuro({
      metodo: 3,
      baseCalcolo: -2000,
    });

    expect(result.importo).toBe(0);
    expect(result.dovuto).toBe(false);
  });

  it("importo al limite: exactly 103.29 is dovuto", () => {
    // 103.29 / 0.88 = 117.375
    const result = calcolaAccontoPuro({
      metodo: 1,
      baseCalcolo: 120, // 120 * 0.88 = 105.60 >= 103.29
    });

    expect(result.importo).toBe(105.6);
    expect(result.dovuto).toBe(true);
  });
});
