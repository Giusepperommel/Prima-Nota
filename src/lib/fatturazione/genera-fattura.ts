/**
 * Genera Fattura Elettronica — orchestrator.
 *
 * Loads all required data, maps to FatturaPA structure,
 * validates, builds XML, and persists the record.
 */

import { prisma } from "@/lib/prisma";
import type { FatturaPA } from "./types";
import { FATTURAPA_SCHEMA_VERSION, DEFAULT_TIPO_DOCUMENTO } from "./constants";
import {
  mapCedentePrestatore,
  mapCessionarioCommittente,
  mapDatiGeneraliDocumento,
  mapDettaglioLinee,
  mapDatiRiepilogo,
  mapDatiPagamento,
  determinaCodiceDestinatario,
  determinaPecDestinatario,
  type SocietaData,
  type AnagraficaData,
  type OperazioneData,
  type SezionaleData,
} from "./mapping";
import { generaNumeroFattura, generaNomeFileSdi, generaProgressivoInvio } from "./sezionale";
import { validateFattura, type ValidationResult } from "./xml-validator";
import { buildFatturaXml } from "./xml-builder";
import { TipoDocumentoSdi } from "@prisma/client";

// ─── Input / Output types ───────────────────────────────────────────────────

export interface GeneraFatturaInput {
  operazioneId: number;
  societaId: number;
  userId: number;
  sezionaleId?: number;
}

export interface GeneraFatturaResult {
  fattura: {
    id: number;
    numero: string;
    nomeFile: string;
    stato: string;
    tipoDocumento: string;
    importoTotale: number;
    dataDocumento: Date;
    dataGenerazione: Date;
  };
  xml: string;
  validation: ValidationResult;
}

// ─── Helper: determine TipoDocumentoSdi for sezionale ───────────────────────

function determinaTipoDocumento(
  tipoDocumentoSdi: TipoDocumentoSdi | null | undefined
): string {
  if (tipoDocumentoSdi) return tipoDocumentoSdi;
  return DEFAULT_TIPO_DOCUMENTO;
}

// ─── Helper: map DB Operazione to OperazioneData ────────────────────────────

function mapOperazioneToData(op: {
  dataOperazione: Date;
  descrizione: string;
  importoImponibile: any;
  importoIva: any;
  importoTotale: any;
  aliquotaIva: any;
  naturaOperazioneIva: string | null;
  splitPayment: boolean | null;
  bolloVirtuale: boolean | null;
  importoBollo: any;
  soggettoARitenuta: boolean | null;
  ritenuta: {
    tipoRitenuta: string;
    aliquota: any;
    importoRitenuta: any;
    cassaPrevidenza: any;
  } | null;
}): OperazioneData {
  const result: OperazioneData = {
    dataOperazione: op.dataOperazione.toISOString().split("T")[0],
    descrizione: op.descrizione,
    importoImponibile: Number(op.importoImponibile ?? 0),
    importoIva: Number(op.importoIva ?? 0),
    importoTotale: Number(op.importoTotale),
    aliquotaIva: Number(op.aliquotaIva ?? 22),
    naturaOperazioneIva: op.naturaOperazioneIva,
    splitPayment: op.splitPayment ?? false,
    bolloVirtuale: op.bolloVirtuale ?? false,
    importoBollo: op.importoBollo ? Number(op.importoBollo) : null,
    soggettoARitenuta: op.soggettoARitenuta ?? false,
  };

  if (op.soggettoARitenuta && op.ritenuta) {
    result.ritenuta = {
      tipoRitenuta: op.ritenuta.tipoRitenuta,
      aliquota: Number(op.ritenuta.aliquota),
      importoRitenuta: Number(op.ritenuta.importoRitenuta),
      cassaPrevidenza: op.ritenuta.cassaPrevidenza
        ? Number(op.ritenuta.cassaPrevidenza)
        : null,
    };
  }

  return result;
}

// ─── Main orchestrator ──────────────────────────────────────────────────────

export async function generaFatturaElettronica(
  input: GeneraFatturaInput
): Promise<GeneraFatturaResult> {
  const { operazioneId, societaId, userId, sezionaleId } = input;

  // 1. Load Operazione with ritenuta and cliente
  const operazione = await prisma.operazione.findFirst({
    where: {
      id: operazioneId,
      societaId,
      eliminato: false,
      tipoOperazione: "FATTURA_ATTIVA",
    },
    include: {
      ritenuta: true,
      cliente: true,
      fatturaElettronica: true,
    },
  });

  if (!operazione) {
    throw new Error("Operazione non trovata o non e una fattura attiva");
  }

  if (operazione.fatturaElettronica) {
    throw new Error(
      `Fattura elettronica gia generata per questa operazione (${operazione.fatturaElettronica.numero})`
    );
  }

  if (!operazione.cliente && !operazione.clienteId) {
    throw new Error("Operazione senza cliente/anagrafica associata");
  }

  // 2. Load Societa
  const societa = await prisma.societa.findUnique({
    where: { id: societaId },
  });

  if (!societa) {
    throw new Error("Societa non trovata");
  }

  if (!societa.partitaIva) {
    throw new Error("La societa non ha una partita IVA configurata");
  }

  // 3. Load Anagrafica (cliente)
  const anagrafica = operazione.cliente
    ? operazione.cliente
    : await prisma.anagrafica.findUnique({
        where: { id: operazione.clienteId! },
      });

  if (!anagrafica) {
    throw new Error("Anagrafica cliente non trovata");
  }

  // 4. Load or find Sezionale
  let sezionale;
  if (sezionaleId) {
    sezionale = await prisma.sezionaleFattura.findFirst({
      where: { id: sezionaleId, societaId, attivo: true },
    });
    if (!sezionale) {
      throw new Error("Sezionale non trovato o non attivo");
    }
  } else {
    // Find the default sezionale
    sezionale = await prisma.sezionaleFattura.findFirst({
      where: { societaId, predefinito: true, attivo: true },
    });
    if (!sezionale) {
      // Fallback: any active sezionale
      sezionale = await prisma.sezionaleFattura.findFirst({
        where: { societaId, attivo: true },
      });
    }
    if (!sezionale) {
      throw new Error(
        "Nessun sezionale configurato. Vai a Configurazione > Fatturazione per crearne uno."
      );
    }
  }

  // 5. Determine current year and reset numbering if needed
  const currentYear = new Date().getFullYear();
  let ultimoNumero = sezionale.ultimoNumero;

  if (sezionale.annoCorrente !== currentYear) {
    // Reset numbering for new year
    ultimoNumero = 0;
    await prisma.sezionaleFattura.update({
      where: { id: sezionale.id },
      data: { annoCorrente: currentYear, ultimoNumero: 0 },
    });
  }

  // 6. Generate invoice number
  const numero = generaNumeroFattura({
    prefisso: sezionale.prefisso,
    separatore: sezionale.separatore,
    paddingCifre: sezionale.paddingCifre,
    ultimoNumero,
  });

  // 7. Map data to FatturaPA structures
  const societaData: SocietaData = {
    partitaIva: societa.partitaIva,
    codiceFiscale: societa.codiceFiscale,
    ragioneSociale: societa.ragioneSociale,
    regimeFiscale: societa.regimeFiscale,
    indirizzo: societa.indirizzo,
    cap: societa.cap,
    citta: societa.citta,
    provincia: societa.provincia,
    nazione: societa.nazione,
    reaUfficio: societa.reaUfficio,
    reaNumero: societa.reaNumero,
    capitaleSociale: societa.capitaleSociale
      ? Number(societa.capitaleSociale)
      : null,
    socioUnico: societa.socioUnico,
    statoLiquidazione: societa.statoLiquidazione,
    telefonoAzienda: societa.telefonoAzienda,
    emailAzienda: societa.emailAzienda,
  };

  const anagraficaData: AnagraficaData = {
    partitaIva: anagrafica.partitaIva,
    codiceFiscale: anagrafica.codiceFiscale,
    denominazione: anagrafica.denominazione,
    tipoSoggetto: anagrafica.tipoSoggetto,
    indirizzo: anagrafica.indirizzo,
    cap: anagrafica.cap,
    citta: anagrafica.citta,
    provincia: anagrafica.provincia,
    nazione: anagrafica.nazione,
    codiceDestinatario: anagrafica.codiceDestinatario,
    pec: anagrafica.pec,
  };

  const tipoDocumento = determinaTipoDocumento(operazione.tipoDocumentoSdi);

  const operazioneData = mapOperazioneToData({
    dataOperazione: operazione.dataOperazione,
    descrizione: operazione.descrizione,
    importoImponibile: operazione.importoImponibile,
    importoIva: operazione.importoIva,
    importoTotale: operazione.importoTotale,
    aliquotaIva: operazione.aliquotaIva,
    naturaOperazioneIva: operazione.naturaOperazioneIva,
    splitPayment: operazione.splitPayment,
    bolloVirtuale: operazione.bolloVirtuale,
    importoBollo: operazione.importoBollo,
    soggettoARitenuta: operazione.soggettoARitenuta,
    ritenuta: operazione.ritenuta,
  });

  const sezionaleData: SezionaleData = {
    tipoDocumento,
    numero,
  };

  // 8. Build FatturaPA structure
  const progressivoInvio = generaProgressivoInvio();
  const codiceDestinatario = determinaCodiceDestinatario(anagraficaData);
  const pecDestinatario = determinaPecDestinatario(anagraficaData);

  const fatturaPa: FatturaPA = {
    FatturaElettronicaHeader: {
      DatiTrasmissione: {
        IdTrasmittente: {
          IdPaese: "IT",
          IdCodice: societa.partitaIva,
        },
        ProgressivoInvio: progressivoInvio,
        FormatoTrasmissione: FATTURAPA_SCHEMA_VERSION,
        CodiceDestinatario: codiceDestinatario,
        PECDestinatario: pecDestinatario,
      },
      CedentePrestatore: mapCedentePrestatore(societaData),
      CessionarioCommittente: mapCessionarioCommittente(anagraficaData),
    },
    FatturaElettronicaBody: {
      DatiGenerali: {
        DatiGeneraliDocumento: mapDatiGeneraliDocumento(
          operazioneData,
          sezionaleData
        ),
      },
      DatiBeniServizi: {
        DettaglioLinee: mapDettaglioLinee(operazioneData),
        DatiRiepilogo: mapDatiRiepilogo(operazioneData),
      },
      DatiPagamento: mapDatiPagamento(operazioneData) || undefined,
    },
  };

  // 9. Validate
  const validation = validateFattura(fatturaPa);

  // 10. Build XML
  const xml = buildFatturaXml(fatturaPa);

  // 11. Generate SDI filename
  const nomeFile = generaNomeFileSdi(societa.partitaIva, progressivoInvio);

  // 12. Compute a simple hash
  const xmlHash = await computeHash(xml);

  // 13. Save to DB (in a transaction to atomically increment sezionale)
  const tipoDocEnum = tipoDocumento as TipoDocumentoSdi;

  const record = await prisma.$transaction(async (tx) => {
    // Increment sezionale counter
    await tx.sezionaleFattura.update({
      where: { id: sezionale.id },
      data: { ultimoNumero: ultimoNumero + 1 },
    });

    // Create FatturaElettronica record
    const fe = await tx.fatturaElettronica.create({
      data: {
        societaId,
        operazioneId,
        sezionaleId: sezionale.id,
        numero,
        annoRiferimento: currentYear,
        progressivoFile: progressivoInvio,
        nomeFile,
        stato: "GENERATA",
        tipoDocumento: tipoDocEnum,
        xmlContent: xml,
        xmlHash,
        importoTotale: Number(operazione.importoTotale),
        dataDocumento: operazione.dataOperazione,
        createdByUserId: userId,
      },
    });

    return fe;
  });

  return {
    fattura: {
      id: record.id,
      numero: record.numero,
      nomeFile: record.nomeFile,
      stato: record.stato,
      tipoDocumento: record.tipoDocumento,
      importoTotale: Number(record.importoTotale),
      dataDocumento: record.dataDocumento,
      dataGenerazione: record.dataGenerazione,
    },
    xml,
    validation,
  };
}

// ─── Hash helper ────────────────────────────────────────────────────────────

async function computeHash(content: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback for Node.js environments without crypto.subtle
  const { createHash } = await import("crypto");
  return createHash("sha256").update(content).digest("hex");
}
