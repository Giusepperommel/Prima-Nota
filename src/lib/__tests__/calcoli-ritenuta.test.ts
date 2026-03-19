import { describe, it, expect } from "vitest";
import { calcolaRitenuta, getScadenzaVersamento } from "../calcoli-ritenuta";

describe("calcolaRitenuta", () => {
  it("lavoro autonomo: 20% su 100%", () => {
    const r = calcolaRitenuta({ tipo: "LAVORO_AUTONOMO", importoLordo: 1000 });
    expect(r.aliquota).toBe(20);
    expect(r.percentualeImponibile).toBe(100);
    expect(r.baseImponibile).toBe(1000);
    expect(r.importoRitenuta).toBe(200);
    expect(r.importoNetto).toBe(800);
    expect(r.codiceTributo).toBe("1040");
  });
  it("provvigioni senza struttura: 23% su 50%", () => {
    const r = calcolaRitenuta({ tipo: "PROVVIGIONI", importoLordo: 1000, conStruttura: false });
    expect(r.aliquota).toBe(23);
    expect(r.percentualeImponibile).toBe(50);
    expect(r.baseImponibile).toBe(500);
    expect(r.importoRitenuta).toBe(115);
    expect(r.importoNetto).toBe(885);
    expect(r.codiceTributo).toBe("1038");
  });
  it("provvigioni con struttura: 23% su 20%", () => {
    const r = calcolaRitenuta({ tipo: "PROVVIGIONI", importoLordo: 1000, conStruttura: true });
    expect(r.percentualeImponibile).toBe(20);
    expect(r.baseImponibile).toBe(200);
    expect(r.importoRitenuta).toBe(46);
  });
  it("occasionale: 20% su 100%", () => {
    const r = calcolaRitenuta({ tipo: "OCCASIONALE", importoLordo: 5000 });
    expect(r.importoRitenuta).toBe(1000);
    expect(r.codiceTributo).toBe("1040");
  });
  it("includes rivalsa INPS 4%", () => {
    const r = calcolaRitenuta({ tipo: "LAVORO_AUTONOMO", importoLordo: 1000, rivalsaInps: 40 });
    expect(r.baseImponibile).toBe(1040);
    expect(r.importoRitenuta).toBe(208);
  });
});

describe("getScadenzaVersamento", () => {
  it("March payment -> April 16", () => {
    expect(getScadenzaVersamento(3, 2026)).toEqual(new Date(2026, 3, 16));
  });
  it("December payment -> January 16 next year", () => {
    expect(getScadenzaVersamento(12, 2026)).toEqual(new Date(2027, 0, 16));
  });
});
