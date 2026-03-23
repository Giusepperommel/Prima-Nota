import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaFatturaAttiva } from "../../generatori/fattura-attiva";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

// Mock PdC map matching structural accounts
const mockPdcMap = new Map<string, number>([
  ["110.001", 10],  // CREDITI_CLIENTI
  ["220.001", 20],  // IVA_DEBITO
  ["420.010", 30],  // RIMBORSO_BOLLI
  ["100.010", 40],  // BANCA_CC
]);

const resolver = new ContoResolver(mockPdcMap);

function asSingle(result: ScritturaGenerata | ScritturaGenerata[]): ScritturaGenerata {
  return Array.isArray(result) ? result[0] : result;
}

describe("generaFatturaAttiva", () => {
  describe("FV — vendita con IVA 22%", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "FATTURA_ATTIVA",
        dataOperazione: new Date("2026-01-15"),
        descrizione: "Vendita servizi consulenza",
        importoTotale: 1220,
        importoImponibile: 1000,
        importoIva: 220,
        aliquotaIva: 22,
      },
      societaId: 1,
      categoriaContoId: 50,
    };

    it("genera scrittura con dare crediti clienti e avere ricavo + IVA debito", () => {
      const scrittura = asSingle(generaFatturaAttiva(input, resolver));

      expect(scrittura.causale).toBe("FV");
      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: crediti clienti 1220
      const creditiDare = scrittura.movimenti.find(
        (m) => m.contoId === 10 && m.importoDare > 0
      );
      expect(creditiDare).toBeDefined();
      expect(creditiDare!.importoDare).toBe(1220);

      // Avere: ricavo 1000
      const ricavoAvere = scrittura.movimenti.find(
        (m) => m.contoId === 50 && m.importoAvere > 0
      );
      expect(ricavoAvere).toBeDefined();
      expect(ricavoAvere!.importoAvere).toBe(1000);

      // Avere: IVA debito 220
      const ivaAvere = scrittura.movimenti.find(
        (m) => m.contoId === 20 && m.importoAvere > 0
      );
      expect(ivaAvere).toBeDefined();
      expect(ivaAvere!.importoAvere).toBe(220);

      // Quadratura
      expect(scrittura.totaleDare).toBe(1220);
      expect(scrittura.totaleAvere).toBe(1220);
      expect(scrittura.warnings).toHaveLength(0);

      // Validates with validaScrittura
      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("FV — esente IVA con bollo virtuale", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "FATTURA_ATTIVA",
        dataOperazione: new Date("2026-02-10"),
        descrizione: "Prestazione esente art. 10",
        importoTotale: 500,
        importoImponibile: 500,
        importoIva: 0,
        aliquotaIva: 0,
        bolloVirtuale: true,
        importoBollo: 2,
      },
      societaId: 1,
      categoriaContoId: 50,
    };

    it("registra rimborso bolli invece di IVA", () => {
      const scrittura = asSingle(generaFatturaAttiva(input, resolver));

      expect(scrittura.causale).toBe("FV");
      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: crediti clienti = imponibile + bollo = 502
      const creditiDare = scrittura.movimenti.find(
        (m) => m.contoId === 10 && m.importoDare > 0
      );
      expect(creditiDare).toBeDefined();
      expect(creditiDare!.importoDare).toBe(502);

      // Avere: ricavo 500
      const ricavoAvere = scrittura.movimenti.find(
        (m) => m.contoId === 50 && m.importoAvere > 0
      );
      expect(ricavoAvere).toBeDefined();
      expect(ricavoAvere!.importoAvere).toBe(500);

      // Avere: rimborso bolli 2
      const bolliAvere = scrittura.movimenti.find(
        (m) => m.contoId === 30 && m.importoAvere > 0
      );
      expect(bolliAvere).toBeDefined();
      expect(bolliAvere!.importoAvere).toBe(2);

      // Quadratura
      expect(scrittura.totaleDare).toBe(502);
      expect(scrittura.totaleAvere).toBe(502);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("FVS — split payment", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "FATTURA_ATTIVA",
        dataOperazione: new Date("2026-03-01"),
        descrizione: "Vendita a Pubblica Amministrazione",
        importoTotale: 1220,
        importoImponibile: 1000,
        importoIva: 220,
        aliquotaIva: 22,
      },
      societaId: 1,
      categoriaContoId: 50,
      causaleOverride: "FVS",
    };

    it("credito clienti = solo imponibile, nessun movimento IVA", () => {
      const scrittura = asSingle(generaFatturaAttiva(input, resolver));

      expect(scrittura.causale).toBe("FVS");
      expect(scrittura.movimenti).toHaveLength(2);

      // Dare: crediti clienti = importoImponibile only (PA pays IVA to Erario)
      const creditiDare = scrittura.movimenti.find(
        (m) => m.contoId === 10 && m.importoDare > 0
      );
      expect(creditiDare).toBeDefined();
      expect(creditiDare!.importoDare).toBe(1000);

      // Avere: ricavo 1000
      const ricavoAvere = scrittura.movimenti.find(
        (m) => m.contoId === 50 && m.importoAvere > 0
      );
      expect(ricavoAvere).toBeDefined();
      expect(ricavoAvere!.importoAvere).toBe(1000);

      // No IVA movement
      const ivaMovimento = scrittura.movimenti.find(
        (m) => m.contoId === 20
      );
      expect(ivaMovimento).toBeUndefined();

      // Quadratura
      expect(scrittura.totaleDare).toBe(1000);
      expect(scrittura.totaleAvere).toBe(1000);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("NCV — nota credito emessa", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "FATTURA_ATTIVA",
        dataOperazione: new Date("2026-02-28"),
        descrizione: "Nota credito su fattura 456",
        importoTotale: 610,
        importoImponibile: 500,
        importoIva: 110,
        aliquotaIva: 22,
      },
      societaId: 1,
      categoriaContoId: 50,
      causaleOverride: "NCV",
    };

    it("inverte dare/avere rispetto alla fattura vendita", () => {
      const scrittura = asSingle(generaFatturaAttiva(input, resolver));

      expect(scrittura.causale).toBe("NCV");
      expect(scrittura.movimenti).toHaveLength(3);

      // Dare: ricavo (storno) 500
      const ricavoDare = scrittura.movimenti.find(
        (m) => m.contoId === 50 && m.importoDare > 0
      );
      expect(ricavoDare).toBeDefined();
      expect(ricavoDare!.importoDare).toBe(500);

      // Dare: IVA debito (storno) 110
      const ivaDare = scrittura.movimenti.find(
        (m) => m.contoId === 20 && m.importoDare > 0
      );
      expect(ivaDare).toBeDefined();
      expect(ivaDare!.importoDare).toBe(110);

      // Avere: crediti clienti 610
      const creditiAvere = scrittura.movimenti.find(
        (m) => m.contoId === 10 && m.importoAvere > 0
      );
      expect(creditiAvere).toBeDefined();
      expect(creditiAvere!.importoAvere).toBe(610);

      // Quadratura
      expect(scrittura.totaleDare).toBe(610);
      expect(scrittura.totaleAvere).toBe(610);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("FV — con incasso immediato (statoPagamentoFattura='PAGATO')", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "FATTURA_ATTIVA",
        dataOperazione: new Date("2026-01-20"),
        descrizione: "Vendita con incasso immediato",
        importoTotale: 1220,
        importoImponibile: 1000,
        importoIva: 220,
        aliquotaIva: 22,
        statoPagamentoFattura: "PAGATO",
      },
      societaId: 1,
      categoriaContoId: 50,
    };

    it("restituisce array di 2 scritture: fattura + incasso", () => {
      const result = generaFatturaAttiva(input, resolver);
      expect(Array.isArray(result)).toBe(true);

      const scritture = result as ScritturaGenerata[];
      expect(scritture).toHaveLength(2);

      // Prima scrittura: FV standard
      const fv = scritture[0];
      expect(fv.causale).toBe("FV");
      expect(fv.movimenti).toHaveLength(3);
      expect(fv.totaleDare).toBe(1220);
      expect(fv.totaleAvere).toBe(1220);

      // Seconda scrittura: incasso
      const incasso = scritture[1];
      expect(incasso.causale).toBe("IN");
      expect(incasso.movimenti).toHaveLength(2);

      // Dare: banca 1220
      const bancaDare = incasso.movimenti.find(
        (m) => m.contoId === 40 && m.importoDare > 0
      );
      expect(bancaDare).toBeDefined();
      expect(bancaDare!.importoDare).toBe(1220);

      // Avere: crediti clienti 1220
      const creditiAvere = incasso.movimenti.find(
        (m) => m.contoId === 10 && m.importoAvere > 0
      );
      expect(creditiAvere).toBeDefined();
      expect(creditiAvere!.importoAvere).toBe(1220);

      // Quadratura incasso
      expect(incasso.totaleDare).toBe(1220);
      expect(incasso.totaleAvere).toBe(1220);

      const validazione1 = validaScrittura(fv.movimenti);
      expect(validazione1.valida).toBe(true);
      const validazione2 = validaScrittura(incasso.movimenti);
      expect(validazione2.valida).toBe(true);
    });

    it("split payment con incasso immediato: incasso = importoImponibile", () => {
      const splitInput: GeneratoreInput = {
        operazione: {
          tipoOperazione: "FATTURA_ATTIVA",
          dataOperazione: new Date("2026-03-10"),
          descrizione: "Vendita PA con incasso",
          importoTotale: 1220,
          importoImponibile: 1000,
          importoIva: 220,
          aliquotaIva: 22,
          statoPagamentoFattura: "PAGATO",
        },
        societaId: 1,
        categoriaContoId: 50,
        causaleOverride: "FVS",
      };

      const result = generaFatturaAttiva(splitInput, resolver);
      const scritture = result as ScritturaGenerata[];
      expect(scritture).toHaveLength(2);

      const incasso = scritture[1];
      expect(incasso.causale).toBe("IN");

      // Incasso = importoImponibile for split payment
      const bancaDare = incasso.movimenti.find(
        (m) => m.contoId === 40 && m.importoDare > 0
      );
      expect(bancaDare!.importoDare).toBe(1000);

      const creditiAvere = incasso.movimenti.find(
        (m) => m.contoId === 10 && m.importoAvere > 0
      );
      expect(creditiAvere!.importoAvere).toBe(1000);
    });
  });

  describe("Warning quando categoria manca", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "FATTURA_ATTIVA",
        dataOperazione: new Date("2026-01-20"),
        descrizione: "Vendita generica",
        importoTotale: 1220,
        importoImponibile: 1000,
        importoIva: 220,
        aliquotaIva: 22,
      },
      societaId: 1,
      categoriaContoId: null,
    };

    it("genera warning quando categoriaContoId e' null", () => {
      const scrittura = asSingle(generaFatturaAttiva(input, resolver));

      expect(scrittura.warnings.length).toBeGreaterThan(0);
      // The ricavo movement should have contoId null
      const ricavoMovimento = scrittura.movimenti.find(
        (m) => m.importoAvere > 0 && m.contoId !== 20
      );
      expect(ricavoMovimento).toBeDefined();
      expect(ricavoMovimento!.contoId).toBeNull();
    });
  });
});
