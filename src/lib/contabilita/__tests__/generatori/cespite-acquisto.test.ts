import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaCespiteAcquisto } from "../../generatori/cespite-acquisto";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

const mockPdcMap = new Map<string, number>([
  ["130.001", 3],   // IVA_CREDITO
  ["200.001", 4],   // DEBITI_FORNITORI
  ["170.008", 20],  // ELABORATORI asset
  ["170.006", 21],  // MOBILI asset
]);

const resolver = new ContoResolver(mockPdcMap);

function asSingle(result: ScritturaGenerata | ScritturaGenerata[]): ScritturaGenerata {
  return Array.isArray(result) ? result[0] : result;
}

describe("generaCespiteAcquisto", () => {
  describe("Acquisto elaboratore con IVA 100% detraibile", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "CESPITE",
        dataOperazione: new Date("2026-03-01"),
        descrizione: "Acquisto server aziendale",
        importoTotale: 3660,
        importoImponibile: 3000,
        importoIva: 660,
        aliquotaIva: 22,
        ivaDetraibile: 660,
        ivaIndetraibile: 0,
        sottotipoCespite: "ELABORATORI",
      } as any,
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera scrittura con dare immobilizzazione + IVA e avere fornitori", () => {
      const scrittura = asSingle(generaCespiteAcquisto(input, resolver));

      expect(scrittura.causale).toBe("FA_CESPITE");
      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: immobilizzazione = 3000 (imponibile, no IVA indetraibile)
      const assetDare = scrittura.movimenti.find(m => m.contoId === 20 && m.importoDare > 0);
      expect(assetDare).toBeDefined();
      expect(assetDare!.importoDare).toBe(3000);

      // Dare: IVA credito = 660
      const ivaDare = scrittura.movimenti.find(m => m.contoId === 3 && m.importoDare > 0);
      expect(ivaDare).toBeDefined();
      expect(ivaDare!.importoDare).toBe(660);

      // Avere: debiti fornitori = 3660
      const fornitoriAvere = scrittura.movimenti.find(m => m.contoId === 4 && m.importoAvere > 0);
      expect(fornitoriAvere).toBeDefined();
      expect(fornitoriAvere!.importoAvere).toBe(3660);

      expect(scrittura.totaleDare).toBe(3660);
      expect(scrittura.totaleAvere).toBe(3660);
      expect(scrittura.warnings).toHaveLength(0);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Acquisto cespite con IVA parzialmente indetraibile", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "CESPITE",
        dataOperazione: new Date("2026-04-15"),
        descrizione: "Acquisto mobili ufficio",
        importoTotale: 1220,
        importoImponibile: 1000,
        importoIva: 220,
        aliquotaIva: 22,
        ivaDetraibile: 110,
        ivaIndetraibile: 110,
        sottotipoCespite: "MOBILI",
      } as any,
      societaId: 1,
      categoriaContoId: null,
    };

    it("somma IVA indetraibile al valore del cespite", () => {
      const scrittura = asSingle(generaCespiteAcquisto(input, resolver));

      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: immobilizzazione = 1000 + 110 = 1110
      const assetDare = scrittura.movimenti.find(m => m.contoId === 21 && m.importoDare > 0);
      expect(assetDare).toBeDefined();
      expect(assetDare!.importoDare).toBe(1110);

      // Dare: IVA credito = 110
      const ivaDare = scrittura.movimenti.find(m => m.contoId === 3 && m.importoDare > 0);
      expect(ivaDare).toBeDefined();
      expect(ivaDare!.importoDare).toBe(110);

      // Avere: fornitori = 1220
      const fornitoriAvere = scrittura.movimenti.find(m => m.contoId === 4 && m.importoAvere > 0);
      expect(fornitoriAvere).toBeDefined();
      expect(fornitoriAvere!.importoAvere).toBe(1220);

      expect(scrittura.totaleDare).toBe(1220);
      expect(scrittura.totaleAvere).toBe(1220);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Fallback quando sottotipoCespite non fornito", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "CESPITE",
        dataOperazione: new Date("2026-05-01"),
        descrizione: "Acquisto generico",
        importoTotale: 500,
        importoImponibile: 500,
        ivaDetraibile: 0,
        ivaIndetraibile: 0,
      },
      societaId: 1,
      categoriaContoId: 99,
    };

    it("usa categoriaContoId come fallback e genera warning", () => {
      const scrittura = asSingle(generaCespiteAcquisto(input, resolver));

      // Uses categoriaContoId = 99 as contoId
      const assetDare = scrittura.movimenti.find(m => m.importoDare > 0 && m.contoId === 99);
      expect(assetDare).toBeDefined();
      expect(assetDare!.importoDare).toBe(500);
      expect(scrittura.warnings).toHaveLength(0);
    });
  });
});
