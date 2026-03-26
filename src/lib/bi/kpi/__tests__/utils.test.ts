import { describe, it, expect } from "vitest";
import { calcolaImportoNetto, calcolaVariazione, determinaTrend, buildPeriodRange } from "../../utils";

describe("bi utils", () => {
  describe("calcolaImportoNetto", () => {
    it("uses importoImponibile when available", () => {
      expect(calcolaImportoNetto({ importoImponibile: 100, importoTotale: 122, aliquotaIva: 22 })).toBe(100);
    });

    it("computes from importoTotale and aliquotaIva", () => {
      expect(calcolaImportoNetto({ importoImponibile: null, importoTotale: 122, aliquotaIva: 22 })).toBe(100);
    });

    it("falls back to importoTotale", () => {
      expect(calcolaImportoNetto({ importoImponibile: null, importoTotale: 100, aliquotaIva: null })).toBe(100);
    });
  });

  describe("calcolaVariazione", () => {
    it("calculates percentage change", () => {
      expect(calcolaVariazione(120, 100)).toBeCloseTo(20);
    });

    it("returns null when previous is zero", () => {
      expect(calcolaVariazione(100, 0)).toBeNull();
    });
  });

  describe("determinaTrend", () => {
    it("returns up for positive variation", () => {
      expect(determinaTrend(10)).toBe("up");
    });

    it("returns down for negative variation", () => {
      expect(determinaTrend(-10)).toBe("down");
    });

    it("returns stable for small variation", () => {
      expect(determinaTrend(0.5)).toBe("stable");
    });
  });

  describe("buildPeriodRange", () => {
    it("builds monthly range", () => {
      const range = buildPeriodRange(2026, 3, "MESE");
      expect(range.da.getMonth()).toBe(2); // March = index 2
      expect(range.a.getMonth()).toBe(2);
      expect(range.label).toBe("2026-03");
    });

    it("builds yearly range", () => {
      const range = buildPeriodRange(2026, 1, "ANNO");
      expect(range.da.getMonth()).toBe(0);
      expect(range.a.getMonth()).toBe(11);
      expect(range.label).toBe("2026");
    });
  });
});
