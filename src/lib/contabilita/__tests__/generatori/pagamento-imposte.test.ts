import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaPagamentoImposte } from "../../generatori/pagamento-imposte";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

const mockPdcMap = new Map<string, number>([
  ["100.010", 1],   // BANCA_CC
  ["130.003", 10],  // ERARIO_ACCONTI_IRES
  ["130.004", 11],  // ERARIO_ACCONTI_IRAP
  ["220.002", 12],  // DEBITI_IRES
  ["220.003", 13],  // DEBITI_IRAP
  ["220.004", 14],  // ERARIO_RITENUTE
  ["220.006", 15],  // ERARIO_IVA
]);

const resolver = new ContoResolver(mockPdcMap);

function asSingle(result: ScritturaGenerata | ScritturaGenerata[]): ScritturaGenerata {
  return Array.isArray(result) ? result[0] : result;
}

describe("generaPagamentoImposte", () => {
  describe("Acconto IRES", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "PAGAMENTO_IMPOSTE",
        dataOperazione: new Date("2026-06-30"),
        descrizione: "Acconto IRES I rata",
        importoTotale: 5000,
        sottotipoImposta: "ACCONTO_IRES",
      } as any,
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera dare ERARIO_ACCONTI_IRES e avere BANCA_CC", () => {
      const scrittura = asSingle(generaPagamentoImposte(input, resolver));

      expect(scrittura.causale).toBe("F24");
      expect(scrittura.movimenti).toHaveLength(2);

      const dareMov = scrittura.movimenti.find(m => m.contoId === 10 && m.importoDare > 0);
      expect(dareMov).toBeDefined();
      expect(dareMov!.importoDare).toBe(5000);

      const avereMov = scrittura.movimenti.find(m => m.contoId === 1 && m.importoAvere > 0);
      expect(avereMov).toBeDefined();
      expect(avereMov!.importoAvere).toBe(5000);

      expect(scrittura.totaleDare).toBe(5000);
      expect(scrittura.totaleAvere).toBe(5000);
      expect(scrittura.warnings).toHaveLength(0);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Saldo IRAP", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "PAGAMENTO_IMPOSTE",
        dataOperazione: new Date("2026-06-30"),
        descrizione: "Saldo IRAP 2025",
        importoTotale: 2000,
        sottotipoImposta: "SALDO_IRAP",
      } as any,
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera dare DEBITI_IRAP e avere BANCA_CC", () => {
      const scrittura = asSingle(generaPagamentoImposte(input, resolver));

      expect(scrittura.movimenti).toHaveLength(2);

      const dareMov = scrittura.movimenti.find(m => m.contoId === 13 && m.importoDare > 0);
      expect(dareMov).toBeDefined();
      expect(dareMov!.importoDare).toBe(2000);

      const avereMov = scrittura.movimenti.find(m => m.contoId === 1 && m.importoAvere > 0);
      expect(avereMov).toBeDefined();
      expect(avereMov!.importoAvere).toBe(2000);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Versamento ritenute", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "PAGAMENTO_IMPOSTE",
        dataOperazione: new Date("2026-02-16"),
        descrizione: "Versamento ritenute gennaio",
        importoTotale: 1200,
        sottotipoImposta: "VERSAMENTO_RITENUTE",
      } as any,
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera dare ERARIO_RITENUTE e avere BANCA_CC", () => {
      const scrittura = asSingle(generaPagamentoImposte(input, resolver));

      const dareMov = scrittura.movimenti.find(m => m.contoId === 14 && m.importoDare > 0);
      expect(dareMov).toBeDefined();
      expect(dareMov!.importoDare).toBe(1200);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Default senza sottotipo", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "PAGAMENTO_IMPOSTE",
        dataOperazione: new Date("2026-03-16"),
        descrizione: "Pagamento F24 generico",
        importoTotale: 800,
      },
      societaId: 1,
      categoriaContoId: null,
    };

    it("usa ERARIO_IVA come default e genera warning", () => {
      const scrittura = asSingle(generaPagamentoImposte(input, resolver));

      expect(scrittura.warnings.length).toBeGreaterThan(0);
      expect(scrittura.warnings).toContain("Sottotipo imposta non specificato — utilizzato ERARIO_IVA come default");

      const dareMov = scrittura.movimenti.find(m => m.contoId === 15 && m.importoDare > 0);
      expect(dareMov).toBeDefined();

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });
});
