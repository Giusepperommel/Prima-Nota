import type { ClassifierInput, ClassifierOutput } from "./types";
import { getCountryGroup, type CountryGroup } from "./countries";

const ALIQUOTA_ORDINARIA = 22;

const REVERSE_CHARGE_NATURE = new Set<string>([
  "N6_1", "N6_2", "N6_3", "N6_4", "N6_5", "N6_6", "N6_7", "N6_8", "N6_9",
]);

export function classify(input: ClassifierInput): ClassifierOutput {
  const countryGroup = getCountryGroup(input.nazioneFornitore);
  const warnings: string[] = [];

  if (input.tipoOperazione === "FATTURA_ATTIVA") {
    return classifyVendita(input, countryGroup, warnings);
  }
  return classifyAcquisto(input, countryGroup, warnings);
}

function classifyVendita(input: ClassifierInput, countryGroup: string, warnings: string[]): ClassifierOutput {
  const base: ClassifierOutput = {
    naturaIva: null, aliquotaIva: ALIQUOTA_ORDINARIA, tipoDocumentoSdi: "TD01",
    richiedeAutofattura: false, richiedeDoppiaRegistrazione: false,
    tipoDocumentoAutofattura: null, registroIva: "VENDITE",
    countryGroup: countryGroup as CountryGroup, warnings,
  };

  if (countryGroup === "IT") {
    if (input.naturaIvaManuale) base.naturaIva = input.naturaIvaManuale;
    if (input.aliquotaIva != null) base.aliquotaIva = input.aliquotaIva;
    return base;
  }

  if (countryGroup === "UE") {
    if (input.tipoMerce === "BENI") { base.naturaIva = "N3_2"; base.aliquotaIva = 0; }
    else { base.naturaIva = "N2_1"; base.aliquotaIva = 0; }
  } else if (countryGroup === "EXTRA_UE" || countryGroup === "SAN_MARINO") {
    if (input.tipoMerce === "BENI") { base.naturaIva = "N3_1"; base.aliquotaIva = 0; }
    else { base.naturaIva = "N2_1"; base.aliquotaIva = 0; }
  }

  if (input.naturaIvaManuale && input.naturaIvaManuale !== base.naturaIva) {
    warnings.push(`Natura manuale ${input.naturaIvaManuale} diversa dalla classificazione automatica ${base.naturaIva}`);
    base.naturaIva = input.naturaIvaManuale;
  }
  return base;
}

function classifyAcquisto(input: ClassifierInput, countryGroup: string, warnings: string[]): ClassifierOutput {
  const base: ClassifierOutput = {
    naturaIva: null, aliquotaIva: input.aliquotaIva ?? ALIQUOTA_ORDINARIA,
    tipoDocumentoSdi: "TD01", richiedeAutofattura: false, richiedeDoppiaRegistrazione: false,
    tipoDocumentoAutofattura: null, registroIva: "ACQUISTI",
    countryGroup: countryGroup as CountryGroup, warnings,
  };

  // N7 (OSS) — no action
  if (input.naturaIvaManuale === "N7") {
    base.naturaIva = "N7"; base.aliquotaIva = 0; return base;
  }

  // IT domestico
  if (countryGroup === "IT") {
    if (input.naturaIvaManuale) base.naturaIva = input.naturaIvaManuale;
    if (input.aliquotaIva != null) base.aliquotaIva = input.aliquotaIva;
    if (input.isReverseChargeInterno && input.naturaIvaManuale && REVERSE_CHARGE_NATURE.has(input.naturaIvaManuale)) {
      base.richiedeAutofattura = true; base.richiedeDoppiaRegistrazione = true; base.tipoDocumentoAutofattura = "TD16";
    }
    return base;
  }

  // UE
  if (countryGroup === "UE") {
    base.aliquotaIva = ALIQUOTA_ORDINARIA; base.richiedeAutofattura = true; base.richiedeDoppiaRegistrazione = true;
    base.tipoDocumentoAutofattura = input.tipoMerce === "BENI" ? "TD18" : "TD17";
    return applyOverride(base, input, warnings);
  }

  // Extra-UE
  if (countryGroup === "EXTRA_UE") {
    base.aliquotaIva = ALIQUOTA_ORDINARIA; base.richiedeAutofattura = true; base.richiedeDoppiaRegistrazione = true;
    base.tipoDocumentoAutofattura = input.tipoMerce === "SERVIZI" ? "TD17" : "TD19";
    return applyOverride(base, input, warnings);
  }

  // San Marino
  if (countryGroup === "SAN_MARINO") {
    if (input.sanMarinoConIva) {
      base.richiedeAutofattura = true; base.richiedeDoppiaRegistrazione = false;
      base.tipoDocumentoAutofattura = "TD28";
      if (input.aliquotaIva != null) base.aliquotaIva = input.aliquotaIva;
    } else {
      base.aliquotaIva = ALIQUOTA_ORDINARIA; base.richiedeAutofattura = true;
      base.richiedeDoppiaRegistrazione = true; base.tipoDocumentoAutofattura = "TD19";
    }
    return applyOverride(base, input, warnings);
  }

  return base;
}

function applyOverride(output: ClassifierOutput, input: ClassifierInput, warnings: string[]): ClassifierOutput {
  if (input.naturaIvaManuale) {
    warnings.push(`Override manuale natura: ${input.naturaIvaManuale} (classificazione automatica: operazione imponibile con aliquota ${output.aliquotaIva}%)`);
    output.naturaIva = input.naturaIvaManuale;
  }
  return output;
}
