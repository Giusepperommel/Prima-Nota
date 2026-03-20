import type { NaturaIva, TipoMerce } from "@prisma/client";
import type { ClassifierOutput, AutofatturaData, ValidationWarning, PlafondCheckResult } from "./types";
import { classify } from "./classifier";
import { buildAutofatturaData } from "./autofattura";
import { validateIva } from "./validation";
import { checkPlafond } from "./plafond";

type ProcessIvaInput = {
  nazioneFornitore: string | null; tipoMerce: TipoMerce;
  tipoOperazione: "COSTO" | "FATTURA_ATTIVA"; descrizione: string;
  importoImponibile: number; aliquotaIva?: number | null;
  naturaIvaManuale?: NaturaIva | null; isReverseChargeInterno?: boolean;
  sanMarinoConIva?: boolean; splitPayment?: boolean;
  plafondAttivo?: boolean; plafondDisponibile?: number; plafondUtilizzato?: number;
};

type ProcessIvaResult = {
  classification: ClassifierOutput; autofattura: AutofatturaData | null;
  validationWarnings: ValidationWarning[]; plafondResult: PlafondCheckResult | null;
  splafonamentoAutofattura: AutofatturaData | null;
};

export function processIva(input: ProcessIvaInput): ProcessIvaResult {
  const classification = classify({
    nazioneFornitore: input.nazioneFornitore, tipoMerce: input.tipoMerce,
    tipoOperazione: input.tipoOperazione, naturaIvaManuale: input.naturaIvaManuale,
    aliquotaIva: input.aliquotaIva, isReverseChargeInterno: input.isReverseChargeInterno,
    sanMarinoConIva: input.sanMarinoConIva,
  });

  let autofattura: AutofatturaData | null = null;
  if (classification.richiedeAutofattura && classification.tipoDocumentoAutofattura) {
    autofattura = buildAutofatturaData({
      descrizioneOriginale: input.descrizione, importoImponibile: input.importoImponibile,
      tipoDocumentoAutofattura: classification.tipoDocumentoAutofattura,
      aliquotaIva: classification.aliquotaIva, tipoMerce: input.tipoMerce,
      doppiaRegistrazione: classification.richiedeDoppiaRegistrazione,
    });
  }

  let plafondResult: PlafondCheckResult | null = null;
  let splafonamentoAutofattura: AutofatturaData | null = null;
  const isPlafondOp = classification.naturaIva === "N3_5" || input.naturaIvaManuale === "N3_5";

  if (isPlafondOp && input.plafondAttivo) {
    plafondResult = checkPlafond({
      plafondAttivo: true, importoDisponibile: input.plafondDisponibile || 0,
      importoUtilizzato: input.plafondUtilizzato || 0, importoOperazione: input.importoImponibile,
    });
    if (plafondResult.sforamento) {
      splafonamentoAutofattura = buildAutofatturaData({
        descrizioneOriginale: `Splafonamento - ${input.descrizione}`,
        importoImponibile: plafondResult.importoSforamento,
        tipoDocumentoAutofattura: "TD21", aliquotaIva: 22,
        tipoMerce: input.tipoMerce, doppiaRegistrazione: false,
      });
    }
  }

  const validationWarnings = validateIva({
    naturaIva: classification.naturaIva, aliquotaIva: classification.aliquotaIva,
    nazioneFornitore: input.nazioneFornitore, tipoDocumentoSdi: classification.tipoDocumentoSdi,
    tipoMerce: input.tipoMerce, isAutofattura: false, splitPayment: input.splitPayment,
    plafondAttivo: input.plafondAttivo,
  });

  return { classification, autofattura, validationWarnings, plafondResult, splafonamentoAutofattura };
}
