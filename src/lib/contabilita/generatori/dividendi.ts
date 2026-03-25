import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";

/**
 * Genera la scrittura contabile per la distribuzione dividendi.
 *
 * Due fasi distinte, selezionate tramite causaleOverride:
 *
 * 1. Delibera (default / causaleOverride !== "DIV_PAG"):
 *    Dare: UTILE_ESERCIZIO = importoTotale
 *    Avere: RISERVA_LEGALE = 5% (se applicabile, campo extra)
 *    Avere: SOCI_DIVIDENDI = dividendi deliberati
 *    Avere: UTILI_A_NUOVO = residuo
 *
 * 2. Pagamento (causaleOverride === "DIV_PAG"):
 *    Dare: SOCI_DIVIDENDI = importoTotale (dividendo lordo)
 *    Avere: ERARIO_RITENUTE = importoRitenuta (26%)
 *    Avere: BANCA_CC = importoTotale - importoRitenuta
 */
export function generaDividendi(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata {
  const { operazione, causaleOverride, anagraficaDenominazione } = input;
  const warnings: string[] = [];
  const movimenti: MovimentoGenerato[] = [];

  const causale = "DIV";
  const isPagamento = causaleOverride === "DIV_PAG";

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  let ordine = 1;

  if (isPagamento) {
    // --- Pagamento dividendi ---
    const contoSociDividendi = resolver.getStrutturale("SOCI_DIVIDENDI");
    const contoRitenute = resolver.getStrutturale("ERARIO_RITENUTE");
    const contoBanca = resolver.getStrutturale("BANCA_CC");

    const importoLordo = operazione.importoTotale;
    const importoRitenuta = operazione.importoRitenuta ?? Math.round(importoLordo * 0.26 * 100) / 100;
    const importoNetto = Math.round((importoLordo - importoRitenuta) * 100) / 100;

    // Dare: SOCI_DIVIDENDI
    movimenti.push({
      contoId: contoSociDividendi!,
      importoDare: importoLordo,
      importoAvere: 0,
      descrizione: "Pagamento dividendi lordi",
      ordine: ordine++,
    });

    // Avere: ERARIO_RITENUTE
    movimenti.push({
      contoId: contoRitenute!,
      importoDare: 0,
      importoAvere: importoRitenuta,
      descrizione: "Ritenuta 26% su dividendi",
      ordine: ordine++,
    });

    // Avere: BANCA_CC
    movimenti.push({
      contoId: contoBanca!,
      importoDare: 0,
      importoAvere: importoNetto,
      descrizione: "Uscita banca c/c (netto dividendi)",
      ordine: ordine++,
    });
  } else {
    // --- Delibera distribuzione utile ---
    const contoUtile = resolver.getStrutturale("UTILE_ESERCIZIO");
    const contoRiservaLegale = resolver.getStrutturale("RISERVA_LEGALE");
    const contoSociDividendi = resolver.getStrutturale("SOCI_DIVIDENDI");
    const contoUtiliANuovo = resolver.getStrutturale("UTILI_A_NUOVO");

    const importoUtile = operazione.importoTotale;

    // Extra fields for split
    const op = operazione as unknown as Record<string, unknown>;
    const quotaRiservaLegale = (typeof op.quotaRiservaLegale === "number")
      ? op.quotaRiservaLegale
      : Math.round(importoUtile * 0.05 * 100) / 100; // default 5%
    const quotaDividendi = (typeof op.quotaDividendi === "number")
      ? op.quotaDividendi
      : Math.round((importoUtile - quotaRiservaLegale) * 100) / 100;
    const quotaUtiliANuovo = Math.round((importoUtile - quotaRiservaLegale - quotaDividendi) * 100) / 100;

    // Dare: UTILE_ESERCIZIO
    movimenti.push({
      contoId: contoUtile!,
      importoDare: importoUtile,
      importoAvere: 0,
      descrizione: "Destinazione utile d'esercizio",
      ordine: ordine++,
    });

    // Avere: RISERVA_LEGALE (if > 0)
    if (quotaRiservaLegale > 0) {
      movimenti.push({
        contoId: contoRiservaLegale!,
        importoDare: 0,
        importoAvere: quotaRiservaLegale,
        descrizione: "Accantonamento riserva legale (5%)",
        ordine: ordine++,
      });
    }

    // Avere: SOCI_DIVIDENDI
    if (quotaDividendi > 0) {
      movimenti.push({
        contoId: contoSociDividendi!,
        importoDare: 0,
        importoAvere: quotaDividendi,
        descrizione: "Dividendi deliberati",
        ordine: ordine++,
      });
    }

    // Avere: UTILI_A_NUOVO (residuo)
    if (quotaUtiliANuovo > 0) {
      movimenti.push({
        contoId: contoUtiliANuovo!,
        importoDare: 0,
        importoAvere: quotaUtiliANuovo,
        descrizione: "Utili portati a nuovo",
        ordine: ordine++,
      });
    }
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
