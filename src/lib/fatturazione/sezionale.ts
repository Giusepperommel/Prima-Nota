/**
 * Sezionale numbering logic for FatturaPA.
 *
 * Pure functions for generating invoice numbers, SDI file names,
 * and unique transmission progressives.
 */

export interface SezionaleConfig {
  prefisso: string;
  separatore: string;
  paddingCifre: number;
  ultimoNumero: number;
}

/**
 * Generates the next invoice number from a sezionale configuration.
 *
 * @example
 * generaNumeroFattura({ prefisso: "FT", separatore: "-", paddingCifre: 4, ultimoNumero: 47 })
 * // => "FT-0048"
 */
export function generaNumeroFattura(sezionale: SezionaleConfig): string {
  const prossimo = sezionale.ultimoNumero + 1;
  const numeroPadded = String(prossimo).padStart(sezionale.paddingCifre, "0");
  return `${sezionale.prefisso}${sezionale.separatore}${numeroPadded}`;
}

/**
 * Generates the SDI file name for a FatturaPA XML.
 *
 * Format: IT{partitaIva}_{progressivo}.xml
 *
 * @example
 * generaNomeFileSdi("01234567890", "00001")
 * // => "IT01234567890_00001.xml"
 */
export function generaNomeFileSdi(partitaIva: string, progressivo: string): string {
  return `IT${partitaIva}_${progressivo}.xml`;
}

/**
 * Generates a random 5-character alphanumeric progressive for SDI transmission.
 *
 * Characters are uppercase letters and digits (36 possible chars).
 */
export function generaProgressivoInvio(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
