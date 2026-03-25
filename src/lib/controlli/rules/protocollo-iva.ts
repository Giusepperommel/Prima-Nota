import type { CheckResult } from "../types";

export async function checkProtocolloIva(_societaId: number, _anno: number): Promise<CheckResult> {
  // TODO: implement IVA register numbering gaps check
  return { found: false, anomalie: [] };
}
