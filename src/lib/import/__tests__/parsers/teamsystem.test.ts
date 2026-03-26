import { describe, it, expect } from "vitest";
import { parseTeamSystemCsv } from "../../parsers/teamsystem";

describe("parseTeamSystemCsv", () => {
  it("parses semicolon-separated CSV", () => {
    const csv = "Codice;Descrizione;Tipo\n001;Cassa;Attivo\n002;Banca;Attivo";
    const result = parseTeamSystemCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].rowNumber).toBe(1);
    expect(result[0].data.Codice).toBe("001");
    expect(result[0].data.Descrizione).toBe("Cassa");
  });

  it("handles quoted fields", () => {
    const csv = 'Codice;Descrizione\n001;"Cassa; contanti"';
    const result = parseTeamSystemCsv(csv);
    expect(result[0].data.Descrizione).toBe("Cassa; contanti");
  });

  it("handles empty CSV", () => {
    const csv = "Codice;Descrizione";
    const result = parseTeamSystemCsv(csv);
    expect(result).toHaveLength(0);
  });
});
