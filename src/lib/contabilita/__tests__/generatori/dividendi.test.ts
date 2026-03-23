import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaDividendi } from "../../generatori/dividendi";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

const mockPdcMap = new Map<string, number>([
  ["100.010", 1],   // BANCA_CC
  ["220.004", 6],   // ERARIO_RITENUTE
  ["230.002", 40],  // SOCI_DIVIDENDI
  ["270.004", 41],  // RISERVA_LEGALE
  ["270.009", 42],  // UTILI_A_NUOVO
  ["270.010", 43],  // UTILE_ESERCIZIO
]);

const resolver = new ContoResolver(mockPdcMap);

function asSingle(result: ScritturaGenerata | ScritturaGenerata[]): ScritturaGenerata {
  return Array.isArray(result) ? result[0] : result;
}

describe("generaDividendi", () => {
  describe("Delibera distribuzione utile (default 5% riserva legale)", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "DISTRIBUZIONE_DIVIDENDI",
        dataOperazione: new Date("2026-04-30"),
        descrizione: "Delibera distribuzione utile 2025",
        importoTotale: 100000,
        quotaDividendi: 90000,
      } as any,
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera dare utile e avere riserva legale + dividendi + utili a nuovo", () => {
      const scrittura = asSingle(generaDividendi(input, resolver));

      expect(scrittura.causale).toBe("DIV");

      // Dare: UTILE_ESERCIZIO = 100000
      const utileDare = scrittura.movimenti.find(m => m.contoId === 43 && m.importoDare > 0);
      expect(utileDare).toBeDefined();
      expect(utileDare!.importoDare).toBe(100000);

      // Avere: RISERVA_LEGALE = 5% = 5000
      const riservaAvere = scrittura.movimenti.find(m => m.contoId === 41 && m.importoAvere > 0);
      expect(riservaAvere).toBeDefined();
      expect(riservaAvere!.importoAvere).toBe(5000);

      // Avere: SOCI_DIVIDENDI = 90000
      const dividendiAvere = scrittura.movimenti.find(m => m.contoId === 40 && m.importoAvere > 0);
      expect(dividendiAvere).toBeDefined();
      expect(dividendiAvere!.importoAvere).toBe(90000);

      // Avere: UTILI_A_NUOVO = 100000 - 5000 - 90000 = 5000
      const utiliNuovoAvere = scrittura.movimenti.find(m => m.contoId === 42 && m.importoAvere > 0);
      expect(utiliNuovoAvere).toBeDefined();
      expect(utiliNuovoAvere!.importoAvere).toBe(5000);

      expect(scrittura.totaleDare).toBe(100000);
      expect(scrittura.totaleAvere).toBe(100000);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Pagamento dividendi con ritenuta 26%", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "DISTRIBUZIONE_DIVIDENDI",
        dataOperazione: new Date("2026-05-15"),
        descrizione: "Pagamento dividendi socio Rossi",
        importoTotale: 10000,
        importoRitenuta: 2600, // 26%
      },
      societaId: 1,
      categoriaContoId: null,
      causaleOverride: "DIV_PAG",
    };

    it("genera dare soci dividendi e avere ritenute + banca", () => {
      const scrittura = asSingle(generaDividendi(input, resolver));

      expect(scrittura.causale).toBe("DIV");
      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: SOCI_DIVIDENDI = 10000
      const sociDare = scrittura.movimenti.find(m => m.contoId === 40 && m.importoDare > 0);
      expect(sociDare).toBeDefined();
      expect(sociDare!.importoDare).toBe(10000);

      // Avere: ERARIO_RITENUTE = 2600
      const ritenuteAvere = scrittura.movimenti.find(m => m.contoId === 6 && m.importoAvere > 0);
      expect(ritenuteAvere).toBeDefined();
      expect(ritenuteAvere!.importoAvere).toBe(2600);

      // Avere: BANCA_CC = 7400
      const bancaAvere = scrittura.movimenti.find(m => m.contoId === 1 && m.importoAvere > 0);
      expect(bancaAvere).toBeDefined();
      expect(bancaAvere!.importoAvere).toBe(7400);

      expect(scrittura.totaleDare).toBe(10000);
      expect(scrittura.totaleAvere).toBe(10000);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });
});
