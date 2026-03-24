/**
 * TypeScript interfaces matching the FatturaPA XML structure (FPR12 v1.2.2).
 *
 * These are the intermediate representations used between database data
 * and XML serialization. Fields marked optional correspond to [0..1] or
 * [0..N] in the XSD schema.
 *
 * Reference: docs/normativa/fatturazione-elettronica-riferimenti.md §2.2
 */

// ─── Root ────────────────────────────────────────────────────────────────────

export interface FatturaPA {
  FatturaElettronicaHeader: FatturaElettronicaHeader;
  FatturaElettronicaBody: FatturaElettronicaBody;
}

// ─── Header ──────────────────────────────────────────────────────────────────

export interface FatturaElettronicaHeader {
  DatiTrasmissione: DatiTrasmissione;
  CedentePrestatore: CedentePrestatore;
  CessionarioCommittente: CessionarioCommittente;
  RappresentanteFiscale?: RappresentanteFiscale;
  TerzoIntermediarioOSoggettoEmittente?: TerzoIntermediario;
  SoggettoEmittente?: string; // "CC" | "TZ"
}

// ─── DatiTrasmissione ────────────────────────────────────────────────────────

export interface DatiTrasmissione {
  IdTrasmittente: IdFiscaleIVA;
  ProgressivoInvio: string;
  FormatoTrasmissione: string; // "FPR12"
  CodiceDestinatario: string; // 7 chars
  ContattiTrasmittente?: ContattiTrasmittente;
  PECDestinatario?: string;
}

export interface ContattiTrasmittente {
  Telefono?: string;
  Email?: string;
}

// ─── Shared sub-structures ───────────────────────────────────────────────────

export interface IdFiscaleIVA {
  IdPaese: string; // 2 chars, e.g. "IT"
  IdCodice: string; // max 28 chars
}

export interface Anagrafica {
  Denominazione?: string; // max 80 chars — alt with Nome/Cognome
  Nome?: string; // max 60 chars
  Cognome?: string; // max 60 chars
  Titolo?: string; // 2-10 chars
  CodEORI?: string; // 13-17 chars
}

export interface Sede {
  Indirizzo: string; // max 60 chars
  NumeroCivico?: string; // max 8 chars
  CAP: string; // 5 chars
  Comune: string; // max 60 chars
  Provincia?: string; // 2 chars
  Nazione: string; // 2 chars
}

export interface IscrizioneREA {
  Ufficio: string; // 2 chars (sigla provincia)
  NumeroREA: string; // max 20 chars
  CapitaleSociale?: string; // decimal
  SocioUnico?: string; // "SU" | "SM"
  StatoLiquidazione: string; // "LS" | "LN"
}

export interface Contatti {
  Telefono?: string;
  Fax?: string;
  Email?: string;
}

// ─── CedentePrestatore ───────────────────────────────────────────────────────

export interface CedentePrestatore {
  DatiAnagrafici: CedentePrestatoreAnagrafici;
  Sede: Sede;
  StabileOrganizzazione?: Sede;
  IscrizioneREA?: IscrizioneREA;
  Contatti?: Contatti;
  RiferimentoAmministrazione?: string;
}

export interface CedentePrestatoreAnagrafici {
  IdFiscaleIVA: IdFiscaleIVA;
  CodiceFiscale?: string;
  Anagrafica: Anagrafica;
  AlboProfessionale?: string;
  ProvinciaAlbo?: string;
  NumeroIscrizioneAlbo?: string;
  DataIscrizioneAlbo?: string;
  RegimeFiscale: string; // "RF01", "RF19", etc.
}

// ─── CessionarioCommittente ──────────────────────────────────────────────────

export interface CessionarioCommittente {
  DatiAnagrafici: CessionarioCommittenteAnagrafici;
  Sede: Sede;
  StabileOrganizzazione?: Sede;
  RappresentanteFiscale?: RappresentanteFiscaleAnagrafici;
}

export interface CessionarioCommittenteAnagrafici {
  IdFiscaleIVA?: IdFiscaleIVA;
  CodiceFiscale?: string;
  Anagrafica: Anagrafica;
}

// ─── RappresentanteFiscale ───────────────────────────────────────────────────

export interface RappresentanteFiscale {
  DatiAnagrafici: RappresentanteFiscaleAnagrafici;
}

export interface RappresentanteFiscaleAnagrafici {
  IdFiscaleIVA: IdFiscaleIVA;
  CodiceFiscale?: string;
  Anagrafica: Anagrafica;
}

// ─── TerzoIntermediario ──────────────────────────────────────────────────────

export interface TerzoIntermediario {
  DatiAnagrafici: RappresentanteFiscaleAnagrafici;
}

// ─── Body ────────────────────────────────────────────────────────────────────

export interface FatturaElettronicaBody {
  DatiGenerali: DatiGenerali;
  DatiBeniServizi: DatiBeniServizi;
  DatiVeicoli?: DatiVeicoli;
  DatiPagamento?: DatiPagamento;
  Allegati?: Allegato[];
}

// ─── DatiGenerali ────────────────────────────────────────────────────────────

export interface DatiGenerali {
  DatiGeneraliDocumento: DatiGeneraliDocumento;
  DatiOrdineAcquisto?: DatiDocumentoCorrelato[];
  DatiContratto?: DatiDocumentoCorrelato[];
  DatiConvenzione?: DatiDocumentoCorrelato[];
  DatiRicezione?: DatiDocumentoCorrelato[];
  DatiFattureCollegate?: DatiDocumentoCorrelato[];
  DatiSAL?: DatiSAL[];
  DatiDDT?: DatiDDT[];
  DatiTrasporto?: DatiTrasporto;
}

export interface DatiGeneraliDocumento {
  TipoDocumento: string; // "TD01", "TD04", etc.
  Divisa: string; // "EUR"
  Data: string; // YYYY-MM-DD
  Numero: string; // max 20 chars
  DatiRitenuta?: DatiRitenuta[];
  DatiBollo?: DatiBollo;
  DatiCassaPrevidenziale?: DatiCassaPrevidenziale[];
  ScontoMaggiorazione?: ScontoMaggiorazione[];
  ImportoTotaleDocumento?: string; // decimal
  Arrotondamento?: string; // decimal
  Causale?: string[]; // each max 200 chars
  Art73?: string; // "SI"
}

export interface DatiRitenuta {
  TipoRitenuta: string; // "RT01"–"RT06"
  ImportoRitenuta: string; // decimal
  AliquotaRitenuta: string; // decimal (percentage)
  CausalePagamento: string; // "A", "R", "M", "L", etc.
}

export interface DatiBollo {
  BolloVirtuale: string; // "SI"
  ImportoBollo: string; // decimal, e.g. "2.00"
}

export interface DatiCassaPrevidenziale {
  TipoCassa: string; // "TC01"–"TC22"
  AlCassa: string; // decimal (percentage)
  ImportoContributoCassa: string; // decimal
  ImponibileCassa?: string; // decimal
  AliquotaIVA: string; // decimal
  Ritenuta?: string; // "SI"
  Natura?: string; // "N1"–"N7"
  RiferimentoAmministrazione?: string;
}

export interface ScontoMaggiorazione {
  Tipo: string; // "SC" (sconto) | "MG" (maggiorazione)
  Percentuale?: string; // decimal
  Importo?: string; // decimal
}

// ─── Documenti correlati ─────────────────────────────────────────────────────

export interface DatiDocumentoCorrelato {
  RiferimentoNumeroLinea?: number[];
  IdDocumento: string;
  Data?: string; // YYYY-MM-DD
  NumItem?: string;
  CodiceCommessaConvenzione?: string;
  CodiceCUP?: string;
  CodiceCIG?: string;
}

export interface DatiSAL {
  RiferimentoFase: number;
}

export interface DatiDDT {
  NumeroDDT: string;
  DataDDT: string; // YYYY-MM-DD
  RiferimentoNumeroLinea?: number[];
}

export interface DatiTrasporto {
  DatiAnagraficiVettore?: RappresentanteFiscaleAnagrafici;
  MezzoTrasporto?: string;
  CausaleTrasporto?: string;
  NumeroColli?: number;
  Descrizione?: string;
  UnitaMisuraPeso?: string;
  PesoLordo?: string; // decimal
  PesoNetto?: string; // decimal
  DataOraRitiro?: string; // datetime
  DataInizioTrasporto?: string; // datetime
  TipoResa?: string;
  IndirizzoResa?: Sede;
}

// ─── DatiBeniServizi ─────────────────────────────────────────────────────────

export interface DatiBeniServizi {
  DettaglioLinee: DettaglioLinee[];
  DatiRiepilogo: DatiRiepilogo[];
}

export interface DettaglioLinee {
  NumeroLinea: number;
  TipoCessionePrestazione?: string; // "SC" | "PR" | "AB" | "AC"
  CodiceArticolo?: CodiceArticolo[];
  Descrizione: string; // max 1000 chars
  Quantita?: string; // decimal
  UnitaMisura?: string;
  DataInizioPeriodo?: string; // YYYY-MM-DD
  DataFinePeriodo?: string; // YYYY-MM-DD
  PrezzoUnitario: string; // decimal, up to 8 decimals
  ScontoMaggiorazione?: ScontoMaggiorazione[];
  PrezzoTotale: string; // decimal, up to 8 decimals
  AliquotaIVA: string; // decimal, 2 decimals
  Ritenuta?: string; // "SI"
  Natura?: string; // "N1"–"N7.x", required if AliquotaIVA=0
  RiferimentoAmministrazione?: string;
  AltriDatiGestionali?: AltriDatiGestionali[];
}

export interface CodiceArticolo {
  CodiceTipo: string; // max 35 chars
  CodiceValore: string; // max 35 chars
}

export interface AltriDatiGestionali {
  TipoDato: string;
  RiferimentoTesto?: string;
  RiferimentoNumero?: string;
  RiferimentoData?: string; // YYYY-MM-DD
}

export interface DatiRiepilogo {
  AliquotaIVA: string; // decimal
  Natura?: string; // required if AliquotaIVA=0
  SpeseAccessorie?: string; // decimal
  Arrotondamento?: string; // decimal
  ImponibileImporto: string; // decimal
  Imposta: string; // decimal
  EsigibilitaIVA?: string; // "I" | "D" | "S"
  RiferimentoNormativo?: string; // max 100 chars
}

// ─── DatiVeicoli ─────────────────────────────────────────────────────────────

export interface DatiVeicoli {
  Data: string; // YYYY-MM-DD
  TotalePercorso: string;
}

// ─── DatiPagamento ───────────────────────────────────────────────────────────

export interface DatiPagamento {
  CondizioniPagamento: string; // "TP01" | "TP02" | "TP03"
  DettaglioPagamento: DettaglioPagamento[];
}

export interface DettaglioPagamento {
  Beneficiario?: string;
  ModalitaPagamento: string; // "MP01"–"MP23"
  DataRiferimentoTerminiPagamento?: string; // YYYY-MM-DD
  GiorniTerminiPagamento?: number;
  DataScadenzaPagamento?: string; // YYYY-MM-DD
  ImportoPagamento: string; // decimal
  CodUfficioPostale?: string;
  CognomeQuietanzante?: string;
  NomeQuietanzante?: string;
  CFQuietanzante?: string;
  TitoloQuietanzante?: string;
  IstitutoFinanziario?: string;
  IBAN?: string;
  ABI?: string;
  CAB?: string;
  BIC?: string;
  ScontoPagamentoAnticipato?: string; // decimal
  DataLimitePagamentoAnticipato?: string; // YYYY-MM-DD
  PenalitaPagamentiRitardati?: string; // decimal
  DataDecorrenzaPenale?: string; // YYYY-MM-DD
  CodicePagamento?: string;
}

// ─── Allegati ────────────────────────────────────────────────────────────────

export interface Allegato {
  NomeAttachment: string; // max 60 chars
  AlgoritmoCompressione?: string;
  FormatoAttachment?: string;
  DescrizioneAttachment?: string;
  Attachment: string; // base64
}
