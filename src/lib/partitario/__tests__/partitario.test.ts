import { describe, it, expect } from "vitest";
import { generaScadenze, OperazionePerScadenza } from "../genera-scadenze";
import { calcolaSaldoPerAnagrafica, calcolaAging, ScadenzaAperta } from "../calcola-saldo";

/** Format date as YYYY-MM-DD in local timezone (avoids UTC offset issues) */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeOp(overrides: Partial<OperazionePerScadenza> = {}): OperazionePerScadenza {
  return {
    id: 1,
    societaId: 1,
    anagraficaId: 10,
    dataOperazione: new Date("2025-03-15"),
    importoTotale: 1000,
    tipoAnagrafica: "FORNITORE",
    ...overrides,
  };
}

describe("generaScadenze", () => {
  it("IMMEDIATO: single due date on same day", () => {
    const result = generaScadenze(makeOp(), "IMMEDIATO");
    expect(result).toHaveLength(1);
    expect(localDateStr(result[0].dataScadenza)).toBe("2025-03-15");
    expect(result[0].importo).toBe(1000);
  });

  it("30GG: single due date 30 days later", () => {
    const result = generaScadenze(makeOp(), "30GG");
    expect(result).toHaveLength(1);
    expect(localDateStr(result[0].dataScadenza)).toBe("2025-04-14");
    expect(result[0].importo).toBe(1000);
  });

  it("60GG: single due date 60 days later", () => {
    const result = generaScadenze(makeOp(), "60GG");
    expect(result).toHaveLength(1);
    expect(localDateStr(result[0].dataScadenza)).toBe("2025-05-14");
  });

  it("90GG: single due date 90 days later", () => {
    const result = generaScadenze(makeOp(), "90GG");
    expect(result).toHaveLength(1);
    expect(localDateStr(result[0].dataScadenza)).toBe("2025-06-13");
  });

  it("30_60GG: two installments 50/50", () => {
    const result = generaScadenze(makeOp(), "30_60GG");
    expect(result).toHaveLength(2);
    expect(result[0].importo).toBe(500);
    expect(result[1].importo).toBe(500);
    expect(localDateStr(result[0].dataScadenza)).toBe("2025-04-14");
    expect(localDateStr(result[1].dataScadenza)).toBe("2025-05-14");
  });

  it("30_60_90GG: three installments 33/33/34", () => {
    const result = generaScadenze(makeOp(), "30_60_90GG");
    expect(result).toHaveLength(3);
    const total = result.reduce((s, r) => s + r.importo, 0);
    expect(Math.round(total * 100) / 100).toBe(1000);
  });

  it("FINE_MESE: due at end of current month", () => {
    const result = generaScadenze(makeOp(), "FINE_MESE");
    expect(result).toHaveLength(1);
    expect(localDateStr(result[0].dataScadenza)).toBe("2025-03-31");
  });

  it("FINE_MESE_30GG: due 30 days after end of month", () => {
    const result = generaScadenze(makeOp(), "FINE_MESE_30GG");
    expect(result).toHaveLength(1);
    expect(localDateStr(result[0].dataScadenza)).toBe("2025-04-30");
  });

  it("preserves tipo from operation", () => {
    const result = generaScadenze(makeOp({ tipoAnagrafica: "CLIENTE" }), "30GG");
    expect(result[0].tipo).toBe("CLIENTE");
  });
});

describe("calcolaSaldoPerAnagrafica", () => {
  const anagrafiche = [
    { id: 10, denominazione: "Fornitore A", tipo: "FORNITORE" },
    { id: 20, denominazione: "Cliente B", tipo: "CLIENTE" },
  ];

  it("calculates open balance excluding closed items", () => {
    const scadenze: ScadenzaAperta[] = [
      { id: 1, anagraficaId: 10, operazioneId: 1, dataScadenza: new Date(), importo: 1000, importoPagato: 0, stato: "APERTA", tipo: "FORNITORE" },
      { id: 2, anagraficaId: 10, operazioneId: 2, dataScadenza: new Date(), importo: 500, importoPagato: 500, stato: "CHIUSA", tipo: "FORNITORE" },
    ];

    const result = calcolaSaldoPerAnagrafica(scadenze, anagrafiche);
    expect(result).toHaveLength(1);
    expect(result[0].saldoAperto).toBe(1000);
  });

  it("handles partial payments", () => {
    const scadenze: ScadenzaAperta[] = [
      { id: 1, anagraficaId: 10, operazioneId: 1, dataScadenza: new Date(), importo: 1000, importoPagato: 300, stato: "PARZIALE", tipo: "FORNITORE" },
    ];

    const result = calcolaSaldoPerAnagrafica(scadenze, anagrafiche);
    expect(result[0].saldoAperto).toBe(700);
  });

  it("sums multiple open items per anagrafica", () => {
    const scadenze: ScadenzaAperta[] = [
      { id: 1, anagraficaId: 10, operazioneId: 1, dataScadenza: new Date("2025-01-01"), importo: 500, importoPagato: 0, stato: "APERTA", tipo: "FORNITORE" },
      { id: 2, anagraficaId: 10, operazioneId: 2, dataScadenza: new Date("2025-02-01"), importo: 300, importoPagato: 0, stato: "APERTA", tipo: "FORNITORE" },
    ];

    const result = calcolaSaldoPerAnagrafica(scadenze, anagrafiche);
    expect(result[0].saldoAperto).toBe(800);
    expect(result[0].numScadenzeAperte).toBe(2);
  });

  it("returns empty for all closed items", () => {
    const scadenze: ScadenzaAperta[] = [
      { id: 1, anagraficaId: 10, operazioneId: 1, dataScadenza: new Date(), importo: 1000, importoPagato: 1000, stato: "CHIUSA", tipo: "FORNITORE" },
    ];

    const result = calcolaSaldoPerAnagrafica(scadenze, anagrafiche);
    expect(result).toHaveLength(0);
  });

  it("sorts by saldo descending", () => {
    const scadenze: ScadenzaAperta[] = [
      { id: 1, anagraficaId: 10, operazioneId: 1, dataScadenza: new Date(), importo: 500, importoPagato: 0, stato: "APERTA", tipo: "FORNITORE" },
      { id: 2, anagraficaId: 20, operazioneId: 2, dataScadenza: new Date(), importo: 2000, importoPagato: 0, stato: "APERTA", tipo: "CLIENTE" },
    ];

    const result = calcolaSaldoPerAnagrafica(scadenze, anagrafiche);
    expect(result[0].saldoAperto).toBeGreaterThan(result[1].saldoAperto);
  });
});

describe("calcolaAging", () => {
  const today = new Date("2025-03-25");

  it("buckets non-overdue items correctly", () => {
    const scadenze: ScadenzaAperta[] = [
      { id: 1, anagraficaId: 10, operazioneId: 1, dataScadenza: new Date("2025-04-15"), importo: 1000, importoPagato: 0, stato: "APERTA", tipo: "FORNITORE" },
    ];

    const buckets = calcolaAging(scadenze, today);
    expect(buckets[0].label).toBe("Non scaduto");
    expect(buckets[0].importo).toBe(1000);
    expect(buckets[0].count).toBe(1);
  });

  it("buckets 1-30 days overdue correctly", () => {
    const scadenze: ScadenzaAperta[] = [
      { id: 1, anagraficaId: 10, operazioneId: 1, dataScadenza: new Date("2025-03-10"), importo: 500, importoPagato: 0, stato: "APERTA", tipo: "FORNITORE" },
    ];

    const buckets = calcolaAging(scadenze, today);
    expect(buckets[1].label).toBe("1-30 giorni");
    expect(buckets[1].importo).toBe(500);
  });

  it("uses residuo (importo - importoPagato)", () => {
    const scadenze: ScadenzaAperta[] = [
      { id: 1, anagraficaId: 10, operazioneId: 1, dataScadenza: new Date("2025-03-10"), importo: 1000, importoPagato: 400, stato: "PARZIALE", tipo: "FORNITORE" },
    ];

    const buckets = calcolaAging(scadenze, today);
    const total = buckets.reduce((s, b) => s + b.importo, 0);
    expect(total).toBe(600);
  });

  it("excludes closed items", () => {
    const scadenze: ScadenzaAperta[] = [
      { id: 1, anagraficaId: 10, operazioneId: 1, dataScadenza: new Date("2025-01-01"), importo: 1000, importoPagato: 1000, stato: "CHIUSA", tipo: "FORNITORE" },
    ];

    const buckets = calcolaAging(scadenze, today);
    const total = buckets.reduce((s, b) => s + b.importo, 0);
    expect(total).toBe(0);
  });

  it("correctly assigns over 90 days bucket", () => {
    const scadenze: ScadenzaAperta[] = [
      { id: 1, anagraficaId: 10, operazioneId: 1, dataScadenza: new Date("2024-12-01"), importo: 2000, importoPagato: 0, stato: "APERTA", tipo: "FORNITORE" },
    ];

    const buckets = calcolaAging(scadenze, today);
    expect(buckets[4].label).toBe("Oltre 90 giorni");
    expect(buckets[4].importo).toBe(2000);
  });
});
