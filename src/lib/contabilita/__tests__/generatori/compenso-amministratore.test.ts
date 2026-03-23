import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaCompensoAmministratore } from "../../generatori/compenso-amministratore";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

// Mock PdC map matching structural accounts
const mockPdcMap = new Map<string, number>([
  ["230.003", 10], // DEBITI_AMMINISTRATORI
  ["220.004", 11], // ERARIO_RITENUTE
  ["220.005", 12], // INPS_CONTRIBUTI
]);

const resolver = new ContoResolver(mockPdcMap);

function asSingle(result: ScritturaGenerata | ScritturaGenerata[]): ScritturaGenerata {
  return Array.isArray(result) ? result[0] : result;
}

describe("generaCompensoAmministratore", () => {
  describe("Compenso semplice con ritenuta 20%", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COMPENSO_AMMINISTRATORE",
        dataOperazione: new Date("2026-03-15"),
        descrizione: "Compenso amministratore Q1 2026",
        importoTotale: 50000,
        importoRitenuta: 10000,
      },
      societaId: 1,
      categoriaContoId: 80, // mock conto for compensi amministratori (330.040)
    };

    it("genera scrittura con dare compenso e avere debiti amm. + ritenute", () => {
      const scrittura = asSingle(generaCompensoAmministratore(input, resolver));

      expect(scrittura.causale).toBe("CA");
      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: compensi amministratori = 50000
      const compensoDare = scrittura.movimenti.find(
        (m) => m.contoId === 80 && m.importoDare > 0
      );
      expect(compensoDare).toBeDefined();
      expect(compensoDare!.importoDare).toBe(50000);

      // Avere: debiti amministratori = 40000 (netto: 50000 - 10000)
      const debitiAvere = scrittura.movimenti.find(
        (m) => m.contoId === 10 && m.importoAvere > 0
      );
      expect(debitiAvere).toBeDefined();
      expect(debitiAvere!.importoAvere).toBe(40000);

      // Avere: erario ritenute = 10000
      const ritenuteAvere = scrittura.movimenti.find(
        (m) => m.contoId === 11 && m.importoAvere > 0
      );
      expect(ritenuteAvere).toBeDefined();
      expect(ritenuteAvere!.importoAvere).toBe(10000);

      // Quadratura
      expect(scrittura.totaleDare).toBe(50000);
      expect(scrittura.totaleAvere).toBe(50000);
      expect(scrittura.warnings).toHaveLength(0);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Compenso con INPS gestione separata", () => {
    // Compenso €50.000, ritenuta €10.000
    // Contributo INPS totale €17.515, di cui 2/3 azienda = €11.676,67
    // 1/3 a carico amministratore = €5.838,33
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COMPENSO_AMMINISTRATORE",
        dataOperazione: new Date("2026-03-15"),
        descrizione: "Compenso amministratore con INPS",
        importoTotale: 50000,
        importoRitenuta: 10000,
        contributoInpsTotale: 17515,
        contributoInpsAzienda: 11676.67,
      } as GeneratoreInput["operazione"] & {
        contributoInpsTotale: number;
        contributoInpsAzienda: number;
      },
      societaId: 1,
      categoriaContoId: 80,
    };

    it("genera 5 movimenti con quadratura corretta", () => {
      const scrittura = asSingle(generaCompensoAmministratore(input, resolver));

      expect(scrittura.causale).toBe("CA");
      expect(scrittura.movimenti).toHaveLength(5);

      // Dare: compensi amministratori = 50000
      const compensoDare = scrittura.movimenti.find(
        (m) => m.contoId === 80 && m.importoDare > 0 && m.descrizione?.includes("Compenso")
      );
      expect(compensoDare).toBeDefined();
      expect(compensoDare!.importoDare).toBe(50000);

      // Dare: contributi INPS c/ditta = 11676.67 (2/3 a carico azienda)
      const inpsCostoDare = scrittura.movimenti.find(
        (m) => m.importoDare > 0 && m.descrizione?.includes("INPS")
      );
      expect(inpsCostoDare).toBeDefined();
      expect(inpsCostoDare!.importoDare).toBe(11676.67);

      // Avere: debiti amministratori = netto = 50000 - 10000 - 5838.33 = 34161.67
      const debitiAvere = scrittura.movimenti.find(
        (m) => m.contoId === 10 && m.importoAvere > 0
      );
      expect(debitiAvere).toBeDefined();
      expect(debitiAvere!.importoAvere).toBeCloseTo(34161.67, 2);

      // Avere: erario ritenute = 10000
      const ritenuteAvere = scrittura.movimenti.find(
        (m) => m.contoId === 11 && m.importoAvere > 0
      );
      expect(ritenuteAvere).toBeDefined();
      expect(ritenuteAvere!.importoAvere).toBe(10000);

      // Avere: INPS contributi = 17515 (intero contributo)
      const inpsAvere = scrittura.movimenti.find(
        (m) => m.contoId === 12 && m.importoAvere > 0
      );
      expect(inpsAvere).toBeDefined();
      expect(inpsAvere!.importoAvere).toBe(17515);

      // Quadratura: Dare = 50000 + 11676.67 = 61676.67
      //             Avere = 34161.67 + 10000 + 17515 = 61676.67
      expect(scrittura.totaleDare).toBeCloseTo(61676.67, 2);
      expect(scrittura.totaleAvere).toBeCloseTo(61676.67, 2);
      expect(scrittura.warnings).toHaveLength(0);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Warning quando conto compenso non risolve", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COMPENSO_AMMINISTRATORE",
        dataOperazione: new Date("2026-03-20"),
        descrizione: "Compenso senza conto",
        importoTotale: 10000,
        importoRitenuta: 2000,
      },
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera warning quando categoriaContoId è null", () => {
      const scrittura = asSingle(generaCompensoAmministratore(input, resolver));

      expect(scrittura.warnings.length).toBeGreaterThan(0);
      // The compenso movement should have contoId null
      const compensoMovimento = scrittura.movimenti.find(
        (m) => m.importoDare > 0 && m.descrizione?.includes("Compenso")
      );
      expect(compensoMovimento).toBeDefined();
      expect(compensoMovimento!.contoId).toBeNull();
    });
  });
});
