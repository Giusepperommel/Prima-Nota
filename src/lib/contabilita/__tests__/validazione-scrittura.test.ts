import { describe, it, expect } from "vitest";
import { validaScrittura, type MovimentoGenerato } from "../validazione-scrittura";

describe("validaScrittura", () => {
  it("accepts a balanced entry", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: 1000, importoAvere: 0, ordine: 1 },
      { contoId: 2, importoDare: 0, importoAvere: 1000, ordine: 2 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(true);
    expect(result.errori).toHaveLength(0);
  });

  it("rejects an unbalanced entry", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: 1000, importoAvere: 0, ordine: 1 },
      { contoId: 2, importoDare: 0, importoAvere: 999, ordine: 2 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(false);
    expect(result.errori[0]).toContain("quadratura");
  });

  it("rejects negative amounts", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: -100, importoAvere: 0, ordine: 1 },
      { contoId: 2, importoDare: 0, importoAvere: -100, ordine: 2 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(false);
    expect(result.errori[0]).toContain("negativ");
  });

  it("rejects row with both dare and avere > 0", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: 500, importoAvere: 500, ordine: 1 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(false);
    expect(result.errori[0]).toContain("mutualmente esclusiv");
  });

  it("rejects empty movimenti", () => {
    const result = validaScrittura([]);
    expect(result.valida).toBe(false);
  });

  it("handles rounding within tolerance (0.02)", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: 100.01, importoAvere: 0, ordine: 1 },
      { contoId: 2, importoDare: 0, importoAvere: 100.00, ordine: 2 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(true);
  });

  it("rejects difference beyond tolerance", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: 100.03, importoAvere: 0, ordine: 1 },
      { contoId: 2, importoDare: 0, importoAvere: 100.00, ordine: 2 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(false);
  });

  it("correctly reports totals", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: 1500.50, importoAvere: 0, ordine: 1 },
      { contoId: 2, importoDare: 0, importoAvere: 1500.50, ordine: 2 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.totaleDare).toBe(1500.50);
    expect(result.totaleAvere).toBe(1500.50);
  });
});
