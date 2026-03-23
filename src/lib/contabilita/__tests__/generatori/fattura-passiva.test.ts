import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaFatturaPassiva } from "../../generatori/fattura-passiva";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

// Mock PdC map matching structural accounts
const mockPdcMap = new Map<string, number>([
  ["130.001", 3],   // IVA_CREDITO
  ["200.001", 4],   // DEBITI_FORNITORI
  ["220.004", 6],   // ERARIO_RITENUTE
]);

const resolver = new ContoResolver(mockPdcMap);

function asSingle(result: ScritturaGenerata | ScritturaGenerata[]): ScritturaGenerata {
  return Array.isArray(result) ? result[0] : result;
}

describe("generaFatturaPassiva", () => {
  describe("FA — acquisto con IVA 100% detraibile", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2026-01-15"),
        descrizione: "Consulenza gestionale",
        importoTotale: 6100,
        importoImponibile: 5000,
        importoIva: 1100,
        aliquotaIva: 22,
        ivaDetraibile: 1100,
        ivaIndetraibile: 0,
      },
      societaId: 1,
      categoriaContoId: 50, // mock category conto id for costo
    };

    it("genera scrittura con dare costo + IVA credito e avere debiti fornitori", () => {
      const scrittura = asSingle(generaFatturaPassiva(input, resolver));

      expect(scrittura.causale).toBe("FA");
      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: costo 5000
      const costoDare = scrittura.movimenti.find(
        (m) => m.contoId === 50 && m.importoDare > 0
      );
      expect(costoDare).toBeDefined();
      expect(costoDare!.importoDare).toBe(5000);

      // Dare: IVA credito 1100
      const ivaDare = scrittura.movimenti.find(
        (m) => m.contoId === 3 && m.importoDare > 0
      );
      expect(ivaDare).toBeDefined();
      expect(ivaDare!.importoDare).toBe(1100);

      // Avere: debiti fornitori 6100
      const fornitoriAvere = scrittura.movimenti.find(
        (m) => m.contoId === 4 && m.importoAvere > 0
      );
      expect(fornitoriAvere).toBeDefined();
      expect(fornitoriAvere!.importoAvere).toBe(6100);

      // Quadratura
      expect(scrittura.totaleDare).toBe(6100);
      expect(scrittura.totaleAvere).toBe(6100);
      expect(scrittura.warnings).toHaveLength(0);

      // Validates with validaScrittura
      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("FA — acquisto con IVA parzialmente detraibile (40%)", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2026-02-10"),
        descrizione: "Leasing auto aziendale",
        importoTotale: 1220,
        importoImponibile: 1000,
        importoIva: 220,
        aliquotaIva: 22,
        ivaDetraibile: 88,
        ivaIndetraibile: 132,
      },
      societaId: 1,
      categoriaContoId: 60,
    };

    it("somma IVA indetraibile al costo e registra solo IVA detraibile", () => {
      const scrittura = asSingle(generaFatturaPassiva(input, resolver));

      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: costo = imponibile + IVA indetraibile = 1000 + 132 = 1132
      const costoDare = scrittura.movimenti.find(
        (m) => m.contoId === 60 && m.importoDare > 0
      );
      expect(costoDare).toBeDefined();
      expect(costoDare!.importoDare).toBe(1132);

      // Dare: IVA credito = 88
      const ivaDare = scrittura.movimenti.find(
        (m) => m.contoId === 3 && m.importoDare > 0
      );
      expect(ivaDare).toBeDefined();
      expect(ivaDare!.importoDare).toBe(88);

      // Avere: debiti fornitori = 1220
      const fornitoriAvere = scrittura.movimenti.find(
        (m) => m.contoId === 4 && m.importoAvere > 0
      );
      expect(fornitoriAvere).toBeDefined();
      expect(fornitoriAvere!.importoAvere).toBe(1220);

      // Quadratura: 1132 + 88 = 1220
      expect(scrittura.totaleDare).toBe(1220);
      expect(scrittura.totaleAvere).toBe(1220);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("FA — acquisto con ritenuta d'acconto", () => {
    // Consulenza legale: compenso €3000, cassa prev 4% = €120
    // Imponibile IVA = €3120, IVA 22% = €686.40
    // Totale fattura = 3806.40, ritenuta = 20% di 3000 = 600
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2026-03-05"),
        descrizione: "Consulenza legale avv. Rossi",
        importoTotale: 3806.40,
        importoImponibile: 3120,
        importoIva: 686.40,
        aliquotaIva: 22,
        ivaDetraibile: 686.40,
        ivaIndetraibile: 0,
        importoRitenuta: 600,
        importoNettoRitenuta: 2400,
      },
      societaId: 1,
      categoriaContoId: 70,
    };

    it("registra debito fornitore = totale - ritenuta e ritenute erario separatamente", () => {
      const scrittura = asSingle(generaFatturaPassiva(input, resolver));

      expect(scrittura.movimenti).toHaveLength(4);

      // Dare: costo = 3120 (imponibile, no IVA indetraibile)
      const costoDare = scrittura.movimenti.find(
        (m) => m.contoId === 70 && m.importoDare > 0
      );
      expect(costoDare).toBeDefined();
      expect(costoDare!.importoDare).toBe(3120);

      // Dare: IVA credito = 686.40
      const ivaDare = scrittura.movimenti.find(
        (m) => m.contoId === 3 && m.importoDare > 0
      );
      expect(ivaDare).toBeDefined();
      expect(ivaDare!.importoDare).toBeCloseTo(686.40, 2);

      // CRITICAL: Avere debiti fornitori = importoTotale - importoRitenuta = 3806.40 - 600 = 3206.40
      const fornitoriAvere = scrittura.movimenti.find(
        (m) => m.contoId === 4 && m.importoAvere > 0
      );
      expect(fornitoriAvere).toBeDefined();
      expect(fornitoriAvere!.importoAvere).toBeCloseTo(3206.40, 2);

      // Avere: erario ritenute = 600
      const ritenuteAvere = scrittura.movimenti.find(
        (m) => m.contoId === 6 && m.importoAvere > 0
      );
      expect(ritenuteAvere).toBeDefined();
      expect(ritenuteAvere!.importoAvere).toBe(600);

      // Quadratura: Dare = 3120 + 686.40 = 3806.40, Avere = 3206.40 + 600 = 3806.40
      expect(scrittura.totaleDare).toBeCloseTo(3806.40, 2);
      expect(scrittura.totaleAvere).toBeCloseTo(3806.40, 2);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Warning quando categoria manca", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2026-01-20"),
        descrizione: "Acquisto generico",
        importoTotale: 122,
        importoImponibile: 100,
        importoIva: 22,
        aliquotaIva: 22,
        ivaDetraibile: 22,
        ivaIndetraibile: 0,
      },
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera warning quando categoriaContoId è null", () => {
      const scrittura = asSingle(generaFatturaPassiva(input, resolver));

      expect(scrittura.warnings.length).toBeGreaterThan(0);
      // The cost movement should have contoId null
      const costoMovimento = scrittura.movimenti.find(
        (m) => m.importoDare > 0 && m.contoId !== 3
      );
      expect(costoMovimento).toBeDefined();
      expect(costoMovimento!.contoId).toBeNull();
    });
  });

  describe("NCA — Nota credito ricevuta (storno)", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2026-02-28"),
        descrizione: "Nota credito su fattura 123",
        importoTotale: 610,
        importoImponibile: 500,
        importoIva: 110,
        aliquotaIva: 22,
        ivaDetraibile: 110,
        ivaIndetraibile: 0,
      },
      societaId: 1,
      categoriaContoId: 50,
      causaleOverride: "NCA",
    };

    it("inverte dare/avere rispetto alla fattura acquisto", () => {
      const scrittura = asSingle(generaFatturaPassiva(input, resolver));

      expect(scrittura.causale).toBe("NCA");
      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: debiti fornitori 610 (storno debito)
      const fornitoriDare = scrittura.movimenti.find(
        (m) => m.contoId === 4 && m.importoDare > 0
      );
      expect(fornitoriDare).toBeDefined();
      expect(fornitoriDare!.importoDare).toBe(610);

      // Avere: costo 500 (storno costo)
      const costoAvere = scrittura.movimenti.find(
        (m) => m.contoId === 50 && m.importoAvere > 0
      );
      expect(costoAvere).toBeDefined();
      expect(costoAvere!.importoAvere).toBe(500);

      // Avere: IVA credito 110 (storno IVA)
      const ivaAvere = scrittura.movimenti.find(
        (m) => m.contoId === 3 && m.importoAvere > 0
      );
      expect(ivaAvere).toBeDefined();
      expect(ivaAvere!.importoAvere).toBe(110);

      // Quadratura
      expect(scrittura.totaleDare).toBe(610);
      expect(scrittura.totaleAvere).toBe(610);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });
});
