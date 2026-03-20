import { describe, it, expect } from "vitest";
import { buildAutofatturaData } from "../autofattura";

describe("buildAutofatturaData", () => {
  it("genera integrazione TD18 per acquisto beni UE", () => {
    const result = buildAutofatturaData({ descrizioneOriginale: "Acquisto componenti", importoImponibile: 1000, tipoDocumentoAutofattura: "TD18", aliquotaIva: 22, tipoMerce: "BENI", doppiaRegistrazione: true });
    expect(result.descrizione).toBe("Integrazione TD18 - Acquisto componenti");
    expect(result.importoImponibile).toBe(1000);
    expect(result.importoIva).toBe(220);
    expect(result.tipoDocumentoSdi).toBe("TD18");
    expect(result.doppiaRegistrazione).toBe(true);
    expect(result.registroIva).toBe("ACQUISTI");
  });
  it("genera comunicazione TD28 per San Marino con IVA", () => {
    const result = buildAutofatturaData({ descrizioneOriginale: "Acquisto da SM", importoImponibile: 500, tipoDocumentoAutofattura: "TD28", aliquotaIva: 22, tipoMerce: "BENI", doppiaRegistrazione: false });
    expect(result.tipoDocumentoSdi).toBe("TD28");
    expect(result.doppiaRegistrazione).toBe(false);
  });
  it("calcola importo IVA corretto con aliquota ridotta", () => {
    const result = buildAutofatturaData({ descrizioneOriginale: "Alimentari", importoImponibile: 1000, tipoDocumentoAutofattura: "TD18", aliquotaIva: 10, tipoMerce: "BENI", doppiaRegistrazione: true });
    expect(result.importoIva).toBe(100);
  });
  it("tronca descrizione lunga", () => {
    const longDesc = "A".repeat(300);
    const result = buildAutofatturaData({ descrizioneOriginale: longDesc, importoImponibile: 100, tipoDocumentoAutofattura: "TD17", aliquotaIva: 22, tipoMerce: "SERVIZI", doppiaRegistrazione: true });
    expect(result.descrizione.length).toBeLessThanOrEqual(255);
  });
});
