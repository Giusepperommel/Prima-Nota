export const API_SCOPES = [
  "read:operazioni", "write:operazioni",
  "read:anagrafiche", "write:anagrafiche",
  "read:scritture", "write:scritture",
  "read:fatture", "write:fatture",
  "read:registri-iva", "read:liquidazioni",
  "read:f24", "read:cu", "read:cespiti",
  "read:movimenti-bancari", "read:scadenzario",
  "read:piano-conti", "write:piano-conti",
  "read:alert", "read:todo",
  "read:kpi", "read:report",
  "webhook:manage",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export interface ApiKeyPayload {
  keyId: number;
  societaId: number;
  scopes: ApiScope[];
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}
