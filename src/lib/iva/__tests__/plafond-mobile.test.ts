import { describe, it, expect } from "vitest";
import { calculateMobilePlafond } from "../plafond";

describe("plafond mobile recalculation", () => {
  it("somma esportazioni degli ultimi 12 mesi", () => {
    const esportazioni = [
      { importo: 10000, data: new Date("2025-06-15") },
      { importo: 20000, data: new Date("2025-09-01") },
      { importo: 15000, data: new Date("2026-01-10") },
    ];
    const result = calculateMobilePlafond(esportazioni, new Date("2026-03-20"));
    expect(result).toBe(45000);
  });

  it("esclude esportazioni oltre i 12 mesi", () => {
    const esportazioni = [
      { importo: 10000, data: new Date("2024-12-01") },
      { importo: 20000, data: new Date("2025-06-15") },
    ];
    const result = calculateMobilePlafond(esportazioni, new Date("2026-03-20"));
    expect(result).toBe(20000);
  });

  it("nessuna esportazione → plafond 0", () => {
    const result = calculateMobilePlafond([], new Date("2026-03-20"));
    expect(result).toBe(0);
  });
});
