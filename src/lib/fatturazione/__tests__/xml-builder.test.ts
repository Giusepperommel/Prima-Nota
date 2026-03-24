import { describe, it, expect } from "vitest";
import { buildFatturaXml, escapeXml } from "../xml-builder";
import type { FatturaPA } from "../types";
import {
  FATTURAPA_NAMESPACE,
  FATTURAPA_SCHEMA_VERSION,
  FATTURAPA_DS_NAMESPACE,
  FATTURAPA_XSI_NAMESPACE,
} from "../constants";

// ─── Fixture: standard TD01 invoice with IVA 22% ───────────────────────────

function makeStandardInvoice(): FatturaPA {
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
          CodiceFiscale: "RSSMRA80A01H501U",
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
          Causale: ["Consulenza informatica mese di marzo 2026"],
        },
      },
      DatiBeniServizi: {
        DettaglioLinee: [
          {
            NumeroLinea: 1,
            Descrizione: "Consulenza informatica",
            Quantita: "1.00",
            UnitaMisura: "NR",
            PrezzoUnitario: "1000.00000000",
            PrezzoTotale: "1000.00000000",
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
      DatiPagamento: {
        CondizioniPagamento: "TP02",
        DettaglioPagamento: [
          {
            ModalitaPagamento: "MP05",
            ImportoPagamento: "1220.00",
            IBAN: "IT60X0542811101000000123456",
          },
        ],
      },
    },
  };
}

describe("escapeXml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeXml('A & B < C > D "E" F\'G')).toBe(
      "A &amp; B &lt; C &gt; D &quot;E&quot; F&apos;G"
    );
  });

  it("returns unchanged string with no special chars", () => {
    expect(escapeXml("Hello World 123")).toBe("Hello World 123");
  });
});

describe("buildFatturaXml", () => {
  const invoice = makeStandardInvoice();
  const xml = buildFatturaXml(invoice);

  it("starts with XML declaration", () => {
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it("has root element with correct namespace and versione", () => {
    expect(xml).toContain(`xmlns:p="${FATTURAPA_NAMESPACE}"`);
    expect(xml).toContain(`versione="${FATTURAPA_SCHEMA_VERSION}"`);
    expect(xml).toContain(`xmlns:ds="${FATTURAPA_DS_NAMESPACE}"`);
    expect(xml).toContain(`xmlns:xsi="${FATTURAPA_XSI_NAMESPACE}"`);
    expect(xml).toContain("<p:FatturaElettronica ");
    expect(xml).toContain("</p:FatturaElettronica>");
  });

  it("contains FatturaElettronicaHeader", () => {
    expect(xml).toContain("<FatturaElettronicaHeader>");
    expect(xml).toContain("</FatturaElettronicaHeader>");
  });

  it("contains DatiTrasmissione with correct values", () => {
    expect(xml).toContain("<DatiTrasmissione>");
    expect(xml).toContain("<IdPaese>IT</IdPaese>");
    expect(xml).toContain("<IdCodice>01234567890</IdCodice>");
    expect(xml).toContain("<ProgressivoInvio>00001</ProgressivoInvio>");
    expect(xml).toContain("<FormatoTrasmissione>FPR12</FormatoTrasmissione>");
    expect(xml).toContain("<CodiceDestinatario>ABCDEFG</CodiceDestinatario>");
  });

  it("contains CedentePrestatore with cedente data", () => {
    expect(xml).toContain("<CedentePrestatore>");
    expect(xml).toContain("<Denominazione>Azienda Test Srl</Denominazione>");
    expect(xml).toContain("<RegimeFiscale>RF01</RegimeFiscale>");
    expect(xml).toContain("<Indirizzo>Via Roma 1</Indirizzo>");
    expect(xml).toContain("<CAP>00100</CAP>");
    expect(xml).toContain("<Comune>Roma</Comune>");
    expect(xml).toContain("<Provincia>RM</Provincia>");
  });

  it("contains CessionarioCommittente with buyer data", () => {
    expect(xml).toContain("<CessionarioCommittente>");
    expect(xml).toContain("<Denominazione>Cliente Spa</Denominazione>");
    expect(xml).toContain("<IdCodice>09876543210</IdCodice>");
  });

  it("contains FatturaElettronicaBody", () => {
    expect(xml).toContain("<FatturaElettronicaBody>");
    expect(xml).toContain("</FatturaElettronicaBody>");
  });

  it("contains DatiGeneraliDocumento with correct values", () => {
    expect(xml).toContain("<TipoDocumento>TD01</TipoDocumento>");
    expect(xml).toContain("<Divisa>EUR</Divisa>");
    expect(xml).toContain("<Data>2026-03-24</Data>");
    expect(xml).toContain("<Numero>FV/001</Numero>");
    expect(xml).toContain("<ImportoTotaleDocumento>1220.00</ImportoTotaleDocumento>");
    expect(xml).toContain("<Causale>Consulenza informatica mese di marzo 2026</Causale>");
  });

  it("contains DettaglioLinee with line items", () => {
    expect(xml).toContain("<DettaglioLinee>");
    expect(xml).toContain("<NumeroLinea>1</NumeroLinea>");
    expect(xml).toContain("<Descrizione>Consulenza informatica</Descrizione>");
    expect(xml).toContain("<PrezzoUnitario>1000.00000000</PrezzoUnitario>");
    expect(xml).toContain("<PrezzoTotale>1000.00000000</PrezzoTotale>");
    expect(xml).toContain("<AliquotaIVA>22.00</AliquotaIVA>");
  });

  it("contains DatiRiepilogo", () => {
    expect(xml).toContain("<DatiRiepilogo>");
    expect(xml).toContain("<ImponibileImporto>1000.00</ImponibileImporto>");
    expect(xml).toContain("<Imposta>220.00</Imposta>");
    expect(xml).toContain("<EsigibilitaIVA>I</EsigibilitaIVA>");
  });

  it("contains DatiPagamento", () => {
    expect(xml).toContain("<DatiPagamento>");
    expect(xml).toContain("<CondizioniPagamento>TP02</CondizioniPagamento>");
    expect(xml).toContain("<ModalitaPagamento>MP05</ModalitaPagamento>");
    expect(xml).toContain("<ImportoPagamento>1220.00</ImportoPagamento>");
    expect(xml).toContain("<IBAN>IT60X0542811101000000123456</IBAN>");
  });

  it("has proper indentation", () => {
    // Root children should have 2 spaces
    expect(xml).toContain("  <FatturaElettronicaHeader>");
    // DatiTrasmissione should have 4 spaces
    expect(xml).toContain("    <DatiTrasmissione>");
  });

  it("handles special characters in text content", () => {
    const inv = makeStandardInvoice();
    inv.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.Causale = [
      'Servizio "A" & Servizio <B>',
    ];
    const xmlWithSpecial = buildFatturaXml(inv);
    expect(xmlWithSpecial).toContain(
      "<Causale>Servizio &quot;A&quot; &amp; Servizio &lt;B&gt;</Causale>"
    );
  });

  it("omits optional elements when not present", () => {
    const inv = makeStandardInvoice();
    // Remove optional DatiPagamento
    delete (inv.FatturaElettronicaBody as Record<string, unknown>).DatiPagamento;
    const xmlNoPag = buildFatturaXml(inv);
    expect(xmlNoPag).not.toContain("<DatiPagamento>");
  });

  it("includes DatiBollo when present", () => {
    const inv = makeStandardInvoice();
    inv.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.DatiBollo = {
      BolloVirtuale: "SI",
      ImportoBollo: "2.00",
    };
    const xmlBollo = buildFatturaXml(inv);
    expect(xmlBollo).toContain("<DatiBollo>");
    expect(xmlBollo).toContain("<BolloVirtuale>SI</BolloVirtuale>");
    expect(xmlBollo).toContain("<ImportoBollo>2.00</ImportoBollo>");
  });

  it("includes DatiRitenuta when present", () => {
    const inv = makeStandardInvoice();
    inv.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.DatiRitenuta = [
      {
        TipoRitenuta: "RT01",
        ImportoRitenuta: "200.00",
        AliquotaRitenuta: "20.00",
        CausalePagamento: "A",
      },
    ];
    const xmlRit = buildFatturaXml(inv);
    expect(xmlRit).toContain("<DatiRitenuta>");
    expect(xmlRit).toContain("<TipoRitenuta>RT01</TipoRitenuta>");
    expect(xmlRit).toContain("<ImportoRitenuta>200.00</ImportoRitenuta>");
    expect(xmlRit).toContain("<AliquotaRitenuta>20.00</AliquotaRitenuta>");
    expect(xmlRit).toContain("<CausalePagamento>A</CausalePagamento>");
  });

  it("includes DatiCassaPrevidenziale when present", () => {
    const inv = makeStandardInvoice();
    inv.FatturaElettronicaBody.DatiGenerali.DatiGeneraliDocumento.DatiCassaPrevidenziale = [
      {
        TipoCassa: "TC22",
        AlCassa: "4.00",
        ImportoContributoCassa: "40.00",
        AliquotaIVA: "22.00",
      },
    ];
    const xmlCassa = buildFatturaXml(inv);
    expect(xmlCassa).toContain("<DatiCassaPrevidenziale>");
    expect(xmlCassa).toContain("<TipoCassa>TC22</TipoCassa>");
    expect(xmlCassa).toContain("<AlCassa>4.00</AlCassa>");
  });

  it("includes IscrizioneREA when present", () => {
    const inv = makeStandardInvoice();
    inv.FatturaElettronicaHeader.CedentePrestatore.IscrizioneREA = {
      Ufficio: "RM",
      NumeroREA: "1234567",
      CapitaleSociale: "10000.00",
      SocioUnico: "SM",
      StatoLiquidazione: "LN",
    };
    const xmlRea = buildFatturaXml(inv);
    expect(xmlRea).toContain("<IscrizioneREA>");
    expect(xmlRea).toContain("<Ufficio>RM</Ufficio>");
    expect(xmlRea).toContain("<NumeroREA>1234567</NumeroREA>");
    expect(xmlRea).toContain("<CapitaleSociale>10000.00</CapitaleSociale>");
  });

  it("handles multiple DettaglioLinee", () => {
    const inv = makeStandardInvoice();
    inv.FatturaElettronicaBody.DatiBeniServizi.DettaglioLinee = [
      {
        NumeroLinea: 1,
        Descrizione: "Servizio A",
        PrezzoUnitario: "500.00000000",
        PrezzoTotale: "500.00000000",
        AliquotaIVA: "22.00",
      },
      {
        NumeroLinea: 2,
        Descrizione: "Servizio B",
        PrezzoUnitario: "500.00000000",
        PrezzoTotale: "500.00000000",
        AliquotaIVA: "22.00",
      },
    ];
    const xmlMulti = buildFatturaXml(inv);
    expect(xmlMulti).toContain("<NumeroLinea>1</NumeroLinea>");
    expect(xmlMulti).toContain("<NumeroLinea>2</NumeroLinea>");
    expect(xmlMulti).toContain("<Descrizione>Servizio A</Descrizione>");
    expect(xmlMulti).toContain("<Descrizione>Servizio B</Descrizione>");
  });

  it("handles multiple DatiRiepilogo", () => {
    const inv = makeStandardInvoice();
    inv.FatturaElettronicaBody.DatiBeniServizi.DatiRiepilogo = [
      {
        AliquotaIVA: "22.00",
        ImponibileImporto: "500.00",
        Imposta: "110.00",
        EsigibilitaIVA: "I",
      },
      {
        AliquotaIVA: "0.00",
        Natura: "N4",
        ImponibileImporto: "500.00",
        Imposta: "0.00",
        RiferimentoNormativo: "Esenti art.10",
      },
    ];
    const xmlMultiR = buildFatturaXml(inv);
    // Should have two DatiRiepilogo blocks
    const count = (xmlMultiR.match(/<DatiRiepilogo>/g) || []).length;
    expect(count).toBe(2);
    expect(xmlMultiR).toContain("<Natura>N4</Natura>");
    expect(xmlMultiR).toContain("<RiferimentoNormativo>Esenti art.10</RiferimentoNormativo>");
  });

  it("includes Contatti when present", () => {
    const inv = makeStandardInvoice();
    inv.FatturaElettronicaHeader.CedentePrestatore.Contatti = {
      Telefono: "+39 06 1234567",
      Email: "info@test.it",
    };
    const xmlCont = buildFatturaXml(inv);
    expect(xmlCont).toContain("<Contatti>");
    expect(xmlCont).toContain("<Telefono>+39 06 1234567</Telefono>");
    expect(xmlCont).toContain("<Email>info@test.it</Email>");
  });

  it("includes PECDestinatario when present", () => {
    const inv = makeStandardInvoice();
    inv.FatturaElettronicaHeader.DatiTrasmissione.CodiceDestinatario = "0000000";
    inv.FatturaElettronicaHeader.DatiTrasmissione.PECDestinatario = "cliente@pec.it";
    const xmlPec = buildFatturaXml(inv);
    expect(xmlPec).toContain("<CodiceDestinatario>0000000</CodiceDestinatario>");
    expect(xmlPec).toContain("<PECDestinatario>cliente@pec.it</PECDestinatario>");
  });

  it("includes Nome/Cognome instead of Denominazione for persona fisica", () => {
    const inv = makeStandardInvoice();
    inv.FatturaElettronicaHeader.CessionarioCommittente.DatiAnagrafici.Anagrafica = {
      Nome: "Mario",
      Cognome: "Rossi",
    };
    const xmlPF = buildFatturaXml(inv);
    expect(xmlPF).toContain("<Nome>Mario</Nome>");
    expect(xmlPF).toContain("<Cognome>Rossi</Cognome>");
    // CessionarioCommittente Anagrafica should not have Denominazione
    // (CedentePrestatore still has it, so we check the cessionario section specifically)
    const ccSection = xmlPF.split("<CessionarioCommittente>")[1].split("</CessionarioCommittente>")[0];
    expect(ccSection).not.toContain("<Denominazione>");
  });
});
