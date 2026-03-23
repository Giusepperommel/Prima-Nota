import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaReverseCharge } from "../../generatori/reverse-charge";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

// Mock PdC map matching structural accounts
const mockPdcMap = new Map<string, number>([
  ["130.001", 3],   // IVA_CREDITO
  ["200.001", 4],   // DEBITI_FORNITORI
  ["220.001", 5],   // IVA_DEBITO
  ["220.010", 7],   // IVA_REVERSE_CHARGE
]);

const resolver = new ContoResolver(mockPdcMap);

describe("generaReverseCharge", () => {
  describe("TD17 — Acquisto intra-UE servizi", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2026-01-15"),
        descrizione: "Servizi cloud provider UE",
        importoTotale: 10000,
        importoImponibile: 10000,
        importoIva: 2200,
        aliquotaIva: 22,
        ivaDetraibile: 2200,
        ivaIndetraibile: 0,
        doppiaRegistrazione: true,
      },
      societaId: 1,
      categoriaContoId: 50,
      causaleOverride: "FAUE",
    };

    it("genera due scritture (registro acquisti + registro vendite)", () => {
      const scritture = generaReverseCharge(input, resolver);

      expect(scritture).toHaveLength(2);
    });

    it("scrittura 1 — registro acquisti: dare costo + IVA credito, avere fornitori + reverse charge", () => {
      const scritture = generaReverseCharge(input, resolver);
      const s1 = scritture[0];

      expect(s1.causale).toBe("FAUE");
      expect(s1.movimenti).toHaveLength(4);

      // Dare: costo 10000
      const costoDare = s1.movimenti.find(
        (m) => m.contoId === 50 && m.importoDare > 0
      );
      expect(costoDare).toBeDefined();
      expect(costoDare!.importoDare).toBe(10000);

      // Dare: IVA credito 2200
      const ivaCreditoDare = s1.movimenti.find(
        (m) => m.contoId === 3 && m.importoDare > 0
      );
      expect(ivaCreditoDare).toBeDefined();
      expect(ivaCreditoDare!.importoDare).toBe(2200);

      // Avere: debiti fornitori = imponibile (NOT totale!)
      const fornitoriAvere = s1.movimenti.find(
        (m) => m.contoId === 4 && m.importoAvere > 0
      );
      expect(fornitoriAvere).toBeDefined();
      expect(fornitoriAvere!.importoAvere).toBe(10000);

      // Avere: IVA reverse charge transitorio 2200
      const rcAvere = s1.movimenti.find(
        (m) => m.contoId === 7 && m.importoAvere > 0
      );
      expect(rcAvere).toBeDefined();
      expect(rcAvere!.importoAvere).toBe(2200);

      // Quadratura
      expect(s1.totaleDare).toBe(12200);
      expect(s1.totaleAvere).toBe(12200);
      expect(s1.warnings).toHaveLength(0);

      const validazione = validaScrittura(s1.movimenti);
      expect(validazione.valida).toBe(true);
    });

    it("scrittura 2 — registro vendite: dare reverse charge, avere IVA debito", () => {
      const scritture = generaReverseCharge(input, resolver);
      const s2 = scritture[1];

      expect(s2.movimenti).toHaveLength(2);

      // Dare: IVA reverse charge 2200
      const rcDare = s2.movimenti.find(
        (m) => m.contoId === 7 && m.importoDare > 0
      );
      expect(rcDare).toBeDefined();
      expect(rcDare!.importoDare).toBe(2200);

      // Avere: IVA debito 2200
      const ivaDebitoAvere = s2.movimenti.find(
        (m) => m.contoId === 5 && m.importoAvere > 0
      );
      expect(ivaDebitoAvere).toBeDefined();
      expect(ivaDebitoAvere!.importoAvere).toBe(2200);

      // Quadratura
      expect(s2.totaleDare).toBe(2200);
      expect(s2.totaleAvere).toBe(2200);

      const validazione = validaScrittura(s2.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("TD16 — Reverse charge interno (subappalto)", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2026-02-20"),
        descrizione: "Subappalto lavori edili",
        importoTotale: 15000,
        importoImponibile: 15000,
        importoIva: 3300,
        aliquotaIva: 22,
        ivaDetraibile: 3300,
        ivaIndetraibile: 0,
        doppiaRegistrazione: true,
      },
      societaId: 1,
      categoriaContoId: 80,
      causaleOverride: "FARE",
    };

    it("genera doppia registrazione con causale FARE", () => {
      const scritture = generaReverseCharge(input, resolver);

      expect(scritture).toHaveLength(2);
      expect(scritture[0].causale).toBe("FARE");

      // Scrittura 1: dare costo 15000 + IVA credito 3300, avere fornitori 15000 + RC 3300
      const s1 = scritture[0];
      expect(s1.totaleDare).toBe(18300);
      expect(s1.totaleAvere).toBe(18300);

      const validazione1 = validaScrittura(s1.movimenti);
      expect(validazione1.valida).toBe(true);

      // Scrittura 2: dare RC 3300, avere IVA debito 3300
      const s2 = scritture[1];
      expect(s2.totaleDare).toBe(3300);
      expect(s2.totaleAvere).toBe(3300);

      const validazione2 = validaScrittura(s2.movimenti);
      expect(validazione2.valida).toBe(true);
    });
  });

  describe("IVA_REVERSE_CHARGE chiude a zero", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2026-03-10"),
        descrizione: "Servizio estero reverse charge",
        importoTotale: 5000,
        importoImponibile: 5000,
        importoIva: 1100,
        aliquotaIva: 22,
        ivaDetraibile: 1100,
        ivaIndetraibile: 0,
        doppiaRegistrazione: true,
      },
      societaId: 1,
      categoriaContoId: 90,
    };

    it("il saldo netto di IVA_REVERSE_CHARGE è zero tra le due scritture", () => {
      const scritture = generaReverseCharge(input, resolver);

      // Collect all movements on IVA_REVERSE_CHARGE (contoId 7)
      const allMovimenti = [...scritture[0].movimenti, ...scritture[1].movimenti];
      const rcMovimenti = allMovimenti.filter((m) => m.contoId === 7);

      const totaleDareRC = rcMovimenti.reduce((s, m) => s + m.importoDare, 0);
      const totaleAvereRC = rcMovimenti.reduce((s, m) => s + m.importoAvere, 0);

      // Dare and Avere on reverse charge account must be equal (closes to zero)
      expect(totaleDareRC).toBe(totaleAvereRC);
      expect(totaleDareRC).toBe(1100);
    });
  });

  describe("Warning quando categoria manca", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2026-01-20"),
        descrizione: "Acquisto reverse charge senza categoria",
        importoTotale: 1000,
        importoImponibile: 1000,
        importoIva: 220,
        aliquotaIva: 22,
        ivaDetraibile: 220,
        ivaIndetraibile: 0,
        doppiaRegistrazione: true,
      },
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera warning quando categoriaContoId è null", () => {
      const scritture = generaReverseCharge(input, resolver);

      expect(scritture[0].warnings.length).toBeGreaterThan(0);
      // The cost movement should have contoId null
      const costoMovimento = scritture[0].movimenti.find(
        (m) => m.importoDare > 0 && m.contoId !== 3
      );
      expect(costoMovimento).toBeDefined();
      expect(costoMovimento!.contoId).toBeNull();
    });
  });

  describe("Causale default FARE quando nessun override", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2026-03-15"),
        descrizione: "Reverse charge generico",
        importoTotale: 2000,
        importoImponibile: 2000,
        importoIva: 440,
        aliquotaIva: 22,
        ivaDetraibile: 440,
        ivaIndetraibile: 0,
        doppiaRegistrazione: true,
      },
      societaId: 1,
      categoriaContoId: 50,
    };

    it("usa FARE come causale di default", () => {
      const scritture = generaReverseCharge(input, resolver);

      expect(scritture[0].causale).toBe("FARE");
    });
  });
});
