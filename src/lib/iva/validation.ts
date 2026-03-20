import type { NaturaIva, TipoDocumentoSdi, TipoMerce } from "@prisma/client";
import type { ValidationWarning } from "./types";
import { getCountryGroup } from "./countries";

const REVERSE_CHARGE_NATURE = new Set<string>(["N6_1","N6_2","N6_3","N6_4","N6_5","N6_6","N6_7","N6_8","N6_9"]);

type ValidationInput = {
  naturaIva: NaturaIva | null; aliquotaIva: number; nazioneFornitore: string | null;
  tipoDocumentoSdi: TipoDocumentoSdi | null; tipoMerce: TipoMerce | null;
  isAutofattura: boolean; splitPayment?: boolean; plafondAttivo?: boolean;
};

export function validateIva(input: ValidationInput): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const countryGroup = getCountryGroup(input.nazioneFornitore);
  const isRcNatura = input.naturaIva && REVERSE_CHARGE_NATURE.has(input.naturaIva);

  if (input.naturaIva && input.aliquotaIva > 0 && !isRcNatura && !input.isAutofattura) {
    warnings.push({ field: "aliquotaIva", message: "Natura IVA implica aliquota 0%", severity: "warning" });
  }
  if (isRcNatura && countryGroup !== "IT") {
    warnings.push({ field: "naturaIva", message: "Reverse charge interno (N6.x) non compatibile con fornitore estero", severity: "warning" });
  }
  if (input.tipoDocumentoSdi === "TD18" && countryGroup === "EXTRA_UE") {
    warnings.push({ field: "tipoDocumentoSdi", message: "TD18 è solo per beni intra-UE, usare TD19", severity: "error" });
  }
  if (input.tipoDocumentoSdi === "TD18" && input.tipoMerce === "SERVIZI") {
    warnings.push({ field: "tipoDocumentoSdi", message: "TD18 è per beni, servizi usano TD17", severity: "warning" });
  }
  if (input.naturaIva === "N3_5" && !input.plafondAttivo) {
    warnings.push({ field: "naturaIva", message: "Operazione N3.5 senza plafond configurato", severity: "warning" });
  }
  if (input.splitPayment && isRcNatura) {
    warnings.push({ field: "splitPayment", message: "Reverse charge ha priorità su split payment", severity: "warning" });
  }
  return warnings;
}
