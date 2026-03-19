const MAPPING_RULES: { pattern: string; codice: string }[] = [
  { pattern: "consulen", codice: "310.001" },
  { pattern: "utenz", codice: "310.010" },
  { pattern: "energia", codice: "310.010" },
  { pattern: "luce", codice: "310.010" },
  { pattern: "telefon", codice: "310.014" },
  { pattern: "mobile", codice: "310.014" },
  { pattern: "internet", codice: "310.015" },
  { pattern: "connett", codice: "310.015" },
  { pattern: "assicuraz", codice: "310.020" },
  { pattern: "banca", codice: "310.030" },
  { pattern: "commissioni bancarie", codice: "310.030" },
  { pattern: "pubblicit", codice: "310.040" },
  { pattern: "promozione", codice: "310.040" },
  { pattern: "trasferta", codice: "310.050" },
  { pattern: "rimborso spese", codice: "310.050" },
  { pattern: "affitto", codice: "320.001" },
  { pattern: "locazione", codice: "320.001" },
  { pattern: "noleggio auto", codice: "320.002" },
  { pattern: "leasing", codice: "320.005" },
  { pattern: "compenso amministrat", codice: "330.040" },
  { pattern: "ires", codice: "390.001" },
  { pattern: "irap", codice: "390.002" },
  { pattern: "fattura attiva", codice: "400.001" },
  { pattern: "ricavo", codice: "400.001" },
];

export function suggerisciConto(nomeCategoria: string): string | null {
  const nome = nomeCategoria.toLowerCase();
  const match = MAPPING_RULES.find(r => nome.includes(r.pattern));
  return match?.codice ?? null;
}
