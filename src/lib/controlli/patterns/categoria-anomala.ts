import type { CheckResult } from "../types";

export async function checkCategoriaAnomala(_societaId: number, _anno: number): Promise<CheckResult> {
  // TODO: implement operation classified differently from history pattern
  return { found: false, anomalie: [] };
}
