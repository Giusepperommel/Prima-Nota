import type { PlafondCheckResult } from "./types";

type PlafondCheckInput = { plafondAttivo: boolean; importoDisponibile: number; importoUtilizzato: number; importoOperazione: number; };

export function checkPlafond(input: PlafondCheckInput): PlafondCheckResult {
  if (!input.plafondAttivo) {
    return { plafondAttivo: false, importoDisponibile: 0, importoUtilizzato: 0, importoResiduo: 0, sforamento: false, importoSforamento: 0 };
  }
  const nuovoUtilizzato = input.importoUtilizzato + input.importoOperazione;
  const sforamento = nuovoUtilizzato > input.importoDisponibile;
  const importoSforamento = sforamento ? nuovoUtilizzato - input.importoDisponibile : 0;
  const importoResiduo = Math.max(0, input.importoDisponibile - nuovoUtilizzato);
  return { plafondAttivo: true, importoDisponibile: input.importoDisponibile, importoUtilizzato: nuovoUtilizzato, importoResiduo, sforamento, importoSforamento };
}

export function calculateSforamento(disponibile: number, utilizzato: number, importoOperazione: number): number {
  return Math.max(0, (utilizzato + importoOperazione) - disponibile);
}
