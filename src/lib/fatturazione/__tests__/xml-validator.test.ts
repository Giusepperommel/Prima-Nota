import { describe, it, expect } from "vitest";
import { validateFattura } from "../xml-validator";
import type { FatturaPA } from "../types";

function makeValidFattura(): FatturaPA {
  return {
    FatturaElettronicaHeader: {
      DatiTrasmissione: {
        IdTrasmittente: { IdPaese: "IT", IdCodice: "01234567890" },
        ProgressivoInvio: "00001",
        FormatoTrasmissione: "FPR12",
        CodiceDestinatario: "ABCDEFG",
      },
      CedentePrestatore: {
        DatiAnagrafici: {
          IdFiscaleIVA: { IdPaese: "IT", IdCodice: "01234567890" },
          Anagrafica: { Denominazione: "Azienda Test Srl" },
          RegimeFiscale: "RF01",
        },
        Sede: {
          Indirizzo: "Via Roma 1",
          CAP: "00100",
          Comune: "Roma",
          Provincia: "RM",
          Nazione: "IT",
        },
      },
      CessionarioCommittente: {
        DatiAnagrafici: {
          IdFiscaleIVA: { IdPaese: "IT", IdCodice: "09876543210" },
          Anagrafica: { Denominazione: "Cliente Spa" },
        },
        Sede: {
          Indirizzo: "Via Milano 10",
          CAP: "20100",
          Comune: "Milano",
          Provincia: "MI",
          Nazione: "IT",
        },
      },
    },
    FatturaElettronicaBody: {
      DatiGenerali: {
        DatiGeneraliDocumento: {
          TipoDocumento: "TD01",
          Divisa: "EUR",
          Data: "2026-03-24",
          Numero: "FV/001",
          ImportoTotaleDocumento: "1220.00",
          Causale: ["Consulenza informatica"],
        },
      },
      DatiBeniServizi: {
        DettaglioLinee: [
          {
            NumeroLinea: 1,
            Descrizione: "Consulenza informatica",
            Quantita: "1.00",
            PrezzoUnitario: "1000.00",
            PrezzoTotale: "1000.00",
            AliquotaIVA: "22.00",
          },
        ],
        DatiRiepilogo: [
          {
            AliquotaIVA: "22.00",
            ImponibileImporto: "1000.00",
            Imposta: "220.00",
            EsigibilitaIVA: "I",
          },
        ],
      },
    },
  };
}

describe("validateFattura", () => {
  it("returns valido=true for a complete valid fattura", () => {
    const result = validateFattura(makeValidFattura());
    expect(result.valido).toBe(true);
    expect(result.errori).toHaveLength(0);
  });

  // ─── Required fields ─────────────────────────────────────────────────────

  it("catches missing IdFiscaleIVA cedente", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaHeader.CedentePrestatore.DatiAnagrafici.IdFiscaleIVA.IdCodice = "";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("IdFiscaleIVA del cedente"))).toBe(true);
  });

  it("catches missing RegimeFiscale cedente", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaHeader.CedentePrestatore.DatiAnagrafici.RegimeFiscale = "";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("RegimeFiscale"))).toBe(true);
  });

  it("catches missing Denominazione and Nome/Cognome cedente", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaHeader.CedentePrestatore.DatiAnagrafici.Anagrafica = {};
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("Denominazione o Nome/Cognome del cedente"))).toBe(true);
  });

  it("catches missing sede cedente fields", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaHeader.CedentePrestatore.Sede.Indirizzo = "";
    f.FatturaElettronicaHeader.CedentePrestatore.Sede.CAP = "";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("Indirizzo sede"))).toBe(true);
    expect(result.errori.some((e) => e.includes("CAP sede"))).toBe(true);
  });

  it("catches missing IdFiscaleIVA and CodiceFiscale cessionario", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaHeader.CessionarioCommittente.DatiAnagrafici = {
      Anagrafica: { Denominazione: "Cliente" },
    };
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("00417"))).toBe(true);
  });

  it("accepts CodiceFiscale without IdFiscaleIVA for cessionario", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaHeader.CessionarioCommittente.DatiAnagrafici = {
      CodiceFiscale: "RSSMRA80A01H501U",
      Anagrafica: { Denominazione: "Cliente" },
    };
    const result = validateFattura(f);
    // Should not have the 00417 error
    expect(result.errori.some((e) => e.includes("00417"))).toBe(false);
  });

  it("catches missing TipoDocumento", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.TipoDocumento = "";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("TipoDocumento"))).toBe(true);
  });

  // ─── Numero with at least one digit ──────────────────────────────────────

  it("catches Numero without any digit", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.Numero = "FV/ABC";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("00425"))).toBe(true);
  });

  it("accepts Numero with digits", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.Numero = "FV/001";
    const result = validateFattura(f);
    expect(result.errori.some((e) => e.includes("00425"))).toBe(false);
  });

  // ─── CodiceDestinatario length ────────────────────────────────────────────

  it("catches CodiceDestinatario with wrong length", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaHeader.DatiTrasmissione.CodiceDestinatario = "AB";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("CodiceDestinatario"))).toBe(true);
  });

  it("accepts CodiceDestinatario with 6 chars (PA)", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaHeader.DatiTrasmissione.CodiceDestinatario = "ABCDEF";
    const result = validateFattura(f);
    expect(result.errori.some((e) => e.includes("CodiceDestinatario"))).toBe(false);
  });

  it("accepts CodiceDestinatario with 7 chars (B2B)", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaHeader.DatiTrasmissione.CodiceDestinatario = "ABCDEFG";
    const result = validateFattura(f);
    expect(result.errori.some((e) => e.includes("CodiceDestinatario"))).toBe(false);
  });

  // ─── AliquotaIVA / Natura consistency ─────────────────────────────────────

  it("catches missing Natura when AliquotaIVA = 0", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiBeniServizi.DettaglioLinee[0].AliquotaIVA = "0.00";
    f.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo[0].AliquotaIVA = "0.00";
    f.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo[0].Imposta = "0.00";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("00400"))).toBe(true);
  });

  it("catches Natura present when AliquotaIVA > 0", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiBeniServizi.DettaglioLinee[0].Natura = "N4";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("00401"))).toBe(true);
  });

  // ─── Arithmetic: PrezzoTotale ─────────────────────────────────────────────

  it("catches PrezzoTotale mismatch with PrezzoUnitario * Quantita", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiBeniServizi.DettaglioLinee[0].PrezzoTotale = "999.00";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("PrezzoTotale"))).toBe(true);
  });

  it("accepts PrezzoTotale within 0.01 tolerance", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiBeniServizi.DettaglioLinee[0].PrezzoTotale = "1000.01";
    // Also fix riepilogo to match
    f.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo[0].ImponibileImporto = "1000.01";
    f.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo[0].Imposta = "220.00";
    const result = validateFattura(f);
    // PrezzoTotale check should pass (within 0.01)
    expect(result.errori.some((e) => e.includes("PrezzoTotale") && e.includes("Linea 1"))).toBe(false);
  });

  // ─── Riepilogo consistency ────────────────────────────────────────────────

  it("catches ImponibileImporto mismatch with line totals", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo[0].ImponibileImporto = "500.00";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("ImponibileImporto"))).toBe(true);
  });

  it("catches Imposta mismatch in riepilogo", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo[0].Imposta = "100.00";
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("Imposta"))).toBe(true);
  });

  // ─── DatiRitenuta coerenza ────────────────────────────────────────────────

  it("catches DatiRitenuta without corresponding line Ritenuta=SI", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.DatiRitenuta = [
      {
        TipoRitenuta: "RT01",
        ImportoRitenuta: "200.00",
        AliquotaRitenuta: "20.00",
        CausalePagamento: "A",
      },
    ];
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("00411"))).toBe(true);
  });

  it("accepts DatiRitenuta when a line has Ritenuta=SI", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.DatiRitenuta = [
      {
        TipoRitenuta: "RT01",
        ImportoRitenuta: "200.00",
        AliquotaRitenuta: "20.00",
        CausalePagamento: "A",
      },
    ];
    f.FatturaElettronicaBody.DatiBeniServizi.DettaglioLinee[0].Ritenuta = "SI";
    const result = validateFattura(f);
    expect(result.errori.some((e) => e.includes("00411"))).toBe(false);
  });

  // ─── DatiBollo coerenza ───────────────────────────────────────────────────

  it("catches BolloVirtuale=SI without ImportoBollo", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.DatiBollo = {
      BolloVirtuale: "SI",
      ImportoBollo: "",
    };
    const result = validateFattura(f);
    expect(result.valido).toBe(false);
    expect(result.errori.some((e) => e.includes("00471"))).toBe(true);
  });

  // ─── ImportoTotaleDocumento warning ───────────────────────────────────────

  it("warns when ImportoTotaleDocumento does not match riepilogo sum", () => {
    const f = makeValidFattura();
    f.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.ImportoTotaleDocumento = "9999.00";
    const result = validateFattura(f);
    // Should be a warning, not an error
    expect(result.valido).toBe(true);
    expect(result.warnings.some((w) => w.includes("ImportoTotaleDocumento"))).toBe(true);
  });

  it("no warning when ImportoTotaleDocumento matches", () => {
    const f = makeValidFattura();
    const result = validateFattura(f);
    expect(result.warnings).toHaveLength(0);
  });
});
