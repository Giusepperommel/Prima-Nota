import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaAmmortamento } from "../../generatori/ammortamento";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

const mockPdcMap = new Map<string, number>([
  ["340.015", 30],  // ELABORATORI amm
  ["170.108", 31],  // ELABORATORI fondo
  ["340.013", 32],  // MOBILI amm
  ["170.106", 33],  // MOBILI fondo
]);

const resolver = new ContoResolver(mockPdcMap);

function asSingle(result: ScritturaGenerata | ScritturaGenerata[]): ScritturaGenerata {
  return Array.isArray(result) ? result[0] : result;
}

describe("generaAmmortamento", () => {
  describe("Ammortamento elaboratore", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "CESPITE",
        dataOperazione: new Date("2026-12-31"),
        descrizione: "Ammortamento server 2026",
        importoTotale: 750,
        sottotipoCespite: "ELABORATORI",
      } as any,
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera dare ammortamento e avere fondo ammortamento", () => {
      const scrittura = asSingle(generaAmmortamento(input, resolver));

      expect(scrittura.causale).toBe("AM");
      expect(scrittura.movimenti).toHaveLength(2);

      // Dare: ammortamento = 750
      const ammDare = scrittura.movimenti.find(m => m.contoId === 30 && m.importoDare > 0);
      expect(ammDare).toBeDefined();
      expect(ammDare!.importoDare).toBe(750);

      // Avere: fondo = 750
      const fondoAvere = scrittura.movimenti.find(m => m.contoId === 31 && m.importoAvere > 0);
      expect(fondoAvere).toBeDefined();
      expect(fondoAvere!.importoAvere).toBe(750);

      expect(scrittura.totaleDare).toBe(750);
      expect(scrittura.totaleAvere).toBe(750);
      expect(scrittura.warnings).toHaveLength(0);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Ammortamento mobili ufficio", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "CESPITE",
        dataOperazione: new Date("2026-12-31"),
        descrizione: "Ammortamento mobili 2026",
        importoTotale: 200,
        sottotipoCespite: "MOBILI",
      } as any,
      societaId: 1,
      categoriaContoId: null,
    };

    it("usa i conti MOBILI da MAPPING_CESPITI", () => {
      const scrittura = asSingle(generaAmmortamento(input, resolver));

      expect(scrittura.movimenti).toHaveLength(2);

      const ammDare = scrittura.movimenti.find(m => m.contoId === 32 && m.importoDare > 0);
      expect(ammDare).toBeDefined();
      expect(ammDare!.importoDare).toBe(200);

      const fondoAvere = scrittura.movimenti.find(m => m.contoId === 33 && m.importoAvere > 0);
      expect(fondoAvere).toBeDefined();
      expect(fondoAvere!.importoAvere).toBe(200);

      expect(scrittura.totaleDare).toBe(200);
      expect(scrittura.totaleAvere).toBe(200);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Warning quando sottotipoCespite manca", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "CESPITE",
        dataOperazione: new Date("2026-12-31"),
        descrizione: "Ammortamento generico",
        importoTotale: 100,
      },
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera warning quando tipo cespite non specificato", () => {
      const scrittura = asSingle(generaAmmortamento(input, resolver));

      expect(scrittura.warnings.length).toBeGreaterThan(0);
      expect(scrittura.warnings[0]).toContain("Tipo cespite non specificato");
    });
  });
});
