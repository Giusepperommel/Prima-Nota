import type { CheckResult } from "../types";

export async function checkFattureSenzaRegistrazione(_societaId: number, _anno: number): Promise<CheckResult> {
  // TODO: implement imported but not IVA-registered invoices check
  return { found: false, anomalie: [] };
}
