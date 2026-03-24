/**
 * LIPE (Liquidazioni Periodiche IVA) data types.
 * Maps to the IVP18 XML format used by Agenzia delle Entrate.
 */

export interface LipeFornitura {
  intestazione: LipeIntestazione;
  comunicazione: LipeComunicazione;
}

export interface LipeIntestazione {
  codiceFornitura: "IVP18";
  codiceFiscaleDichiarante?: string;
  codiceCarica?: number;
}

export interface LipeComunicazione {
  frontespizio: LipeFrontespizio;
  datiContabili: LipeModulo[];
}

export interface LipeFrontespizio {
  codiceFiscale: string;
  anno: number;
  trimestre: number;
  partitaIva: string;
  cognomeODenominazione: string;
  nome?: string;
  firmaDelDichiarante: boolean;
}

export interface LipeModulo {
  /** 1-12 for mensili */
  mese?: number;
  /** 1-4 for trimestrali (only one of mese/trimestre should be set) */
  trimestre?: number;
  /** VP2: totale operazioni attive */
  totaleOperazioniAttive: number;
  /** VP3: totale operazioni passive */
  totaleOperazioniPassive: number;
  /** VP4: IVA esigibile */
  ivaEsigibile: number;
  /** VP5: IVA detratta */
  ivaDetratta: number;
  /** VP6: IVA dovuta (if debito, mutually exclusive with ivaCredito) */
  ivaDovuta?: number;
  /** VP6: IVA a credito (if credito, mutually exclusive with ivaDovuta) */
  ivaCredito?: number;
  /** VP7: debito periodo precedente */
  debitoPrec: number;
  /** VP8: credito periodo precedente */
  creditoPrec: number;
  /** VP9: credito anno precedente */
  creditoAnnoPrec: number;
  /** VP10 */
  versamentiAutoUE: number;
  /** VP11 */
  creditiImposta: number;
  /** VP12: interessi dovuti (1% trimestrali) */
  interessiDovuti: number;
  /** VP13: acconto versato */
  acconto: number;
  /** VP14: importo da versare (if debito, mutually exclusive with importoACredito) */
  importoDaVersare?: number;
  /** VP14: importo a credito (if credito, mutually exclusive with importoDaVersare) */
  importoACredito?: number;
  /** Subfornitura (usually not used for small businesses) */
  subfornitura?: number;
  /** Eventi eccezionali flag */
  eventiEccezionali?: number;
  /** Operazioni straordinarie flag */
  operazioniStraordinarie?: number;
}

/**
 * LIPE XML namespace constants.
 */
export const LIPE_NS = {
  iv: "urn:www.agenziaentrate.gov.it:specificheTecniche:schemario:messaggi:v1.0",
  ds: "http://www.w3.org/2000/09/xmldsig#",
};
