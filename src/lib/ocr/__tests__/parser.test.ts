// src/lib/ocr/__tests__/parser.test.ts
import { describe, it, expect } from "vitest";
import { parseDocumentText } from "../parser";

describe("parseDocumentText", () => {
  it("estrae data in formato DD/MM/YYYY", () => {
    const result = parseDocumentText("Fattura del 15/03/2026");
    expect(result.dataOperazione).toBe("2026-03-15");
  });

  it("estrae numero fattura", () => {
    const result = parseDocumentText("Fattura n. 123/2026");
    expect(result.numeroDocumento).toBe("123/2026");
  });

  it("estrae importo totale con simbolo euro", () => {
    const result = parseDocumentText("Totale € 1.234,56");
    expect(result.importoTotale).toBe(1234.56);
  });

  it("estrae importo totale senza simbolo", () => {
    const result = parseDocumentText("Totale: 500,00");
    expect(result.importoTotale).toBe(500.0);
  });

  it("estrae imponibile", () => {
    const result = parseDocumentText("Imponibile € 1.000,00\nIVA 22% € 220,00\nTotale € 1.220,00");
    expect(result.imponibile).toBe(1000.0);
    expect(result.aliquotaIva).toBe("22");
    expect(result.importoIva).toBe(220.0);
    expect(result.importoTotale).toBe(1220.0);
  });

  it("estrae aliquota IVA dal testo", () => {
    const result = parseDocumentText("IVA 10%");
    expect(result.aliquotaIva).toBe("10");
  });

  it("riconosce aliquota IVA 4%", () => {
    const result = parseDocumentText("IVA al 4%");
    expect(result.aliquotaIva).toBe("4");
  });

  it("estrae fornitore da ragione sociale", () => {
    const result = parseDocumentText("Mario Rossi S.r.l.\nVia Roma 1\nFattura n. 42");
    expect(result.fornitore).not.toBeNull();
  });

  it("costruisce descrizione da fornitore e numero documento", () => {
    const text = "ACME S.r.l.\nFattura n. 99/2026\nTotale € 100,00";
    const result = parseDocumentText(text);
    expect(result.descrizione).toContain("99/2026");
  });

  it("imposta tipoOperazione COSTO di default", () => {
    const result = parseDocumentText("Totale € 100,00");
    expect(result.tipoOperazione).toBe("COSTO");
  });

  it("restituisce null per campi non trovati", () => {
    const result = parseDocumentText("testo casuale senza dati");
    expect(result.importoTotale).toBeNull();
    expect(result.numeroDocumento).toBeNull();
    expect(result.dataOperazione).toBeNull();
  });

  it("gestisce importi con punto come separatore migliaia", () => {
    const result = parseDocumentText("Totale € 12.500,00");
    expect(result.importoTotale).toBe(12500.0);
  });

  it("gestisce importi senza centesimi", () => {
    const result = parseDocumentText("Totale € 500");
    expect(result.importoTotale).toBe(500);
  });
});
