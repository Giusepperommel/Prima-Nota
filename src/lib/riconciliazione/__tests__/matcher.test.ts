import { describe, it, expect } from "vitest";
import { generaSuggerimenti, calcolaScore, differenzaGiorni, MovimentoPerMatch, OperazionePerMatch } from "../matcher";

function makeMovimento(overrides: Partial<MovimentoPerMatch> = {}): MovimentoPerMatch {
  return {
    id: 1,
    data: new Date("2025-03-15"),
    importo: 1000,
    segno: "DARE",
    descrizione: "Bonifico a fornitore ABC",
    ...overrides,
  };
}

function makeOperazione(overrides: Partial<OperazionePerMatch> = {}): OperazionePerMatch {
  return {
    id: 101,
    dataOperazione: new Date("2025-03-15"),
    importoTotale: 1000,
    tipoOperazione: "COSTO",
    descrizione: "Acquisto materiali ABC",
    numeroDocumento: "FT-001",
    ...overrides,
  };
}

describe("differenzaGiorni", () => {
  it("returns 0 for same day", () => {
    expect(differenzaGiorni(new Date("2025-03-15"), new Date("2025-03-15"))).toBe(0);
  });

  it("returns positive for later date first", () => {
    expect(differenzaGiorni(new Date("2025-03-17"), new Date("2025-03-15"))).toBe(2);
  });

  it("returns negative for earlier date first", () => {
    expect(differenzaGiorni(new Date("2025-03-13"), new Date("2025-03-15"))).toBe(-2);
  });
});

describe("calcolaScore", () => {
  it("gives maximum score for exact match", () => {
    const mov = makeMovimento();
    const op = makeOperazione();
    const score = calcolaScore(mov, op);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it("gives high score for same amount different day", () => {
    const mov = makeMovimento({ data: new Date("2025-03-16") });
    const op = makeOperazione();
    const score = calcolaScore(mov, op);
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it("gives 0 for very different amounts", () => {
    const mov = makeMovimento({ importo: 5000 });
    const op = makeOperazione({ importoTotale: 100 });
    expect(calcolaScore(mov, op)).toBe(0);
  });

  it("gives 0 for dates too far apart", () => {
    const mov = makeMovimento({ data: new Date("2025-04-15") });
    const op = makeOperazione();
    expect(calcolaScore(mov, op)).toBe(0);
  });

  it("bonus for matching invoice number in description", () => {
    const mov = makeMovimento({ descrizione: "Pagamento FT-001 fornitore" });
    const op = makeOperazione({ numeroDocumento: "FT-001" });
    const scoreWith = calcolaScore(mov, op);

    const movNoRef = makeMovimento({ descrizione: "Pagamento generico" });
    const scoreWithout = calcolaScore(movNoRef, op);

    expect(scoreWith).toBeGreaterThan(scoreWithout);
  });

  it("bonus for consistent direction (DARE for costs)", () => {
    const mov = makeMovimento({ segno: "DARE" });
    const op = makeOperazione({ tipoOperazione: "COSTO" });
    const scoreDare = calcolaScore(mov, op);

    const movAvere = makeMovimento({ segno: "AVERE" });
    const scoreAvere = calcolaScore(movAvere, op);

    expect(scoreDare).toBeGreaterThan(scoreAvere);
  });
});

describe("generaSuggerimenti", () => {
  it("returns empty for no movements", () => {
    expect(generaSuggerimenti([], [makeOperazione()])).toHaveLength(0);
  });

  it("returns empty for no operations", () => {
    expect(generaSuggerimenti([makeMovimento()], [])).toHaveLength(0);
  });

  it("matches a movement with the best operation", () => {
    const movimenti = [makeMovimento()];
    const operazioni = [
      makeOperazione({ id: 101, importoTotale: 1000 }),
      makeOperazione({ id: 102, importoTotale: 999 }),
    ];

    const suggerimenti = generaSuggerimenti(movimenti, operazioni);
    expect(suggerimenti).toHaveLength(1);
    expect(suggerimenti[0].operazioneId).toBe(101); // Exact match preferred
    expect(suggerimenti[0].score).toBeGreaterThanOrEqual(80);
  });

  it("returns suggestions sorted by score descending", () => {
    const movimenti = [
      makeMovimento({ id: 1, importo: 1000 }),
      makeMovimento({ id: 2, importo: 500, data: new Date("2025-03-20") }),
    ];
    const operazioni = [
      makeOperazione({ id: 101, importoTotale: 1000 }),
      makeOperazione({ id: 102, importoTotale: 500, dataOperazione: new Date("2025-03-20") }),
    ];

    const suggerimenti = generaSuggerimenti(movimenti, operazioni);
    expect(suggerimenti.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < suggerimenti.length; i++) {
      expect(suggerimenti[i - 1].score).toBeGreaterThanOrEqual(suggerimenti[i].score);
    }
  });

  it("respects custom config for score threshold", () => {
    const movimenti = [makeMovimento({ data: new Date("2025-03-18") })]; // 3 days diff
    const operazioni = [makeOperazione()];

    const withLowThreshold = generaSuggerimenti(movimenti, operazioni, { scoreMinimo: 30 });
    const withHighThreshold = generaSuggerimenti(movimenti, operazioni, { scoreMinimo: 95 });

    expect(withLowThreshold.length).toBeGreaterThanOrEqual(withHighThreshold.length);
  });

  it("includes motivazione in each suggestion", () => {
    const suggerimenti = generaSuggerimenti([makeMovimento()], [makeOperazione()]);
    expect(suggerimenti[0].motivazione).toBeTruthy();
    expect(typeof suggerimenti[0].motivazione).toBe("string");
  });
});
