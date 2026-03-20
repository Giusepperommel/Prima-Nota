import type { NaturaIva, TipoDocumentoSdi, RegistroIva, TipoMerce } from "@prisma/client";
import type { CountryGroup } from "./countries";

export type ClassifierInput = {
  nazioneFornitore: string | null;
  tipoMerce: TipoMerce;
  tipoOperazione: "COSTO" | "FATTURA_ATTIVA";
  naturaIvaManuale?: NaturaIva | null;
  aliquotaIva?: number | null;
  isReverseChargeInterno?: boolean;
  sanMarinoConIva?: boolean;
};

export type ClassifierOutput = {
  naturaIva: NaturaIva | null;
  aliquotaIva: number;
  tipoDocumentoSdi: TipoDocumentoSdi;
  richiedeAutofattura: boolean;
  richiedeDoppiaRegistrazione: boolean;
  tipoDocumentoAutofattura: TipoDocumentoSdi | null;
  registroIva: RegistroIva;
  countryGroup: CountryGroup;
  warnings: string[];
};

export type AutofatturaData = {
  descrizione: string;
  importoImponibile: number;
  aliquotaIva: number;
  importoIva: number;
  tipoDocumentoSdi: TipoDocumentoSdi;
  tipoMerce: TipoMerce;
  doppiaRegistrazione: boolean;
  registroIva: RegistroIva;
  naturaOperazioneIva: NaturaIva | null;
};

export type ValidationWarning = {
  field: string;
  message: string;
  severity: "warning" | "error";
};

export type PlafondCheckResult = {
  plafondAttivo: boolean;
  importoDisponibile: number;
  importoUtilizzato: number;
  importoResiduo: number;
  sforamento: boolean;
  importoSforamento: number;
};
