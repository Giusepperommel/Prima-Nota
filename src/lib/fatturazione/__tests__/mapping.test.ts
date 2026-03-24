import { describe, it, expect } from "vitest";
import {
  mapCedentePrestatore,
  mapCessionarioCommittente,
  mapDatiGeneraliDocumento,
  mapDettaglioLinee,
  mapDatiRiepilogo,
  mapDatiPagamento,
  determinaCodiceDestinatario,
  determinaPecDestinatario,
  type SocietaData,
  type AnagraficaData,
  type OperazioneData,
  type SezionaleData,
} from "../mapping";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeSocieta(overrides?: Partial<SocietaData>): SocietaData {
  return {
    partitaIva: "01234567890",
    codiceFiscale: "01234567890",
    ragioneSociale: "Azienda Test Srl",
    regimeFiscale: "ORDINARIO",
    indirizzo: "Via Roma 1",
    cap: "00100",
    citta: "Roma",
    provincia: "RM",
    nazione: "IT",
    ...overrides,
  };
}

function makeAnagrafica(overrides?: Partial<AnagraficaData>): AnagraficaData {
  return {
    partitaIva: "09876543210",
    codiceFiscale: "RSSMRA80A01H501U",
    denominazione: "Cliente Spa",
    tipoSoggetto: "AZIENDA",
    indirizzo: "Via Milano 10",
    cap: "20100",
    citta: "Milano",
    provincia: "MI",
    nazione: "IT",
    codiceDestinatario: "ABCDEFG",
    pec: "cliente@pec.it",
    ...overrides,
  };
}

function makeOperazione(overrides?: Partial<OperazioneData>): OperazioneData {
  return {
    dataOperazione: "2026-03-24",
    descrizione: "Consulenza informatica",
    importoImponibile: 1000,
    importoIva: 220,
    importoTotale: 1220,
    aliquotaIva: 22,
    ...overrides,
  };
}

function makeSezionale(overrides?: Partial<SezionaleData>): SezionaleData {
  return {
    tipoDocumento: "TD01",
    numero: "FV/001",
    ...overrides,
  };
}

// ─── Task 7: mapCedentePrestatore ───────────────────────────────────────────

describe("mapCedentePrestatore", () => {
  it("maps societa to CedentePrestatore with correct IdFiscaleIVA", () => {
    const result = mapCedentePrestatore(makeSocieta());
    expect(result.DatiAnagrafici.IdFiscaleIVA).toEqual({
      IdPaese: "IT",
      IdCodice: "01234567890",
    });
  });

  it("maps ragioneSociale to Denominazione", () => {
    const result = mapCedentePrestatore(makeSocieta());
    expect(result.DatiAnagrafici.Anagrafica.Denominazione).toBe("Azienda Test Srl");
  });

  it("maps ORDINARIO to RF01", () => {
    const result = mapCedentePrestatore(makeSocieta({ regimeFiscale: "ORDINARIO" }));
    expect(result.DatiAnagrafici.RegimeFiscale).toBe("RF01");
  });

  it("maps FORFETTARIO to RF19", () => {
    const result = mapCedentePrestatore(makeSocieta({ regimeFiscale: "FORFETTARIO" }));
    expect(result.DatiAnagrafici.RegimeFiscale).toBe("RF19");
  });

  it("maps sede fields correctly", () => {
    const result = mapCedentePrestatore(makeSocieta());
    expect(result.Sede).toEqual({
      Indirizzo: "Via Roma 1",
      CAP: "00100",
      Comune: "Roma",
      Provincia: "RM",
      Nazione: "IT",
    });
  });

  it("defaults Nazione to IT when not provided", () => {
    const result = mapCedentePrestatore(makeSocieta({ nazione: null }));
    expect(result.Sede.Nazione).toBe("IT");
  });

  it("includes IscrizioneREA when reaUfficio and reaNumero present", () => {
    const result = mapCedentePrestatore(
      makeSocieta({
        reaUfficio: "RM",
        reaNumero: "1234567",
        capitaleSociale: 10000,
        socioUnico: "SM",
        statoLiquidazione: "LN",
      })
    );
    expect(result.IscrizioneREA).toEqual({
      Ufficio: "RM",
      NumeroREA: "1234567",
      CapitaleSociale: "10000.00",
      SocioUnico: "SM",
      StatoLiquidazione: "LN",
    });
  });

  it("omits IscrizioneREA when reaUfficio missing", () => {
    const result = mapCedentePrestatore(makeSocieta({ reaUfficio: null }));
    expect(result.IscrizioneREA).toBeUndefined();
  });

  it("includes Contatti when telefonoAzienda or emailAzienda present", () => {
    const result = mapCedentePrestatore(
      makeSocieta({ telefonoAzienda: "+39 06 1234567", emailAzienda: "info@test.it" })
    );
    expect(result.Contatti).toEqual({
      Telefono: "+39 06 1234567",
      Email: "info@test.it",
    });
  });

  it("omits Contatti when neither present", () => {
    const result = mapCedentePrestatore(makeSocieta({ telefonoAzienda: null, emailAzienda: null }));
    expect(result.Contatti).toBeUndefined();
  });

  it("includes CodiceFiscale when present", () => {
    const result = mapCedentePrestatore(makeSocieta({ codiceFiscale: "01234567890" }));
    expect(result.DatiAnagrafici.CodiceFiscale).toBe("01234567890");
  });
});

// ─── Task 8: mapCessionarioCommittente ──────────────────────────────────────

describe("mapCessionarioCommittente", () => {
  it("maps AZIENDA to Denominazione", () => {
    const result = mapCessionarioCommittente(makeAnagrafica());
    expect(result.DatiAnagrafici.Anagrafica.Denominazione).toBe("Cliente Spa");
  });

  it("maps PERSONA_FISICA to Nome/Cognome by splitting denominazione", () => {
    const result = mapCessionarioCommittente(
      makeAnagrafica({ tipoSoggetto: "PERSONA_FISICA", denominazione: "Mario Rossi" })
    );
    expect(result.DatiAnagrafici.Anagrafica.Nome).toBe("Mario");
    expect(result.DatiAnagrafici.Anagrafica.Cognome).toBe("Rossi");
    expect(result.DatiAnagrafici.Anagrafica.Denominazione).toBeUndefined();
  });

  it("maps PROFESSIONISTA to Nome/Cognome", () => {
    const result = mapCessionarioCommittente(
      makeAnagrafica({ tipoSoggetto: "PROFESSIONISTA", denominazione: "Dott. Marco Bianchi" })
    );
    expect(result.DatiAnagrafici.Anagrafica.Nome).toBe("Dott. Marco");
    expect(result.DatiAnagrafici.Anagrafica.Cognome).toBe("Bianchi");
  });

  it("maps IdFiscaleIVA with correct IdPaese from nazione", () => {
    const result = mapCessionarioCommittente(makeAnagrafica({ nazione: "DE", partitaIva: "DE123456789" }));
    expect(result.DatiAnagrafici.IdFiscaleIVA).toEqual({
      IdPaese: "DE",
      IdCodice: "DE123456789",
    });
  });

  it("omits IdFiscaleIVA when partitaIva is null", () => {
    const result = mapCessionarioCommittente(makeAnagrafica({ partitaIva: null }));
    expect(result.DatiAnagrafici.IdFiscaleIVA).toBeUndefined();
  });

  it("includes CodiceFiscale", () => {
    const result = mapCessionarioCommittente(makeAnagrafica({ codiceFiscale: "RSSMRA80A01H501U" }));
    expect(result.DatiAnagrafici.CodiceFiscale).toBe("RSSMRA80A01H501U");
  });

  it("maps sede correctly", () => {
    const result = mapCessionarioCommittente(makeAnagrafica());
    expect(result.Sede.Indirizzo).toBe("Via Milano 10");
    expect(result.Sede.CAP).toBe("20100");
    expect(result.Sede.Comune).toBe("Milano");
  });
});

describe("determinaCodiceDestinatario", () => {
  it("returns the codice when 7 chars and IT", () => {
    expect(determinaCodiceDestinatario(makeAnagrafica())).toBe("ABCDEFG");
  });

  it("returns 0000000 when IT without valid codice", () => {
    expect(
      determinaCodiceDestinatario(makeAnagrafica({ codiceDestinatario: null }))
    ).toBe("0000000");
  });

  it("returns XXXXXXX for foreign buyer", () => {
    expect(
      determinaCodiceDestinatario(makeAnagrafica({ nazione: "DE" }))
    ).toBe("XXXXXXX");
  });
});

describe("determinaPecDestinatario", () => {
  it("returns PEC when IT and codice = 0000000", () => {
    expect(
      determinaPecDestinatario(makeAnagrafica({ codiceDestinatario: null, pec: "test@pec.it" }))
    ).toBe("test@pec.it");
  });

  it("returns undefined when codice is valid 7 chars", () => {
    expect(determinaPecDestinatario(makeAnagrafica())).toBeUndefined();
  });

  it("returns undefined for foreign buyer", () => {
    expect(
      determinaPecDestinatario(makeAnagrafica({ nazione: "DE", pec: "test@pec.de" }))
    ).toBeUndefined();
  });
});

// ─── Task 9: mapDatiGeneraliDocumento ───────────────────────────────────────

describe("mapDatiGeneraliDocumento", () => {
  it("maps basic fields from operazione and sezionale", () => {
    const result = mapDatiGeneraliDocumento(makeOperazione(), makeSezionale());
    expect(result.TipoDocumento).toBe("TD01");
    expect(result.Divisa).toBe("EUR");
    expect(result.Data).toBe("2026-03-24");
    expect(result.Numero).toBe("FV/001");
    expect(result.ImportoTotaleDocumento).toBe("1220.00");
  });

  it("splits long Causale into 200-char blocks", () => {
    const longDesc = "A".repeat(450);
    const result = mapDatiGeneraliDocumento(
      makeOperazione({ descrizione: longDesc }),
      makeSezionale()
    );
    expect(result.Causale).toHaveLength(3);
    expect(result.Causale![0]).toHaveLength(200);
    expect(result.Causale![1]).toHaveLength(200);
    expect(result.Causale![2]).toHaveLength(50);
  });

  it("includes DatiBollo when bolloVirtuale is true", () => {
    const result = mapDatiGeneraliDocumento(
      makeOperazione({ bolloVirtuale: true }),
      makeSezionale()
    );
    expect(result.DatiBollo).toEqual({
      BolloVirtuale: "SI",
      ImportoBollo: "2.00",
    });
  });

  it("uses custom importoBollo when provided", () => {
    const result = mapDatiGeneraliDocumento(
      makeOperazione({ bolloVirtuale: true, importoBollo: 4 }),
      makeSezionale()
    );
    expect(result.DatiBollo!.ImportoBollo).toBe("4.00");
  });

  it("omits DatiBollo when bolloVirtuale is false", () => {
    const result = mapDatiGeneraliDocumento(makeOperazione(), makeSezionale());
    expect(result.DatiBollo).toBeUndefined();
  });

  it("includes DatiRitenuta when soggettoARitenuta", () => {
    const result = mapDatiGeneraliDocumento(
      makeOperazione({
        soggettoARitenuta: true,
        ritenuta: {
          tipoRitenuta: "LAVORO_AUTONOMO",
          aliquota: 20,
          importoRitenuta: 200,
        },
      }),
      makeSezionale()
    );
    expect(result.DatiRitenuta).toEqual([
      {
        TipoRitenuta: "RT01",
        ImportoRitenuta: "200.00",
        AliquotaRitenuta: "20.00",
        CausalePagamento: "A",
      },
    ]);
  });

  it("maps PROVVIGIONI ritenuta to causale R", () => {
    const result = mapDatiGeneraliDocumento(
      makeOperazione({
        soggettoARitenuta: true,
        ritenuta: {
          tipoRitenuta: "PROVVIGIONI",
          aliquota: 20,
          importoRitenuta: 200,
        },
      }),
      makeSezionale()
    );
    expect(result.DatiRitenuta![0].CausalePagamento).toBe("R");
  });

  it("includes DatiCassaPrevidenziale when cassa > 0", () => {
    const result = mapDatiGeneraliDocumento(
      makeOperazione({
        soggettoARitenuta: true,
        ritenuta: {
          tipoRitenuta: "LAVORO_AUTONOMO",
          aliquota: 20,
          importoRitenuta: 200,
          cassaPrevidenza: 40,
          aliquotaCassa: 4,
        },
      }),
      makeSezionale()
    );
    expect(result.DatiCassaPrevidenziale).toEqual([
      {
        TipoCassa: "TC22",
        AlCassa: "4.00",
        ImportoContributoCassa: "40.00",
        AliquotaIVA: "22.00",
      },
    ]);
  });
});

// ─── mapDettaglioLinee ──────────────────────────────────────────────────────

describe("mapDettaglioLinee", () => {
  it("creates a single line with NumeroLinea=1", () => {
    const result = mapDettaglioLinee(makeOperazione());
    expect(result).toHaveLength(1);
    expect(result[0].NumeroLinea).toBe(1);
  });

  it("formats PrezzoUnitario with 8 decimals", () => {
    const result = mapDettaglioLinee(makeOperazione());
    expect(result[0].PrezzoUnitario).toBe("1000.00000000");
  });

  it("formats AliquotaIVA with 2 decimals", () => {
    const result = mapDettaglioLinee(makeOperazione());
    expect(result[0].AliquotaIVA).toBe("22.00");
  });

  it("includes Natura when AliquotaIVA = 0", () => {
    const result = mapDettaglioLinee(
      makeOperazione({
        aliquotaIva: 0,
        importoIva: 0,
        importoTotale: 1000,
        naturaOperazioneIva: "N4",
      })
    );
    expect(result[0].AliquotaIVA).toBe("0.00");
    expect(result[0].Natura).toBe("N4");
  });

  it("maps underscore Natura codes to dot notation", () => {
    const result = mapDettaglioLinee(
      makeOperazione({
        aliquotaIva: 0,
        importoIva: 0,
        importoTotale: 1000,
        naturaOperazioneIva: "N2_2",
      })
    );
    expect(result[0].Natura).toBe("N2.2");
  });

  it("omits Natura when AliquotaIVA > 0", () => {
    const result = mapDettaglioLinee(makeOperazione());
    expect(result[0].Natura).toBeUndefined();
  });

  it("includes Ritenuta=SI when soggettoARitenuta", () => {
    const result = mapDettaglioLinee(
      makeOperazione({
        soggettoARitenuta: true,
        ritenuta: { tipoRitenuta: "LAVORO_AUTONOMO", aliquota: 20, importoRitenuta: 200 },
      })
    );
    expect(result[0].Ritenuta).toBe("SI");
  });
});

// ─── mapDatiRiepilogo ───────────────────────────────────────────────────────

describe("mapDatiRiepilogo", () => {
  it("creates a single riepilogo block", () => {
    const result = mapDatiRiepilogo(makeOperazione());
    expect(result).toHaveLength(1);
  });

  it("maps AliquotaIVA and ImponibileImporto correctly", () => {
    const result = mapDatiRiepilogo(makeOperazione());
    expect(result[0].AliquotaIVA).toBe("22.00");
    expect(result[0].ImponibileImporto).toBe("1000.00");
    expect(result[0].Imposta).toBe("220.00");
  });

  it("sets EsigibilitaIVA to I (immediata) by default", () => {
    const result = mapDatiRiepilogo(makeOperazione());
    expect(result[0].EsigibilitaIVA).toBe("I");
  });

  it("sets EsigibilitaIVA to S for split payment", () => {
    const result = mapDatiRiepilogo(makeOperazione({ splitPayment: true }));
    expect(result[0].EsigibilitaIVA).toBe("S");
  });

  it("includes Natura and RiferimentoNormativo when AliquotaIVA = 0", () => {
    const result = mapDatiRiepilogo(
      makeOperazione({
        aliquotaIva: 0,
        importoIva: 0,
        importoTotale: 1000,
        naturaOperazioneIva: "N4",
      })
    );
    expect(result[0].Natura).toBe("N4");
    expect(result[0].RiferimentoNormativo).toContain("Esenti");
  });

  it("omits Natura when AliquotaIVA > 0", () => {
    const result = mapDatiRiepilogo(makeOperazione());
    expect(result[0].Natura).toBeUndefined();
    expect(result[0].RiferimentoNormativo).toBeUndefined();
  });
});

// ─── mapDatiPagamento ───────────────────────────────────────────────────────

describe("mapDatiPagamento", () => {
  it("returns DatiPagamento with TP02 (completo) by default", () => {
    const result = mapDatiPagamento(makeOperazione());
    expect(result).not.toBeNull();
    expect(result!.CondizioniPagamento).toBe("TP02");
  });

  it("uses MP05 (bonifico) as default ModalitaPagamento", () => {
    const result = mapDatiPagamento(makeOperazione());
    expect(result!.DettaglioPagamento[0].ModalitaPagamento).toBe("MP05");
  });

  it("uses custom modalitaPagamento when provided", () => {
    const result = mapDatiPagamento(makeOperazione({ modalitaPagamento: "MP08" }));
    expect(result!.DettaglioPagamento[0].ModalitaPagamento).toBe("MP08");
  });

  it("sets ImportoPagamento to importoTotale", () => {
    const result = mapDatiPagamento(makeOperazione());
    expect(result!.DettaglioPagamento[0].ImportoPagamento).toBe("1220.00");
  });

  it("subtracts ritenuta from ImportoPagamento", () => {
    const result = mapDatiPagamento(
      makeOperazione({
        soggettoARitenuta: true,
        ritenuta: { tipoRitenuta: "LAVORO_AUTONOMO", aliquota: 20, importoRitenuta: 200 },
      })
    );
    expect(result!.DettaglioPagamento[0].ImportoPagamento).toBe("1020.00");
  });

  it("for split payment, ImportoPagamento is net of IVA", () => {
    const result = mapDatiPagamento(makeOperazione({ splitPayment: true }));
    // 1000 imponibile (no IVA collected)
    expect(result!.DettaglioPagamento[0].ImportoPagamento).toBe("1000.00");
  });

  it("for split payment with ritenuta, ImportoPagamento = imponibile - ritenuta", () => {
    const result = mapDatiPagamento(
      makeOperazione({
        splitPayment: true,
        soggettoARitenuta: true,
        ritenuta: { tipoRitenuta: "LAVORO_AUTONOMO", aliquota: 20, importoRitenuta: 200 },
      })
    );
    // 1000 - 200 = 800
    expect(result!.DettaglioPagamento[0].ImportoPagamento).toBe("800.00");
  });

  it("includes IBAN when provided", () => {
    const result = mapDatiPagamento(makeOperazione({ iban: "IT60X0542811101000000123456" }));
    expect(result!.DettaglioPagamento[0].IBAN).toBe("IT60X0542811101000000123456");
  });

  it("includes DataScadenzaPagamento when provided", () => {
    const result = mapDatiPagamento(makeOperazione({ dataScadenzaPagamento: "2026-04-24" }));
    expect(result!.DettaglioPagamento[0].DataScadenzaPagamento).toBe("2026-04-24");
  });
});
