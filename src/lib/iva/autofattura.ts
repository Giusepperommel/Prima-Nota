import type { TipoDocumentoSdi, TipoMerce } from "@prisma/client";
import type { AutofatturaData } from "./types";

type BuildAutofatturaInput = {
  descrizioneOriginale: string; importoImponibile: number;
  tipoDocumentoAutofattura: TipoDocumentoSdi; aliquotaIva: number;
  tipoMerce: TipoMerce; doppiaRegistrazione: boolean;
};

const MAX_DESC_LENGTH = 255;

export function buildAutofatturaData(input: BuildAutofatturaInput): AutofatturaData {
  const importoIva = Math.round(input.importoImponibile * input.aliquotaIva) / 100;
  const rawDescrizione = `Integrazione ${input.tipoDocumentoAutofattura} - ${input.descrizioneOriginale}`;
  const descrizione = rawDescrizione.length > MAX_DESC_LENGTH ? rawDescrizione.slice(0, MAX_DESC_LENGTH - 3) + "..." : rawDescrizione;

  return {
    descrizione, importoImponibile: input.importoImponibile, aliquotaIva: input.aliquotaIva,
    importoIva, tipoDocumentoSdi: input.tipoDocumentoAutofattura, tipoMerce: input.tipoMerce,
    doppiaRegistrazione: input.doppiaRegistrazione, registroIva: "ACQUISTI", naturaOperazioneIva: null,
  };
}
