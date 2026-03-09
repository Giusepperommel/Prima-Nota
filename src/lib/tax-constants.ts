/**
 * Italian tax constants for SRL fiscal estimation.
 * Reference year: 2025/2026.
 *
 * These are indicative values for planning purposes.
 */

// IRES — Imposta sul Reddito delle Societa
export const IRES_RATE = 24; // %

// IRAP — Imposta Regionale sulle Attivita Produttive
export const IRAP_RATE_DEFAULT = 3.9; // % (base nazionale, varia per regione)

// Ritenuta a titolo d'imposta sui dividendi distribuiti a persone fisiche
export const RITENUTA_DIVIDENDI = 26; // %

// IRPEF — Imposta sul Reddito delle Persone Fisiche (scaglioni 2025/2026)
export const IRPEF_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 28000, rate: 23 },
  { upTo: 50000, rate: 33 },
  { upTo: Infinity, rate: 43 },
];

// INPS Gestione Commercianti (soci lavoratori SRL commerciale)
export const INPS_COMMERCIANTI = {
  aliquota: 24.48, // % sul reddito attribuito
  minimale: 18415, // reddito minimo su cui calcolare contributi
  contributoMinimale: 4515.43, // contributo fisso minimo annuo (circa)
  massimale: 119650, // reddito massimo contributivo
};
