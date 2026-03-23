import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaLiquidazioneIva } from "../../generatori/liquidazione-iva";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

const mockPdcMap = new Map<string, number>([
  ["100.010", 1],   // BANCA_CC
  ["130.001", 3],   // IVA_CREDITO
  ["220.001", 50],  // IVA_DEBITO
  ["220.006", 15],  // ERARIO_IVA
]);

const resolver = new ContoResolver(mockPdcMap);

function asSingle(result: ScritturaGenerata | ScritturaGenerata[]): ScritturaGenerata {
  return Array.isArray(result) ? result[0] : result;
}

describe("generaLiquidazioneIva", () => {
  describe("Versamento IVA semplificato (importoTotale > 0)", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "LIQUIDAZIONE_IVA",
        dataOperazione: new Date("2026-03-16"),
        descrizione: "Versamento IVA febbraio 2026",
        importoTotale: 3500,
      },
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera dare ERARIO_IVA e avere BANCA_CC", () => {
      const scrittura = asSingle(generaLiquidazioneIva(input, resolver));

      expect(scrittura.causale).toBe("LQ");
      expect(scrittura.movimenti).toHaveLength(2);

      const erarioDare = scrittura.movimenti.find(m => m.contoId === 15 && m.importoDare > 0);
      expect(erarioDare).toBeDefined();
      expect(erarioDare!.importoDare).toBe(3500);

      const bancaAvere = scrittura.movimenti.find(m => m.contoId === 1 && m.importoAvere > 0);
      expect(bancaAvere).toBeDefined();
      expect(bancaAvere!.importoAvere).toBe(3500);

      expect(scrittura.totaleDare).toBe(3500);
      expect(scrittura.totaleAvere).toBe(3500);
      expect(scrittura.warnings).toHaveLength(0);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Giroconto completo con IVA vendite/acquisti", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "LIQUIDAZIONE_IVA",
        dataOperazione: new Date("2026-03-16"),
        descrizione: "Liquidazione IVA febbraio 2026",
        importoTotale: 2000,
        totaleIvaVendite: 8000,
        totaleIvaAcquisti: 6000,
      } as any,
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera giroconto IVA debito/credito e differenza a ERARIO_IVA", () => {
      const scrittura = asSingle(generaLiquidazioneIva(input, resolver));

      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: IVA_DEBITO = 8000
      const ivaDebitoDare = scrittura.movimenti.find(m => m.contoId === 50 && m.importoDare > 0);
      expect(ivaDebitoDare).toBeDefined();
      expect(ivaDebitoDare!.importoDare).toBe(8000);

      // Avere: IVA_CREDITO = 6000
      const ivaCreditoAvere = scrittura.movimenti.find(m => m.contoId === 3 && m.importoAvere > 0);
      expect(ivaCreditoAvere).toBeDefined();
      expect(ivaCreditoAvere!.importoAvere).toBe(6000);

      // Avere: ERARIO_IVA = 2000 (differenza)
      const erarioAvere = scrittura.movimenti.find(m => m.contoId === 15 && m.importoAvere > 0);
      expect(erarioAvere).toBeDefined();
      expect(erarioAvere!.importoAvere).toBe(2000);

      expect(scrittura.totaleDare).toBe(8000);
      expect(scrittura.totaleAvere).toBe(8000);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("IVA a credito (nessun versamento)", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "LIQUIDAZIONE_IVA",
        dataOperazione: new Date("2026-03-16"),
        descrizione: "Liquidazione IVA — credito",
        importoTotale: -500,
      },
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera warning e nessun movimento", () => {
      const scrittura = asSingle(generaLiquidazioneIva(input, resolver));

      expect(scrittura.movimenti).toHaveLength(0);
      expect(scrittura.warnings.length).toBeGreaterThan(0);
      expect(scrittura.warnings[0]).toContain("credito");
    });
  });
});
