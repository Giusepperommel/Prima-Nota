/**
 * XBRL Instance Document Generator (simplified)
 *
 * Genera un documento XBRL instance basico con la tassonomia it-gaap
 * per il deposito al Registro delle Imprese.
 */

import type { BilancioCompleto, SezioneCE } from "./types";

type DatiSocieta = {
  partitaIva: string;
  ragioneSociale: string;
};

/**
 * Mapping delle voci di bilancio ai concetti XBRL it-gaap.
 */
const SP_ATTIVO_XBRL: Record<string, string> = {
  "A": "CredVSociPerVersAncoraDoVuTi",
  "B": "TotaleImmobilizzazioni",
  "B.I": "TotImmobilizzazioniImmateriali",
  "B.II": "TotImmobilizzazioniMateriali",
  "B.III": "TotImmobilizzazioniFinanziarie",
  "C": "TotaleAttivoCircolante",
  "C.I": "TotaleRimanenze",
  "C.II": "TotaleCrediti",
  "C.III": "TotaleAttivitaFinanziarie",
  "C.IV": "TotaleDisponibilitaLiquide",
  "D": "RateiERiscontiAttivi",
};

const SP_PASSIVO_XBRL: Record<string, string> = {
  "A": "TotalePatrimonioNetto",
  "A.I": "Capitale",
  "A.IV": "RiservaLegale",
  "A.VI": "AltreRiserve",
  "A.VIII": "UtiliPerditePrtNuovo",
  "A.IX": "UtilePerditaEsercizio",
  "B": "TotaleFondiPerRischiEOneri",
  "C": "TrattamentoFineRapporto",
  "D": "TotaleDebiti",
  "E": "RateiERiscontiPassivi",
};

const CE_XBRL: Record<string, string> = {
  "A": "TotaleValoreDellaProduzione",
  "A.1": "RicaviVenditeEPrestazioni",
  "A.5": "AltriRicaviEProventi",
  "B": "TotaleCostiDellaProduzione",
  "B.6": "PerMateriePrime",
  "B.7": "PerServizi",
  "B.8": "PerGodimentoBeniTerzi",
  "B.9": "PerIlPersonale",
  "B.10": "AmmortamentiESvalutazioni",
  "B.14": "OneriDiversiDiGestione",
  "C": "TotaleProventiEOneriFinanziari",
  "C.16": "AltriProventiFinanziari",
  "C.17": "InteressiEAltriOneriFinanziari",
  "D": "TotaleRettificheValoreAttFinanz",
  "AB": "DiffTraValoreECostiProduzione",
  "20": "ImposteSulRedditoDellEsercizio",
  "21": "UtilePerdita",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Genera un XBRL instance document semplificato.
 */
export function generateXbrl(
  bilancio: BilancioCompleto,
  societa: DatiSocieta
): string {
  const anno = bilancio.anno;
  const dataInizio = `${anno}-01-01`;
  const dataFine = `${anno}-12-31`;
  const contextId = `ctx_${anno}`;
  const unitId = "EUR";

  const facts: string[] = [];

  // ─── SP ATTIVO ───
  for (const classe of bilancio.statoPatrimoniale.attivo.classi) {
    const xbrlTag = SP_ATTIVO_XBRL[classe.codice];
    if (xbrlTag && Math.abs(classe.importo) > 0.005) {
      facts.push(buildFact(`itcc-ci:${xbrlTag}`, classe.importo, contextId, unitId));
    }

    for (const sc of classe.sottoclassi) {
      const scKey = `${classe.codice}.${sc.codice}`;
      const scTag = SP_ATTIVO_XBRL[scKey];
      if (scTag && Math.abs(sc.importo) > 0.005) {
        facts.push(buildFact(`itcc-ci:${scTag}`, sc.importo, contextId, unitId));
      }
    }
  }

  // Totale attivo
  facts.push(buildFact("itcc-ci:TotaleAttivo", bilancio.totaleAttivo, contextId, unitId));

  // ─── SP PASSIVO ───
  for (const classe of bilancio.statoPatrimoniale.passivo.classi) {
    const xbrlTag = SP_PASSIVO_XBRL[classe.codice];
    if (xbrlTag && Math.abs(classe.importo) > 0.005) {
      facts.push(buildFact(`itcc-ci:${xbrlTag}`, classe.importo, contextId, unitId));
    }

    for (const sc of classe.sottoclassi) {
      const scKey = `${classe.codice}.${sc.codice}`;
      const scTag = SP_PASSIVO_XBRL[scKey];
      if (scTag && Math.abs(sc.importo) > 0.005) {
        facts.push(buildFact(`itcc-ci:${scTag}`, sc.importo, contextId, unitId));
      }
    }
  }

  // Totale passivo
  facts.push(buildFact("itcc-ci:TotalePassivo", bilancio.totalePassivo, contextId, unitId));

  // ─── CE ───
  for (const sezione of bilancio.contoEconomico.sezioni) {
    const sezTag = CE_XBRL[sezione.codice];
    if (sezTag) {
      facts.push(buildFact(`itcc-ci:${sezTag}`, sezione.importo, contextId, unitId));
    }

    for (const voce of sezione.voci) {
      const voceKey = `${sezione.codice}.${voce.codice}`;
      const voceTag = CE_XBRL[voceKey];
      if (voceTag && Math.abs(voce.importo) > 0.005) {
        facts.push(buildFact(`itcc-ci:${voceTag}`, voce.importo, contextId, unitId));
      }
    }
  }

  // Differenza A-B
  facts.push(buildFact(`itcc-ci:${CE_XBRL["AB"]}`, bilancio.contoEconomico.differenzaAB, contextId, unitId));

  // Imposte e utile
  facts.push(buildFact(`itcc-ci:${CE_XBRL["20"]}`, bilancio.contoEconomico.imposte, contextId, unitId));
  facts.push(buildFact(`itcc-ci:${CE_XBRL["21"]}`, bilancio.contoEconomico.utilePerditaEsercizio, contextId, unitId));

  return buildXbrlDocument(societa, dataInizio, dataFine, contextId, unitId, facts);
}

function buildFact(concept: string, amount: number, contextRef: string, unitRef: string): string {
  return `    <${concept} contextRef="${contextRef}" unitRef="${unitRef}" decimals="2">${formatAmount(amount)}</${concept}>`;
}

function buildXbrlDocument(
  societa: DatiSocieta,
  dataInizio: string,
  dataFine: string,
  contextId: string,
  unitId: string,
  facts: string[]
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<xbrl
  xmlns="http://www.xbrl.org/2003/instance"
  xmlns:xbrli="http://www.xbrl.org/2003/instance"
  xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
  xmlns:itcc-ci="http://www.infocamere.it/itcc/itcc-ci-2018-11-04">

  <link:schemaRef xlink:type="simple"
    xlink:href="http://www.infocamere.it/itcc/itcc-ci-2018-11-04_entry-point_full.xsd" />

  <xbrli:context id="${contextId}">
    <xbrli:entity>
      <xbrli:identifier scheme="http://www.agenziaentrate.gov.it/">${escapeXml(societa.partitaIva)}</xbrli:identifier>
    </xbrli:entity>
    <xbrli:period>
      <xbrli:startDate>${dataInizio}</xbrli:startDate>
      <xbrli:endDate>${dataFine}</xbrli:endDate>
    </xbrli:period>
  </xbrli:context>

  <xbrli:unit id="${unitId}">
    <xbrli:measure>iso4217:EUR</xbrli:measure>
  </xbrli:unit>

  <!-- Denominazione sociale -->
  <itcc-ci:DenominazioneSociale contextRef="${contextId}">${escapeXml(societa.ragioneSociale)}</itcc-ci:DenominazioneSociale>

  <!-- Dati di bilancio -->
${facts.join("\n")}

</xbrl>`;
}
