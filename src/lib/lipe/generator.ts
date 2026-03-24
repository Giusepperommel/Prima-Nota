/**
 * LIPE XML generator.
 *
 * Generates XML in the IVP18 format required by Agenzia delle Entrate.
 * Uses xmlbuilder2 for robust XML construction.
 */

import { create } from "xmlbuilder2";
import type { LipeFornitura, LipeModulo } from "./types";
import { LIPE_NS } from "./types";

/**
 * Formats a number for LIPE XML: 2 decimal places, dot separator, no thousands separator.
 */
function formatDecimal(value: number): string {
  return value.toFixed(2);
}

/**
 * Adds a VP element to the modulo node only if the value is non-zero.
 */
function addVPElement(
  parent: ReturnType<typeof create>,
  name: string,
  value: number | undefined
): void {
  if (value != null && value !== 0) {
    parent.ele("iv:" + name).txt(formatDecimal(value));
  }
}

/**
 * Builds a single Modulo XML element from a LipeModulo.
 */
function buildModuloXml(
  parent: ReturnType<typeof create>,
  modulo: LipeModulo
): void {
  const mod = parent.ele("iv:Modulo");

  // NumeroModulo not required for single-entity submissions
  if (modulo.mese != null) {
    mod.ele("iv:Mese").txt(String(modulo.mese));
  }
  if (modulo.trimestre != null) {
    mod.ele("iv:Trimestre").txt(String(modulo.trimestre));
  }

  if (modulo.subfornitura != null) {
    mod.ele("iv:Subfornitura").txt(String(modulo.subfornitura));
  }
  if (modulo.eventiEccezionali != null) {
    mod.ele("iv:EventiEccezionali").txt(String(modulo.eventiEccezionali));
  }

  addVPElement(mod, "TotaleOperazioniAttive", modulo.totaleOperazioniAttive);
  addVPElement(mod, "TotaleOperazioniPassive", modulo.totaleOperazioniPassive);
  addVPElement(mod, "IvaEsigibile", modulo.ivaEsigibile);
  addVPElement(mod, "IvaDetratta", modulo.ivaDetratta);

  // VP6: mutually exclusive
  if (modulo.ivaDovuta != null && modulo.ivaDovuta > 0) {
    mod.ele("iv:IvaDovuta").txt(formatDecimal(modulo.ivaDovuta));
  } else if (modulo.ivaCredito != null && modulo.ivaCredito > 0) {
    mod.ele("iv:IvaCredito").txt(formatDecimal(modulo.ivaCredito));
  }

  addVPElement(mod, "DebitoPrecedente", modulo.debitoPrec);
  addVPElement(mod, "CreditoPeriodoPrecedente", modulo.creditoPrec);
  addVPElement(mod, "CreditoAnnoPrecedente", modulo.creditoAnnoPrec);
  addVPElement(mod, "VersamentiAutoUE", modulo.versamentiAutoUE);
  addVPElement(mod, "CreditiImposta", modulo.creditiImposta);
  addVPElement(mod, "InteressiDovuti", modulo.interessiDovuti);
  addVPElement(mod, "Acconto", modulo.acconto);

  // VP14: mutually exclusive
  if (modulo.importoDaVersare != null && modulo.importoDaVersare > 0) {
    mod.ele("iv:ImportoDaVersare").txt(formatDecimal(modulo.importoDaVersare));
  } else if (modulo.importoACredito != null && modulo.importoACredito > 0) {
    mod.ele("iv:ImportoACredito").txt(formatDecimal(modulo.importoACredito));
  }
}

/**
 * Generates the complete LIPE XML string from a LipeFornitura object.
 */
export function generateLipeXml(data: LipeFornitura): string {
  const doc = create({ version: "1.0", encoding: "UTF-8" });

  const fornitura = doc.ele("iv:Fornitura", {
    "xmlns:iv": LIPE_NS.iv,
    "xmlns:ds": LIPE_NS.ds,
  });

  // Intestazione
  const intestazione = fornitura.ele("iv:Intestazione");
  intestazione
    .ele("iv:CodiceFornitura")
    .txt(data.intestazione.codiceFornitura);

  if (data.intestazione.codiceFiscaleDichiarante) {
    intestazione
      .ele("iv:CodiceFiscaleDichiarante")
      .txt(data.intestazione.codiceFiscaleDichiarante);
  }
  if (data.intestazione.codiceCarica != null) {
    intestazione
      .ele("iv:CodiceCarica")
      .txt(String(data.intestazione.codiceCarica));
  }

  // Comunicazione
  const comunicazione = fornitura.ele("iv:Comunicazione");

  // Frontespizio
  const front = data.comunicazione.frontespizio;
  const frontXml = comunicazione.ele("iv:Frontespizio");
  frontXml.ele("iv:CodiceFiscale").txt(front.codiceFiscale);
  frontXml.ele("iv:AnnoImposta").txt(String(front.anno));
  frontXml.ele("iv:Trimestre").txt(String(front.trimestre));
  frontXml.ele("iv:PartitaIVA").txt(front.partitaIva);

  // CognomeODenominazione or cognome + nome
  if (front.nome) {
    frontXml.ele("iv:Cognome").txt(front.cognomeODenominazione);
    frontXml.ele("iv:Nome").txt(front.nome);
  } else {
    frontXml
      .ele("iv:CognomeODenominazione")
      .txt(front.cognomeODenominazione);
  }

  frontXml
    .ele("iv:FirmaDichiarazione")
    .txt(front.firmaDelDichiarante ? "1" : "0");

  // DatiContabili
  const datiContabili = comunicazione.ele("iv:DatiContabili");
  for (const modulo of data.comunicazione.datiContabili) {
    buildModuloXml(datiContabili, modulo);
  }

  return doc.end({ prettyPrint: true });
}

/**
 * Generates the standard LIPE file name.
 * Format: IT{codiceFiscale}_LI_{progressivo padded to 5}.xml
 */
export function generateLipeFileName(
  codiceFiscale: string,
  progressivo: number
): string {
  const prog = String(progressivo).padStart(5, "0");
  return `IT${codiceFiscale}_LI_${prog}.xml`;
}

/**
 * Calculates the LIPE submission deadline for a given quarter.
 * Q1 → May 31, Q2 → Sep 16 (extended to Sep 30), Q3 → Nov 30, Q4 → Feb 28/29 next year
 */
export function getScadenzaInvioLipe(
  anno: number,
  trimestre: number
): Date {
  switch (trimestre) {
    case 1:
      return new Date(anno, 4, 31); // May 31
    case 2:
      return new Date(anno, 8, 30); // Sep 30
    case 3:
      return new Date(anno, 10, 30); // Nov 30
    case 4:
      // Feb 28/29 of next year (use Date to auto-handle leap years)
      return new Date(anno + 1, 2, 0); // Last day of Feb
    default:
      return new Date(anno, 4, 31);
  }
}
