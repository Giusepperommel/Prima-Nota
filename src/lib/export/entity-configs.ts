import { format as formatDate } from "date-fns";
import type { EntityConfig, EntityType, ExportFieldConfig } from "./types";

// ─── Helper Formatters ────────────────────────────────────────────────────────

function formatDecimal(value: unknown): string {
  if (value == null) return "";
  return Number(value).toFixed(2);
}

function formatDateField(value: unknown): string {
  if (value == null) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return "";
  return formatDate(d, "dd/MM/yyyy");
}

function formatBoolean(value: unknown): string {
  if (value == null) return "";
  return value ? "Sì" : "No";
}

// ─── Entity Configs ───────────────────────────────────────────────────────────

const operazioniConfig: EntityConfig = {
  entityType: "operazioni",
  displayName: "Operazioni",
  fields: [
    { key: "id", label: "ID" },
    { key: "dataOperazione", label: "Data", format: formatDateField },
    { key: "tipoOperazione", label: "Tipo" },
    { key: "descrizione", label: "Descrizione" },
    { key: "importoTotale", label: "Importo Totale", format: formatDecimal },
    { key: "aliquotaIva", label: "Aliquota IVA", format: formatDecimal },
    { key: "importoImponibile", label: "Imponibile", format: formatDecimal },
    { key: "importoIva", label: "IVA", format: formatDecimal },
    { key: "importoDeducibile", label: "Deducibile", format: formatDecimal },
    {
      key: "percentualeDeducibilita",
      label: "% Deducibilità",
      format: formatDecimal,
    },
    { key: "categoriaId", label: "Categoria ID" },
    { key: "tipoRipartizione", label: "Tipo Ripartizione" },
    { key: "numeroDocumento", label: "N. Documento" },
    { key: "note", label: "Note" },
    { key: "registroIva", label: "Registro IVA" },
    { key: "protocolloIva", label: "Protocollo IVA" },
    {
      key: "statoPagamentoFattura",
      label: "Stato Pagamento",
    },
    { key: "createdAt", label: "Data Creazione", format: formatDateField },
  ],
  prismaModel: "operazione",
  defaultOrderBy: { dataOperazione: "desc" },
};

const scrittureContabiliConfig: EntityConfig = {
  entityType: "scritture-contabili",
  displayName: "Scritture Contabili",
  fields: [
    { key: "id", label: "ID" },
    {
      key: "dataRegistrazione",
      label: "Data Registrazione",
      format: formatDateField,
    },
    {
      key: "dataCompetenza",
      label: "Data Competenza",
      format: formatDateField,
    },
    { key: "numeroProtocollo", label: "N. Protocollo" },
    { key: "anno", label: "Anno" },
    { key: "descrizione", label: "Descrizione" },
    { key: "causale", label: "Causale" },
    { key: "tipoScrittura", label: "Tipo Scrittura" },
    { key: "stato", label: "Stato" },
    { key: "totaleDare", label: "Totale Dare", format: formatDecimal },
    { key: "totaleAvere", label: "Totale Avere", format: formatDecimal },
    { key: "protocolloIva", label: "Protocollo IVA" },
    { key: "createdAt", label: "Data Creazione", format: formatDateField },
  ],
  prismaModel: "scritturaContabile",
  defaultOrderBy: { dataRegistrazione: "desc" },
};

const pianoDeiContiConfig: EntityConfig = {
  entityType: "piano-dei-conti",
  displayName: "Piano dei Conti",
  fields: [
    { key: "id", label: "ID" },
    { key: "codice", label: "Codice" },
    { key: "descrizione", label: "Descrizione" },
    { key: "tipo", label: "Tipo Conto" },
    { key: "voceSp", label: "Voce SP" },
    { key: "voceCe", label: "Voce CE" },
    { key: "naturaSaldo", label: "Natura Saldo" },
    { key: "attivo", label: "Attivo", format: formatBoolean },
    { key: "preConfigurato", label: "Pre-configurato", format: formatBoolean },
  ],
  prismaModel: "pianoDeiConti",
  defaultOrderBy: { codice: "asc" },
};

const anagraficheConfig: EntityConfig = {
  entityType: "anagrafiche",
  displayName: "Anagrafiche",
  fields: [
    { key: "id", label: "ID" },
    { key: "denominazione", label: "Denominazione" },
    { key: "partitaIva", label: "Partita IVA" },
    { key: "codiceFiscale", label: "Codice Fiscale" },
    { key: "tipoSoggetto", label: "Tipo Soggetto" },
    { key: "tipo", label: "Tipo Anagrafica" },
    { key: "indirizzo", label: "Indirizzo" },
    { key: "cap", label: "CAP" },
    { key: "citta", label: "Città" },
    { key: "provincia", label: "Provincia" },
    { key: "nazione", label: "Nazione" },
    { key: "codiceDestinatario", label: "Codice Destinatario" },
    { key: "pec", label: "PEC" },
    {
      key: "soggettoARitenuta",
      label: "Soggetto a Ritenuta",
      format: formatBoolean,
    },
    { key: "createdAt", label: "Data Creazione", format: formatDateField },
  ],
  prismaModel: "anagrafica",
  defaultOrderBy: { denominazione: "asc" },
};

const fattureElettronicheConfig: EntityConfig = {
  entityType: "fatture-elettroniche",
  displayName: "Fatture Elettroniche",
  fields: [
    { key: "id", label: "ID" },
    { key: "numero", label: "Numero" },
    { key: "annoRiferimento", label: "Anno" },
    { key: "tipoDocumento", label: "Tipo Documento" },
    { key: "stato", label: "Stato" },
    { key: "importoTotale", label: "Importo Totale", format: formatDecimal },
    {
      key: "dataDocumento",
      label: "Data Documento",
      format: formatDateField,
    },
    { key: "nomeFile", label: "Nome File" },
    { key: "progressivoFile", label: "Progressivo File" },
    { key: "identificativoSdi", label: "ID SdI" },
    { key: "dataInvio", label: "Data Invio", format: formatDateField },
    { key: "dataEsitoSdi", label: "Data Esito SdI", format: formatDateField },
    { key: "createdAt", label: "Data Creazione", format: formatDateField },
  ],
  prismaModel: "fatturaElettronica",
  defaultOrderBy: { dataDocumento: "desc" },
};

const registriIvaConfig: EntityConfig = {
  entityType: "registri-iva",
  displayName: "Registri IVA",
  fields: [
    { key: "id", label: "ID" },
    { key: "dataOperazione", label: "Data", format: formatDateField },
    {
      key: "dataRegistrazione",
      label: "Data Registrazione",
      format: formatDateField,
    },
    { key: "registroIva", label: "Registro" },
    { key: "protocolloIva", label: "Protocollo" },
    { key: "tipoOperazione", label: "Tipo" },
    { key: "descrizione", label: "Descrizione" },
    { key: "importoImponibile", label: "Imponibile", format: formatDecimal },
    { key: "aliquotaIva", label: "Aliquota IVA", format: formatDecimal },
    { key: "importoIva", label: "IVA", format: formatDecimal },
    { key: "importoTotale", label: "Totale", format: formatDecimal },
    { key: "naturaOperazioneIva", label: "Natura IVA" },
    { key: "tipoDocumentoSdi", label: "Tipo Documento SdI" },
  ],
  prismaModel: "operazione",
  defaultOrderBy: { dataRegistrazione: "desc" },
};

const liquidazioniIvaConfig: EntityConfig = {
  entityType: "liquidazioni-iva",
  displayName: "Liquidazioni IVA",
  fields: [
    { key: "id", label: "ID" },
    { key: "tipo", label: "Tipo Liquidazione" },
    { key: "periodo", label: "Periodo" },
    { key: "anno", label: "Anno" },
    { key: "ivaEsigibile", label: "IVA Esigibile", format: formatDecimal },
    { key: "ivaDetraibile", label: "IVA Detraibile", format: formatDecimal },
    { key: "saldo", label: "Saldo", format: formatDecimal },
    {
      key: "creditoPeriodoPrecedente",
      label: "Credito Periodo Precedente",
      format: formatDecimal,
    },
    {
      key: "accontoVersato",
      label: "Acconto Versato",
      format: formatDecimal,
    },
    {
      key: "importoVersato",
      label: "Importo Versato",
      format: formatDecimal,
    },
    { key: "statoVersamento", label: "Stato Versamento" },
    {
      key: "totaleOperazioniAttive",
      label: "Tot. Operazioni Attive",
      format: formatDecimal,
    },
    {
      key: "totaleOperazioniPassive",
      label: "Tot. Operazioni Passive",
      format: formatDecimal,
    },
    {
      key: "dataVersamento",
      label: "Data Versamento",
      format: formatDateField,
    },
    { key: "createdAt", label: "Data Creazione", format: formatDateField },
  ],
  prismaModel: "liquidazioneIva",
  defaultOrderBy: { anno: "desc" },
};

const f24Config: EntityConfig = {
  entityType: "f24",
  displayName: "F24",
  fields: [
    { key: "id", label: "ID" },
    { key: "anno", label: "Anno" },
    { key: "mese", label: "Mese" },
    {
      key: "dataScadenza",
      label: "Data Scadenza",
      format: formatDateField,
    },
    {
      key: "dataPagamento",
      label: "Data Pagamento",
      format: formatDateField,
    },
    { key: "stato", label: "Stato" },
    { key: "totaleDebito", label: "Totale Debito", format: formatDecimal },
    { key: "totaleCredito", label: "Totale Credito", format: formatDecimal },
    {
      key: "totaleVersamento",
      label: "Totale Versamento",
      format: formatDecimal,
    },
    { key: "note", label: "Note" },
    { key: "createdAt", label: "Data Creazione", format: formatDateField },
  ],
  prismaModel: "f24Versamento",
  defaultOrderBy: { dataScadenza: "desc" },
};

const cuConfig: EntityConfig = {
  entityType: "cu",
  displayName: "Certificazioni Uniche",
  fields: [
    { key: "id", label: "ID" },
    { key: "anno", label: "Anno" },
    { key: "anagraficaId", label: "Anagrafica ID" },
    { key: "causaleCu", label: "Causale CU" },
    {
      key: "ammontareLordo",
      label: "Ammontare Lordo",
      format: formatDecimal,
    },
    { key: "imponibile", label: "Imponibile", format: formatDecimal },
    {
      key: "ritenutaAcconto",
      label: "Ritenuta Acconto",
      format: formatDecimal,
    },
    { key: "rivalsaInps", label: "Rivalsa INPS", format: formatDecimal },
    {
      key: "cassaPrevidenza",
      label: "Cassa Previdenza",
      format: formatDecimal,
    },
    { key: "stato", label: "Stato" },
    {
      key: "dataGenerazione",
      label: "Data Generazione",
      format: formatDateField,
    },
    { key: "dataInvio", label: "Data Invio", format: formatDateField },
    { key: "createdAt", label: "Data Creazione", format: formatDateField },
  ],
  prismaModel: "certificazioneUnica",
  defaultOrderBy: { anno: "desc" },
};

const cespitiConfig: EntityConfig = {
  entityType: "cespiti",
  displayName: "Cespiti",
  fields: [
    { key: "id", label: "ID" },
    { key: "descrizione", label: "Descrizione" },
    {
      key: "valoreIniziale",
      label: "Valore Iniziale",
      format: formatDecimal,
    },
    {
      key: "aliquotaAmmortamento",
      label: "Aliquota Ammortamento",
      format: formatDecimal,
    },
    {
      key: "dataAcquisto",
      label: "Data Acquisto",
      format: formatDateField,
    },
    { key: "annoInizio", label: "Anno Inizio" },
    { key: "stato", label: "Stato" },
    {
      key: "fondoAmmortamento",
      label: "Fondo Ammortamento",
      format: formatDecimal,
    },
    { key: "createdAt", label: "Data Creazione", format: formatDateField },
  ],
  prismaModel: "cespite",
  defaultOrderBy: { dataAcquisto: "desc" },
};

const movimentiBancariConfig: EntityConfig = {
  entityType: "movimenti-bancari",
  displayName: "Movimenti Bancari",
  fields: [
    { key: "id", label: "ID" },
    { key: "data", label: "Data", format: formatDateField },
    { key: "descrizione", label: "Descrizione" },
    { key: "importo", label: "Importo", format: formatDecimal },
    { key: "segno", label: "Segno" },
    { key: "saldo", label: "Saldo", format: formatDecimal },
    { key: "riferimentoEsterno", label: "Riferimento Esterno" },
    { key: "statoRiconciliazione", label: "Stato Riconciliazione" },
    { key: "createdAt", label: "Data Creazione", format: formatDateField },
  ],
  prismaModel: "movimentoBancario",
  defaultOrderBy: { data: "desc" },
};

const scadenzarioConfig: EntityConfig = {
  entityType: "scadenzario",
  displayName: "Scadenzario",
  fields: [
    { key: "id", label: "ID" },
    {
      key: "dataScadenza",
      label: "Data Scadenza",
      format: formatDateField,
    },
    { key: "importo", label: "Importo", format: formatDecimal },
    {
      key: "importoPagato",
      label: "Importo Pagato",
      format: formatDecimal,
    },
    { key: "stato", label: "Stato" },
    { key: "tipo", label: "Tipo" },
    { key: "anagraficaId", label: "Anagrafica ID" },
    { key: "operazioneId", label: "Operazione ID" },
    { key: "createdAt", label: "Data Creazione", format: formatDateField },
  ],
  prismaModel: "scadenzaPartitario",
  defaultOrderBy: { dataScadenza: "desc" },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

const configMap: Record<EntityType, EntityConfig> = {
  operazioni: operazioniConfig,
  "scritture-contabili": scrittureContabiliConfig,
  "piano-dei-conti": pianoDeiContiConfig,
  anagrafiche: anagraficheConfig,
  "fatture-elettroniche": fattureElettronicheConfig,
  "registri-iva": registriIvaConfig,
  "liquidazioni-iva": liquidazioniIvaConfig,
  f24: f24Config,
  cu: cuConfig,
  cespiti: cespitiConfig,
  "movimenti-bancari": movimentiBancariConfig,
  scadenzario: scadenzarioConfig,
};

export const ALL_ENTITY_TYPES: EntityType[] = Object.keys(
  configMap
) as EntityType[];

export function getEntityConfig(entityType: EntityType): EntityConfig {
  const config = configMap[entityType];
  if (!config) {
    throw new Error(`Tipo entità sconosciuto: ${entityType}`);
  }
  return config;
}
