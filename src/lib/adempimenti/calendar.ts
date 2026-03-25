import { prisma } from "@/lib/prisma";
import type { ScadenzaFiscaleTipo } from "@prisma/client";
import type {
  ScadenzaTemplate,
  SocietaContext,
  GeneraCalendarioResult,
} from "./types";

// ─── 13 Deadline Templates ────────────────────────────────────────────────────

export const SCADENZE_TEMPLATES: ScadenzaTemplate[] = [
  // 1. F24 IVA — monthly, day 16
  {
    tipo: "F24_IVA",
    nome: "F24 IVA mensile",
    frequenza: "MENSILE",
    giornoScadenza: 16,
    condizione: (ctx) => ctx.regimeFiscale !== "FORFETTARIO",
    checklist: [
      { descrizione: "Fatture del mese registrate", verificaAutomatica: true, queryVerifica: "fattureMeseRegistrate" },
      { descrizione: "Registri IVA quadrano", verificaAutomatica: true, queryVerifica: "registriIvaQuadrano" },
      { descrizione: "Liquidazione IVA calcolata", verificaAutomatica: true, queryVerifica: "liquidazioneCalcolata" },
      { descrizione: "F24 generato", verificaAutomatica: true, queryVerifica: "f24Generato" },
      { descrizione: "F24 pagato/inviato", verificaAutomatica: true, queryVerifica: "f24Pagato" },
    ],
  },
  // 2. F24 RITENUTE — monthly, day 16
  {
    tipo: "F24_RITENUTE",
    nome: "F24 Ritenute d'acconto",
    frequenza: "MENSILE",
    giornoScadenza: 16,
    condizione: (ctx) => ctx.hasRitenute,
    checklist: [
      { descrizione: "Ritenute del mese calcolate", verificaAutomatica: true, queryVerifica: "ritenuteCalcolate" },
      { descrizione: "F24 ritenute generato", verificaAutomatica: true, queryVerifica: "f24Generato" },
      { descrizione: "F24 ritenute pagato", verificaAutomatica: true, queryVerifica: "f24Pagato" },
    ],
  },
  // 3. F24 ACCONTO IRES — annual, June 30 and Nov 30
  {
    tipo: "F24_ACCONTO_IRES",
    nome: "Acconto IRES",
    frequenza: "ANNUALE",
    giornoScadenza: 30,
    meseScadenza: 6,
    condizione: (ctx) =>
      !["DITTA_INDIVIDUALE", "LIBERO_PROFESSIONISTA"].includes(ctx.tipoAttivita) &&
      ctx.regimeFiscale !== "FORFETTARIO",
    checklist: [
      { descrizione: "Calcolo acconto IRES effettuato", verificaAutomatica: false },
      { descrizione: "F24 generato", verificaAutomatica: true, queryVerifica: "f24Generato" },
      { descrizione: "F24 pagato", verificaAutomatica: true, queryVerifica: "f24Pagato" },
    ],
  },
  // 4. F24 ACCONTO IRPEF — annual, June 30
  {
    tipo: "F24_ACCONTO_IRPEF",
    nome: "Acconto IRPEF",
    frequenza: "ANNUALE",
    giornoScadenza: 30,
    meseScadenza: 6,
    condizione: (ctx) =>
      ["DITTA_INDIVIDUALE", "LIBERO_PROFESSIONISTA"].includes(ctx.tipoAttivita),
    checklist: [
      { descrizione: "Calcolo acconto IRPEF effettuato", verificaAutomatica: false },
      { descrizione: "F24 generato", verificaAutomatica: true, queryVerifica: "f24Generato" },
      { descrizione: "F24 pagato", verificaAutomatica: true, queryVerifica: "f24Pagato" },
    ],
  },
  // 5. LIPE — quarterly
  {
    tipo: "LIPE",
    nome: "Comunicazione liquidazioni periodiche IVA (LIPE)",
    frequenza: "TRIMESTRALE",
    giornoScadenza: 31,
    condizione: (ctx) => ctx.regimeFiscale !== "FORFETTARIO",
    checklist: [
      { descrizione: "Liquidazioni IVA del trimestre calcolate", verificaAutomatica: true, queryVerifica: "liquidazioneCalcolata" },
      { descrizione: "LIPE generata", verificaAutomatica: true, queryVerifica: "lipeGenerata" },
      { descrizione: "LIPE inviata", verificaAutomatica: false },
    ],
  },
  // 6. CU — annual, March 16
  {
    tipo: "CU",
    nome: "Certificazione Unica",
    frequenza: "ANNUALE",
    giornoScadenza: 16,
    meseScadenza: 3,
    condizione: (ctx) => ctx.hasRitenute,
    checklist: [
      { descrizione: "Ritenute anno precedente verificate", verificaAutomatica: true, queryVerifica: "ritenuteVersate" },
      { descrizione: "CU generate per tutti i percipienti", verificaAutomatica: true, queryVerifica: "cuGenerata" },
      { descrizione: "CU inviate", verificaAutomatica: false },
    ],
  },
  // 7. DICHIARAZIONE IVA — annual, April 30
  {
    tipo: "DICHIARAZIONE_IVA",
    nome: "Dichiarazione IVA annuale",
    frequenza: "ANNUALE",
    giornoScadenza: 30,
    meseScadenza: 4,
    condizione: (ctx) => ctx.regimeFiscale !== "FORFETTARIO",
    checklist: [
      { descrizione: "Tutte le liquidazioni IVA calcolate", verificaAutomatica: false },
      { descrizione: "Registri IVA stampati in definitivo", verificaAutomatica: false },
      { descrizione: "Dichiarazione compilata e inviata", verificaAutomatica: false },
    ],
  },
  // 8. DICHIARAZIONE 770 — annual, October 31
  {
    tipo: "DICHIARAZIONE_770",
    nome: "Modello 770",
    frequenza: "ANNUALE",
    giornoScadenza: 31,
    meseScadenza: 10,
    condizione: (ctx) => ctx.hasRitenute,
    checklist: [
      { descrizione: "CU inviate", verificaAutomatica: false },
      { descrizione: "Ritenute versate tutte", verificaAutomatica: true, queryVerifica: "ritenuteVersate" },
      { descrizione: "Modello 770 compilato e inviato", verificaAutomatica: false },
    ],
  },
  // 9. REDDITI — annual, November 30
  {
    tipo: "REDDITI",
    nome: "Dichiarazione dei redditi",
    frequenza: "ANNUALE",
    giornoScadenza: 30,
    meseScadenza: 11,
    condizione: () => true,
    checklist: [
      { descrizione: "Bilancio approvato", verificaAutomatica: true, queryVerifica: "bilancioGenerato" },
      { descrizione: "Dichiarazione compilata", verificaAutomatica: false },
      { descrizione: "Dichiarazione inviata", verificaAutomatica: false },
    ],
  },
  // 10. IRAP — annual, November 30
  {
    tipo: "IRAP",
    nome: "Dichiarazione IRAP",
    frequenza: "ANNUALE",
    giornoScadenza: 30,
    meseScadenza: 11,
    condizione: (ctx) => ctx.regimeFiscale !== "FORFETTARIO",
    checklist: [
      { descrizione: "Base imponibile IRAP calcolata", verificaAutomatica: false },
      { descrizione: "Dichiarazione IRAP compilata e inviata", verificaAutomatica: false },
    ],
  },
  // 11. BILANCIO DEPOSITO — annual, June 29 (entro 30 gg dall'approvazione)
  {
    tipo: "BILANCIO_DEPOSITO",
    nome: "Deposito bilancio CCIAA",
    frequenza: "ANNUALE",
    giornoScadenza: 29,
    meseScadenza: 6,
    condizione: (ctx) =>
      !["DITTA_INDIVIDUALE", "LIBERO_PROFESSIONISTA"].includes(ctx.tipoAttivita),
    checklist: [
      { descrizione: "Bilancio generato in XBRL", verificaAutomatica: true, queryVerifica: "bilancioGenerato" },
      { descrizione: "Bilancio approvato in assemblea", verificaAutomatica: false },
      { descrizione: "Bilancio depositato presso CCIAA", verificaAutomatica: false },
    ],
  },
  // 12. DIRITTO CCIAA — annual, June 30
  {
    tipo: "DIRITTO_CCIAA",
    nome: "Diritto annuale CCIAA",
    frequenza: "ANNUALE",
    giornoScadenza: 30,
    meseScadenza: 6,
    condizione: (ctx) =>
      !["LIBERO_PROFESSIONISTA"].includes(ctx.tipoAttivita),
    checklist: [
      { descrizione: "Importo diritto calcolato", verificaAutomatica: false },
      { descrizione: "F24 pagato", verificaAutomatica: true, queryVerifica: "f24Pagato" },
    ],
  },
  // 13. ACCONTO IVA — annual, December 27
  {
    tipo: "ACCONTO_IVA",
    nome: "Acconto IVA dicembre",
    frequenza: "ANNUALE",
    giornoScadenza: 27,
    meseScadenza: 12,
    condizione: (ctx) => ctx.regimeFiscale !== "FORFETTARIO",
    checklist: [
      { descrizione: "Calcolo acconto IVA effettuato", verificaAutomatica: false },
      { descrizione: "F24 generato", verificaAutomatica: true, queryVerifica: "f24Generato" },
      { descrizione: "F24 pagato", verificaAutomatica: true, queryVerifica: "f24Pagato" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build SocietaContext by querying DB for the societa's actual state.
 * periodicityIva is inferred from existing LiquidazioneIva records
 * or defaults to MENSILE.
 */
async function buildSocietaContext(societaId: number): Promise<SocietaContext> {
  const societa = await prisma.societa.findUnique({
    where: { id: societaId },
  });

  if (!societa) {
    throw new Error(`Societa ${societaId} non trovata`);
  }

  // Infer IVA periodicity from existing liquidazioni
  const liquidazione = await prisma.liquidazioneIva.findFirst({
    where: { societaId },
    orderBy: { createdAt: "desc" },
  });
  const periodicityIva: "MENSILE" | "TRIMESTRALE" =
    liquidazione?.tipo === "TRIMESTRALE" ? "TRIMESTRALE" : "MENSILE";

  // Check if societa has ritenute
  const ritenuteCount = await prisma.operazione.count({
    where: {
      societaId,
      ritenuta: { isNot: null },
    },
  });

  // Check if societa has cespiti
  const cespitiCount = await prisma.cespite.count({
    where: { societaId },
  });

  return {
    tipoAttivita: societa.tipoAttivita,
    regimeFiscale: societa.regimeFiscale,
    periodicityIva,
    hasRitenute: ritenuteCount > 0,
    hasCespiti: cespitiCount > 0,
    hasFattureElettroniche: true, // default: assume electronic invoicing
  };
}

/**
 * Generate date periods for a template.
 * Monthly: 12 periods (1-12), scadenza on giornoScadenza of month+1
 * Quarterly: 4 periods (1-4), LIPE scadenze: Q1->May 31, Q2->Sep 16, Q3->Nov 30, Q4->Feb 28 next year
 * Annual: 1 period (null), scadenza on meseScadenza/giornoScadenza
 */
function generatePeriods(
  template: ScadenzaTemplate,
  anno: number
): Array<{ periodo: number | null; scadenza: Date }> {
  if (template.frequenza === "MENSILE") {
    return Array.from({ length: 12 }, (_, i) => {
      const mese = i + 1;
      // Monthly F24 for month N is due on the 16th of month N+1
      const scadenzaMese = mese === 12 ? 1 : mese + 1;
      const scadenzaAnno = mese === 12 ? anno + 1 : anno;
      return {
        periodo: mese,
        scadenza: new Date(scadenzaAnno, scadenzaMese - 1, template.giornoScadenza),
      };
    });
  }

  if (template.frequenza === "TRIMESTRALE") {
    // LIPE quarterly deadlines
    const lipeDeadlines: Array<{ periodo: number; scadenza: Date }> = [
      { periodo: 1, scadenza: new Date(anno, 4, 31) },     // Q1 -> May 31
      { periodo: 2, scadenza: new Date(anno, 8, 16) },     // Q2 -> Sep 16
      { periodo: 3, scadenza: new Date(anno, 10, 30) },    // Q3 -> Nov 30
      { periodo: 4, scadenza: new Date(anno + 1, 1, 28) }, // Q4 -> Feb 28 next year
    ];
    return lipeDeadlines;
  }

  // ANNUALE
  return [
    {
      periodo: null,
      scadenza: new Date(anno, (template.meseScadenza ?? 1) - 1, template.giornoScadenza),
    },
  ];
}

// ─── Main Functions ───────────────────────────────────────────────────────────

/**
 * Generate fiscal calendar for a societa for the given year.
 * Creates ScadenzaFiscale + ChecklistAdempimento records for each
 * applicable deadline template. Skips already existing deadlines.
 */
export async function generaCalendarioFiscale(
  societaId: number,
  anno: number
): Promise<GeneraCalendarioResult> {
  const ctx = await buildSocietaContext(societaId);

  let scadenzeGenerate = 0;
  let scadenzeEsistenti = 0;

  for (const template of SCADENZE_TEMPLATES) {
    // Check if this deadline applies to this societa
    if (!template.condizione(ctx)) {
      continue;
    }

    const periods = generatePeriods(template, anno);

    for (const { periodo, scadenza } of periods) {
      // Check if already exists
      const existing = await prisma.scadenzaFiscale.findFirst({
        where: {
          societaId,
          tipo: template.tipo as ScadenzaFiscaleTipo,
          anno,
          periodo,
        },
      });

      if (existing) {
        scadenzeEsistenti++;
        continue;
      }

      // Create the ScadenzaFiscale
      const created = await prisma.scadenzaFiscale.create({
        data: {
          societaId,
          tipo: template.tipo as ScadenzaFiscaleTipo,
          anno,
          periodo,
          scadenza,
          stato: "NON_INIZIATA",
          percentualeCompletamento: 0,
        },
      });

      // Create checklist items
      if (template.checklist.length > 0) {
        await prisma.checklistAdempimento.createMany({
          data: template.checklist.map((item, index) => ({
            scadenzaFiscaleId: created.id,
            ordine: index + 1,
            descrizione: item.descrizione,
            verificaAutomatica: item.verificaAutomatica,
            queryVerifica: item.queryVerifica ?? null,
            completata: false,
          })),
        });
      }

      scadenzeGenerate++;
    }
  }

  return { scadenzeGenerate, scadenzeEsistenti };
}

/**
 * Get all fiscal deadlines for a societa for the given year,
 * including their checklist items.
 */
export async function getScadenzePerSocieta(societaId: number, anno: number) {
  return prisma.scadenzaFiscale.findMany({
    where: { societaId, anno },
    include: { checklist: true },
    orderBy: { scadenza: "asc" },
  });
}
