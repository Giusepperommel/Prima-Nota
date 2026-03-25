import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";
import type { GeneratoreInput, ScritturaGenerata } from "../types";

export interface ContoEconomicoInput {
  contoId: number;
  codice: string;
  saldo: number;       // positive = normal balance (dare for costi, avere for ricavi)
  tipo: string;        // "COSTO" | "RICAVO"
}

/**
 * Genera le scritture di chiusura dei conti economici a fine esercizio.
 *
 * Produce 3 scritture (array):
 *
 * 1. Chiusura conti di costo → CONTO_ECONOMICO (900.001)
 *    Dare: CONTO_ECONOMICO = somma saldi costi
 *    Avere: ogni conto di costo = suo saldo (azzerato)
 *
 * 2. Chiusura conti di ricavo → CONTO_ECONOMICO
 *    Dare: ogni conto di ricavo = suo saldo
 *    Avere: CONTO_ECONOMICO = somma saldi ricavi
 *
 * 3. Determinazione utile/perdita
 *    Se ricavi > costi → utile:
 *      Dare: CONTO_ECONOMICO = utile
 *      Avere: UTILE_ESERCIZIO = utile
 *    Se costi > ricavi → perdita:
 *      Dare: UTILE_ESERCIZIO = perdita
 *      Avere: CONTO_ECONOMICO = perdita
 */
export function generaChiusuraEsercizio(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata[] {
  const { operazione } = input;
  const warnings: string[] = [];

  // Extract contiEconomici from operazione extra data
  const op = operazione as unknown as Record<string, unknown>;
  const contiEconomici = (op.contiEconomici as ContoEconomicoInput[]) ?? [];

  if (contiEconomici.length === 0) {
    warnings.push("Nessun conto economico fornito — impossibile generare chiusura");
    return [{
      descrizione: operazione.descrizione,
      causale: "SC",
      movimenti: [],
      totaleDare: 0,
      totaleAvere: 0,
      warnings,
    }];
  }

  const contiCosto = contiEconomici.filter(c => c.tipo === "COSTO" && c.saldo > 0);
  const contiRicavo = contiEconomici.filter(c => c.tipo === "RICAVO" && c.saldo > 0);

  // Resolve structural accounts
  const ceResult = resolver.resolveStrutturale("CONTO_ECONOMICO");
  if (ceResult.warning) warnings.push(ceResult.warning);
  const contoEconomicoId = ceResult.contoId;

  const utResult = resolver.resolveStrutturale("UTILE_ESERCIZIO");
  if (utResult.warning) warnings.push(utResult.warning);
  const utileEsercizioId = utResult.contoId;

  const scritture: ScritturaGenerata[] = [];

  // --- Scrittura 1: Chiusura conti di costo ---
  {
    const movimenti: MovimentoGenerato[] = [];
    let ordine = 1;
    const totaleCosti = Math.round(contiCosto.reduce((s, c) => s + c.saldo, 0) * 100) / 100;

    if (totaleCosti > 0) {
      // Dare: CONTO_ECONOMICO = totale costi
      movimenti.push({
        contoId: contoEconomicoId as number,
        importoDare: totaleCosti,
        importoAvere: 0,
        descrizione: "Chiusura conti di costo a Conto Economico",
        ordine: ordine++,
      });

      // Avere: ogni conto di costo = suo saldo
      for (const conto of contiCosto) {
        movimenti.push({
          contoId: conto.contoId,
          importoDare: 0,
          importoAvere: conto.saldo,
          descrizione: `Chiusura ${conto.codice}`,
          ordine: ordine++,
        });
      }
    }

    const totaleDare = Math.round(movimenti.reduce((s, m) => s + m.importoDare, 0) * 100) / 100;
    const totaleAvere = Math.round(movimenti.reduce((s, m) => s + m.importoAvere, 0) * 100) / 100;

    scritture.push({
      descrizione: `${operazione.descrizione} — Chiusura conti di costo`,
      causale: "SC",
      movimenti,
      totaleDare,
      totaleAvere,
      warnings: [...warnings],
    });
  }

  // --- Scrittura 2: Chiusura conti di ricavo ---
  {
    const movimenti: MovimentoGenerato[] = [];
    let ordine = 1;
    const totaleRicavi = Math.round(contiRicavo.reduce((s, c) => s + c.saldo, 0) * 100) / 100;

    if (totaleRicavi > 0) {
      // Dare: ogni conto di ricavo = suo saldo
      for (const conto of contiRicavo) {
        movimenti.push({
          contoId: conto.contoId,
          importoDare: conto.saldo,
          importoAvere: 0,
          descrizione: `Chiusura ${conto.codice}`,
          ordine: ordine++,
        });
      }

      // Avere: CONTO_ECONOMICO = totale ricavi
      movimenti.push({
        contoId: contoEconomicoId as number,
        importoDare: 0,
        importoAvere: totaleRicavi,
        descrizione: "Chiusura conti di ricavo a Conto Economico",
        ordine: ordine++,
      });
    }

    const totaleDare = Math.round(movimenti.reduce((s, m) => s + m.importoDare, 0) * 100) / 100;
    const totaleAvere = Math.round(movimenti.reduce((s, m) => s + m.importoAvere, 0) * 100) / 100;

    scritture.push({
      descrizione: `${operazione.descrizione} — Chiusura conti di ricavo`,
      causale: "SC",
      movimenti,
      totaleDare,
      totaleAvere,
      warnings: [],
    });
  }

  // --- Scrittura 3: Determinazione utile/perdita ---
  {
    const movimenti: MovimentoGenerato[] = [];
    let ordine = 1;
    const totaleCosti = Math.round(contiCosto.reduce((s, c) => s + c.saldo, 0) * 100) / 100;
    const totaleRicavi = Math.round(contiRicavo.reduce((s, c) => s + c.saldo, 0) * 100) / 100;
    const differenza = Math.round((totaleRicavi - totaleCosti) * 100) / 100;

    if (differenza > 0) {
      // Utile: ricavi > costi
      // Dare: CONTO_ECONOMICO = utile
      movimenti.push({
        contoId: contoEconomicoId as number,
        importoDare: differenza,
        importoAvere: 0,
        descrizione: "Utile d'esercizio",
        ordine: ordine++,
      });
      // Avere: UTILE_ESERCIZIO = utile
      movimenti.push({
        contoId: utileEsercizioId as number,
        importoDare: 0,
        importoAvere: differenza,
        descrizione: "Utile d'esercizio",
        ordine: ordine++,
      });
    } else if (differenza < 0) {
      // Perdita: costi > ricavi
      const perdita = Math.abs(differenza);
      // Dare: UTILE_ESERCIZIO = perdita
      movimenti.push({
        contoId: utileEsercizioId as number,
        importoDare: perdita,
        importoAvere: 0,
        descrizione: "Perdita d'esercizio",
        ordine: ordine++,
      });
      // Avere: CONTO_ECONOMICO = perdita
      movimenti.push({
        contoId: contoEconomicoId as number,
        importoDare: 0,
        importoAvere: perdita,
        descrizione: "Perdita d'esercizio",
        ordine: ordine++,
      });
    }

    const totaleDare = Math.round(movimenti.reduce((s, m) => s + m.importoDare, 0) * 100) / 100;
    const totaleAvere = Math.round(movimenti.reduce((s, m) => s + m.importoAvere, 0) * 100) / 100;

    scritture.push({
      descrizione: `${operazione.descrizione} — Determinazione risultato d'esercizio`,
      causale: "SC",
      movimenti,
      totaleDare,
      totaleAvere,
      warnings: [],
    });
  }

  return scritture;
}
