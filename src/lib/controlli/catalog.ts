import type { CheckDefinition } from "./types";

// Deterministic rules
import { checkDareAvere } from "./rules/dare-avere";
import { checkAnagraficheIncomplete } from "./rules/anagrafiche-incomplete";
import { checkQuadraturaIva } from "./rules/quadratura-iva";
import { checkProtocolloIva } from "./rules/protocollo-iva";
import { checkFattureSenzaRegistrazione } from "./rules/fatture-senza-registrazione";
import { checkScadenzeScoperte } from "./rules/scadenze-scoperte";
import { checkCassaNegativa } from "./rules/cassa-negativa";
import { checkRitenuteNonVersate } from "./rules/ritenute-non-versate";
import { checkPlafondSforato } from "./rules/plafond-sforato";
import { checkAmmortamentiMancanti } from "./rules/ammortamenti-mancanti";

// Pattern checks
import { checkDoppiaFattura } from "./patterns/doppia-fattura";
import { checkCategoriaAnomala } from "./patterns/categoria-anomala";

const checks: CheckDefinition[] = [];

export function registerCheck(check: CheckDefinition): void {
  checks.push(check);
}

export function getAllChecks(): CheckDefinition[] {
  return [...checks];
}

export function getChecksBySource(sorgente: string): CheckDefinition[] {
  return checks.filter((c) => c.sorgente === sorgente);
}

// ─── Register all checks ────────────────────────────────────────────────────

registerCheck({
  id: "dare-avere",
  nome: "Quadratura dare/avere",
  sorgente: "REGOLA",
  run: checkDareAvere,
});

registerCheck({
  id: "anagrafiche-incomplete",
  nome: "Anagrafiche incomplete",
  sorgente: "REGOLA",
  run: checkAnagraficheIncomplete,
});

registerCheck({
  id: "quadratura-iva",
  nome: "Quadratura IVA",
  sorgente: "REGOLA",
  run: checkQuadraturaIva,
});

registerCheck({
  id: "protocollo-iva",
  nome: "Protocollo IVA",
  sorgente: "REGOLA",
  run: checkProtocolloIva,
});

registerCheck({
  id: "fatture-senza-registrazione",
  nome: "Fatture senza registrazione IVA",
  sorgente: "REGOLA",
  run: checkFattureSenzaRegistrazione,
});

registerCheck({
  id: "scadenze-scoperte",
  nome: "Scadenze scoperte",
  sorgente: "REGOLA",
  run: checkScadenzeScoperte,
});

registerCheck({
  id: "cassa-negativa",
  nome: "Cassa negativa",
  sorgente: "REGOLA",
  run: checkCassaNegativa,
});

registerCheck({
  id: "ritenute-non-versate",
  nome: "Ritenute non versate",
  sorgente: "REGOLA",
  run: checkRitenuteNonVersate,
});

registerCheck({
  id: "plafond-sforato",
  nome: "Plafond sforato",
  sorgente: "REGOLA",
  run: checkPlafondSforato,
});

registerCheck({
  id: "ammortamenti-mancanti",
  nome: "Ammortamenti mancanti",
  sorgente: "REGOLA",
  run: checkAmmortamentiMancanti,
});

registerCheck({
  id: "doppia-fattura",
  nome: "Doppia fattura",
  sorgente: "PATTERN",
  run: checkDoppiaFattura,
});

registerCheck({
  id: "categoria-anomala",
  nome: "Categoria anomala",
  sorgente: "PATTERN",
  run: checkCategoriaAnomala,
});
