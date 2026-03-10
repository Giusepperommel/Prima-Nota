// Costanti limiti fiscali art. 164 TUIR
export const LIMITI_LEASING_AUTO = {
  STANDARD: 18075.99,
  AGENTE: 25822.84,
};

export const LIMITI_NLT_ANNUO = {
  STANDARD: 3615.20,
  AGENTE: 5164.57,
};

export const DURATA_MINIMA_FISCALE_AUTO_MESI = 48;

type TipoAttivita = "SRL" | "SRLS" | "SNC" | "SAS" | "STP" | "DITTA_INDIVIDUALE" | "LIBERO_PROFESSIONISTA" | "AGENTE_COMMERCIO";

/**
 * Calcola il coefficiente di proporzionalità per leasing auto.
 * Se il valore del bene supera il limite fiscale, il canone deducibile
 * si riduce proporzionalmente: canone × (limite / valoreBene)
 */
export function calcolaCoeffLeasing(
  valoreBene: number,
  tipoAttivita: TipoAttivita
): number {
  const isAgente = tipoAttivita === "AGENTE_COMMERCIO";
  const limite = isAgente ? LIMITI_LEASING_AUTO.AGENTE : LIMITI_LEASING_AUTO.STANDARD;

  if (valoreBene <= limite) return 1;
  return limite / valoreBene;
}

/**
 * Calcola la quota di maxicanone mensile da aggiungere al canone
 * per il calcolo della deducibilità.
 * Il maxicanone va riscontato sull'intera durata del contratto.
 */
export function calcolaQuotaMaxicanoneMensile(
  maxicanone: number,
  durataContratto: number
): number {
  if (durataContratto <= 0 || maxicanone <= 0) return 0;
  return maxicanone / durataContratto;
}

/**
 * Per NLT: calcola il cap mensile sulla quota locazione.
 * Limite annuo: €3.615,20 (standard) o €5.164,57 (agenti).
 * È un cap secco, non proporzionale.
 */
export function calcolaCapNltMensile(tipoAttivita: TipoAttivita): number {
  const isAgente = tipoAttivita === "AGENTE_COMMERCIO";
  const limiteAnnuo = isAgente ? LIMITI_NLT_ANNUO.AGENTE : LIMITI_NLT_ANNUO.STANDARD;
  return Math.round((limiteAnnuo / 12) * 100) / 100;
}

/**
 * Calcola l'importo deducibile per un canone di leasing auto.
 * Applica: proporzionalità sul valore bene + maxicanone riscontato.
 *
 * @returns importoDeducibile (dopo applicazione % deducibilità)
 */
export function calcolaDeducibileLeasing(params: {
  canone: number;
  valoreBene: number;
  maxicanone: number;
  durataContratto: number;
  percentualeDeducibilita: number;
  tipoAttivita: TipoAttivita;
}): number {
  const { canone, valoreBene, maxicanone, durataContratto, percentualeDeducibilita, tipoAttivita } = params;

  const coeff = calcolaCoeffLeasing(valoreBene, tipoAttivita);
  const quotaMaxicanone = calcolaQuotaMaxicanoneMensile(maxicanone, durataContratto);

  // Il canone fiscalmente rilevante è (canone + quota maxicanone mensile) × coefficiente
  const canoneFiscale = (canone + quotaMaxicanone) * coeff;

  return Math.round(canoneFiscale * percentualeDeducibilita) / 100;
}

/**
 * Calcola l'importo deducibile per un canone NLT auto.
 * La quota locazione ha un cap annuo; la quota servizi non ha limiti.
 *
 * @returns importoDeducibile (dopo applicazione % deducibilità)
 */
export function calcolaDeducibileNlt(params: {
  canone: number;
  quotaServizi: number;
  maxicanone: number;
  durataContratto: number;
  percentualeDeducibilita: number;
  tipoAttivita: TipoAttivita;
}): number {
  const { canone, quotaServizi, maxicanone, durataContratto, percentualeDeducibilita, tipoAttivita } = params;

  const quotaLocazione = canone - quotaServizi;
  const capMensile = calcolaCapNltMensile(tipoAttivita);

  // Quota locazione: capped al limite mensile
  const quotaLocazioneDeducibile = Math.min(quotaLocazione, capMensile);

  // Quota servizi: nessun cap, stessa % deducibilità
  // Anticipo NLT: riscontato sulla durata
  const quotaAnticipo = (maxicanone > 0 && durataContratto > 0)
    ? maxicanone / durataContratto
    : 0;

  const totaleFiscale = quotaLocazioneDeducibile + quotaServizi + quotaAnticipo;

  return Math.round(totaleFiscale * percentualeDeducibilita) / 100;
}

/**
 * Calcola la data effettiva per un dato mese/anno rispettando il giorno scelto.
 * Se il mese ha meno giorni, usa l'ultimo giorno del mese.
 */
export function calcolaDataEffettiva(
  giornoDelMese: number,
  mese: number, // 0-11
  anno: number
): Date {
  // Ultimo giorno del mese
  const ultimoGiorno = new Date(anno, mese + 1, 0).getDate();
  const giornoEffettivo = Math.min(giornoDelMese, ultimoGiorno);
  return new Date(anno, mese, giornoEffettivo);
}

/**
 * Calcola la prossima data di generazione a partire dalla data corrente.
 */
export function calcolaProssimaGenerazione(
  giornoDelMese: number,
  dataCorrente: Date
): Date {
  const mese = dataCorrente.getMonth();
  const anno = dataCorrente.getFullYear();

  // Prova il mese successivo
  const meseProssimo = mese + 1;
  const annoProssimo = meseProssimo > 11 ? anno + 1 : anno;
  const meseEffettivo = meseProssimo > 11 ? 0 : meseProssimo;

  return calcolaDataEffettiva(giornoDelMese, meseEffettivo, annoProssimo);
}
