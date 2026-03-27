import { describe, it, expect } from "vitest";
import { parseZucchettiCsv } from "../../parsers/zucchetti";

describe("parseZucchettiCsv", () => {
  it("parses pipe-separated CSV", () => {
    const csv = "Codice|Descrizione|Tipo\n001|Cassa|Attivo\n002|Banca|Passivo";
    const result = parseZucchettiCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].data.Codice).toBe("001");
    expect(result[0].data.Descrizione).toBe("Cassa");
    expect(result[0].data.Tipo).toBe("Attivo");
    expect(result[1].data.Codice).toBe("002");
  });

  it("handles empty file", () => {
    expect(parseZucchettiCsv("Codice|Descrizione")).toHaveLength(0);
  });

  it("assigns correct row numbers", () => {
    const csv = "A|B\n1|2\n3|4\n5|6";
    const result = parseZucchettiCsv(csv);
    expect(result).toHaveLength(3);
    expect(result[0].rowNumber).toBe(1);
    expect(result[1].rowNumber).toBe(2);
    expect(result[2].rowNumber).toBe(3);
  });
});
