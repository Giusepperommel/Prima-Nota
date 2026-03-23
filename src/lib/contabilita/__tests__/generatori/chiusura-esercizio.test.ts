import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaChiusuraEsercizio } from "../../generatori/chiusura-esercizio";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";
import type { ContoEconomicoInput } from "../../generatori/chiusura-esercizio";

// Mock PdC map — structural accounts
const mockPdcMap = new Map<string, number>([
  ["900.001", 900],  // CONTO_ECONOMICO
  ["270.010", 901],  // UTILE_ESERCIZIO
]);

const resolver = new ContoResolver(mockPdcMap);

function makeInput(contiEconomici: ContoEconomicoInput[]): GeneratoreInput {
  return {
    operazione: {
      tipoOperazione: "CHIUSURA",
      dataOperazione: new Date("2026-12-31"),
      descrizione: "Chiusura esercizio 2026",
      importoTotale: 0,
      contiEconomici,
    } as any,
    societaId: 1,
    categoriaContoId: null,
  };
}

describe("generaChiusuraEsercizio", () => {
  describe("Chiusura con utile (ricavi > costi)", () => {
    const contiEconomici: ContoEconomicoInput[] = [
      { contoId: 10, codice: "310.001", saldo: 50000, tipo: "COSTO" },
      { contoId: 11, codice: "340.001", saldo: 30000, tipo: "COSTO" },
      { contoId: 20, codice: "400.001", saldo: 70000, tipo: "RICAVO" },
      { contoId: 21, codice: "410.001", saldo: 30000, tipo: "RICAVO" },
    ];

    const input = makeInput(contiEconomici);
    let scritture: ScritturaGenerata[];

    it("genera 3 scritture", () => {
      scritture = generaChiusuraEsercizio(input, resolver);
      expect(scritture).toHaveLength(3);
    });

    it("scrittura 1: chiude conti di costo a CONTO_ECONOMICO", () => {
      const s = scritture[0];
      expect(s.causale).toBe("SC");
      expect(s.descrizione).toContain("Chiusura conti di costo");

      // Dare: CONTO_ECONOMICO = 80.000
      const dareMovimenti = s.movimenti.filter(m => m.importoDare > 0);
      expect(dareMovimenti).toHaveLength(1);
      expect(dareMovimenti[0].contoId).toBe(900); // CONTO_ECONOMICO
      expect(dareMovimenti[0].importoDare).toBe(80000);

      // Avere: each cost account closes to zero
      const avereMovimenti = s.movimenti.filter(m => m.importoAvere > 0);
      expect(avereMovimenti).toHaveLength(2);
      expect(avereMovimenti.find(m => m.contoId === 10)?.importoAvere).toBe(50000);
      expect(avereMovimenti.find(m => m.contoId === 11)?.importoAvere).toBe(30000);

      expect(s.totaleDare).toBe(80000);
      expect(s.totaleAvere).toBe(80000);

      const v = validaScrittura(s.movimenti);
      expect(v.valida).toBe(true);
    });

    it("scrittura 2: chiude conti di ricavo a CONTO_ECONOMICO", () => {
      const s = scritture[1];
      expect(s.causale).toBe("SC");
      expect(s.descrizione).toContain("Chiusura conti di ricavo");

      // Dare: each revenue account closes to zero
      const dareMovimenti = s.movimenti.filter(m => m.importoDare > 0);
      expect(dareMovimenti).toHaveLength(2);
      expect(dareMovimenti.find(m => m.contoId === 20)?.importoDare).toBe(70000);
      expect(dareMovimenti.find(m => m.contoId === 21)?.importoDare).toBe(30000);

      // Avere: CONTO_ECONOMICO = 100.000
      const avereMovimenti = s.movimenti.filter(m => m.importoAvere > 0);
      expect(avereMovimenti).toHaveLength(1);
      expect(avereMovimenti[0].contoId).toBe(900);
      expect(avereMovimenti[0].importoAvere).toBe(100000);

      expect(s.totaleDare).toBe(100000);
      expect(s.totaleAvere).toBe(100000);

      const v = validaScrittura(s.movimenti);
      expect(v.valida).toBe(true);
    });

    it("scrittura 3: determina utile 20.000", () => {
      const s = scritture[2];
      expect(s.causale).toBe("SC");
      expect(s.descrizione).toContain("Determinazione risultato");

      // Dare: CONTO_ECONOMICO = 20.000 (utile)
      const dareMovimenti = s.movimenti.filter(m => m.importoDare > 0);
      expect(dareMovimenti).toHaveLength(1);
      expect(dareMovimenti[0].contoId).toBe(900);
      expect(dareMovimenti[0].importoDare).toBe(20000);

      // Avere: UTILE_ESERCIZIO = 20.000
      const avereMovimenti = s.movimenti.filter(m => m.importoAvere > 0);
      expect(avereMovimenti).toHaveLength(1);
      expect(avereMovimenti[0].contoId).toBe(901);
      expect(avereMovimenti[0].importoAvere).toBe(20000);

      const v = validaScrittura(s.movimenti);
      expect(v.valida).toBe(true);
    });

    it("CONTO_ECONOMICO netto chiude a zero dopo tutte le scritture", () => {
      // CE receives:
      // Scrittura 1: Dare 80.000 (costi)
      // Scrittura 2: Avere 100.000 (ricavi)
      // Scrittura 3: Dare 20.000 (utile)
      // Net: Dare 100.000, Avere 100.000 → zero
      let dareTotale = 0;
      let avereTotale = 0;
      for (const s of scritture) {
        for (const m of s.movimenti) {
          if (m.contoId === 900) {
            dareTotale += m.importoDare;
            avereTotale += m.importoAvere;
          }
        }
      }
      expect(dareTotale).toBe(avereTotale);
    });
  });

  describe("Chiusura con perdita (costi > ricavi)", () => {
    const contiEconomici: ContoEconomicoInput[] = [
      { contoId: 10, codice: "310.001", saldo: 60000, tipo: "COSTO" },
      { contoId: 11, codice: "340.001", saldo: 40000, tipo: "COSTO" },
      { contoId: 20, codice: "400.001", saldo: 50000, tipo: "RICAVO" },
      { contoId: 21, codice: "410.001", saldo: 30000, tipo: "RICAVO" },
    ];

    const input = makeInput(contiEconomici);
    let scritture: ScritturaGenerata[];

    it("genera 3 scritture", () => {
      scritture = generaChiusuraEsercizio(input, resolver);
      expect(scritture).toHaveLength(3);
    });

    it("scrittura 1: chiude costi 100.000", () => {
      const s = scritture[0];
      expect(s.totaleDare).toBe(100000);
      expect(s.totaleAvere).toBe(100000);

      const v = validaScrittura(s.movimenti);
      expect(v.valida).toBe(true);
    });

    it("scrittura 2: chiude ricavi 80.000", () => {
      const s = scritture[1];
      expect(s.totaleDare).toBe(80000);
      expect(s.totaleAvere).toBe(80000);

      const v = validaScrittura(s.movimenti);
      expect(v.valida).toBe(true);
    });

    it("scrittura 3: determina perdita 20.000", () => {
      const s = scritture[2];
      expect(s.descrizione).toContain("Determinazione risultato");

      // Dare: UTILE_ESERCIZIO = 20.000 (perdita)
      const dareMovimenti = s.movimenti.filter(m => m.importoDare > 0);
      expect(dareMovimenti).toHaveLength(1);
      expect(dareMovimenti[0].contoId).toBe(901); // UTILE_ESERCIZIO
      expect(dareMovimenti[0].importoDare).toBe(20000);

      // Avere: CONTO_ECONOMICO = 20.000
      const avereMovimenti = s.movimenti.filter(m => m.importoAvere > 0);
      expect(avereMovimenti).toHaveLength(1);
      expect(avereMovimenti[0].contoId).toBe(900);
      expect(avereMovimenti[0].importoAvere).toBe(20000);

      const v = validaScrittura(s.movimenti);
      expect(v.valida).toBe(true);
    });

    it("CONTO_ECONOMICO netto chiude a zero dopo tutte le scritture", () => {
      let dareTotale = 0;
      let avereTotale = 0;
      for (const s of scritture) {
        for (const m of s.movimenti) {
          if (m.contoId === 900) {
            dareTotale += m.importoDare;
            avereTotale += m.importoAvere;
          }
        }
      }
      expect(dareTotale).toBe(avereTotale);
    });
  });

  describe("Ogni conto di costo chiude a zero", () => {
    const contiEconomici: ContoEconomicoInput[] = [
      { contoId: 10, codice: "310.001", saldo: 25000, tipo: "COSTO" },
      { contoId: 11, codice: "340.001", saldo: 15000, tipo: "COSTO" },
      { contoId: 12, codice: "350.001", saldo: 10000, tipo: "COSTO" },
      { contoId: 20, codice: "400.001", saldo: 60000, tipo: "RICAVO" },
    ];

    it("ogni conto costo ha un avere pari al suo saldo", () => {
      const scritture = generaChiusuraEsercizio(makeInput(contiEconomici), resolver);
      const s1 = scritture[0]; // chiusura costi

      for (const conto of contiEconomici.filter(c => c.tipo === "COSTO")) {
        const mov = s1.movimenti.find(m => m.contoId === conto.contoId && m.importoAvere > 0);
        expect(mov).toBeDefined();
        expect(mov!.importoAvere).toBe(conto.saldo);
      }
    });
  });

  describe("Warning quando nessun conto economico fornito", () => {
    it("genera warning e scrittura vuota", () => {
      const scritture = generaChiusuraEsercizio(makeInput([]), resolver);
      expect(scritture).toHaveLength(1);
      expect(scritture[0].warnings.length).toBeGreaterThan(0);
      expect(scritture[0].warnings[0]).toContain("Nessun conto economico fornito");
      expect(scritture[0].movimenti).toHaveLength(0);
    });
  });

  describe("Pareggio (costi = ricavi)", () => {
    const contiEconomici: ContoEconomicoInput[] = [
      { contoId: 10, codice: "310.001", saldo: 50000, tipo: "COSTO" },
      { contoId: 20, codice: "400.001", saldo: 50000, tipo: "RICAVO" },
    ];

    it("scrittura 3 non ha movimenti quando utile/perdita = 0", () => {
      const scritture = generaChiusuraEsercizio(makeInput(contiEconomici), resolver);
      expect(scritture).toHaveLength(3);
      // Third scrittura has no movimenti (no utile/perdita)
      expect(scritture[2].movimenti).toHaveLength(0);
    });
  });
});
