import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";

/**
 * Genera la scrittura contabile per un compenso amministratore.
 *
 * Caso semplice (solo ritenuta):
 *   Dare: Compensi amministratori       = importoTotale (lordo)
 *   Avere: Debiti vs amministratori      = lordo - ritenuta (netto)
 *   Avere: Erario c/ritenute             = ritenuta
 *
 * Caso con INPS gestione separata:
 *   Dare: Compensi amministratori        = importoTotale (lordo)
 *   Dare: Contributi INPS c/ditta        = contributoInpsAzienda (2/3)
 *   Avere: Debiti vs amministratori      = lordo - ritenuta - (contributoInpsTotale - contributoInpsAzienda)
 *   Avere: Erario c/ritenute             = ritenuta
 *   Avere: INPS c/contributi             = contributoInpsTotale
 */
export function generaCompensoAmministratore(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata {
  const { operazione, categoriaContoId, contoEsplicito, anagraficaDenominazione } = input;
  const warnings: string[] = [];
  const movimenti: MovimentoGenerato[] = [];

  const causale = "CA";

  // Resolve compenso cost account (330.040 or category default)
  const compensoResult = contoEsplicito
    ? resolver.resolveEsplicito(contoEsplicito)
    : resolver.resolveCategoria(categoriaContoId);

  if (compensoResult.contoId === null) {
    warnings.push(compensoResult.warning ?? "Conto compenso non risolvibile — scrittura provvisoria");
  }

  const contoIdCompenso = compensoResult.contoId;

  // Resolve structural accounts
  const contoDebitiAmm = resolver.getStrutturale("DEBITI_AMMINISTRATORI");
  const contoRitenute = resolver.getStrutturale("ERARIO_RITENUTE");
  const contoInps = resolver.getStrutturale("INPS_CONTRIBUTI");

  // Extract amounts
  const importoLordo = operazione.importoTotale;
  const importoRitenuta = operazione.importoRitenuta ?? 0;

  // INPS fields (extended, not in base OperazioneContabile)
  const op = operazione as Record<string, unknown>;
  const contributoInpsTotale = (typeof op.contributoInpsTotale === "number") ? op.contributoInpsTotale : 0;
  const contributoInpsAzienda = (typeof op.contributoInpsAzienda === "number") ? op.contributoInpsAzienda : 0;

  // 1/3 a carico amministratore
  const contributoInpsAmministratore = Math.round((contributoInpsTotale - contributoInpsAzienda) * 100) / 100;

  // Netto da corrispondere all'amministratore
  const importoNetto = Math.round((importoLordo - importoRitenuta - contributoInpsAmministratore) * 100) / 100;

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  let ordine = 1;

  // Dare: compensi amministratori (lordo)
  movimenti.push({
    contoId: contoIdCompenso as number,
    importoDare: importoLordo,
    importoAvere: 0,
    descrizione: "Compenso lordo amministratore",
    ordine: ordine++,
  });

  // Dare: contributi INPS c/ditta (if present)
  if (contributoInpsAzienda > 0) {
    // Use same compenso account for INPS cost (accountant can override)
    movimenti.push({
      contoId: contoIdCompenso as number,
      importoDare: contributoInpsAzienda,
      importoAvere: 0,
      descrizione: "Contributi INPS c/ditta",
      ordine: ordine++,
    });
  }

  // Avere: debiti vs amministratori (netto)
  movimenti.push({
    contoId: contoDebitiAmm!,
    importoDare: 0,
    importoAvere: importoNetto,
    descrizione: "Debito verso amministratore (netto)",
    ordine: ordine++,
  });

  // Avere: erario ritenute
  if (importoRitenuta > 0) {
    movimenti.push({
      contoId: contoRitenute!,
      importoDare: 0,
      importoAvere: importoRitenuta,
      descrizione: "Ritenuta d'acconto",
      ordine: ordine++,
    });
  }

  // Avere: INPS contributi (intero contributo)
  if (contributoInpsTotale > 0) {
    movimenti.push({
      contoId: contoInps!,
      importoDare: 0,
      importoAvere: contributoInpsTotale,
      descrizione: "Contributi INPS gestione separata",
      ordine: ordine++,
    });
  }

  const totaleDare = Math.round(movimenti.reduce((s, m) => s + m.importoDare, 0) * 100) / 100;
  const totaleAvere = Math.round(movimenti.reduce((s, m) => s + m.importoAvere, 0) * 100) / 100;

  return {
    descrizione,
    causale,
    movimenti,
    totaleDare,
    totaleAvere,
    warnings,
  };
}
