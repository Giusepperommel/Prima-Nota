import { describe, it, expect } from "vitest";
import { ContoResolver } from "../../conto-resolver";
import { generaOperazioneGenerica } from "../../generatori/operazione-generica";
import { validaScrittura } from "../../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../../types";

const mockPdcMap = new Map<string, number>();
const resolver = new ContoResolver(mockPdcMap);

function asSingle(result: ScritturaGenerata | ScritturaGenerata[]): ScritturaGenerata {
  return Array.isArray(result) ? result[0] : result;
}

describe("generaOperazioneGenerica", () => {
  describe("Con movimenti espliciti", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "GENERICO",
        dataOperazione: new Date("2026-03-20"),
        descrizione: "Scrittura manuale commercialista",
        importoTotale: 1500,
        movimenti: [
          { contoId: 100, importoDare: 1500, importoAvere: 0, descrizione: "Dare manuale", ordine: 1 },
          { contoId: 200, importoDare: 0, importoAvere: 1500, descrizione: "Avere manuale", ordine: 2 },
        ],
      } as any,
      societaId: 1,
      categoriaContoId: null,
    };

    it("passa attraverso i movimenti forniti", () => {
      const scrittura = asSingle(generaOperazioneGenerica(input, resolver));

      expect(scrittura.causale).toBe("OG");
      expect(scrittura.movimenti).toHaveLength(2);

      expect(scrittura.movimenti[0].contoId).toBe(100);
      expect(scrittura.movimenti[0].importoDare).toBe(1500);

      expect(scrittura.movimenti[1].contoId).toBe(200);
      expect(scrittura.movimenti[1].importoAvere).toBe(1500);

      expect(scrittura.totaleDare).toBe(1500);
      expect(scrittura.totaleAvere).toBe(1500);
      expect(scrittura.warnings).toHaveLength(0);

      const validazione = validaScrittura(scrittura.movimenti);
      expect(validazione.valida).toBe(true);
    });
  });

  describe("Senza movimenti espliciti", () => {
    const input: GeneratoreInput = {
      operazione: {
        tipoOperazione: "GENERICO",
        dataOperazione: new Date("2026-03-20"),
        descrizione: "Operazione senza movimenti",
        importoTotale: 0,
      },
      societaId: 1,
      categoriaContoId: null,
    };

    it("restituisce scrittura vuota con warning", () => {
      const scrittura = asSingle(generaOperazioneGenerica(input, resolver));

      expect(scrittura.causale).toBe("OG");
      expect(scrittura.movimenti).toHaveLength(0);
      expect(scrittura.totaleDare).toBe(0);
      expect(scrittura.totaleAvere).toBe(0);
      expect(scrittura.warnings.length).toBeGreaterThan(0);
      expect(scrittura.warnings[0]).toContain("Nessun movimento esplicito");
    });
  });
});
