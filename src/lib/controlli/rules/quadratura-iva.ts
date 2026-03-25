import type { CheckResult } from "../types";

export async function checkQuadraturaIva(_societaId: number, _anno: number): Promise<CheckResult> {
  // TODO: implement IVA vendite vs acquisti vs liquidazione check
  return { found: false, anomalie: [] };
}
