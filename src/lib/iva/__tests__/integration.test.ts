import { describe, it, expect } from "vitest";
import { processIva } from "../engine";

describe("IVA Engine — integration scenarios", () => {
  it("scenario completo: fattura acquisto beni da Germania", () => {
    const result = processIva({
      nazioneFornitore: "DE", tipoMerce: "BENI", tipoOperazione: "COSTO",
      descrizione: "Componenti elettronici Siemens", importoImponibile: 5000,
    });
    expect(result.classification.countryGroup).toBe("UE");
    expect(result.classification.richiedeAutofattura).toBe(true);
    expect(result.classification.tipoDocumentoAutofattura).toBe("TD18");
    expect(result.classification.richiedeDoppiaRegistrazione).toBe(true);
    expect(result.classification.aliquotaIva).toBe(22);
    expect(result.autofattura).not.toBeNull();
    expect(result.autofattura!.descrizione).toContain("TD18");
    expect(result.autofattura!.importoImponibile).toBe(5000);
    expect(result.autofattura!.importoIva).toBe(1100);
    expect(result.autofattura!.doppiaRegistrazione).toBe(true);
    expect(result.validationWarnings).toHaveLength(0);
  });

  it("scenario completo: fattura servizi da USA", () => {
    const result = processIva({
      nazioneFornitore: "US", tipoMerce: "SERVIZI", tipoOperazione: "COSTO",
      descrizione: "Licenza software annuale", importoImponibile: 12000,
    });
    expect(result.classification.tipoDocumentoAutofattura).toBe("TD17");
    expect(result.autofattura!.importoIva).toBe(2640);
  });

  it("scenario completo: vendita servizi a cliente francese", () => {
    const result = processIva({
      nazioneFornitore: "FR", tipoMerce: "SERVIZI", tipoOperazione: "FATTURA_ATTIVA",
      descrizione: "Consulenza strategica", importoImponibile: 20000,
    });
    expect(result.classification.naturaIva).toBe("N2_1");
    expect(result.classification.aliquotaIva).toBe(0);
    expect(result.autofattura).toBeNull();
  });

  it("scenario completo: reverse charge interno subappalto", () => {
    const result = processIva({
      nazioneFornitore: "IT", tipoMerce: "SERVIZI", tipoOperazione: "COSTO",
      descrizione: "Lavori edili subappalto", importoImponibile: 30000,
      isReverseChargeInterno: true, naturaIvaManuale: "N6_3",
    });
    expect(result.classification.tipoDocumentoAutofattura).toBe("TD16");
    expect(result.classification.richiedeDoppiaRegistrazione).toBe(true);
    expect(result.autofattura!.importoIva).toBe(6600);
  });
});
