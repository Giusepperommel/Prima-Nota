import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";

export function generaReverseCharge(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata[] {
  const { operazione, categoriaContoId, contoEsplicito, causaleOverride, anagraficaDenominazione } = input;
  const warnings: string[] = [];

  // Determine causale
  const causale = causaleOverride || "FARE";

  // Resolve costo account
  const costoResult = contoEsplicito
    ? resolver.resolveEsplicito(contoEsplicito)
    : resolver.resolveCategoria(categoriaContoId);

  if (costoResult.contoId === null) {
    warnings.push(costoResult.warning ?? "Conto costo non risolvibile — scrittura provvisoria");
  }

  const contoIdCosto = costoResult.contoId;

  // Resolve structural accounts
  const contoIvaCredito = resolver.getStrutturale("IVA_CREDITO");
  const contoDebitiFornitori = resolver.getStrutturale("DEBITI_FORNITORI");
  const contoIvaDebito = resolver.getStrutturale("IVA_DEBITO");
  const contoReverseCharge = resolver.getStrutturale("IVA_REVERSE_CHARGE");

  // Extract amounts
  const importoImponibile = operazione.importoImponibile ?? operazione.importoTotale;
  const importoIva = operazione.importoIva ?? 0;

  const descrizione = operazione.descrizione +
    (anagraficaDenominazione ? ` — ${anagraficaDenominazione}` : "");

  // --- Scrittura 1: Registro acquisti ---
  const movimenti1: MovimentoGenerato[] = [];
  let ordine1 = 1;

  // Dare: conto da categoria = importoImponibile
  movimenti1.push({
    contoId: contoIdCosto as number,
    importoDare: importoImponibile,
    importoAvere: 0,
    descrizione: "Costo acquisto",
    ordine: ordine1++,
  });

  // Dare: IVA credito = importoIva
  if (importoIva > 0) {
    movimenti1.push({
      contoId: contoIvaCredito!,
      importoDare: importoIva,
      importoAvere: 0,
      descrizione: "IVA a credito",
      ordine: ordine1++,
    });
  }

  // Avere: debiti fornitori = importoImponibile (NOT importoTotale)
  movimenti1.push({
    contoId: contoDebitiFornitori!,
    importoDare: 0,
    importoAvere: importoImponibile,
    descrizione: "Debito verso fornitore",
    ordine: ordine1++,
  });

  // Avere: IVA reverse charge transitorio = importoIva
  if (importoIva > 0) {
    movimenti1.push({
      contoId: contoReverseCharge!,
      importoDare: 0,
      importoAvere: importoIva,
      descrizione: "IVA reverse charge (transitorio)",
      ordine: ordine1++,
    });
  }

  const totaleDare1 = Math.round(movimenti1.reduce((s, m) => s + m.importoDare, 0) * 100) / 100;
  const totaleAvere1 = Math.round(movimenti1.reduce((s, m) => s + m.importoAvere, 0) * 100) / 100;

  const scrittura1: ScritturaGenerata = {
    descrizione,
    causale,
    movimenti: movimenti1,
    totaleDare: totaleDare1,
    totaleAvere: totaleAvere1,
    warnings,
  };

  // --- Scrittura 2: Registro vendite (integrazione IVA) ---
  const movimenti2: MovimentoGenerato[] = [];
  let ordine2 = 1;

  // Dare: IVA reverse charge (chiude transitorio)
  movimenti2.push({
    contoId: contoReverseCharge!,
    importoDare: importoIva,
    importoAvere: 0,
    descrizione: "Chiusura IVA reverse charge",
    ordine: ordine2++,
  });

  // Avere: IVA debito
  movimenti2.push({
    contoId: contoIvaDebito!,
    importoDare: 0,
    importoAvere: importoIva,
    descrizione: "IVA a debito (integrazione)",
    ordine: ordine2++,
  });

  const totaleDare2 = Math.round(movimenti2.reduce((s, m) => s + m.importoDare, 0) * 100) / 100;
  const totaleAvere2 = Math.round(movimenti2.reduce((s, m) => s + m.importoAvere, 0) * 100) / 100;

  const scrittura2: ScritturaGenerata = {
    descrizione: `${descrizione} — Integrazione IVA — registro vendite`,
    causale: `${causale}_V`,
    movimenti: movimenti2,
    totaleDare: totaleDare2,
    totaleAvere: totaleAvere2,
    warnings: [],
  };

  return [scrittura1, scrittura2];
}
