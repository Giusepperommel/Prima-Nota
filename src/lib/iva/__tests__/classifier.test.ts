import { describe, it, expect } from "vitest";
import { classify } from "../classifier";

describe("IVA Classifier — Acquisti", () => {
  it("IT domestico senza natura → operazione ordinaria", () => {
    const result = classify({
      nazioneFornitore: "IT",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
      aliquotaIva: 22,
    });
    expect(result.richiedeAutofattura).toBe(false);
    expect(result.richiedeDoppiaRegistrazione).toBe(false);
    expect(result.aliquotaIva).toBe(22);
    expect(result.registroIva).toBe("ACQUISTI");
  });

  it("IT con reverse charge interno N6.3 → TD16, doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "IT",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
      isReverseChargeInterno: true,
      naturaIvaManuale: "N6_3",
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD16");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
  });

  it("UE + BENI → TD18, doppia registrazione, aliquota IT", () => {
    const result = classify({
      nazioneFornitore: "DE",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD18");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
    expect(result.aliquotaIva).toBe(22);
  });

  it("UE + SERVIZI → TD17, doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "FR",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD17");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
  });

  it("Extra-UE + SERVIZI → TD17, doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "US",
      tipoMerce: "SERVIZI",
      tipoOperazione: "COSTO",
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD17");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
  });

  it("Extra-UE + BENI → TD19, doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "CN",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD19");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
  });

  it("San Marino con IVA → TD28, NO doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "SM",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
      sanMarinoConIva: true,
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD28");
    expect(result.richiedeDoppiaRegistrazione).toBe(false);
  });

  it("San Marino senza IVA → TD19, doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "SM",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
      sanMarinoConIva: false,
    });
    expect(result.richiedeAutofattura).toBe(true);
    expect(result.tipoDocumentoAutofattura).toBe("TD19");
    expect(result.richiedeDoppiaRegistrazione).toBe(true);
  });

  it("override manuale con natura diversa → accetta + warning", () => {
    const result = classify({
      nazioneFornitore: "DE",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
      naturaIvaManuale: "N4",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("N7 (OSS) → nessuna autofattura, nessuna doppia registrazione", () => {
    const result = classify({
      nazioneFornitore: "DE",
      tipoMerce: "BENI",
      tipoOperazione: "COSTO",
      naturaIvaManuale: "N7",
    });
    expect(result.richiedeAutofattura).toBe(false);
    expect(result.richiedeDoppiaRegistrazione).toBe(false);
    expect(result.naturaIva).toBe("N7");
  });
});

describe("IVA Classifier — Vendite", () => {
  it("vendita a cliente UE B2B beni → N3.2 cessione intra", () => {
    const result = classify({
      nazioneFornitore: "DE",
      tipoMerce: "BENI",
      tipoOperazione: "FATTURA_ATTIVA",
    });
    expect(result.naturaIva).toBe("N3_2");
    expect(result.richiedeAutofattura).toBe(false);
    expect(result.registroIva).toBe("VENDITE");
  });

  it("vendita a cliente UE servizi → N2.1 fuori campo", () => {
    const result = classify({
      nazioneFornitore: "FR",
      tipoMerce: "SERVIZI",
      tipoOperazione: "FATTURA_ATTIVA",
    });
    expect(result.naturaIva).toBe("N2_1");
    expect(result.registroIva).toBe("VENDITE");
  });

  it("vendita export extra-UE beni → N3.1 esportazione", () => {
    const result = classify({
      nazioneFornitore: "US",
      tipoMerce: "BENI",
      tipoOperazione: "FATTURA_ATTIVA",
    });
    expect(result.naturaIva).toBe("N3_1");
  });

  it("vendita extra-UE servizi → N2.1 fuori campo", () => {
    const result = classify({
      nazioneFornitore: "US",
      tipoMerce: "SERVIZI",
      tipoOperazione: "FATTURA_ATTIVA",
    });
    expect(result.naturaIva).toBe("N2_1");
  });
});
