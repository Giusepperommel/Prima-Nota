/**
 * Bilancio Civilistico Engine
 *
 * Orchestrazione: legge i saldi dal bilancio di verifica e chiama
 * SP builder e CE builder per produrre il bilancio completo.
 */

import type { SaldoConto, BilancioCompleto } from "./types";
import { buildStatoPatrimoniale } from "./sp-builder";
import { buildContoEconomico } from "./ce-builder";

/**
 * Genera il bilancio civilistico completo a partire dai saldi dei conti.
 */
export function generaBilancio(
  anno: number,
  saldi: SaldoConto[],
  tipo: "ORDINARIO" | "ABBREVIATO" = "ORDINARIO"
): BilancioCompleto {
  const statoPatrimoniale = buildStatoPatrimoniale(saldi);
  const contoEconomico = buildContoEconomico(saldi);

  const totaleAttivo = statoPatrimoniale.attivo.totale;
  const totalePassivo = statoPatrimoniale.passivo.totale;
  const utileEsercizio = contoEconomico.utilePerditaEsercizio;

  return {
    anno,
    tipo,
    statoPatrimoniale,
    contoEconomico,
    totaleAttivo,
    totalePassivo,
    utileEsercizio,
  };
}
