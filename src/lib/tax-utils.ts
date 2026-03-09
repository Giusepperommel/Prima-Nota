/**
 * Pure tax calculation functions for Italian SRL fiscal estimation.
 * No database access — all data passed as parameters.
 */

import {
  IRES_RATE,
  RITENUTA_DIVIDENDI,
  IRPEF_BRACKETS,
  INPS_COMMERCIANTI,
} from "./tax-constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DettaglioScaglione = {
  scaglione: string;
  imponibile: number;
  imposta: number;
  aliquota: number;
};

export type DettaglioSocioFiscale = {
  socioId: number;
  nome: string;
  cognome: string;
  quotaPercentuale: number;
  quotaUtile: number;
  ritenutaDividendi: number;
  irpef: number;
  dettaglioIrpef: DettaglioScaglione[];
  inps: number;
  totaleCaricoFiscale: number;
  nettoStimato: number;
};

export type StimaFiscaleResult = {
  regime: "ORDINARIO" | "TRASPARENZA";
  utileAnteImposte: number;
  fatturato: number;
  costi: number;
  ires: number;
  irap: number;
  aliquotaIrap: number;
  totaleImposteSocieta: number;
  utileDopoImposte: number;
  dettaglioSoci: DettaglioSocioFiscale[];
  riepilogoComplessivo: {
    totaleImposteSocieta: number;
    totaleCaricoSoci: number;
    pressioneFiscaleEffettiva: number;
  };
};

export type SocioInput = {
  socioId: number;
  nome: string;
  cognome: string;
  quotaPercentuale: number;
  socioLavoratore: boolean;
};

export type StimaSocioResult = {
  regime: "ORDINARIO" | "TRASPARENZA";
  socio: {
    nome: string;
    cognome: string;
    quotaPercentuale: number;
    socioLavoratore: boolean;
  };
  fatturato: number;
  costi: number;
  ammortamento: number;
  utileAnteImposte: number;
  // Quota imposte societa attribuite al socio (pro-quota)
  iresProQuota: number;
  irapProQuota: number;
  totaleImposteSocietaProQuota: number;
  utileDopoImposteSocieta: number;
  // Imposte personali
  ritenutaDividendi: number;
  irpef: number;
  dettaglioIrpef: DettaglioScaglione[];
  inps: number;
  totaleCaricoFiscalePersonale: number;
  nettoStimato: number;
};

// ---------------------------------------------------------------------------
// Individual calculations
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcolaIRES(utile: number): number {
  if (utile <= 0) return 0;
  return round2((utile * IRES_RATE) / 100);
}

export function calcolaIRAP(
  baseImponibile: number,
  aliquota: number,
): number {
  if (baseImponibile <= 0) return 0;
  return round2((baseImponibile * aliquota) / 100);
}

export function calcolaIRPEF(reddito: number): {
  imposta: number;
  dettaglioScaglioni: DettaglioScaglione[];
} {
  if (reddito <= 0) return { imposta: 0, dettaglioScaglioni: [] };

  const dettaglioScaglioni: DettaglioScaglione[] = [];
  let impostaTotale = 0;
  let redditoResiduo = reddito;
  let limiteInferiore = 0;

  for (const bracket of IRPEF_BRACKETS) {
    if (redditoResiduo <= 0) break;

    const capienza = bracket.upTo === Infinity
      ? redditoResiduo
      : Math.min(redditoResiduo, bracket.upTo - limiteInferiore);

    if (capienza <= 0) {
      limiteInferiore = bracket.upTo;
      continue;
    }

    const imposta = round2((capienza * bracket.rate) / 100);
    impostaTotale += imposta;

    const limSup = bracket.upTo === Infinity
      ? "oltre"
      : `${bracket.upTo.toLocaleString("it-IT")}`;
    const label =
      limiteInferiore === 0
        ? `Fino a \u20AC ${limSup}`
        : bracket.upTo === Infinity
          ? `Oltre \u20AC ${limiteInferiore.toLocaleString("it-IT")}`
          : `\u20AC ${limiteInferiore.toLocaleString("it-IT")} - ${limSup}`;

    dettaglioScaglioni.push({
      scaglione: label,
      imponibile: round2(capienza),
      imposta,
      aliquota: bracket.rate,
    });

    redditoResiduo -= capienza;
    limiteInferiore = bracket.upTo;
  }

  return { imposta: round2(impostaTotale), dettaglioScaglioni };
}

export function calcolaRitenutaDividendi(dividendo: number): number {
  if (dividendo <= 0) return 0;
  return round2((dividendo * RITENUTA_DIVIDENDI) / 100);
}

export function calcolaINPS(reddito: number): {
  contributo: number;
  note: string;
} {
  if (reddito <= 0) {
    return {
      contributo: INPS_COMMERCIANTI.contributoMinimale,
      note: "Contributo minimo obbligatorio",
    };
  }

  // Reddito capped at massimale
  const redditoContributivo = Math.min(reddito, INPS_COMMERCIANTI.massimale);

  // Contributo calcolato
  const contributoCalcolato = round2(
    (redditoContributivo * INPS_COMMERCIANTI.aliquota) / 100,
  );

  // Il contributo non puo essere inferiore al minimale
  const contributo = Math.max(
    contributoCalcolato,
    INPS_COMMERCIANTI.contributoMinimale,
  );

  let note = `Aliquota ${INPS_COMMERCIANTI.aliquota}%`;
  if (reddito >= INPS_COMMERCIANTI.massimale) {
    note += ` (massimale \u20AC ${INPS_COMMERCIANTI.massimale.toLocaleString("it-IT")})`;
  } else if (contributoCalcolato < INPS_COMMERCIANTI.contributoMinimale) {
    note = "Contributo minimo obbligatorio";
  }

  return { contributo, note };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export function stimaFiscaleSocieta(params: {
  fatturato: number;
  costi: number;
  regime: "ORDINARIO" | "TRASPARENZA";
  aliquotaIrap: number;
  soci: SocioInput[];
}): StimaFiscaleResult {
  const { fatturato, costi, regime, aliquotaIrap, soci } = params;

  const utileAnteImposte = round2(fatturato - costi);

  // IRES: only in ORDINARIO regime
  const ires = regime === "ORDINARIO" ? calcolaIRES(utileAnteImposte) : 0;

  // IRAP: applies in both regimes, base = utile ante imposte (simplified)
  const irap = calcolaIRAP(utileAnteImposte, aliquotaIrap);

  const totaleImposteSocieta = round2(ires + irap);
  const utileDopoImposte = round2(utileAnteImposte - totaleImposteSocieta);

  // Per-socio calculations
  let totaleCaricoSoci = 0;

  const dettaglioSoci: DettaglioSocioFiscale[] = soci.map((socio) => {
    const quotaUtile = round2((utileDopoImposte * socio.quotaPercentuale) / 100);

    let ritenutaDividendi = 0;
    let irpef = 0;
    let dettaglioIrpef: DettaglioScaglione[] = [];
    let inps = 0;

    if (regime === "ORDINARIO") {
      // In regime ordinario, dividendi tassati al 26% a titolo d'imposta
      ritenutaDividendi = calcolaRitenutaDividendi(quotaUtile);
    } else {
      // In trasparenza, l'utile e' tassato IRPEF in capo al socio
      // Quota calcolata sull'utile ante imposte (al netto IRAP)
      const quotaUtileTrasparenza = round2(
        ((utileAnteImposte - irap) * socio.quotaPercentuale) / 100,
      );
      const risultatoIrpef = calcolaIRPEF(quotaUtileTrasparenza);
      irpef = risultatoIrpef.imposta;
      dettaglioIrpef = risultatoIrpef.dettaglioScaglioni;
    }

    // INPS per soci lavoratori
    if (socio.socioLavoratore) {
      const quotaPerInps = regime === "ORDINARIO"
        ? quotaUtile
        : round2(((utileAnteImposte - irap) * socio.quotaPercentuale) / 100);
      const risultatoInps = calcolaINPS(quotaPerInps);
      inps = risultatoInps.contributo;
    }

    const totaleCaricoFiscale = round2(ritenutaDividendi + irpef + inps);
    const nettoStimato = round2(
      (regime === "ORDINARIO"
        ? quotaUtile
        : round2(((utileAnteImposte - irap) * socio.quotaPercentuale) / 100))
        - totaleCaricoFiscale,
    );

    totaleCaricoSoci += totaleCaricoFiscale;

    return {
      socioId: socio.socioId,
      nome: socio.nome,
      cognome: socio.cognome,
      quotaPercentuale: socio.quotaPercentuale,
      quotaUtile: regime === "ORDINARIO"
        ? quotaUtile
        : round2(((utileAnteImposte - irap) * socio.quotaPercentuale) / 100),
      ritenutaDividendi,
      irpef,
      dettaglioIrpef,
      inps,
      totaleCaricoFiscale,
      nettoStimato,
    };
  });

  totaleCaricoSoci = round2(totaleCaricoSoci);

  const pressioneFiscaleEffettiva = fatturato > 0
    ? round2(((totaleImposteSocieta + totaleCaricoSoci) / fatturato) * 100)
    : 0;

  return {
    regime,
    utileAnteImposte,
    fatturato,
    costi,
    ires,
    irap,
    aliquotaIrap,
    totaleImposteSocieta,
    utileDopoImposte,
    dettaglioSoci,
    riepilogoComplessivo: {
      totaleImposteSocieta,
      totaleCaricoSoci,
      pressioneFiscaleEffettiva,
    },
  };
}

// ---------------------------------------------------------------------------
// Per-socio estimation (based on actual socio fatturato/costi)
// ---------------------------------------------------------------------------

export function stimaFiscaleSocio(params: {
  fatturato: number;
  costi: number;
  ammortamento: number;
  regime: "ORDINARIO" | "TRASPARENZA";
  aliquotaIrap: number;
  socio: {
    nome: string;
    cognome: string;
    quotaPercentuale: number;
    socioLavoratore: boolean;
  };
}): StimaSocioResult {
  const { fatturato, costi, ammortamento, regime, aliquotaIrap, socio } = params;

  const utileAnteImposte = round2(fatturato - costi);

  // Pro-quota share of societa-level taxes
  // These are computed on the socio's own utile, not on the societa total
  const iresProQuota = regime === "ORDINARIO" ? calcolaIRES(utileAnteImposte) : 0;
  const irapProQuota = calcolaIRAP(utileAnteImposte, aliquotaIrap);
  const totaleImposteSocietaProQuota = round2(iresProQuota + irapProQuota);
  const utileDopoImposteSocieta = round2(utileAnteImposte - totaleImposteSocietaProQuota);

  // Personal tax calculations
  let ritenutaDividendi = 0;
  let irpef = 0;
  let dettaglioIrpef: DettaglioScaglione[] = [];
  let inps = 0;

  if (regime === "ORDINARIO") {
    ritenutaDividendi = calcolaRitenutaDividendi(utileDopoImposteSocieta);
  } else {
    // Trasparenza: IRPEF on utile al netto IRAP
    const baseIrpef = round2(utileAnteImposte - irapProQuota);
    const risultatoIrpef = calcolaIRPEF(baseIrpef);
    irpef = risultatoIrpef.imposta;
    dettaglioIrpef = risultatoIrpef.dettaglioScaglioni;
  }

  if (socio.socioLavoratore) {
    const baseInps = regime === "ORDINARIO"
      ? utileDopoImposteSocieta
      : round2(utileAnteImposte - irapProQuota);
    const risultatoInps = calcolaINPS(baseInps);
    inps = risultatoInps.contributo;
  }

  const totaleCaricoFiscalePersonale = round2(ritenutaDividendi + irpef + inps);
  const baseNetto = regime === "ORDINARIO"
    ? utileDopoImposteSocieta
    : round2(utileAnteImposte - irapProQuota);
  const nettoStimato = round2(baseNetto - totaleCaricoFiscalePersonale);

  return {
    regime,
    socio,
    fatturato,
    costi,
    ammortamento,
    utileAnteImposte,
    iresProQuota,
    irapProQuota,
    totaleImposteSocietaProQuota,
    utileDopoImposteSocieta,
    ritenutaDividendi,
    irpef,
    dettaglioIrpef,
    inps,
    totaleCaricoFiscalePersonale,
    nettoStimato,
  };
}
