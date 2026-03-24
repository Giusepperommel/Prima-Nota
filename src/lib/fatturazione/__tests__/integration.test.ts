/**
 * Integration test: full flow from mock data to validated XML.
 *
 * Tests the complete pipeline:
 *   mapping → validation → XML build → verify XML contents
 */

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
import { validateFattura } from "../xml-validator";
import { buildFatturaXml } from "../xml-builder";
import { generaNumeroFattura, generaNomeFileSdi, generaProgressivoInvio } from "../sezionale";
import { FATTURAPA_SCHEMA_VERSION } from "../constants";
import type { FatturaPA } from "../types";

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
    reaUfficio: "RM",
    reaNumero: "123456",
    capitaleSociale: 50000,
    socioUnico: "SM",
    statoLiquidazione: "LN",
    telefonoAzienda: "0612345678",
    emailAzienda: "info@test.it",
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
    numero: "FT/001",
    ...overrides,
  };
}

/**
 * Helper to build a complete FatturaPA from fixtures.
 */
function buildCompleteFattura(options?: {
  societa?: Partial<SocietaData>;
  anagrafica?: Partial<AnagraficaData>;
  operazione?: Partial<OperazioneData>;
  sezionale?: Partial<SezionaleData>;
}): { fattura: FatturaPA; xml: string } {
  const societa = makeSocieta(options?.societa);
  const anagrafica = makeAnagrafica(options?.anagrafica);
  const operazione = makeOperazione(options?.operazione);
  const sezionale = makeSezionale(options?.sezionale);

  const codiceDestinatario = determinaCodiceDestinatario(anagrafica);
  const pecDestinatario = determinaPecDestinatario(anagrafica);

  const fattura: FatturaPA = {
    FatturaElettronicaHeader: {
      DatiTrasmissione: {
        IdTrasmittente: {
          IdPaese: "IT",
          IdCodice: societa.partitaIva,
        },
        ProgressivoInvio: "AAAAA",
        FormatoTrasmissione: FATTURAPA_SCHEMA_VERSION,
        CodiceDestinatario: codiceDestinatario,
        PECDestinatario: pecDestinatario,
      },
      CedentePrestatore: mapCedentePrestatore(societa),
      CessionarioCommittente: mapCessionarioCommittente(anagrafica),
    },
    FatturaElettronicaBody: {
      DatiGenerali: {
        DatiGeneraliDocumento: mapDatiGeneraliDocumento(operazione, sezionale),
      },
      DatiBeniServizi: {
        DettaglioLinee: mapDettaglioLinee(operazione),
        DatiRiepilogo: mapDatiRiepilogo(operazione),
      },
      DatiPagamento: mapDatiPagamento(operazione) || undefined,
    },
  };

  const xml = buildFatturaXml(fattura);
  return { fattura, xml };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Integration: full XML generation flow", () => {
  it("generates a valid FatturaPA XML for a standard invoice", () => {
    const { fattura, xml } = buildCompleteFattura();

    // Validate the data structure
    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(true);
    expect(validation.errori).toHaveLength(0);

    // XML should be well-formed
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<p:FatturaElettronica");
    expect(xml).toContain("</p:FatturaElettronica>");

    // Header elements
    expect(xml).toContain("<FormatoTrasmissione>FPR12</FormatoTrasmissione>");
    expect(xml).toContain("<IdCodice>01234567890</IdCodice>");
    expect(xml).toContain("<ProgressivoInvio>AAAAA</ProgressivoInvio>");
    expect(xml).toContain("<CodiceDestinatario>ABCDEFG</CodiceDestinatario>");

    // Cedente
    expect(xml).toContain("<Denominazione>Azienda Test Srl</Denominazione>");
    expect(xml).toContain("<RegimeFiscale>RF01</RegimeFiscale>");
    expect(xml).toContain("<Indirizzo>Via Roma 1</Indirizzo>");
    expect(xml).toContain("<CAP>00100</CAP>");

    // REA
    expect(xml).toContain("<Ufficio>RM</Ufficio>");
    expect(xml).toContain("<NumeroREA>123456</NumeroREA>");
    expect(xml).toContain("<CapitaleSociale>50000.00</CapitaleSociale>");

    // Cessionario
    expect(xml).toContain("<Denominazione>Cliente Spa</Denominazione>");
    expect(xml).toContain("<IdCodice>09876543210</IdCodice>");

    // Body
    expect(xml).toContain("<TipoDocumento>TD01</TipoDocumento>");
    expect(xml).toContain("<Divisa>EUR</Divisa>");
    expect(xml).toContain("<Data>2026-03-24</Data>");
    expect(xml).toContain("<Numero>FT/001</Numero>");
    expect(xml).toContain("<ImportoTotaleDocumento>1220.00</ImportoTotaleDocumento>");

    // Linee
    expect(xml).toContain("<NumeroLinea>1</NumeroLinea>");
    expect(xml).toContain("<Descrizione>Consulenza informatica</Descrizione>");
    expect(xml).toContain("<AliquotaIVA>22.00</AliquotaIVA>");

    // Riepilogo
    expect(xml).toContain("<ImponibileImporto>1000.00</ImponibileImporto>");
    expect(xml).toContain("<Imposta>220.00</Imposta>");

    // Pagamento
    expect(xml).toContain("<ModalitaPagamento>MP05</ModalitaPagamento>");
    expect(xml).toContain("<ImportoPagamento>1220.00</ImportoPagamento>");
  });

  it("generates valid XML for a zero-VAT invoice with Natura", () => {
    const { fattura, xml } = buildCompleteFattura({
      operazione: {
        aliquotaIva: 0,
        importoIva: 0,
        importoTotale: 1000,
        naturaOperazioneIva: "N4",
      },
    });

    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(true);

    expect(xml).toContain("<AliquotaIVA>0.00</AliquotaIVA>");
    expect(xml).toContain("<Natura>N4</Natura>");
    expect(xml).toContain("<Imposta>0.00</Imposta>");
  });

  it("generates valid XML for split payment invoice", () => {
    const { fattura, xml } = buildCompleteFattura({
      operazione: {
        splitPayment: true,
      },
    });

    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(true);

    expect(xml).toContain("<EsigibilitaIVA>S</EsigibilitaIVA>");
    // Payment should be net of IVA for split payment
    expect(xml).toContain("<ImportoPagamento>1000.00</ImportoPagamento>");
  });

  it("generates valid XML with bollo virtuale", () => {
    const { fattura, xml } = buildCompleteFattura({
      operazione: {
        aliquotaIva: 0,
        importoIva: 0,
        importoTotale: 1000,
        naturaOperazioneIva: "N4",
        bolloVirtuale: true,
        importoBollo: 2,
      },
    });

    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(true);

    expect(xml).toContain("<BolloVirtuale>SI</BolloVirtuale>");
    expect(xml).toContain("<ImportoBollo>2.00</ImportoBollo>");
  });

  it("generates valid XML with ritenuta d'acconto", () => {
    const { fattura, xml } = buildCompleteFattura({
      operazione: {
        soggettoARitenuta: true,
        ritenuta: {
          tipoRitenuta: "LAVORO_AUTONOMO",
          aliquota: 20,
          importoRitenuta: 200,
          cassaPrevidenza: null,
        },
      },
    });

    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(true);

    expect(xml).toContain("<TipoRitenuta>RT01</TipoRitenuta>");
    expect(xml).toContain("<ImportoRitenuta>200.00</ImportoRitenuta>");
    expect(xml).toContain("<AliquotaRitenuta>20.00</AliquotaRitenuta>");
    expect(xml).toContain("<CausalePagamento>A</CausalePagamento>");
    // Payment should be total - ritenuta
    expect(xml).toContain("<ImportoPagamento>1020.00</ImportoPagamento>");
  });

  it("generates valid XML for persona fisica buyer", () => {
    const { fattura, xml } = buildCompleteFattura({
      anagrafica: {
        tipoSoggetto: "PERSONA_FISICA",
        denominazione: "Mario Rossi",
        partitaIva: null,
        codiceFiscale: "RSSMRA80A01H501U",
        codiceDestinatario: null,
      },
    });

    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(true);

    expect(xml).toContain("<Nome>Mario</Nome>");
    expect(xml).toContain("<Cognome>Rossi</Cognome>");
    expect(xml).toContain("<CodiceDestinatario>0000000</CodiceDestinatario>");
  });

  it("generates valid XML for foreign buyer", () => {
    const { fattura, xml } = buildCompleteFattura({
      anagrafica: {
        nazione: "DE",
        partitaIva: "DE123456789",
        codiceDestinatario: null,
      },
    });

    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(true);

    expect(xml).toContain("<CodiceDestinatario>XXXXXXX</CodiceDestinatario>");
    expect(xml).toContain("<Nazione>DE</Nazione>");
  });

  it("validates PEC for IT buyer without codice destinatario", () => {
    const { fattura, xml } = buildCompleteFattura({
      anagrafica: {
        codiceDestinatario: null,
        pec: "test@pec.it",
      },
    });

    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(true);

    expect(xml).toContain("<CodiceDestinatario>0000000</CodiceDestinatario>");
    expect(xml).toContain("<PECDestinatario>test@pec.it</PECDestinatario>");
  });

  it("detects validation errors for incomplete data", () => {
    const { fattura } = buildCompleteFattura({
      societa: {
        partitaIva: "",
        indirizzo: "",
        cap: "",
        citta: "",
      },
    });

    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(false);
    expect(validation.errori.length).toBeGreaterThan(0);
    expect(
      validation.errori.some((e) => e.includes("IdFiscaleIVA"))
    ).toBe(true);
  });

  it("detects validation errors when Natura is missing for zero-rate line", () => {
    const { fattura } = buildCompleteFattura({
      operazione: {
        aliquotaIva: 0,
        importoIva: 0,
        importoTotale: 1000,
        naturaOperazioneIva: null, // missing Natura
      },
    });

    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(false);
    expect(
      validation.errori.some((e) => e.includes("Natura") && e.includes("00400"))
    ).toBe(true);
  });

  it("sezionale numbering works correctly", () => {
    const numero = generaNumeroFattura({
      prefisso: "FT",
      separatore: "/",
      paddingCifre: 4,
      ultimoNumero: 47,
    });
    expect(numero).toBe("FT/0048");
  });

  it("SDI filename is generated correctly", () => {
    const nomeFile = generaNomeFileSdi("01234567890", "AAAAA");
    expect(nomeFile).toBe("IT01234567890_AAAAA.xml");
  });

  it("progressivo invio is 5 chars alphanumeric", () => {
    const prog = generaProgressivoInvio();
    expect(prog).toHaveLength(5);
    expect(/^[A-Z0-9]{5}$/.test(prog)).toBe(true);
  });

  it("handles long description split into causale blocks", () => {
    const longDesc = "A".repeat(450);
    const { xml } = buildCompleteFattura({
      operazione: { descrizione: longDesc },
    });

    // Should have multiple Causale elements (450 chars = 3 blocks: 200+200+50)
    const matches = xml.match(/<Causale>/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3);
  });

  it("complete flow produces consistent XML across multiple generations", () => {
    // Two generations with same data should produce structurally identical XML
    // (only ProgressivoInvio would differ in real usage)
    const opts = {
      societa: { partitaIva: "11111111111" },
      operazione: { importoImponibile: 500, importoIva: 110, importoTotale: 610, aliquotaIva: 22 },
    };

    const { xml: xml1 } = buildCompleteFattura(opts);
    const { xml: xml2 } = buildCompleteFattura(opts);

    expect(xml1).toBe(xml2);
  });

  it("generates valid XML with cassa previdenza", () => {
    const { fattura, xml } = buildCompleteFattura({
      operazione: {
        soggettoARitenuta: true,
        ritenuta: {
          tipoRitenuta: "LAVORO_AUTONOMO",
          aliquota: 20,
          importoRitenuta: 200,
          cassaPrevidenza: 40,
          aliquotaCassa: 4,
        },
      },
    });

    const validation = validateFattura(fattura);
    expect(validation.valido).toBe(true);

    expect(xml).toContain("<TipoCassa>TC22</TipoCassa>");
    expect(xml).toContain("<ImportoContributoCassa>40.00</ImportoContributoCassa>");
  });
});
