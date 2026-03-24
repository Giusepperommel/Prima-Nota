/**
 * FatturaPA constants — all official codes and mappings for XML generation.
 *
 * Reference: docs/normativa/fatturazione-elettronica-riferimenti.md
 * Schema: FPR12 v1.2.2
 */

// ─── Namespace & Schema ──────────────────────────────────────────────────────

export const FATTURAPA_NAMESPACE =
  "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2";

export const FATTURAPA_SCHEMA_LOCATION =
  "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_v1.2.2.xsd";

export const FATTURAPA_SCHEMA_VERSION = "FPR12";

export const FATTURAPA_DS_NAMESPACE =
  "http://www.w3.org/2000/09/xmldsig#";

export const FATTURAPA_XSI_NAMESPACE =
  "http://www.w3.org/2001/XMLSchema-instance";

// ─── TipoDocumento (TD01–TD28) ──────────────────────────────────────────────

export const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  TD01: "Fattura",
  TD02: "Acconto/anticipo su fattura",
  TD03: "Acconto/anticipo su parcella",
  TD04: "Nota di credito",
  TD05: "Nota di debito",
  TD06: "Parcella",
  TD07: "Fattura semplificata",
  TD08: "Nota di credito semplificata",
  TD09: "Nota di debito semplificata",
  TD16: "Integrazione fattura reverse charge interno",
  TD17: "Integrazione/autofattura per acquisto servizi dall'estero",
  TD18: "Integrazione per acquisto di beni intracomunitari",
  TD19: "Integrazione/autofattura per acquisto di beni ex art.17 c.2 DPR 633/72",
  TD20: "Autofattura per regolarizzazione e integrazione delle fatture (art.6 c.8 DLgs 471/97 o art.46 c.5 DL 331/93)",
  TD21: "Autofattura per splafonamento",
  TD22: "Estrazione beni da Deposito IVA",
  TD23: "Estrazione beni da Deposito IVA con versamento IVA",
  TD24: "Fattura differita di cui all'art.21 c.4 lett.a)",
  TD25: "Fattura differita di cui all'art.21 c.4 terzo periodo lett.b)",
  TD26: "Cessione di beni ammortizzabili e per passaggi interni (art.36 DPR 633/72)",
  TD27: "Fattura per autoconsumo o per cessioni gratuite senza rivalsa",
  TD28: "Acquisti da San Marino con IVA (fattura cartacea)",
};

// ─── Natura IVA (N1–N7) ─────────────────────────────────────────────────────

/** Maps app NaturaIva enum values (underscore) to FatturaPA codes (dot). */
export const NATURA_IVA_MAP: Record<string, string> = {
  N1: "N1",
  N2_1: "N2.1",
  N2_2: "N2.2",
  N3_1: "N3.1",
  N3_2: "N3.2",
  N3_3: "N3.3",
  N3_4: "N3.4",
  N3_5: "N3.5",
  N3_6: "N3.6",
  N4: "N4",
  N5: "N5",
  N6_1: "N6.1",
  N6_2: "N6.2",
  N6_3: "N6.3",
  N6_4: "N6.4",
  N6_5: "N6.5",
  N6_6: "N6.6",
  N6_7: "N6.7",
  N6_8: "N6.8",
  N6_9: "N6.9",
  N7: "N7",
};

export const NATURA_IVA_LABELS: Record<string, string> = {
  N1: "Escluse ex art. 15 DPR 633/72",
  "N2.1": "Non soggette ad IVA — artt. da 7 a 7-septies DPR 633/72",
  "N2.2": "Non soggette — altri casi",
  "N3.1": "Non imponibili — esportazioni",
  "N3.2": "Non imponibili — cessioni intracomunitarie",
  "N3.3": "Non imponibili — cessioni verso San Marino",
  "N3.4": "Non imponibili — operazioni assimilate alle cessioni all'esportazione",
  "N3.5": "Non imponibili — a seguito di dichiarazioni d'intento (art.8 c.1 lett.c)",
  "N3.6": "Non imponibili — altre operazioni che non concorrono alla formazione del plafond",
  N4: "Esenti (art. 10 DPR 633/72)",
  N5: "Regime del margine / IVA non esposta in fattura",
  "N6.1": "Inversione contabile — cessione di rottami e materiali di recupero",
  "N6.2": "Inversione contabile — cessione di oro e argento ai sensi della L. 7/2000",
  "N6.3": "Inversione contabile — subappalto nel settore edile",
  "N6.4": "Inversione contabile — cessione di fabbricati",
  "N6.5": "Inversione contabile — cessione di telefoni cellulari",
  "N6.6": "Inversione contabile — cessione di prodotti elettronici",
  "N6.7": "Inversione contabile — prestazioni comparto edile e settori connessi",
  "N6.8": "Inversione contabile — operazioni settore energetico",
  "N6.9": "Inversione contabile — altri casi",
  N7: "IVA assolta in altro stato UE (telecomunicazioni, tele-radiodiffusione ed elettronici)",
};

// ─── Regime Fiscale (RF01–RF19) ──────────────────────────────────────────────

/** Maps app RegimeFiscale enum to FatturaPA code. */
export const REGIME_FISCALE_MAP: Record<string, string> = {
  ORDINARIO: "RF01",
  FORFETTARIO: "RF19",
};

export const REGIME_FISCALE_LABELS: Record<string, string> = {
  RF01: "Regime ordinario",
  RF02: "Regime dei contribuenti minimi (art.1, c.96-117, L. 244/2007)",
  RF04: "Agricoltura e attivita connesse e pesca (artt.34 e 34-bis DPR 633/72)",
  RF05: "Vendita sali e tabacchi (art.74 c.1 DPR 633/72)",
  RF06: "Commercio di fiammiferi (art.74 c.1 DPR 633/72)",
  RF07: "Editoria (art.74 c.1 DPR 633/72)",
  RF08: "Gestione di servizi di telefonia pubblica (art.74 c.1 DPR 633/72)",
  RF09: "Rivendita di documenti di trasporto pubblico e di sosta (art.74 c.1 DPR 633/72)",
  RF10: "Intrattenimenti, giochi e altre attivita (art.74 c.6 DPR 633/72)",
  RF11: "Agenzie di viaggi e turismo (art.74-ter DPR 633/72)",
  RF12: "Agriturismo (art.5 c.2 L. 413/91)",
  RF13: "Vendite a domicilio (art.25-bis c.6 DPR 600/73)",
  RF14: "Rivendita di beni usati, oggetti d'arte, antiquariato o da collezione (art.36 DL 41/95)",
  RF15: "Agenzie di vendite all'asta di oggetti d'arte, antiquariato o da collezione (art.40-bis DL 41/95)",
  RF16: "IVA per cassa PA (art.6 c.5 DPR 633/72)",
  RF17: "IVA per cassa (art.32-bis DL 83/2012)",
  RF18: "Altro",
  RF19: "Regime forfettario (art.1 c.54-89 L. 190/2014)",
};

// ─── Modalita Pagamento (MP01–MP23) ──────────────────────────────────────────

export const MODALITA_PAGAMENTO_LABELS: Record<string, string> = {
  MP01: "Contanti",
  MP02: "Assegno",
  MP03: "Assegno circolare",
  MP04: "Contanti presso Tesoreria",
  MP05: "Bonifico",
  MP06: "Vaglia cambiario",
  MP07: "Bollettino bancario",
  MP08: "Carta di pagamento",
  MP09: "RID",
  MP10: "RID utenze",
  MP11: "RID veloce",
  MP12: "RIBA",
  MP13: "MAV",
  MP14: "Quietanza erario",
  MP15: "Giroconto su conti di contabilita speciale",
  MP16: "Domiciliazione bancaria",
  MP17: "Domiciliazione postale",
  MP18: "Bollettino di c/c postale",
  MP19: "SEPA Direct Debit",
  MP20: "SEPA Direct Debit CORE",
  MP21: "SEPA Direct Debit B2B",
  MP22: "Trattenuta su somme gia riscosse",
  MP23: "PagoPA",
};

// ─── Tipo Cassa Previdenziale (TC01–TC22) ────────────────────────────────────

export const TIPO_CASSA_LABELS: Record<string, string> = {
  TC01: "Cassa nazionale previdenza e assistenza avvocati e procuratori legali",
  TC02: "Cassa previdenza dottori commercialisti",
  TC03: "Cassa previdenza e assistenza geometri",
  TC04: "Cassa nazionale previdenza e assistenza ingegneri e architetti liberi professionisti",
  TC05: "Cassa nazionale del notariato",
  TC06: "Cassa nazionale previdenza e assistenza ragionieri e periti commerciali",
  TC07: "Ente nazionale assistenza agenti e rappresentanti di commercio (ENASARCO)",
  TC08: "Ente nazionale previdenza e assistenza consulenti del lavoro (ENPACL)",
  TC09: "Ente nazionale previdenza e assistenza medici (ENPAM)",
  TC10: "Ente nazionale previdenza e assistenza farmacisti (ENPAF)",
  TC11: "Ente nazionale previdenza e assistenza veterinari (ENPAV)",
  TC12: "Ente nazionale previdenza e assistenza impiegati dell'agricoltura (ENPAIA)",
  TC13: "Fondo previdenza impiegati imprese di spedizione e agenzie marittime",
  TC14: "Istituto nazionale previdenza giornalisti italiani (INPGI)",
  TC15: "Opera nazionale assistenza orfani sanitari italiani (ONAOSI)",
  TC16: "Cassa autonoma assistenza integrativa giornalisti italiani (CASAGIT)",
  TC17: "Ente previdenza periti industriali e periti industriali laureati (EPPI)",
  TC18: "Ente previdenza e assistenza pluricategoriale (EPAP)",
  TC19: "Ente nazionale previdenza e assistenza biologi (ENPAB)",
  TC20: "Ente nazionale previdenza e assistenza professione infermieristica (ENPAPI)",
  TC21: "Ente nazionale previdenza e assistenza psicologi (ENPAP)",
  TC22: "INPS",
};

// ─── Tipo Ritenuta (RT01–RT06) ───────────────────────────────────────────────

export const TIPO_RITENUTA_LABELS: Record<string, string> = {
  RT01: "Ritenuta di acconto persone fisiche",
  RT02: "Ritenuta di acconto persone giuridiche",
  RT03: "Contributo INPS",
  RT04: "Contributo ENASARCO",
  RT05: "Contributo ENPAM",
  RT06: "Altro contributo previdenziale",
};

/** Maps app TipoRitenuta enum to SDI tipo + causale pagamento. */
export const TIPO_RITENUTA_SDI_MAP: Record<string, { tipo: string; causale: string }> = {
  LAVORO_AUTONOMO: { tipo: "RT01", causale: "A" },
  PROVVIGIONI: { tipo: "RT01", causale: "R" },
  OCCASIONALE: { tipo: "RT01", causale: "M" },
  DIRITTI_AUTORE: { tipo: "RT01", causale: "L" },
};

// ─── Esigibilita IVA ────────────────────────────────────────────────────────

export const ESIGIBILITA_IVA = {
  IMMEDIATA: "I",
  DIFFERITA: "D",
  SPLIT_PAYMENT: "S",
} as const;

export const ESIGIBILITA_IVA_LABELS: Record<string, string> = {
  I: "Esigibilita immediata",
  D: "Esigibilita differita",
  S: "Scissione dei pagamenti (split payment)",
};

// ─── Condizioni Pagamento ────────────────────────────────────────────────────

export const CONDIZIONI_PAGAMENTO = {
  RATE: "TP01",
  COMPLETO: "TP02",
  ANTICIPO: "TP03",
} as const;

// ─── Bollo Virtuale ──────────────────────────────────────────────────────────

/** Soglia importo per obbligo di bollo (EUR). */
export const BOLLO_IMPORTO_SOGLIA = 77.47;

/** Importo bollo virtuale (EUR). */
export const BOLLO_IMPORTO = 2.0;

// ─── Default values ──────────────────────────────────────────────────────────

export const DEFAULT_DIVISA = "EUR";
export const DEFAULT_MODALITA_PAGAMENTO = "MP05";
export const DEFAULT_CONDIZIONI_PAGAMENTO = CONDIZIONI_PAGAMENTO.COMPLETO;
export const DEFAULT_TIPO_DOCUMENTO = "TD01";
export const DEFAULT_TIPO_CASSA_INPS = "TC22";

/** Max chars per Causale element in FatturaPA XML. */
export const CAUSALE_MAX_LENGTH = 200;
