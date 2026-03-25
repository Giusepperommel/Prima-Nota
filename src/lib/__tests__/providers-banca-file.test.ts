import { describe, it, expect } from "vitest";
import { parseBancaCsv } from "../providers/adapters/banca-file";

describe("parseBancaCsv", () => {
  it("parses standard Italian bank CSV (semicolon separator)", () => {
    const csv = `Data;Data Valuta;Descrizione;Importo;Causale
15/03/2026;15/03/2026;BONIFICO A ROSSI SRL FT 001;-1220.00;48
16/03/2026;16/03/2026;ACCREDITO STIPENDIO;2500.00;27`;
    const result = parseBancaCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].importo).toBe(-1220);
    expect(result[0].descrizione).toBe("BONIFICO A ROSSI SRL FT 001");
    expect(result[1].importo).toBe(2500);
  });

  it("handles comma separator", () => {
    const csv = `Data,Descrizione,Importo
15/03/2026,PAGAMENTO FATTURA,-500.00`;
    const result = parseBancaCsv(csv);
    expect(result).toHaveLength(1);
    expect(result[0].importo).toBe(-500);
  });

  it("handles amounts with comma as decimal separator", () => {
    const csv = `Data;Descrizione;Importo
15/03/2026;PAGAMENTO;-1.220,50`;
    const result = parseBancaCsv(csv);
    expect(result[0].importo).toBe(-1220.5);
  });

  it("parses dates in DD/MM/YYYY format", () => {
    const csv = `Data;Descrizione;Importo
25/12/2026;NATALIZIO;100.00`;
    const result = parseBancaCsv(csv);
    expect(result[0].data.getFullYear()).toBe(2026);
    expect(result[0].data.getMonth()).toBe(11);
    expect(result[0].data.getDate()).toBe(25);
  });

  it("returns empty array for empty input", () => {
    expect(parseBancaCsv("")).toEqual([]);
    expect(parseBancaCsv("Data;Descrizione;Importo")).toEqual([]);
  });
});
