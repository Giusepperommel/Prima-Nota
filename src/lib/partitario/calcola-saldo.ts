/**
 * Open balance calculation and aging analysis for partitario.
 */

export type ScadenzaAperta = {
  id: number;
  anagraficaId: number;
  operazioneId: number | null;
  dataScadenza: Date;
  importo: number;
  importoPagato: number;
  stato: "APERTA" | "PARZIALE" | "CHIUSA";
  tipo: "CLIENTE" | "FORNITORE";
};

export type SaldoAnagrafica = {
  anagraficaId: number;
  denominazione: string;
  tipo: "CLIENTE" | "FORNITORE";
  saldoAperto: number;
  numScadenzeAperte: number;
  scadenzaPiuVecchia: Date | null;
};

export type AgingBucket = {
  label: string;
  minDays: number;
  maxDays: number;
  importo: number;
  count: number;
};

/**
 * Calculate open balance per anagrafica.
 * Pure function.
 */
export function calcolaSaldoPerAnagrafica(
  scadenze: ScadenzaAperta[],
  anagrafiche: { id: number; denominazione: string; tipo: string }[],
): SaldoAnagrafica[] {
  const map = new Map<number, { saldo: number; count: number; oldest: Date | null }>();

  for (const s of scadenze) {
    if (s.stato === "CHIUSA") continue;
    const residuo = Math.round((s.importo - s.importoPagato) * 100) / 100;
    if (residuo <= 0) continue;

    const current = map.get(s.anagraficaId) || { saldo: 0, count: 0, oldest: null };
    current.saldo = Math.round((current.saldo + residuo) * 100) / 100;
    current.count++;
    if (!current.oldest || s.dataScadenza < current.oldest) {
      current.oldest = s.dataScadenza;
    }
    map.set(s.anagraficaId, current);
  }

  const anagMap = new Map(anagrafiche.map((a) => [a.id, a]));

  return Array.from(map.entries())
    .map(([anagraficaId, data]) => {
      const anag = anagMap.get(anagraficaId);
      return {
        anagraficaId,
        denominazione: anag?.denominazione || `Anagrafica #${anagraficaId}`,
        tipo: (anag?.tipo === "CLIENTE" ? "CLIENTE" : "FORNITORE") as "CLIENTE" | "FORNITORE",
        saldoAperto: data.saldo,
        numScadenzeAperte: data.count,
        scadenzaPiuVecchia: data.oldest,
      };
    })
    .sort((a, b) => b.saldoAperto - a.saldoAperto);
}

/**
 * Aging analysis: bucket scadenze by days overdue.
 * Pure function.
 */
export function calcolaAging(
  scadenze: ScadenzaAperta[],
  dataRiferimento: Date = new Date(),
): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { label: "Non scaduto", minDays: -999999, maxDays: 0, importo: 0, count: 0 },
    { label: "1-30 giorni", minDays: 1, maxDays: 30, importo: 0, count: 0 },
    { label: "31-60 giorni", minDays: 31, maxDays: 60, importo: 0, count: 0 },
    { label: "61-90 giorni", minDays: 61, maxDays: 90, importo: 0, count: 0 },
    { label: "Oltre 90 giorni", minDays: 91, maxDays: 999999, importo: 0, count: 0 },
  ];

  for (const s of scadenze) {
    if (s.stato === "CHIUSA") continue;
    const residuo = Math.round((s.importo - s.importoPagato) * 100) / 100;
    if (residuo <= 0) continue;

    const giorniScaduti = differenzaGiorni(dataRiferimento, s.dataScadenza);

    for (const bucket of buckets) {
      if (giorniScaduti >= bucket.minDays && giorniScaduti <= bucket.maxDays) {
        bucket.importo = Math.round((bucket.importo + residuo) * 100) / 100;
        bucket.count++;
        break;
      }
    }
  }

  return buckets;
}

function differenzaGiorni(a: Date, b: Date): number {
  const msPerDay = 86400000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / msPerDay);
}
