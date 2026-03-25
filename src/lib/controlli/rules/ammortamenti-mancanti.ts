import type { CheckResult } from "../types";

export async function checkAmmortamentiMancanti(_societaId: number, _anno: number): Promise<CheckResult> {
  // TODO: implement active assets without current year depreciation check
  return { found: false, anomalie: [] };
}
