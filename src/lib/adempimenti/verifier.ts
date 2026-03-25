import { prisma } from "@/lib/prisma";
import type { ChecklistAdempimento } from "@prisma/client";

export type VerificaResult = { completata: boolean; dettaglio?: string };

// ─── Registry of verification functions ───────────────────────────────────────
// Each function queries the DB and returns whether the check passed.
// Field names match the actual Prisma schema.

const VERIFICHE: Record<
  string,
  (societaId: number, anno: number, periodo: number) => Promise<VerificaResult>
> = {
  /**
   * 1. Check that invoices for the period are registered (not bozza).
   */
  fattureMeseRegistrate: async (societaId, anno, periodo) => {
    const count = await prisma.operazione.count({
      where: {
        societaId,
        bozza: false,
        eliminato: false,
        dataOperazione: {
          gte: new Date(anno, periodo - 1, 1),
          lt: new Date(anno, periodo, 1),
        },
      },
    });
    return { completata: count > 0, dettaglio: `${count} fatture registrate` };
  },

  /**
   * 2. Check that IVA register entries exist for the period.
   */
  registriIvaQuadrano: async (societaId, anno, periodo) => {
    const count = await prisma.operazione.count({
      where: {
        societaId,
        bozza: false,
        eliminato: false,
        registroIva: { not: null },
        dataRegistrazione: {
          gte: new Date(anno, periodo - 1, 1),
          lt: new Date(anno, periodo, 1),
        },
      },
    });
    return { completata: count > 0, dettaglio: `${count} registrazioni IVA` };
  },

  /**
   * 3. Check that the IVA liquidation for the period has been calculated.
   */
  liquidazioneCalcolata: async (societaId, anno, periodo) => {
    const liq = await prisma.liquidazioneIva.findFirst({
      where: { societaId, anno, periodo },
    });
    return { completata: liq !== null };
  },

  /**
   * 4. Check that an F24 has been generated for the period.
   */
  f24Generato: async (societaId, anno, periodo) => {
    const f24 = await prisma.f24Versamento.findFirst({
      where: { societaId, anno, mese: periodo },
    });
    return { completata: f24 !== null };
  },

  /**
   * 5. Check that an F24 for the period has been paid (stato = PAGATO).
   */
  f24Pagato: async (societaId, anno, periodo) => {
    const f24 = await prisma.f24Versamento.findFirst({
      where: { societaId, anno, mese: periodo, stato: "PAGATO" },
    });
    return { completata: f24 !== null };
  },

  /**
   * 6. Check that ritenute for the period have been calculated.
   * Uses the Ritenuta model's meseCompetenza / annoCompetenza fields.
   */
  ritenuteCalcolate: async (societaId, anno, periodo) => {
    const count = await prisma.ritenuta.count({
      where: {
        societaId,
        annoCompetenza: anno,
        meseCompetenza: periodo,
      },
    });
    return { completata: count > 0, dettaglio: `${count} ritenute calcolate` };
  },

  /**
   * 7. Check all ritenute for the period are versate (statoVersamento != DA_VERSARE).
   */
  ritenuteVersate: async (societaId, anno, periodo) => {
    const nonVersate = await prisma.ritenuta.count({
      where: {
        societaId,
        annoCompetenza: anno,
        meseCompetenza: periodo,
        statoVersamento: "DA_VERSARE",
      },
    });
    return { completata: nonVersate === 0, dettaglio: `${nonVersate} ritenute da versare` };
  },

  /**
   * 8. Check that CU has been generated for the anno.
   */
  cuGenerata: async (societaId, anno) => {
    const cu = await prisma.certificazioneUnica.findFirst({
      where: { societaId, anno },
    });
    return { completata: cu !== null };
  },

  /**
   * 9. Check that LIPE has been generated for the trimestre.
   */
  lipeGenerata: async (societaId, anno, periodo) => {
    const lipe = await prisma.lipeInvio.findFirst({
      where: { societaId, anno, trimestre: periodo },
    });
    return { completata: lipe !== null };
  },

  /**
   * 10. Check that bilancio has been generated for the anno.
   */
  bilancioGenerato: async (societaId, anno) => {
    const bilancio = await prisma.bilancioGenerato.findFirst({
      where: { societaId, anno },
    });
    return { completata: bilancio !== null };
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Verify a single checklist item by running its automatic verification query.
 * Returns the verification result without persisting it.
 */
export async function verificaChecklist(
  societaId: number,
  item: ChecklistAdempimento,
  anno: number,
  periodo: number
): Promise<VerificaResult> {
  if (!item.verificaAutomatica || !item.queryVerifica) {
    return { completata: item.completata };
  }

  const fn = VERIFICHE[item.queryVerifica];
  if (!fn) {
    return { completata: false, dettaglio: `Verifica sconosciuta: ${item.queryVerifica}` };
  }

  return fn(societaId, anno, periodo);
}

/**
 * Recalculate the progress percentage and stato of a ScadenzaFiscale
 * based on its checklist items' completata status.
 */
export async function aggiornaProgressoScadenza(scadenzaId: number): Promise<void> {
  const scadenza = await prisma.scadenzaFiscale.findUnique({
    where: { id: scadenzaId },
    include: { checklist: true },
  });

  if (!scadenza || scadenza.checklist.length === 0) return;

  const completate = scadenza.checklist.filter(
    (c: { completata: boolean }) => c.completata
  ).length;
  const percentuale = Math.round((completate / scadenza.checklist.length) * 100);

  let stato: "NON_INIZIATA" | "IN_PREPARAZIONE" | "PRONTA";
  if (percentuale === 0) stato = "NON_INIZIATA";
  else if (percentuale === 100) stato = "PRONTA";
  else stato = "IN_PREPARAZIONE";

  await prisma.scadenzaFiscale.update({
    where: { id: scadenzaId },
    data: { percentualeCompletamento: percentuale, stato },
  });
}
