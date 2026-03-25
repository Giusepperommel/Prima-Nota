import type { CheckDefinition } from "./types";

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
