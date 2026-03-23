import { generaFatturaPassiva } from "./fattura-passiva";
import { generaFatturaAttiva } from "./fattura-attiva";
import { generaReverseCharge } from "./reverse-charge";
import { generaCompensoAmministratore } from "./compenso-amministratore";
import { generaCespiteAcquisto } from "./cespite-acquisto";
import { generaAmmortamento } from "./ammortamento";
import { generaPagamentoImposte } from "./pagamento-imposte";
import { generaDividendi } from "./dividendi";
import { generaLiquidazioneIva } from "./liquidazione-iva";
import { generaPagamento } from "./pagamento";
import { generaOperazioneGenerica } from "./operazione-generica";
import { generaChiusuraEsercizio } from "./chiusura-esercizio";
import type { Generatore } from "../types";

export const GENERATORI: Record<string, Generatore> = {
  FA: generaFatturaPassiva,
  NCA: generaFatturaPassiva,
  NDA: generaFatturaPassiva,
  FV: generaFatturaAttiva,
  FVS: generaFatturaAttiva,
  NCV: generaFatturaAttiva,
  NDV: generaFatturaAttiva,
  FAUE: generaReverseCharge,
  FARE: generaReverseCharge,
  FA_CESPITE: generaCespiteAcquisto,
  CA: generaCompensoAmministratore,
  AM: generaAmmortamento,
  F24: generaPagamentoImposte,
  DIV: generaDividendi,
  LQ: generaLiquidazioneIva,
  PG: generaPagamento,
  IN: generaPagamento,
  OG: generaOperazioneGenerica,
  SC: generaChiusuraEsercizio,
  SA: generaChiusuraEsercizio,
  SAS: generaChiusuraEsercizio,
  ST: generaChiusuraEsercizio,
};

export {
  generaFatturaPassiva,
  generaFatturaAttiva,
  generaReverseCharge,
  generaCompensoAmministratore,
  generaCespiteAcquisto,
  generaAmmortamento,
  generaPagamentoImposte,
  generaDividendi,
  generaLiquidazioneIva,
  generaPagamento,
  generaOperazioneGenerica,
  generaChiusuraEsercizio,
};
