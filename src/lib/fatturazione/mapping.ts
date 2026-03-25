/**
 * Mapping functions: transform internal data (Societa, Anagrafica, Operazione)
 * into FatturaPA intermediate types for XML generation.
 */

import {
  REGIME_FISCALE_MAP,
  NATURA_IVA_MAP,
  NATURA_IVA_LABELS,
  TIPO_RITENUTA_SDI_MAP,
  ESIGIBILITA_IVA,
  DEFAULT_DIVISA,
  DEFAULT_MODALITA_PAGAMENTO,
  DEFAULT_CONDIZIONI_PAGAMENTO,
  DEFAULT_TIPO_CASSA_INPS,
  CAUSALE_MAX_LENGTH,
  BOLLO_IMPORTO,
} from "./constants";

import type {
  CedentePrestatore,
  CessionarioCommittente,
  DatiGeneraliDocumento,
  DettaglioLinee,
  DatiRiepilogo,
  DatiPagamento,
  Sede,
  IscrizioneREA,
} from "./types";

// ─── Input data shapes (from the database / internal model) ─────────────────

export interface SocietaData {
  partitaIva: string;
  codiceFiscale?: string | null;
  ragioneSociale: string;
  regimeFiscale: string; // "ORDINARIO" | "FORFETTARIO"
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
  nazione?: string | null;
  // REA
  reaUfficio?: string | null;
  reaNumero?: string | null;
  capitaleSociale?: number | null;
  socioUnico?: string | null; // "SU" | "SM"
  statoLiquidazione?: string | null; // "LS" | "LN"
  // Contatti
  telefonoAzienda?: string | null;
  emailAzienda?: string | null;
}

export interface AnagraficaData {
  partitaIva?: string | null;
  codiceFiscale?: string | null;
  denominazione: string;
  tipoSoggetto: string; // "AZIENDA" | "PERSONA_FISICA" | "PROFESSIONISTA"
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
  nazione?: string | null; // ISO 2 char, default "IT"
  codiceDestinatario?: string | null;
  pec?: string | null;
}

export interface OperazioneData {
  dataOperazione: string; // ISO date YYYY-MM-DD
  descrizione: string;
  importoImponibile: number;
  importoIva: number;
  importoTotale: number;
  aliquotaIva: number; // e.g. 22
  naturaOperazioneIva?: string | null; // e.g. "N4", "N2_2"
  splitPayment?: boolean;
  bolloVirtuale?: boolean;
  importoBollo?: number | null;
  // Ritenuta
  soggettoARitenuta?: boolean;
  ritenuta?: {
    tipoRitenuta: string; // e.g. "LAVORO_AUTONOMO"
    aliquota: number; // e.g. 20
    importoRitenuta: number;
    cassaPrevidenza?: number | null;
    aliquotaCassa?: number | null;
  } | null;
  // Pagamento
  modalitaPagamento?: string | null; // e.g. "MP05"
  iban?: string | null;
  dataScadenzaPagamento?: string | null;
}

export interface SezionaleData {
  tipoDocumento: string; // "TD01", "TD04", etc.
  numero: string; // formatted invoice number e.g. "FV/001"
}

// ─── Task 7: Seller mapping ─────────────────────────────────────────────────

export function mapCedentePrestatore(societa: SocietaData): CedentePrestatore {
  const regimeFiscale = REGIME_FISCALE_MAP[societa.regimeFiscale] || societa.regimeFiscale;

  const sede: Sede = {
    Indirizzo: societa.indirizzo || "",
    CAP: societa.cap || "",
    Comune: societa.citta || "",
    Provincia: societa.provincia || undefined,
    Nazione: societa.nazione || "IT",
  };

  const result: CedentePrestatore = {
    DatiAnagrafici: {
      IdFiscaleIVA: {
        IdPaese: "IT",
        IdCodice: societa.partitaIva,
      },
      CodiceFiscale: societa.codiceFiscale || undefined,
      Anagrafica: {
        Denominazione: societa.ragioneSociale,
      },
      RegimeFiscale: regimeFiscale,
    },
    Sede: sede,
  };

  // IscrizioneREA (optional, only if data present)
  if (societa.reaUfficio && societa.reaNumero) {
    const rea: IscrizioneREA = {
      Ufficio: societa.reaUfficio,
      NumeroREA: societa.reaNumero,
      StatoLiquidazione: societa.statoLiquidazione || "LN",
    };
    if (societa.capitaleSociale != null) {
      rea.CapitaleSociale = societa.capitaleSociale.toFixed(2);
    }
    if (societa.socioUnico) {
      rea.SocioUnico = societa.socioUnico;
    }
    result.IscrizioneREA = rea;
  }

  // Contatti (optional)
  if (societa.telefonoAzienda || societa.emailAzienda) {
    result.Contatti = {
      Telefono: societa.telefonoAzienda || undefined,
      Email: societa.emailAzienda || undefined,
    };
  }

  return result;
}

// ─── Task 8: Buyer mapping ──────────────────────────────────────────────────

export function mapCessionarioCommittente(anagrafica: AnagraficaData): CessionarioCommittente {
  const nazione = anagrafica.nazione || "IT";
  const isPersonaFisica =
    anagrafica.tipoSoggetto === "PERSONA_FISICA" ||
    anagrafica.tipoSoggetto === "PROFESSIONISTA";

  // Build Anagrafica: Denominazione for AZIENDA, Nome/Cognome for persona fisica
  let anagraficaXml: { Denominazione?: string; Nome?: string; Cognome?: string };
  if (isPersonaFisica && anagrafica.denominazione.includes(" ")) {
    const parts = anagrafica.denominazione.trim().split(/\s+/);
    const cognome = parts.pop()!;
    const nome = parts.join(" ");
    anagraficaXml = { Nome: nome, Cognome: cognome };
  } else {
    anagraficaXml = { Denominazione: anagrafica.denominazione };
  }

  const result: CessionarioCommittente = {
    DatiAnagrafici: {
      IdFiscaleIVA: anagrafica.partitaIva
        ? {
            IdPaese: nazione,
            IdCodice: anagrafica.partitaIva,
          }
        : undefined,
      CodiceFiscale: anagrafica.codiceFiscale || undefined,
      Anagrafica: anagraficaXml,
    },
    Sede: {
      Indirizzo: anagrafica.indirizzo || "",
      CAP: anagrafica.cap || "",
      Comune: anagrafica.citta || "",
      Provincia: anagrafica.provincia || undefined,
      Nazione: nazione,
    },
  };

  return result;
}

/**
 * Determines the CodiceDestinatario for a buyer.
 * - IT with codice → the codice (7 chars)
 * - IT without codice → "0000000"
 * - Foreign → "XXXXXXX"
 */
export function determinaCodiceDestinatario(anagrafica: AnagraficaData): string {
  const nazione = anagrafica.nazione || "IT";
  if (nazione !== "IT") {
    return "XXXXXXX";
  }
  if (anagrafica.codiceDestinatario && anagrafica.codiceDestinatario.length === 7) {
    return anagrafica.codiceDestinatario;
  }
  return "0000000";
}

/**
 * Determines the PECDestinatario (only used when CodiceDestinatario = "0000000" and IT).
 */
export function determinaPecDestinatario(anagrafica: AnagraficaData): string | undefined {
  const nazione = anagrafica.nazione || "IT";
  if (nazione !== "IT") return undefined;
  const codice = determinaCodiceDestinatario(anagrafica);
  if (codice === "0000000" && anagrafica.pec) {
    return anagrafica.pec;
  }
  return undefined;
}

// ─── Task 9: Invoice body mapping ───────────────────────────────────────────

export function mapDatiGeneraliDocumento(
  operazione: OperazioneData,
  sezionale: SezionaleData
): DatiGeneraliDocumento {
  const result: DatiGeneraliDocumento = {
    TipoDocumento: sezionale.tipoDocumento,
    Divisa: DEFAULT_DIVISA,
    Data: operazione.dataOperazione,
    Numero: sezionale.numero,
    ImportoTotaleDocumento: operazione.importoTotale.toFixed(2),
  };

  // Causale (split into 200-char blocks if needed)
  if (operazione.descrizione) {
    const causale: string[] = [];
    let desc = operazione.descrizione;
    while (desc.length > 0) {
      causale.push(desc.substring(0, CAUSALE_MAX_LENGTH));
      desc = desc.substring(CAUSALE_MAX_LENGTH);
    }
    result.Causale = causale;
  }

  // DatiBollo
  if (operazione.bolloVirtuale) {
    result.DatiBollo = {
      BolloVirtuale: "SI",
      ImportoBollo: (operazione.importoBollo ?? BOLLO_IMPORTO).toFixed(2),
    };
  }

  // DatiRitenuta
  if (operazione.soggettoARitenuta && operazione.ritenuta) {
    const rit = operazione.ritenuta;
    const sdiMap = TIPO_RITENUTA_SDI_MAP[rit.tipoRitenuta] || { tipo: "RT01", causale: "A" };
    result.DatiRitenuta = [
      {
        TipoRitenuta: sdiMap.tipo,
        ImportoRitenuta: rit.importoRitenuta.toFixed(2),
        AliquotaRitenuta: rit.aliquota.toFixed(2),
        CausalePagamento: sdiMap.causale,
      },
    ];
  }

  // DatiCassaPrevidenziale
  if (operazione.ritenuta?.cassaPrevidenza && operazione.ritenuta.cassaPrevidenza > 0) {
    const rit = operazione.ritenuta;
    result.DatiCassaPrevidenziale = [
      {
        TipoCassa: DEFAULT_TIPO_CASSA_INPS,
        AlCassa: (rit.aliquotaCassa ?? 4).toFixed(2),
        ImportoContributoCassa: (rit.cassaPrevidenza ?? 0).toFixed(2),
        AliquotaIVA: operazione.aliquotaIva.toFixed(2),
      },
    ];
  }

  return result;
}

export function mapDettaglioLinee(operazione: OperazioneData): DettaglioLinee[] {
  const aliquota = operazione.aliquotaIva.toFixed(2);
  const natura =
    operazione.aliquotaIva === 0 && operazione.naturaOperazioneIva
      ? NATURA_IVA_MAP[operazione.naturaOperazioneIva] || operazione.naturaOperazioneIva
      : undefined;

  const linea: DettaglioLinee = {
    NumeroLinea: 1,
    Descrizione: operazione.descrizione,
    Quantita: "1.00",
    PrezzoUnitario: operazione.importoImponibile.toFixed(8),
    PrezzoTotale: operazione.importoImponibile.toFixed(8),
    AliquotaIVA: aliquota,
  };

  if (natura) {
    linea.Natura = natura;
  }

  if (operazione.soggettoARitenuta) {
    linea.Ritenuta = "SI";
  }

  return [linea];
}

export function mapDatiRiepilogo(operazione: OperazioneData): DatiRiepilogo[] {
  const aliquota = operazione.aliquotaIva.toFixed(2);
  const natura =
    operazione.aliquotaIva === 0 && operazione.naturaOperazioneIva
      ? NATURA_IVA_MAP[operazione.naturaOperazioneIva] || operazione.naturaOperazioneIva
      : undefined;

  // Determine EsigibilitaIVA
  let esigibilita: string;
  if (operazione.splitPayment) {
    esigibilita = ESIGIBILITA_IVA.SPLIT_PAYMENT;
  } else {
    esigibilita = ESIGIBILITA_IVA.IMMEDIATA;
  }

  const riepilogo: DatiRiepilogo = {
    AliquotaIVA: aliquota,
    ImponibileImporto: operazione.importoImponibile.toFixed(2),
    Imposta: operazione.importoIva.toFixed(2),
    EsigibilitaIVA: esigibilita,
  };

  if (natura) {
    riepilogo.Natura = natura;
    // Add RiferimentoNormativo from the natura labels
    const naturaCode = natura;
    const label = NATURA_IVA_LABELS[naturaCode];
    if (label) {
      riepilogo.RiferimentoNormativo = label;
    }
  }

  return [riepilogo];
}

export function mapDatiPagamento(operazione: OperazioneData): DatiPagamento | null {
  const modalita = operazione.modalitaPagamento || DEFAULT_MODALITA_PAGAMENTO;

  // Calculate payment amount (total - ritenuta if present)
  let importoPagamento = operazione.importoTotale;
  if (operazione.soggettoARitenuta && operazione.ritenuta) {
    importoPagamento = operazione.importoTotale - operazione.ritenuta.importoRitenuta;
  }
  // If split payment, payment is net of IVA
  if (operazione.splitPayment) {
    importoPagamento = operazione.importoImponibile;
    if (operazione.soggettoARitenuta && operazione.ritenuta) {
      importoPagamento -= operazione.ritenuta.importoRitenuta;
    }
  }

  const dettaglio: DatiPagamento["DettaglioPagamento"][0] = {
    ModalitaPagamento: modalita,
    ImportoPagamento: importoPagamento.toFixed(2),
  };

  if (operazione.dataScadenzaPagamento) {
    dettaglio.DataScadenzaPagamento = operazione.dataScadenzaPagamento;
  }

  if (operazione.iban) {
    dettaglio.IBAN = operazione.iban;
  }

  return {
    CondizioniPagamento: DEFAULT_CONDIZIONI_PAGAMENTO,
    DettaglioPagamento: [dettaglio],
  };
}
