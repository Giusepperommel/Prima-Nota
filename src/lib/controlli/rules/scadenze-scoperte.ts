import type { CheckResult } from "../types";

export async function checkScadenzeScoperte(_societaId: number, _anno: number): Promise<CheckResult> {
  // TODO: implement F24/LIPE/CU near deadline not completed check
  return { found: false, anomalie: [] };
}
