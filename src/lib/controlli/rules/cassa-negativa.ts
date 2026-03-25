import type { CheckResult } from "../types";

export async function checkCassaNegativa(_societaId: number, _anno: number): Promise<CheckResult> {
  // TODO: implement cash balance < 0 check
  return { found: false, anomalie: [] };
}
