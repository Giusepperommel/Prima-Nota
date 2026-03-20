const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "LV", "LT", "LU", "MT", "NL", "PL",
  "PT", "RO", "SK", "SI", "ES", "SE",
]);

export type CountryGroup = "IT" | "UE" | "SAN_MARINO" | "EXTRA_UE";

export function getCountryGroup(nazione: string | null | undefined): CountryGroup {
  if (!nazione) return "IT";
  const code = nazione.toUpperCase().trim();
  if (!code || code === "IT") return "IT";
  if (code === "SM") return "SAN_MARINO";
  if (EU_COUNTRIES.has(code)) return "UE";
  return "EXTRA_UE";
}

export function isEU(nazione: string): boolean {
  return getCountryGroup(nazione) === "UE";
}

export function isExtraEU(nazione: string): boolean {
  return getCountryGroup(nazione) === "EXTRA_UE";
}

export function isSanMarino(nazione: string): boolean {
  return getCountryGroup(nazione) === "SAN_MARINO";
}

/** Full EU country list for UI select, sorted alphabetically by name */
export const EU_COUNTRY_LIST: { code: string; name: string }[] = [
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgio" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croazia" },
  { code: "CY", name: "Cipro" },
  { code: "CZ", name: "Repubblica Ceca" },
  { code: "DK", name: "Danimarca" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finlandia" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Germania" },
  { code: "GR", name: "Grecia" },
  { code: "HU", name: "Ungheria" },
  { code: "IE", name: "Irlanda" },
  { code: "LV", name: "Lettonia" },
  { code: "LT", name: "Lituania" },
  { code: "LU", name: "Lussemburgo" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Paesi Bassi" },
  { code: "PL", name: "Polonia" },
  { code: "PT", name: "Portogallo" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovacchia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spagna" },
  { code: "SE", name: "Svezia" },
];
