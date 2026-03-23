import { describe, it, expect } from "vitest";
import { generaScritture } from "../motore-scritture";
import { PIANO_DEI_CONTI_DEFAULT } from "../../piano-dei-conti-default";

// Build a mock PdC map from the actual default data
// Since we don't have DB IDs, use the array index + 1 as ID
const mockPdcMap = new Map<string, number>();
PIANO_DEI_CONTI_DEFAULT.forEach((conto, index) => {
  mockPdcMap.set(conto.codice, index + 1);
});

// Helper to find contoId by codice
const getContoId = (codice: string) => mockPdcMap.get(codice)!;

describe("Integration — Full generation flow", () => {
  it("COSTO generates balanced scrittura", () => {
    const result = generaScritture({
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2025-06-15"),
        descrizione: "Consulenza professionale",
        importoTotale: 6100,
        importoImponibile: 5000,
        importoIva: 1100,
        ivaDetraibile: 1100,
        ivaIndetraibile: 0,
      },
      societaId: 1,
      categoriaContoId: getContoId("310.001"),
    }, mockPdcMap);

    expect(result.success).toBe(true);
    expect(result.scritture).toHaveLength(1);
    expect(result.scritture[0].stato).toBe("DEFINITIVA");
    expect(result.scritture[0].totaleDare).toBeCloseTo(6100, 1);
    expect(result.scritture[0].totaleAvere).toBeCloseTo(6100, 1);
  });

  it("FATTURA_ATTIVA generates balanced scrittura", () => {
    const result = generaScritture({
      operazione: {
        tipoOperazione: "FATTURA_ATTIVA",
        dataOperazione: new Date("2025-06-15"),
        descrizione: "Vendita servizi",
        importoTotale: 12200,
        importoImponibile: 10000,
        importoIva: 2200,
      },
      societaId: 1,
      categoriaContoId: getContoId("400.001"),
    }, mockPdcMap);

    expect(result.success).toBe(true);
    expect(result.scritture.length).toBeGreaterThanOrEqual(1);
    for (const s of result.scritture) {
      expect(s.totaleDare).toBeCloseTo(s.totaleAvere, 1);
    }
  });

  it("Reverse charge generates 2 balanced scritture", () => {
    const result = generaScritture({
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2025-06-15"),
        descrizione: "Servizi UE",
        importoTotale: 10000,
        importoImponibile: 10000,
        importoIva: 2200,
        ivaDetraibile: 2200,
        ivaIndetraibile: 0,
      },
      societaId: 1,
      categoriaContoId: getContoId("310.001"),
      isReverseCharge: true,
      tipoDocumentoSdi: "TD17",
    }, mockPdcMap);

    expect(result.success).toBe(true);
    expect(result.scritture).toHaveLength(2);
    for (const s of result.scritture) {
      expect(s.totaleDare).toBeCloseTo(s.totaleAvere, 1);
    }
  });

  it("COMPENSO_AMMINISTRATORE generates balanced scrittura", () => {
    const result = generaScritture({
      operazione: {
        tipoOperazione: "COMPENSO_AMMINISTRATORE",
        dataOperazione: new Date("2025-06-15"),
        descrizione: "Compenso admin Q2",
        importoTotale: 50000,
        importoRitenuta: 10000,
      },
      societaId: 1,
      categoriaContoId: getContoId("330.040"),
    }, mockPdcMap);

    expect(result.success).toBe(true);
    expect(result.scritture).toHaveLength(1);
    expect(result.scritture[0].totaleDare).toBeCloseTo(result.scritture[0].totaleAvere, 1);
  });

  it("PAGAMENTO_IMPOSTE generates balanced scrittura", () => {
    const result = generaScritture({
      operazione: {
        tipoOperazione: "PAGAMENTO_IMPOSTE",
        dataOperazione: new Date("2025-06-16"),
        descrizione: "F24 ritenute",
        importoTotale: 5000,
      },
      societaId: 1,
      categoriaContoId: null,
    }, mockPdcMap);

    expect(result.success).toBe(true);
    expect(result.scritture).toHaveLength(1);
    expect(result.scritture[0].totaleDare).toBeCloseTo(result.scritture[0].totaleAvere, 1);
  });

  it("DISTRIBUZIONE_DIVIDENDI generates balanced scrittura", () => {
    const result = generaScritture({
      operazione: {
        tipoOperazione: "DISTRIBUZIONE_DIVIDENDI",
        dataOperazione: new Date("2025-06-15"),
        descrizione: "Dividendi 2024",
        importoTotale: 100000,
        importoRitenuta: 26000,
      },
      societaId: 1,
      categoriaContoId: null,
    }, mockPdcMap);

    expect(result.success).toBe(true);
    expect(result.scritture).toHaveLength(1);
    expect(result.scritture[0].totaleDare).toBeCloseTo(result.scritture[0].totaleAvere, 1);
  });

  it("Missing categoriaContoId produces PROVVISORIA", () => {
    const result = generaScritture({
      operazione: {
        tipoOperazione: "COSTO",
        dataOperazione: new Date("2025-06-15"),
        descrizione: "Spesa senza categoria",
        importoTotale: 1000,
        importoImponibile: 1000,
      },
      societaId: 1,
      categoriaContoId: null,
    }, mockPdcMap);

    expect(result.scritture.length).toBeGreaterThanOrEqual(1);
    expect(result.scritture[0].stato).toBe("PROVVISORIA");
    expect(result.scritture[0].warnings.length).toBeGreaterThan(0);
  });

  it("All operation types produce balanced entries", () => {
    const types = [
      { tipo: "COSTO", categoriaContoId: getContoId("310.001") },
      { tipo: "FATTURA_ATTIVA", categoriaContoId: getContoId("400.001") },
      { tipo: "COMPENSO_AMMINISTRATORE", categoriaContoId: getContoId("330.040") },
      { tipo: "PAGAMENTO_IMPOSTE", categoriaContoId: null },
      { tipo: "DISTRIBUZIONE_DIVIDENDI", categoriaContoId: null },
    ];

    for (const { tipo, categoriaContoId } of types) {
      const result = generaScritture({
        operazione: {
          tipoOperazione: tipo,
          dataOperazione: new Date("2025-01-01"),
          descrizione: `Test ${tipo}`,
          importoTotale: 10000,
          importoImponibile: tipo === "COSTO" || tipo === "FATTURA_ATTIVA" ? 8196.72 : undefined,
          importoIva: tipo === "COSTO" || tipo === "FATTURA_ATTIVA" ? 1803.28 : undefined,
          ivaDetraibile: tipo === "COSTO" ? 1803.28 : undefined,
          ivaIndetraibile: tipo === "COSTO" ? 0 : undefined,
          importoRitenuta: tipo === "COMPENSO_AMMINISTRATORE" ? 2000 : tipo === "DISTRIBUZIONE_DIVIDENDI" ? 2600 : undefined,
        },
        societaId: 1,
        categoriaContoId,
      }, mockPdcMap);

      for (const s of result.scritture) {
        expect(Math.abs(s.totaleDare - s.totaleAvere)).toBeLessThan(0.03);
      }
    }
  });
});
