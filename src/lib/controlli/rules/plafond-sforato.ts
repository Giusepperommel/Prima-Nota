import type { CheckResult } from "../types";

export async function checkPlafondSforato(_societaId: number, _anno: number): Promise<CheckResult> {
  // TODO: implement plafond usage > availability check
  return { found: false, anomalie: [] };
}
