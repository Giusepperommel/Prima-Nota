import { describe, it, expect } from "vitest";
import { parseCSV, parseLine, parseDate, parseAmount, PRESET_MAPPINGS } from "../csv-parser";

describe("parseLine", () => {
  it("splits simple semicolon-separated line", () => {
    expect(parseLine("a;b;c", ";")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted fields with semicolons", () => {
    expect(parseLine('"hello;world";b;c', ";")).toEqual(["hello;world", "b", "c"]);
  });

  it("handles escaped quotes", () => {
    expect(parseLine('"he said ""hi""";b', ";")).toEqual(['he said "hi"', "b"]);
  });

  it("handles comma separator", () => {
    expect(parseLine("a,b,c", ",")).toEqual(["a", "b", "c"]);
  });
});

describe("parseDate", () => {
  it("parses dd/mm/yyyy", () => {
    const d = parseDate("15/03/2025");
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
    expect(d!.getMonth()).toBe(2); // March = 2
    expect(d!.getFullYear()).toBe(2025);
  });

  it("parses yyyy-mm-dd", () => {
    const d = parseDate("2025-03-15");
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
  });

  it("parses dd.mm.yyyy", () => {
    const d = parseDate("15.03.2025");
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(15);
  });

  it("returns null for invalid date", () => {
    expect(parseDate("not-a-date")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("parseAmount", () => {
  it("parses Italian format (1.234,56)", () => {
    expect(parseAmount("1.234,56")).toBe(1234.56);
  });

  it("parses negative Italian format", () => {
    expect(parseAmount("-1.234,56")).toBe(-1234.56);
  });

  it("parses simple decimal", () => {
    expect(parseAmount("123.45")).toBe(123.45);
  });

  it("strips currency symbols", () => {
    expect(parseAmount("€ 1.234,56")).toBe(1234.56);
  });

  it("returns 0 for empty string", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("  ")).toBe(0);
  });

  it("handles zero", () => {
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount("0,00")).toBe(0);
  });
});

describe("parseCSV", () => {
  it("parses a basic CSV with single import column", () => {
    const csv = `Data;Descrizione;Importo;Saldo
15/03/2025;Pagamento fornitore;-500,00;10000,00
16/03/2025;Incasso cliente;1200,00;11200,00`;

    const result = parseCSV(csv, PRESET_MAPPINGS.GENERICO);

    expect(result.errori).toHaveLength(0);
    expect(result.movimenti).toHaveLength(2);

    const m0 = result.movimenti[0];
    expect(m0.descrizione).toBe("Pagamento fornitore");
    expect(m0.importo).toBe(500);
    expect(m0.segno).toBe("DARE");
    expect(m0.saldo).toBe(10000);

    const m1 = result.movimenti[1];
    expect(m1.importo).toBe(1200);
    expect(m1.segno).toBe("AVERE");
  });

  it("parses CSV with separate dare/avere columns", () => {
    const csv = `Data Operazione;Descrizione Operazione;Dare;Avere;Saldo
15/03/2025;Bonifico uscita;500,00;;9500,00
16/03/2025;Accredito;;1200,00;10700,00`;

    const result = parseCSV(csv, PRESET_MAPPINGS.INTESA_SANPAOLO);

    expect(result.errori).toHaveLength(0);
    expect(result.movimenti).toHaveLength(2);
    expect(result.movimenti[0].segno).toBe("DARE");
    expect(result.movimenti[0].importo).toBe(500);
    expect(result.movimenti[1].segno).toBe("AVERE");
    expect(result.movimenti[1].importo).toBe(1200);
  });

  it("reports errors for missing date", () => {
    const csv = `Data;Descrizione;Importo
;Test;100,00`;

    const result = parseCSV(csv, PRESET_MAPPINGS.GENERICO);
    expect(result.errori).toHaveLength(1);
    expect(result.errori[0].messaggio).toContain("Data mancante");
  });

  it("reports error when required column missing", () => {
    const csv = `WrongCol;Descrizione;Importo
15/03/2025;Test;100,00`;

    const result = parseCSV(csv, PRESET_MAPPINGS.GENERICO);
    expect(result.errori.length).toBeGreaterThan(0);
    expect(result.errori[0].messaggio).toContain("non trovata");
  });

  it("handles empty file", () => {
    const result = parseCSV("", PRESET_MAPPINGS.GENERICO);
    expect(result.movimenti).toHaveLength(0);
    expect(result.errori.length).toBeGreaterThan(0);
  });

  it("skips empty lines", () => {
    const csv = `Data;Descrizione;Importo
15/03/2025;Test;100,00

16/03/2025;Test2;200,00`;

    const result = parseCSV(csv, PRESET_MAPPINGS.GENERICO);
    expect(result.movimenti).toHaveLength(2);
  });
});
