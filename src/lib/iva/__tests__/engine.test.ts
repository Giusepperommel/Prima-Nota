import { describe, it, expect } from "vitest";
import { processIva } from "../engine";

describe("IVA Engine — processIva", () => {
  it("acquisto domestico ordinario → nessuna autofattura", () => {
    const result = processIva({
      nazioneFornitore: "IT", tipoMerce: "SERVIZI", tipoOperazione: "COSTO",
      aliquotaIva: 22, descrizione: "Consulenza", importoImponibile: 1000,
    });
    expect(result.classification.richiedeAutofattura).toBe(false);
    expect(result.autofattura).toBeNull();
    expect(result.validationWarnings).toHaveLength(0);
    expect(result.plafondResult).toBeNull();
    expect(result.splafonamentoAutofattura).toBeNull();
  });

  it("acquisto beni da DE → autofattura TD18 + doppia reg", () => {
    const result = processIva({
      nazioneFornitore: "DE", tipoMerce: "BENI", tipoOperazione: "COSTO",
      descrizione: "Componenti elettronici", importoImponibile: 1000,
    });
    expect(result.classification.richiedeAutofattura).toBe(true);
    expect(result.classification.tipoDocumentoAutofattura).toBe("TD18");
    expect(result.autofattura).not.toBeNull();
    expect(result.autofattura!.importoIva).toBe(220);
    expect(result.autofattura!.doppiaRegistrazione).toBe(true);
  });

  it("vendita a cliente FR servizi → N2.1, no autofattura", () => {
    const result = processIva({
      nazioneFornitore: "FR", tipoMerce: "SERVIZI", tipoOperazione: "FATTURA_ATTIVA",
      descrizione: "Consulenza", importoImponibile: 5000,
    });
    expect(result.classification.naturaIva).toBe("N2_1");
    expect(result.classification.richiedeAutofattura).toBe(false);
    expect(result.autofattura).toBeNull();
  });

  it("N3.5 con plafond attivo e sforamento → genera TD21", () => {
    const result = processIva({
      nazioneFornitore: "IT", tipoMerce: "BENI", tipoOperazione: "COSTO",
      descrizione: "Materie prime", importoImponibile: 10000,
      naturaIvaManuale: "N3_5",
      plafondAttivo: true, plafondDisponibile: 100000, plafondUtilizzato: 95000,
    });
    expect(result.plafondResult).not.toBeNull();
    expect(result.plafondResult!.sforamento).toBe(true);
    expect(result.plafondResult!.importoSforamento).toBe(5000);
    expect(result.splafonamentoAutofattura).not.toBeNull();
    expect(result.splafonamentoAutofattura!.tipoDocumentoSdi).toBe("TD21");
    expect(result.splafonamentoAutofattura!.importoImponibile).toBe(5000);
  });
});
