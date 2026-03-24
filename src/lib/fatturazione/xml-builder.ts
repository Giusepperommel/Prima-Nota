/**
 * FatturaPA XML Builder — serializes a FatturaPA object to valid XML v1.2.2.
 *
 * Uses template literals (no heavy XML library). The FatturaPA structure is
 * well-defined and predictable, making a lightweight approach appropriate.
 */

import {
  FATTURAPA_NAMESPACE,
  FATTURAPA_SCHEMA_LOCATION,
  FATTURAPA_SCHEMA_VERSION,
  FATTURAPA_DS_NAMESPACE,
  FATTURAPA_XSI_NAMESPACE,
} from "./constants";

import type {
  FatturaPA,
  FatturaElettronicaHeader,
  FatturaElettronicaBody,
  DatiTrasmissione,
  CedentePrestatore,
  CedentePrestatoreAnagrafici,
  CessionarioCommittente,
  CessionarioCommittenteAnagrafici,
  Anagrafica,
  Sede,
  IdFiscaleIVA,
  IscrizioneREA,
  Contatti,
  DatiGenerali,
  DatiGeneraliDocumento,
  DatiRitenuta,
  DatiBollo,
  DatiCassaPrevidenziale,
  ScontoMaggiorazione,
  DatiBeniServizi,
  DettaglioLinee,
  DatiRiepilogo,
  DatiPagamento,
  DettaglioPagamento,
  CodiceArticolo,
  AltriDatiGestionali,
  Allegato,
} from "./types";

// ─── XML Escaping ───────────────────────────────────────────────────────────

const XML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export function escapeXml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => XML_ESCAPE_MAP[ch]);
}

// ─── Helper: XML element builder ────────────────────────────────────────────

function el(tag: string, value: string | number | undefined | null, indent: string): string {
  if (value === undefined || value === null || value === "") return "";
  const escaped = typeof value === "number" ? String(value) : escapeXml(String(value));
  return `${indent}<${tag}>${escaped}</${tag}>\n`;
}

function openTag(tag: string, indent: string, attrs?: string): string {
  return attrs ? `${indent}<${tag} ${attrs}>\n` : `${indent}<${tag}>\n`;
}

function closeTag(tag: string, indent: string): string {
  return `${indent}</${tag}>\n`;
}

// ─── Section builders ───────────────────────────────────────────────────────

function buildIdFiscaleIVA(id: IdFiscaleIVA, indent: string): string {
  let xml = openTag("IdFiscaleIVA", indent);
  xml += el("IdPaese", id.IdPaese, indent + "  ");
  xml += el("IdCodice", id.IdCodice, indent + "  ");
  xml += closeTag("IdFiscaleIVA", indent);
  return xml;
}

function buildAnagrafica(a: Anagrafica, indent: string): string {
  let xml = openTag("Anagrafica", indent);
  xml += el("Denominazione", a.Denominazione, indent + "  ");
  xml += el("Nome", a.Nome, indent + "  ");
  xml += el("Cognome", a.Cognome, indent + "  ");
  xml += el("Titolo", a.Titolo, indent + "  ");
  xml += el("CodEORI", a.CodEORI, indent + "  ");
  xml += closeTag("Anagrafica", indent);
  return xml;
}

function buildSede(sede: Sede, tag: string, indent: string): string {
  let xml = openTag(tag, indent);
  xml += el("Indirizzo", sede.Indirizzo, indent + "  ");
  xml += el("NumeroCivico", sede.NumeroCivico, indent + "  ");
  xml += el("CAP", sede.CAP, indent + "  ");
  xml += el("Comune", sede.Comune, indent + "  ");
  xml += el("Provincia", sede.Provincia, indent + "  ");
  xml += el("Nazione", sede.Nazione, indent + "  ");
  xml += closeTag(tag, indent);
  return xml;
}

function buildIscrizioneREA(rea: IscrizioneREA, indent: string): string {
  let xml = openTag("IscrizioneREA", indent);
  xml += el("Ufficio", rea.Ufficio, indent + "  ");
  xml += el("NumeroREA", rea.NumeroREA, indent + "  ");
  xml += el("CapitaleSociale", rea.CapitaleSociale, indent + "  ");
  xml += el("SocioUnico", rea.SocioUnico, indent + "  ");
  xml += el("StatoLiquidazione", rea.StatoLiquidazione, indent + "  ");
  xml += closeTag("IscrizioneREA", indent);
  return xml;
}

function buildContatti(contatti: Contatti, indent: string): string {
  let xml = openTag("Contatti", indent);
  xml += el("Telefono", contatti.Telefono, indent + "  ");
  xml += el("Fax", contatti.Fax, indent + "  ");
  xml += el("Email", contatti.Email, indent + "  ");
  xml += closeTag("Contatti", indent);
  return xml;
}

function buildDatiTrasmissione(dt: DatiTrasmissione, indent: string): string {
  let xml = openTag("DatiTrasmissione", indent);
  xml += buildIdFiscaleIVA(dt.IdTrasmittente, indent + "  ");
  xml += el("ProgressivoInvio", dt.ProgressivoInvio, indent + "  ");
  xml += el("FormatoTrasmissione", dt.FormatoTrasmissione, indent + "  ");
  xml += el("CodiceDestinatario", dt.CodiceDestinatario, indent + "  ");
  if (dt.ContattiTrasmittente) {
    let ct = openTag("ContattiTrasmittente", indent + "  ");
    ct += el("Telefono", dt.ContattiTrasmittente.Telefono, indent + "    ");
    ct += el("Email", dt.ContattiTrasmittente.Email, indent + "    ");
    ct += closeTag("ContattiTrasmittente", indent + "  ");
    xml += ct;
  }
  xml += el("PECDestinatario", dt.PECDestinatario, indent + "  ");
  xml += closeTag("DatiTrasmissione", indent);
  return xml;
}

function buildCedenteAnagrafici(da: CedentePrestatoreAnagrafici, indent: string): string {
  let xml = openTag("DatiAnagrafici", indent);
  xml += buildIdFiscaleIVA(da.IdFiscaleIVA, indent + "  ");
  xml += el("CodiceFiscale", da.CodiceFiscale, indent + "  ");
  xml += buildAnagrafica(da.Anagrafica, indent + "  ");
  xml += el("AlboProfessionale", da.AlboProfessionale, indent + "  ");
  xml += el("ProvinciaAlbo", da.ProvinciaAlbo, indent + "  ");
  xml += el("NumeroIscrizioneAlbo", da.NumeroIscrizioneAlbo, indent + "  ");
  xml += el("DataIscrizioneAlbo", da.DataIscrizioneAlbo, indent + "  ");
  xml += el("RegimeFiscale", da.RegimeFiscale, indent + "  ");
  xml += closeTag("DatiAnagrafici", indent);
  return xml;
}

function buildCedentePrestatore(cp: CedentePrestatore, indent: string): string {
  let xml = openTag("CedentePrestatore", indent);
  xml += buildCedenteAnagrafici(cp.DatiAnagrafici, indent + "  ");
  xml += buildSede(cp.Sede, "Sede", indent + "  ");
  if (cp.StabileOrganizzazione) {
    xml += buildSede(cp.StabileOrganizzazione, "StabileOrganizzazione", indent + "  ");
  }
  if (cp.IscrizioneREA) {
    xml += buildIscrizioneREA(cp.IscrizioneREA, indent + "  ");
  }
  if (cp.Contatti) {
    xml += buildContatti(cp.Contatti, indent + "  ");
  }
  xml += el("RiferimentoAmministrazione", cp.RiferimentoAmministrazione, indent + "  ");
  xml += closeTag("CedentePrestatore", indent);
  return xml;
}

function buildCessionarioAnagrafici(da: CessionarioCommittenteAnagrafici, indent: string): string {
  let xml = openTag("DatiAnagrafici", indent);
  if (da.IdFiscaleIVA) {
    xml += buildIdFiscaleIVA(da.IdFiscaleIVA, indent + "  ");
  }
  xml += el("CodiceFiscale", da.CodiceFiscale, indent + "  ");
  xml += buildAnagrafica(da.Anagrafica, indent + "  ");
  xml += closeTag("DatiAnagrafici", indent);
  return xml;
}

function buildCessionarioCommittente(cc: CessionarioCommittente, indent: string): string {
  let xml = openTag("CessionarioCommittente", indent);
  xml += buildCessionarioAnagrafici(cc.DatiAnagrafici, indent + "  ");
  xml += buildSede(cc.Sede, "Sede", indent + "  ");
  if (cc.StabileOrganizzazione) {
    xml += buildSede(cc.StabileOrganizzazione, "StabileOrganizzazione", indent + "  ");
  }
  xml += closeTag("CessionarioCommittente", indent);
  return xml;
}

function buildHeader(header: FatturaElettronicaHeader, indent: string): string {
  let xml = openTag("FatturaElettronicaHeader", indent);
  xml += buildDatiTrasmissione(header.DatiTrasmissione, indent + "  ");
  xml += buildCedentePrestatore(header.CedentePrestatore, indent + "  ");
  xml += buildCessionarioCommittente(header.CessionarioCommittente, indent + "  ");
  xml += closeTag("FatturaElettronicaHeader", indent);
  return xml;
}

// ─── Body builders ──────────────────────────────────────────────────────────

function buildDatiRitenuta(dr: DatiRitenuta, indent: string): string {
  let xml = openTag("DatiRitenuta", indent);
  xml += el("TipoRitenuta", dr.TipoRitenuta, indent + "  ");
  xml += el("ImportoRitenuta", dr.ImportoRitenuta, indent + "  ");
  xml += el("AliquotaRitenuta", dr.AliquotaRitenuta, indent + "  ");
  xml += el("CausalePagamento", dr.CausalePagamento, indent + "  ");
  xml += closeTag("DatiRitenuta", indent);
  return xml;
}

function buildDatiBollo(db: DatiBollo, indent: string): string {
  let xml = openTag("DatiBollo", indent);
  xml += el("BolloVirtuale", db.BolloVirtuale, indent + "  ");
  xml += el("ImportoBollo", db.ImportoBollo, indent + "  ");
  xml += closeTag("DatiBollo", indent);
  return xml;
}

function buildDatiCassaPrevidenziale(dc: DatiCassaPrevidenziale, indent: string): string {
  let xml = openTag("DatiCassaPrevidenziale", indent);
  xml += el("TipoCassa", dc.TipoCassa, indent + "  ");
  xml += el("AlCassa", dc.AlCassa, indent + "  ");
  xml += el("ImportoContributoCassa", dc.ImportoContributoCassa, indent + "  ");
  xml += el("ImponibileCassa", dc.ImponibileCassa, indent + "  ");
  xml += el("AliquotaIVA", dc.AliquotaIVA, indent + "  ");
  xml += el("Ritenuta", dc.Ritenuta, indent + "  ");
  xml += el("Natura", dc.Natura, indent + "  ");
  xml += el("RiferimentoAmministrazione", dc.RiferimentoAmministrazione, indent + "  ");
  xml += closeTag("DatiCassaPrevidenziale", indent);
  return xml;
}

function buildScontoMaggiorazione(sm: ScontoMaggiorazione, indent: string): string {
  let xml = openTag("ScontoMaggiorazione", indent);
  xml += el("Tipo", sm.Tipo, indent + "  ");
  xml += el("Percentuale", sm.Percentuale, indent + "  ");
  xml += el("Importo", sm.Importo, indent + "  ");
  xml += closeTag("ScontoMaggiorazione", indent);
  return xml;
}

function buildDatiGeneraliDocumento(dgd: DatiGeneraliDocumento, indent: string): string {
  let xml = openTag("DatiGeneraliDocumento", indent);
  xml += el("TipoDocumento", dgd.TipoDocumento, indent + "  ");
  xml += el("Divisa", dgd.Divisa, indent + "  ");
  xml += el("Data", dgd.Data, indent + "  ");
  xml += el("Numero", dgd.Numero, indent + "  ");
  if (dgd.DatiRitenuta) {
    for (const dr of dgd.DatiRitenuta) {
      xml += buildDatiRitenuta(dr, indent + "  ");
    }
  }
  if (dgd.DatiBollo) {
    xml += buildDatiBollo(dgd.DatiBollo, indent + "  ");
  }
  if (dgd.DatiCassaPrevidenziale) {
    for (const dc of dgd.DatiCassaPrevidenziale) {
      xml += buildDatiCassaPrevidenziale(dc, indent + "  ");
    }
  }
  if (dgd.ScontoMaggiorazione) {
    for (const sm of dgd.ScontoMaggiorazione) {
      xml += buildScontoMaggiorazione(sm, indent + "  ");
    }
  }
  xml += el("ImportoTotaleDocumento", dgd.ImportoTotaleDocumento, indent + "  ");
  xml += el("Arrotondamento", dgd.Arrotondamento, indent + "  ");
  if (dgd.Causale) {
    for (const c of dgd.Causale) {
      xml += el("Causale", c, indent + "  ");
    }
  }
  xml += el("Art73", dgd.Art73, indent + "  ");
  xml += closeTag("DatiGeneraliDocumento", indent);
  return xml;
}

function buildDatiGenerali(dg: DatiGenerali, indent: string): string {
  let xml = openTag("DatiGenerali", indent);
  xml += buildDatiGeneraliDocumento(dg.DatiGeneraliDocumento, indent + "  ");
  // DatiOrdineAcquisto, DatiContratto, etc. are rarely used; include if present
  if (dg.DatiDDT) {
    for (const ddt of dg.DatiDDT) {
      let ddtXml = openTag("DatiDDT", indent + "  ");
      ddtXml += el("NumeroDDT", ddt.NumeroDDT, indent + "    ");
      ddtXml += el("DataDDT", ddt.DataDDT, indent + "    ");
      if (ddt.RiferimentoNumeroLinea) {
        for (const rnl of ddt.RiferimentoNumeroLinea) {
          ddtXml += el("RiferimentoNumeroLinea", rnl, indent + "    ");
        }
      }
      ddtXml += closeTag("DatiDDT", indent + "  ");
      xml += ddtXml;
    }
  }
  xml += closeTag("DatiGenerali", indent);
  return xml;
}

function buildCodiceArticolo(ca: CodiceArticolo, indent: string): string {
  let xml = openTag("CodiceArticolo", indent);
  xml += el("CodiceTipo", ca.CodiceTipo, indent + "  ");
  xml += el("CodiceValore", ca.CodiceValore, indent + "  ");
  xml += closeTag("CodiceArticolo", indent);
  return xml;
}

function buildAltriDatiGestionali(adg: AltriDatiGestionali, indent: string): string {
  let xml = openTag("AltriDatiGestionali", indent);
  xml += el("TipoDato", adg.TipoDato, indent + "  ");
  xml += el("RiferimentoTesto", adg.RiferimentoTesto, indent + "  ");
  xml += el("RiferimentoNumero", adg.RiferimentoNumero, indent + "  ");
  xml += el("RiferimentoData", adg.RiferimentoData, indent + "  ");
  xml += closeTag("AltriDatiGestionali", indent);
  return xml;
}

function buildDettaglioLinee(dl: DettaglioLinee, indent: string): string {
  let xml = openTag("DettaglioLinee", indent);
  xml += el("NumeroLinea", dl.NumeroLinea, indent + "  ");
  xml += el("TipoCessionePrestazione", dl.TipoCessionePrestazione, indent + "  ");
  if (dl.CodiceArticolo) {
    for (const ca of dl.CodiceArticolo) {
      xml += buildCodiceArticolo(ca, indent + "  ");
    }
  }
  xml += el("Descrizione", dl.Descrizione, indent + "  ");
  xml += el("Quantita", dl.Quantita, indent + "  ");
  xml += el("UnitaMisura", dl.UnitaMisura, indent + "  ");
  xml += el("DataInizioPeriodo", dl.DataInizioPeriodo, indent + "  ");
  xml += el("DataFinePeriodo", dl.DataFinePeriodo, indent + "  ");
  xml += el("PrezzoUnitario", dl.PrezzoUnitario, indent + "  ");
  if (dl.ScontoMaggiorazione) {
    for (const sm of dl.ScontoMaggiorazione) {
      xml += buildScontoMaggiorazione(sm, indent + "  ");
    }
  }
  xml += el("PrezzoTotale", dl.PrezzoTotale, indent + "  ");
  xml += el("AliquotaIVA", dl.AliquotaIVA, indent + "  ");
  xml += el("Ritenuta", dl.Ritenuta, indent + "  ");
  xml += el("Natura", dl.Natura, indent + "  ");
  xml += el("RiferimentoAmministrazione", dl.RiferimentoAmministrazione, indent + "  ");
  if (dl.AltriDatiGestionali) {
    for (const adg of dl.AltriDatiGestionali) {
      xml += buildAltriDatiGestionali(adg, indent + "  ");
    }
  }
  xml += closeTag("DettaglioLinee", indent);
  return xml;
}

function buildDatiRiepilogo(dr: DatiRiepilogo, indent: string): string {
  let xml = openTag("DatiRiepilogo", indent);
  xml += el("AliquotaIVA", dr.AliquotaIVA, indent + "  ");
  xml += el("Natura", dr.Natura, indent + "  ");
  xml += el("SpeseAccessorie", dr.SpeseAccessorie, indent + "  ");
  xml += el("Arrotondamento", dr.Arrotondamento, indent + "  ");
  xml += el("ImponibileImporto", dr.ImponibileImporto, indent + "  ");
  xml += el("Imposta", dr.Imposta, indent + "  ");
  xml += el("EsigibilitaIVA", dr.EsigibilitaIVA, indent + "  ");
  xml += el("RiferimentoNormativo", dr.RiferimentoNormativo, indent + "  ");
  xml += closeTag("DatiRiepilogo", indent);
  return xml;
}

function buildDatiBeniServizi(dbs: DatiBeniServizi, indent: string): string {
  let xml = openTag("DatiBeniServizi", indent);
  for (const dl of dbs.DettaglioLinee) {
    xml += buildDettaglioLinee(dl, indent + "  ");
  }
  for (const dr of dbs.DatiRiepilogo) {
    xml += buildDatiRiepilogo(dr, indent + "  ");
  }
  xml += closeTag("DatiBeniServizi", indent);
  return xml;
}

function buildDettaglioPagamento(dp: DettaglioPagamento, indent: string): string {
  let xml = openTag("DettaglioPagamento", indent);
  xml += el("Beneficiario", dp.Beneficiario, indent + "  ");
  xml += el("ModalitaPagamento", dp.ModalitaPagamento, indent + "  ");
  xml += el("DataRiferimentoTerminiPagamento", dp.DataRiferimentoTerminiPagamento, indent + "  ");
  xml += el("GiorniTerminiPagamento", dp.GiorniTerminiPagamento, indent + "  ");
  xml += el("DataScadenzaPagamento", dp.DataScadenzaPagamento, indent + "  ");
  xml += el("ImportoPagamento", dp.ImportoPagamento, indent + "  ");
  xml += el("IstitutoFinanziario", dp.IstitutoFinanziario, indent + "  ");
  xml += el("IBAN", dp.IBAN, indent + "  ");
  xml += el("ABI", dp.ABI, indent + "  ");
  xml += el("CAB", dp.CAB, indent + "  ");
  xml += el("BIC", dp.BIC, indent + "  ");
  xml += el("ScontoPagamentoAnticipato", dp.ScontoPagamentoAnticipato, indent + "  ");
  xml += el("DataLimitePagamentoAnticipato", dp.DataLimitePagamentoAnticipato, indent + "  ");
  xml += el("PenalitaPagamentiRitardati", dp.PenalitaPagamentiRitardati, indent + "  ");
  xml += el("DataDecorrenzaPenale", dp.DataDecorrenzaPenale, indent + "  ");
  xml += el("CodicePagamento", dp.CodicePagamento, indent + "  ");
  xml += closeTag("DettaglioPagamento", indent);
  return xml;
}

function buildDatiPagamento(dp: DatiPagamento, indent: string): string {
  let xml = openTag("DatiPagamento", indent);
  xml += el("CondizioniPagamento", dp.CondizioniPagamento, indent + "  ");
  for (const det of dp.DettaglioPagamento) {
    xml += buildDettaglioPagamento(det, indent + "  ");
  }
  xml += closeTag("DatiPagamento", indent);
  return xml;
}

function buildAllegato(a: Allegato, indent: string): string {
  let xml = openTag("Allegati", indent);
  xml += el("NomeAttachment", a.NomeAttachment, indent + "  ");
  xml += el("AlgoritmoCompressione", a.AlgoritmoCompressione, indent + "  ");
  xml += el("FormatoAttachment", a.FormatoAttachment, indent + "  ");
  xml += el("DescrizioneAttachment", a.DescrizioneAttachment, indent + "  ");
  xml += el("Attachment", a.Attachment, indent + "  ");
  xml += closeTag("Allegati", indent);
  return xml;
}

function buildBody(body: FatturaElettronicaBody, indent: string): string {
  let xml = openTag("FatturaElettronicaBody", indent);
  xml += buildDatiGenerali(body.DatiGenerali, indent + "  ");
  xml += buildDatiBeniServizi(body.DatiBeniServizi, indent + "  ");
  if (body.DatiPagamento) {
    xml += buildDatiPagamento(body.DatiPagamento, indent + "  ");
  }
  if (body.Allegati) {
    for (const a of body.Allegati) {
      xml += buildAllegato(a, indent + "  ");
    }
  }
  xml += closeTag("FatturaElettronicaBody", indent);
  return xml;
}

// ─── Main export ────────────────────────────────────────────────────────────

/**
 * Builds a complete FatturaPA XML string from a FatturaPA data object.
 *
 * Produces valid XML with:
 * - XML declaration (<?xml version="1.0" encoding="UTF-8"?>)
 * - Root element with namespace, schema location, versione attribute
 * - FatturaElettronicaHeader
 * - FatturaElettronicaBody
 * - Proper indentation (2 spaces)
 * - XML escaping for special characters
 */
export function buildFatturaXml(fattura: FatturaPA): string {
  const rootAttrs = [
    `versione="${FATTURAPA_SCHEMA_VERSION}"`,
    `xmlns:ds="${FATTURAPA_DS_NAMESPACE}"`,
    `xmlns:p="${FATTURAPA_NAMESPACE}"`,
    `xmlns:xsi="${FATTURAPA_XSI_NAMESPACE}"`,
    `xsi:schemaLocation="${FATTURAPA_SCHEMA_LOCATION}"`,
  ].join(" ");

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<p:FatturaElettronica ${rootAttrs}>\n`;
  xml += buildHeader(fattura.FatturaElettronicaHeader, "  ");
  xml += buildBody(fattura.FatturaElettronicaBody, "  ");
  xml += `</p:FatturaElettronica>\n`;

  return xml;
}
