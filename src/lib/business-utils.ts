/**
 * Business logic helper functions for Prima Nota.
 */

// ---------------------------------------------------------------------------
// Deducibilita
// ---------------------------------------------------------------------------

/**
 * Calculate the deductible amount given a total and a deductibility percentage.
 *
 * @param importoTotale  - The total amount.
 * @param percentuale    - The deductibility percentage (0-100).
 * @returns The deductible amount rounded to 2 decimal places.
 */
export function calcolaDeducibilita(
  importoTotale: number,
  percentuale: number,
): number {
  return Math.round((importoTotale * percentuale) / 100 * 100) / 100;
}

// ---------------------------------------------------------------------------
// Ripartizione
// ---------------------------------------------------------------------------

export type RipartizioneResult = {
  socioId: number;
  percentuale: number;
  importo: number;
}[];

/**
 * Calculate the allocation of a total amount among soci (partners).
 *
 * @param importoTotale      - The total amount to allocate.
 * @param tipo               - The allocation type: COMUNE, SINGOLO, or CUSTOM.
 * @param soci               - Array of soci with their id and ownership percentage.
 * @param socioSingoloId     - The id of the single socio (required when tipo is SINGOLO).
 * @param percentualiCustom  - Custom percentages (required when tipo is CUSTOM).
 * @returns An array of objects with socioId, percentuale, and importo.
 */
export function calcolaRipartizione(
  importoTotale: number,
  tipo: "COMUNE" | "SINGOLO" | "CUSTOM",
  soci: { id: number; quotaPercentuale: number }[],
  socioSingoloId?: number,
  percentualiCustom?: { socioId: number; percentuale: number }[],
): RipartizioneResult {
  switch (tipo) {
    case "COMUNE":
      return soci.map((socio) => ({
        socioId: socio.id,
        percentuale: socio.quotaPercentuale,
        importo:
          Math.round((importoTotale * socio.quotaPercentuale) / 100 * 100) /
          100,
      }));

    case "SINGOLO": {
      if (socioSingoloId === undefined) {
        throw new Error(
          "socioSingoloId is required when tipo is SINGOLO",
        );
      }

      return soci.map((socio) => {
        const isSingolo = socio.id === socioSingoloId;
        return {
          socioId: socio.id,
          percentuale: isSingolo ? 100 : 0,
          importo: isSingolo
            ? Math.round(importoTotale * 100) / 100
            : 0,
        };
      });
    }

    case "CUSTOM": {
      if (!percentualiCustom || percentualiCustom.length === 0) {
        throw new Error(
          "percentualiCustom is required when tipo is CUSTOM",
        );
      }

      const customMap = new Map(
        percentualiCustom.map((p) => [p.socioId, p.percentuale]),
      );

      return soci.map((socio) => {
        const percentuale = customMap.get(socio.id) ?? 0;
        return {
          socioId: socio.id,
          percentuale,
          importo:
            Math.round((importoTotale * percentuale) / 100 * 100) / 100,
        };
      });
    }

    default: {
      const _exhaustive: never = tipo;
      throw new Error(`Tipo ripartizione non supportato: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Ammortamento (Depreciation)
// ---------------------------------------------------------------------------

export type QuotaAmmortamentoCalcolata = {
  anno: number;
  aliquotaApplicata: number;
  importoQuota: number;
  fondoProgressivo: number;
};

/**
 * Generate the full multi-year depreciation schedule for a fixed asset.
 *
 * Rules (Italian TUIR Art. 102):
 * - First year: rate is halved (aliquota / 2)
 * - Subsequent years: full rate
 * - Last year: only remaining value to reach 100%
 * - Straight-line depreciation on the initial value
 */
export function calcolaPianoAmmortamento(
  valoreIniziale: number,
  aliquota: number,
  annoInizio: number,
): QuotaAmmortamentoCalcolata[] {
  const quote: QuotaAmmortamentoCalcolata[] = [];
  let fondoProgressivo = 0;
  let annoCorrente = annoInizio;
  let primoAnno = true;

  while (fondoProgressivo < valoreIniziale) {
    let aliquotaApplicata: number;

    if (primoAnno) {
      aliquotaApplicata = aliquota / 2;
      primoAnno = false;
    } else {
      aliquotaApplicata = aliquota;
    }

    let importoQuota =
      Math.round(((valoreIniziale * aliquotaApplicata) / 100) * 100) / 100;

    // Cap at remaining value
    const residuo =
      Math.round((valoreIniziale - fondoProgressivo) * 100) / 100;
    if (importoQuota > residuo) {
      importoQuota = residuo;
      aliquotaApplicata =
        Math.round(((importoQuota / valoreIniziale) * 100) * 100) / 100;
    }

    if (importoQuota <= 0) break;

    fondoProgressivo =
      Math.round((fondoProgressivo + importoQuota) * 100) / 100;

    quote.push({
      anno: annoCorrente,
      aliquotaApplicata,
      importoQuota,
      fondoProgressivo,
    });

    annoCorrente++;
  }

  return quote;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a number as Italian-locale currency (EUR).
 *
 * @param amount - The amount to format.
 * @returns A string like "€ 1.234,56".
 */
export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `\u20AC ${formatted}`;
}

/**
 * Format a number as an Italian-locale percentage string.
 *
 * @param value - The percentage value (e.g. 75.5 for 75,50%).
 * @returns A string like "75,50%".
 */
export function formatPercentuale(value: number): string {
  return (
    new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + "%"
  );
}
