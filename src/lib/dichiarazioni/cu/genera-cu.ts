/**
 * CU generation engine.
 * Aggregates ritenute records per percipiente per year to produce CU data.
 * Pure function — no DB access.
 */

import {
  type DatiCU,
  type RitenutaInput,
  type RiepilogoCU,
  type DettaglioRitenutaCU,
  type CausaleCU,
  TIPO_RITENUTA_TO_CAUSALE,
} from "./cu-types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Aggregates ritenute per percipiente for a given year.
 * Returns one DatiCU per percipiente (anagrafica).
 *
 * If a percipiente has multiple tipoRitenuta in the same year,
 * the most frequent causale is used (as per CU rules, separate CU per causale
 * would be needed — this simplified version uses the primary one).
 */
export function generaCU(ritenute: RitenutaInput[], anno: number): DatiCU[] {
  // Filter for the specified year
  const ritenuteAnno = ritenute.filter((r) => r.annoCompetenza === anno);

  if (ritenuteAnno.length === 0) return [];

  // Group by anagraficaId
  const gruppi = new Map<number, RitenutaInput[]>();
  for (const r of ritenuteAnno) {
    const list = gruppi.get(r.anagraficaId) ?? [];
    list.push(r);
    gruppi.set(r.anagraficaId, list);
  }

  const risultati: DatiCU[] = [];

  for (const [anagraficaId, ritenutePercipiente] of gruppi) {
    // Determine primary causale (most frequent tipo ritenuta)
    const causaleCounts = new Map<CausaleCU, number>();
    for (const r of ritenutePercipiente) {
      const causale = TIPO_RITENUTA_TO_CAUSALE[r.tipoRitenuta] ?? "A";
      causaleCounts.set(causale, (causaleCounts.get(causale) ?? 0) + 1);
    }
    let causalePrimaria: CausaleCU = "A";
    let maxCount = 0;
    for (const [causale, count] of causaleCounts) {
      if (count > maxCount) {
        maxCount = count;
        causalePrimaria = causale;
      }
    }

    // Aggregate amounts
    let ammontareLordo = 0;
    let imponibile = 0;
    let ritenutaAcconto = 0;
    let rivalsaInps = 0;
    let cassaPrevidenza = 0;
    const dettaglioRitenute: DettaglioRitenutaCU[] = [];

    for (const r of ritenutePercipiente) {
      ammontareLordo += r.importoLordo;
      imponibile += r.baseImponibile;
      ritenutaAcconto += r.importoRitenuta;
      rivalsaInps += r.rivalsaInps ?? 0;
      cassaPrevidenza += r.cassaPrevidenza ?? 0;

      dettaglioRitenute.push({
        ritenutaId: r.id,
        meseCompetenza: r.meseCompetenza,
        annoCompetenza: r.annoCompetenza,
        importoLordo: r.importoLordo,
        baseImponibile: r.baseImponibile,
        importoRitenuta: r.importoRitenuta,
        codiceTributo: r.codiceTributo,
        dataVersamento: r.dataVersamento,
        statoVersamento: r.statoVersamento,
      });
    }

    const anagrafica = ritenutePercipiente[0].anagrafica;

    risultati.push({
      anno,
      anagraficaId,
      denominazione: anagrafica.denominazione,
      codiceFiscale: anagrafica.codiceFiscale,
      partitaIva: anagrafica.partitaIva,
      indirizzo: anagrafica.indirizzo,
      cap: anagrafica.cap,
      citta: anagrafica.citta,
      provincia: anagrafica.provincia,
      causaleCu: causalePrimaria,
      ammontareLordo: round2(ammontareLordo),
      imponibile: round2(imponibile),
      ritenutaAcconto: round2(ritenutaAcconto),
      rivalsaInps: round2(rivalsaInps),
      cassaPrevidenza: round2(cassaPrevidenza),
      dettaglioRitenute: dettaglioRitenute.sort(
        (a, b) => a.meseCompetenza - b.meseCompetenza,
      ),
    });
  }

  // Sort by denominazione
  return risultati.sort((a, b) => a.denominazione.localeCompare(b.denominazione));
}

/**
 * Produces a summary for the CU year.
 */
export function riepilogoCU(ritenute: RitenutaInput[], anno: number): RiepilogoCU {
  const percipienti = generaCU(ritenute, anno);

  let totaleLordo = 0;
  let totaleRitenute = 0;
  for (const p of percipienti) {
    totaleLordo += p.ammontareLordo;
    totaleRitenute += p.ritenutaAcconto;
  }

  return {
    anno,
    totalePercipienti: percipienti.length,
    totaleLordo: round2(totaleLordo),
    totaleRitenute: round2(totaleRitenute),
    percipienti,
  };
}

/**
 * Validates CU data before generation.
 * Returns list of warnings/errors.
 */
export function validaCU(ritenute: RitenutaInput[], anno: number): string[] {
  const warnings: string[] = [];
  const ritenuteAnno = ritenute.filter((r) => r.annoCompetenza === anno);

  if (ritenuteAnno.length === 0) {
    warnings.push(`Nessuna ritenuta trovata per l'anno ${anno}`);
    return warnings;
  }

  // Check for ritenute not yet versate
  const nonVersate = ritenuteAnno.filter((r) => r.statoVersamento === "DA_VERSARE");
  if (nonVersate.length > 0) {
    warnings.push(
      `${nonVersate.length} ritenute non ancora versate per l'anno ${anno}. ` +
      `La CU riportera comunque gli importi operati.`,
    );
  }

  // Check for missing CF on percipienti
  const gruppi = new Map<number, RitenutaInput>();
  for (const r of ritenuteAnno) {
    if (!gruppi.has(r.anagraficaId)) gruppi.set(r.anagraficaId, r);
  }
  for (const [, r] of gruppi) {
    if (!r.anagrafica.codiceFiscale) {
      warnings.push(
        `Percipiente "${r.anagrafica.denominazione}" senza codice fiscale — obbligatorio per CU`,
      );
    }
  }

  return warnings;
}
