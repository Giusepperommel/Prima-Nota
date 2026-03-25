import type { CheckResult } from "../types";

export async function checkRitenuteNonVersate(_societaId: number, _anno: number): Promise<CheckResult> {
  // TODO: implement withholdings not paid by 16th check
  return { found: false, anomalie: [] };
}
