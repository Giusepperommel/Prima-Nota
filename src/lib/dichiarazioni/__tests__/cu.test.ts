import { describe, it, expect } from "vitest";
import { generaCU, riepilogoCU, validaCU } from "../cu/genera-cu";
import { TIPO_RITENUTA_TO_CAUSALE } from "../cu/cu-types";
import type { RitenutaInput } from "../cu/cu-types";

function makeRitenuta(overrides: Partial<RitenutaInput> = {}): RitenutaInput {
  return {
    id: 1,
    anagraficaId: 100,
    tipoRitenuta: "LAVORO_AUTONOMO",
    importoLordo: 1000,
    baseImponibile: 1000,
    importoRitenuta: 200,
    rivalsaInps: null,
    cassaPrevidenza: null,
    meseCompetenza: 3,
    annoCompetenza: 2025,
    codiceTributo: "1040",
    dataVersamento: null,
    statoVersamento: "DA_VERSARE",
    anagrafica: {
      id: 100,
      denominazione: "Mario Rossi",
      codiceFiscale: "RSSMRA80A01H501A",
      partitaIva: "12345678901",
      indirizzo: "Via Roma 1",
      cap: "00100",
      citta: "Roma",
      provincia: "RM",
    },
    ...overrides,
  };
}

describe("TIPO_RITENUTA_TO_CAUSALE", () => {
  it("maps LAVORO_AUTONOMO to A", () => {
    expect(TIPO_RITENUTA_TO_CAUSALE.LAVORO_AUTONOMO).toBe("A");
  });

  it("maps PROVVIGIONI to C", () => {
    expect(TIPO_RITENUTA_TO_CAUSALE.PROVVIGIONI).toBe("C");
  });

  it("maps OCCASIONALE to M", () => {
    expect(TIPO_RITENUTA_TO_CAUSALE.OCCASIONALE).toBe("M");
  });

  it("maps DIRITTI_AUTORE to L", () => {
    expect(TIPO_RITENUTA_TO_CAUSALE.DIRITTI_AUTORE).toBe("L");
  });
});

describe("generaCU", () => {
  it("generates CU for a single percipiente", () => {
    const ritenute = [
      makeRitenuta({ id: 1, meseCompetenza: 1 }),
      makeRitenuta({ id: 2, meseCompetenza: 2, importoLordo: 2000, baseImponibile: 2000, importoRitenuta: 400 }),
      makeRitenuta({ id: 3, meseCompetenza: 3 }),
    ];

    const result = generaCU(ritenute, 2025);
    expect(result.length).toBe(1);
    expect(result[0].anagraficaId).toBe(100);
    expect(result[0].ammontareLordo).toBe(4000);
    expect(result[0].imponibile).toBe(4000);
    expect(result[0].ritenutaAcconto).toBe(800); // 200+400+200
    expect(result[0].causaleCu).toBe("A");
    expect(result[0].denominazione).toBe("Mario Rossi");
    expect(result[0].dettaglioRitenute.length).toBe(3);
  });

  it("generates separate CU for different percipienti", () => {
    const ritenute = [
      makeRitenuta({ id: 1, anagraficaId: 100 }),
      makeRitenuta({
        id: 2,
        anagraficaId: 200,
        anagrafica: {
          id: 200,
          denominazione: "Luigi Verdi",
          codiceFiscale: "VRDLGU80A01H501B",
          partitaIva: "98765432109",
          indirizzo: "Via Milano 2",
          cap: "20100",
          citta: "Milano",
          provincia: "MI",
        },
      }),
    ];

    const result = generaCU(ritenute, 2025);
    expect(result.length).toBe(2);
    // Sorted by name
    expect(result[0].denominazione).toBe("Luigi Verdi");
    expect(result[1].denominazione).toBe("Mario Rossi");
  });

  it("returns empty for wrong year", () => {
    const ritenute = [makeRitenuta({ annoCompetenza: 2024 })];
    const result = generaCU(ritenute, 2025);
    expect(result.length).toBe(0);
  });

  it("uses most frequent causale for mixed types", () => {
    const ritenute = [
      makeRitenuta({ id: 1, tipoRitenuta: "LAVORO_AUTONOMO" }),
      makeRitenuta({ id: 2, tipoRitenuta: "LAVORO_AUTONOMO" }),
      makeRitenuta({ id: 3, tipoRitenuta: "OCCASIONALE" }),
    ];

    const result = generaCU(ritenute, 2025);
    expect(result[0].causaleCu).toBe("A"); // LAVORO_AUTONOMO is more frequent
  });

  it("includes rivalsa INPS in totals", () => {
    const ritenute = [
      makeRitenuta({ id: 1, rivalsaInps: 40, cassaPrevidenza: 20 }),
      makeRitenuta({ id: 2, rivalsaInps: 40, cassaPrevidenza: 0 }),
    ];

    const result = generaCU(ritenute, 2025);
    expect(result[0].rivalsaInps).toBe(80);
    expect(result[0].cassaPrevidenza).toBe(20);
  });

  it("sorts dettaglio ritenute by mese", () => {
    const ritenute = [
      makeRitenuta({ id: 1, meseCompetenza: 6 }),
      makeRitenuta({ id: 2, meseCompetenza: 2 }),
      makeRitenuta({ id: 3, meseCompetenza: 10 }),
    ];

    const result = generaCU(ritenute, 2025);
    expect(result[0].dettaglioRitenute[0].meseCompetenza).toBe(2);
    expect(result[0].dettaglioRitenute[1].meseCompetenza).toBe(6);
    expect(result[0].dettaglioRitenute[2].meseCompetenza).toBe(10);
  });
});

describe("riepilogoCU", () => {
  it("produces summary with totals", () => {
    const ritenute = [
      makeRitenuta({ id: 1, importoLordo: 5000, importoRitenuta: 1000 }),
      makeRitenuta({
        id: 2,
        anagraficaId: 200,
        importoLordo: 3000,
        importoRitenuta: 600,
        anagrafica: {
          id: 200,
          denominazione: "Luigi Verdi",
          codiceFiscale: "VRDLGU80A01H501B",
          partitaIva: "98765432109",
          indirizzo: null,
          cap: null,
          citta: null,
          provincia: null,
        },
      }),
    ];

    const riepilogo = riepilogoCU(ritenute, 2025);
    expect(riepilogo.anno).toBe(2025);
    expect(riepilogo.totalePercipienti).toBe(2);
    expect(riepilogo.totaleLordo).toBe(8000);
    expect(riepilogo.totaleRitenute).toBe(1600);
    expect(riepilogo.percipienti.length).toBe(2);
  });

  it("returns zero totals for no ritenute", () => {
    const riepilogo = riepilogoCU([], 2025);
    expect(riepilogo.totalePercipienti).toBe(0);
    expect(riepilogo.totaleLordo).toBe(0);
    expect(riepilogo.totaleRitenute).toBe(0);
  });
});

describe("validaCU", () => {
  it("warns when no ritenute found", () => {
    const warnings = validaCU([], 2025);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("Nessuna ritenuta");
  });

  it("warns about non-versate ritenute", () => {
    const ritenute = [
      makeRitenuta({ statoVersamento: "DA_VERSARE" }),
    ];
    const warnings = validaCU(ritenute, 2025);
    expect(warnings.some((w) => w.includes("non ancora versate"))).toBe(true);
  });

  it("warns about missing CF", () => {
    const ritenute = [
      makeRitenuta({
        anagrafica: {
          id: 100,
          denominazione: "Senza CF",
          codiceFiscale: null,
          partitaIva: null,
          indirizzo: null,
          cap: null,
          citta: null,
          provincia: null,
        },
      }),
    ];
    const warnings = validaCU(ritenute, 2025);
    expect(warnings.some((w) => w.includes("senza codice fiscale"))).toBe(true);
  });

  it("returns no warnings for valid data", () => {
    const ritenute = [
      makeRitenuta({ statoVersamento: "VERSATO" }),
    ];
    const warnings = validaCU(ritenute, 2025);
    expect(warnings.length).toBe(0);
  });
});
