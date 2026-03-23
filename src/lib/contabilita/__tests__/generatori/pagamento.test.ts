import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaPagamento } from "../../generatori/pagamento";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

const mockPdcMap = new Map<string, number>([
  ["100.010", 1],   // BANCA_CC
  ["110.001", 2],   // CREDITI_CLIENTI
  ["200.001", 4],   // DEBITI_FORNITORI
]);

const resolver = new ContoResolver(mockPdcMap);

function asSingle(result: ScritturaGenerata | ScritturaGenerata[]): ScritturaGenerata {
  return Array.isArray(result) ? result[0] : result;
}

describe("generaPagamento", () => {
  describe("PG — pagamento fornitore", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "PAGAMENTO",
        dataOperazione: new Date("2026-03-10"),
        descrizione: "Pagamento fattura 456",
        importoTotale: 6100,
      },
      societaId: 1,
      categoriaContoId: null,
      causaleOverride: "PG",
      anagraficaDenominazione: "Fornitore Bianchi Srl",
    };

    it("genera dare DEBITI_FORNITORI e avere BANCA_CC", () => {
      const scrittura = asSingle(generaPagamento(input, resolver));

      expect(scrittura.causale).toBe("PG");
      expect(scrittura.movimenti).toHaveLength(2);

      // Dare: DEBITI_FORNITORI = 6100
      const fornitoriDare = scrittura.movimenti.find(m => m.contoId === 4 && m.importoDare > 0);
      expect(fornitoriDare).toBeDefined();
      expect(fornitoriDare!.importoDare).toBe(6100);

      // Avere: BANCA_CC = 6100
      const bancaAvere = scrittura.movimenti.find(m => m.contoId === 1 && m.importoAvere > 0);
      expect(bancaAvere).toBeDefined();
      expect(bancaAvere!.importoAvere).toBe(6100);

      expect(scrittura.totaleDare).toBe(6100);
      expect(scrittura.totaleAvere).toBe(6100);
      expect(scrittura.warnings).toHaveLength(0);

      expect(scrittura.descrizione).toContain("Fornitore Bianchi Srl");

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("IN — incasso da cliente", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "INCASSO",
        dataOperazione: new Date("2026-03-15"),
        descrizione: "Incasso fattura 789",
        importoTotale: 12200,
      },
      societaId: 1,
      categoriaContoId: null,
      causaleOverride: "IN",
      anagraficaDenominazione: "Cliente Verdi SpA",
    };

    it("genera dare BANCA_CC e avere CREDITI_CLIENTI", () => {
      const scrittura = asSingle(generaPagamento(input, resolver));

      expect(scrittura.causale).toBe("IN");
      expect(scrittura.movimenti).toHaveLength(2);

      // Dare: BANCA_CC = 12200
      const bancaDare = scrittura.movimenti.find(m => m.contoId === 1 && m.importoDare > 0);
      expect(bancaDare).toBeDefined();
      expect(bancaDare!.importoDare).toBe(12200);

      // Avere: CREDITI_CLIENTI = 12200
      const creditiAvere = scrittura.movimenti.find(m => m.contoId === 2 && m.importoAvere > 0);
      expect(creditiAvere).toBeDefined();
      expect(creditiAvere!.importoAvere).toBe(12200);

      expect(scrittura.totaleDare).toBe(12200);
      expect(scrittura.totaleAvere).toBe(12200);

      expect(scrittura.descrizione).toContain("Cliente Verdi SpA");

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });
});
