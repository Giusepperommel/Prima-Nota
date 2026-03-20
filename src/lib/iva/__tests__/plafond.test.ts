import { describe, it, expect } from "vitest";
import { checkPlafond, calculateSforamento } from "../plafond";

describe("plafond", () => {
  it("plafond non attivo → risultato neutro", () => {
    const result = checkPlafond({ plafondAttivo: false, importoDisponibile: 0, importoUtilizzato: 0, importoOperazione: 1000 });
    expect(result.plafondAttivo).toBe(false);
    expect(result.sforamento).toBe(false);
  });
  it("operazione entro il plafond → OK", () => {
    const result = checkPlafond({ plafondAttivo: true, importoDisponibile: 100000, importoUtilizzato: 50000, importoOperazione: 10000 });
    expect(result.plafondAttivo).toBe(true);
    expect(result.sforamento).toBe(false);
    expect(result.importoResiduo).toBe(40000);
  });
  it("operazione supera il plafond → sforamento", () => {
    const result = checkPlafond({ plafondAttivo: true, importoDisponibile: 100000, importoUtilizzato: 95000, importoOperazione: 10000 });
    expect(result.sforamento).toBe(true);
    expect(result.importoSforamento).toBe(5000);
  });
  it("calculateSforamento calcola eccedenza corretta", () => {
    expect(calculateSforamento(100000, 95000, 10000)).toBe(5000);
    expect(calculateSforamento(100000, 50000, 10000)).toBe(0);
  });
  it("plafond esattamente esaurito → sforamento 0", () => {
    const result = checkPlafond({ plafondAttivo: true, importoDisponibile: 100000, importoUtilizzato: 90000, importoOperazione: 10000 });
    expect(result.sforamento).toBe(false);
    expect(result.importoResiduo).toBe(0);
  });
});
