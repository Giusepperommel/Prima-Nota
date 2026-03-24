# Specifica Tecnica — Sotto-progetto 3: Fatturazione Elettronica

> **Stato:** In attesa approvazione utente
> **Data:** 2026-03-24
> **Progetto padre:** Upgrade a contabilita professionale
> **Riferimenti normativi:** `docs/normativa/fatturazione-elettronica-riferimenti.md`

---

## 1. Contesto e Obiettivo

Il software Prima Nota gestisce gia operazioni contabili, partita doppia, IVA engine con autofattura/reverse charge, OCR per import XML e anagrafiche con dati SDI (P.IVA, CF, PEC, codice destinatario). Il passo successivo e la **generazione di fatture elettroniche** in formato FatturaPA (FPR12, schema v1.2.2) per le fatture attive, con download dell'XML per upload manuale su SDI.

**Scope attuale:**
- Generazione XML FatturaPA per fatture attive (emissione)
- Download del file XML generato
- Architettura predisposta per futura integrazione con provider (Aruba, ecc.)
- Numerazione con sezionali configurabili

**Fuori scope (predisposto nel modello dati):**
- Invio automatico a SDI via provider
- Ricezione fatture passive
- Firma digitale

**Principio delle tre modalita:**
- **Semplice:** generazione XML invisibile, bottone "Scarica fattura XML" sulla fattura attiva
- **Avanzata:** visibilita dello stato fattura elettronica, gestione sezionali
- **Commercialista:** controllo totale — configurazione provider, sezionali multipli, gestione stati

---

## 2. Modello Dati

### 2.1 Nuove tabelle

#### FatturaElettronica

| Campo | Tipo | Note |
|---|---|---|
| fatturaElettronicaId | Int @id @default(autoincrement()) | PK |
| societaId | Int | FK → Societa, RLS |
| operazioneId | Int @unique | FK → Operazione (1:1, solo FATTURA_ATTIVA) |
| sezionaleId | Int | FK → SezionaleFattura |
| numero | String @db.VarChar(20) | Numero progressivo generato (es. "FV/1") |
| annoRiferimento | Int | Anno fiscale di riferimento |
| progressivoFile | String @db.VarChar(5) | Progressivo per nome file SDI |
| nomeFile | String @db.VarChar(50) | Nome file generato (es. "IT01234567890_00001.xml") |
| stato | Enum(StatoFatturaElettronica) | Stato del ciclo di vita |
| tipoDocumento | TipoDocumentoSdi | TD01, TD04, TD06, ecc. |
| xmlContent | String @db.LongText | XML generato |
| xmlHash | String? @db.VarChar(64) | SHA-256 dell'XML per integrita |
| importoTotale | Decimal @db.Decimal(12, 2) | ImportoTotaleDocumento |
| dataDocumento | DateTime @db.Date | Data del documento |
| dataGenerazione | DateTime @default(now()) | Quando e stato generato |
| dataInvio | DateTime? | Quando e stato inviato a SDI |
| dataEsitoSdi | DateTime? | Quando e arrivato l'esito |
| identificativoSdi | String? @db.VarChar(50) | ID assegnato da SDI |
| erroriSdi | String? @db.Text | Dettaglio errori se SCARTATA |
| createdByUserId | Int | FK → Utente |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |

**Indici:**
- `@@unique([societaId, sezionaleId, annoRiferimento, numero])` — numero unico per sezionale/anno
- `@@unique([societaId, nomeFile])` — nome file unico
- `@@index([societaId, stato])`
- `@@index([societaId, annoRiferimento])`
- `@@index([operazioneId])`

**Enum StatoFatturaElettronica:**
```
BOZZA                    — XML generato ma non confermato
GENERATA                 — XML confermato, pronto per download/invio
INVIATA                  — Inviata a SDI (futuro)
CONSEGNATA               — RC ricevuta da SDI (futuro)
SCARTATA                 — NS ricevuta da SDI (futuro)
MANCATA_CONSEGNA         — MC ricevuta da SDI (futuro)
IMPOSSIBILITA_RECAPITO   — AT ricevuta da SDI (futuro)
ANNULLATA                — Annullata dall'utente (prima dell'invio)
```

#### SezionaleFattura

| Campo | Tipo | Note |
|---|---|---|
| sezionaleId | Int @id @default(autoincrement()) | PK |
| societaId | Int | FK → Societa, RLS |
| codice | String @db.VarChar(10) | Codice sezionale (es. "FV", "NC") |
| descrizione | String @db.VarChar(100) | Descrizione (es. "Fatture vendita") |
| prefisso | String @db.VarChar(10) | Prefisso nel numero (es. "FV/") |
| separatore | String @db.VarChar(5) @default("/") | Separatore tra prefisso e numero |
| tipiDocumento | Json | Array di TipoDocumentoSdi gestiti (es. ["TD01","TD24"]) |
| ultimoNumero | Int @default(0) | Ultimo numero progressivo usato |
| numeroIniziale | Int @default(1) | Numero iniziale (per migrazione) |
| annoCorrente | Int | Anno del contatore |
| formato | String @db.VarChar(50) @default("{prefisso}{numero}") | Template formato (es. "{anno}/{prefisso}{numero}") |
| paddingCifre | Int @default(1) | Zero-padding del numero (1 = no padding, 3 = "001") |
| attivo | Boolean @default(true) | Se il sezionale e attivo |
| predefinito | Boolean @default(false) | Se e il sezionale predefinito per i tipi associati |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |

**Indici:**
- `@@unique([societaId, codice])` — codice unico per societa
- `@@index([societaId, attivo])`

#### ConfigurazioneProvider

| Campo | Tipo | Note |
|---|---|---|
| configId | Int @id @default(autoincrement()) | PK |
| societaId | Int @unique | FK → Societa, RLS (1:1 per societa) |
| provider | String @db.VarChar(30) | Nome provider ("MANUALE", "ARUBA", ecc.) |
| attivo | Boolean @default(false) | Se l'integrazione e attiva |
| configurazione | Json? | Configurazione specifica del provider (API key, endpoint, ecc.) |
| ultimoTest | DateTime? | Data ultimo test di connessione |
| esitoTest | Boolean? | Esito ultimo test |
| createdAt | DateTime @default(now()) | |
| updatedAt | DateTime @updatedAt | |

**Note:** Per la prima implementazione, `provider` sara sempre "MANUALE" (download XML). La tabella e predisposta per futuri adapter.

### 2.2 Relazioni

```
Societa 1:N FatturaElettronica
Societa 1:N SezionaleFattura
Societa 1:1 ConfigurazioneProvider
Operazione 1:1 FatturaElettronica
SezionaleFattura 1:N FatturaElettronica
```

### 2.3 Modifiche a tabelle esistenti

**Societa** — aggiungere campi opzionali per dati FatturaPA:
| Campo | Tipo | Note |
|---|---|---|
| reaUfficio | String? @db.VarChar(2) | Sigla provincia ufficio REA |
| reaNumero | String? @db.VarChar(20) | Numero REA |
| socioUnico | String? @db.VarChar(2) | "SU" o "SM" |
| statoLiquidazione | String? @db.VarChar(2) @default("LN") | "LS" o "LN" |
| telefonoAzienda | String? @db.VarChar(20) | Telefono per CedentePrestatore |
| emailAzienda | String? @db.VarChar(255) | Email per CedentePrestatore |
| cap | String? @db.VarChar(5) | CAP sede |
| citta | String? @db.VarChar(60) | Comune sede |
| provincia | String? @db.VarChar(2) | Provincia sede |
| nazione | String? @db.VarChar(2) @default("IT") | Nazione sede |

**Nota:** il campo `indirizzo` esiste gia come `String? @db.Text`. Sara usato per via e numero civico.

---

## 3. Architettura XML Generator

### 3.1 Struttura moduli

```
src/lib/fatturazione/
  constants.ts          — Enum codes, namespace, schema URL, mapping tables
  mapping.ts            — Mappa dati interni → struttura FatturaPA
  xml-builder.ts        — Costruisce l'XML da struttura intermedia
  xml-validator.ts      — Validazione business rules prima della generazione
  sezionale.ts          — Gestione numerazione progressiva
  types.ts              — TypeScript types per la struttura FatturaPA intermedia
  index.ts              — Export pubblico
```

### 3.2 constants.ts

Contiene tutte le codifiche come oggetti TypeScript:

```typescript
export const FATTURAPA_NAMESPACE = "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2";
export const FATTURAPA_SCHEMA_VERSION = "FPR12";

export const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  TD01: "Fattura",
  TD02: "Acconto/anticipo su fattura",
  // ... tutti i codici
};

export const NATURA_IVA_MAP: Record<string, string> = {
  N1: "N1",
  N2_1: "N2.1",
  N2_2: "N2.2",
  // ... mappatura underscore → punto
};

export const REGIME_FISCALE_MAP: Record<string, string> = {
  ORDINARIO: "RF01",
  FORFETTARIO: "RF19",
};

export const TIPO_RITENUTA_MAP: Record<string, { tipo: string; causale: string }> = {
  LAVORO_AUTONOMO: { tipo: "RT01", causale: "A" },
  PROVVIGIONI: { tipo: "RT01", causale: "R" },
  OCCASIONALE: { tipo: "RT01", causale: "M" },
  DIRITTI_AUTORE: { tipo: "RT01", causale: "L" },
};
```

### 3.3 types.ts — Struttura intermedia

Una rappresentazione TypeScript dell'intero albero FatturaPA, usata come layer intermedio tra i dati del database e l'XML:

```typescript
interface FatturaPA {
  FatturaElettronicaHeader: {
    DatiTrasmissione: DatiTrasmissione;
    CedentePrestatore: CedentePrestatore;
    CessionarioCommittente: CessionarioCommittente;
  };
  FatturaElettronicaBody: FatturaElettronicaBody;
}
```

Ogni sotto-interfaccia riflette fedelmente la struttura XSD (vedi riferimenti normativi sezione 2.2).

### 3.4 mapping.ts — Logica di mapping

Il modulo espone funzioni di mapping che trasformano i dati interni nella struttura intermedia:

#### mapCedentePrestatore(societa: Societa) → CedentePrestatore
- `societa.partitaIva` → IdFiscaleIVA.IdCodice
- `"IT"` → IdFiscaleIVA.IdPaese
- `societa.codiceFiscale` → CodiceFiscale
- `societa.ragioneSociale` → Anagrafica.Denominazione
- `societa.regimeFiscale` → RegimeFiscale (via REGIME_FISCALE_MAP)
- `societa.indirizzo` → Sede.Indirizzo
- `societa.cap/citta/provincia/nazione` → Sede.*
- `societa.reaUfficio/reaNumero/capitaleSociale/socioUnico/statoLiquidazione` → IscrizioneREA

#### mapCessionarioCommittente(anagrafica: Anagrafica) → CessionarioCommittente
- `anagrafica.partitaIva` → IdFiscaleIVA.IdCodice (se presente)
- `anagrafica.nazione` → IdFiscaleIVA.IdPaese
- `anagrafica.codiceFiscale` → CodiceFiscale
- `anagrafica.denominazione` → Anagrafica.Denominazione (se AZIENDA)
- Per PERSONA_FISICA/PROFESSIONISTA: split denominazione in Nome/Cognome
- `anagrafica.indirizzo/cap/citta/provincia/nazione` → Sede.*
- `anagrafica.codiceDestinatario` → DatiTrasmissione.CodiceDestinatario
- `anagrafica.pec` → DatiTrasmissione.PECDestinatario

#### mapDatiGeneraliDocumento(operazione, fattura) → DatiGeneraliDocumento
- `fattura.tipoDocumento` → TipoDocumento
- `"EUR"` → Divisa
- `operazione.dataOperazione` → Data
- `fattura.numero` → Numero
- `operazione.importoTotale` → ImportoTotaleDocumento
- `operazione.descrizione` → Causale (split in blocchi da 200 char se necessario)
- Se `operazione.bolloVirtuale` → DatiBollo { BolloVirtuale: "SI", ImportoBollo: importoBollo }
- Se `operazione.soggettoARitenuta` → DatiRitenuta (da Ritenuta collegata)
- Se Ritenuta con `cassaPrevidenza > 0` → DatiCassaPrevidenziale

#### mapDettaglioLinee(operazione) → DettaglioLinee[]
- Per la prima versione: una singola linea con i dati dell'operazione
- `NumeroLinea`: 1
- `Descrizione`: operazione.descrizione
- `PrezzoUnitario`: operazione.importoImponibile
- `PrezzoTotale`: operazione.importoImponibile
- `AliquotaIVA`: operazione.aliquotaIva (o 0.00 se esente)
- Se aliquotaIva = 0 → `Natura`: naturaOperazioneIva mappata
- Se soggettoARitenuta → `Ritenuta`: "SI"

#### mapDatiRiepilogo(operazione) → DatiRiepilogo[]
- Un blocco per ogni aliquota IVA distinta
- `AliquotaIVA`: aliquota
- `ImponibileImporto`: somma imponibili
- `Imposta`: somma IVA
- `EsigibilitaIVA`: "S" se splitPayment, "I" altrimenti (o "D" se IVA per cassa)
- Se AliquotaIVA = 0 → `Natura` obbligatoria
- `RiferimentoNormativo`: testo descrittivo della natura

#### mapDatiPagamento(operazione) → DatiPagamento
- `CondizioniPagamento`: TP02 (pagamento completo) per default
- `ModalitaPagamento`: MP05 (bonifico) per default
- `ImportoPagamento`: importo totale (- ritenuta se presente)
- `DataScadenzaPagamento`: dataPagamento o dataOperazione + 30gg

### 3.5 xml-builder.ts

Costruisce l'XML partendo dalla struttura intermedia FatturaPA:

```typescript
export function buildFatturaPAXml(data: FatturaPA): string
```

- Usa una libreria XML (es. `fast-xml-parser` o `xmlbuilder2`) per costruire il documento
- Imposta namespace, versione, encoding
- Root element: `<p:FatturaElettronica versione="FPR12" xmlns:ds="..." xmlns:p="..." xmlns:xsi="...">`
- Genera XML indentato per leggibilita
- Restituisce stringa XML completa con `<?xml version="1.0" encoding="UTF-8"?>`

### 3.6 xml-validator.ts

Validazione pre-generazione (non XSD, ma business rules):

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export function validateFattura(data: FatturaPA): ValidationResult
```

Controlli implementati:
1. **AliquotaIVA/Natura coerenza** — se aliquota = 0, Natura obbligatoria; se > 0, Natura assente
2. **PrezzoTotale aritmetico** — PrezzoUnitario * Quantita entro tolleranza 0.01
3. **Imposta riepilogo aritmetico** — ImponibileImporto * AliquotaIVA / 100 entro tolleranza 0.01
4. **Numero con almeno una cifra**
5. **Data non nel futuro**
6. **CodiceDestinatario formato** — 7 char alfanumerici, o "0000000", o "XXXXXXX"
7. **IdFiscaleIVA o CodiceFiscale obbligatorio** per cessionario
8. **BolloVirtuale con ImportoBollo**
9. **DatiRitenuta coerenza** — se presente, almeno una linea con Ritenuta = "SI"
10. **ImportoTotaleDocumento coerenza** — warning se non quadra

### 3.7 sezionale.ts

```typescript
export async function getNextNumero(
  prisma: PrismaClient,
  societaId: number,
  sezionaleId: number,
  anno: number
): Promise<{ numero: string; progressivo: number }>
```

Logica:
1. Acquisire lock sulla riga SezionaleFattura (SELECT ... FOR UPDATE)
2. Se `annoCorrente != anno`, reset contatore a `numeroIniziale` e aggiornare `annoCorrente`
3. Incrementare `ultimoNumero`
4. Formattare il numero secondo il template `formato` con padding
5. Restituire numero formattato e progressivo numerico

```typescript
export async function getNextProgressivoFile(
  prisma: PrismaClient,
  societaId: number
): Promise<string>
```

Logica:
- Conta le fatture elettroniche della societa e genera progressivo alfanumerico a 5 char
- Formato: zero-padded "00001", "00002", ecc.

---

## 4. API Endpoints

### 4.1 POST /api/fatture-elettroniche/genera

Genera XML FatturaPA da un'operazione di tipo FATTURA_ATTIVA.

**Input:**
```json
{
  "operazioneId": 123,
  "sezionaleId": 1,         // opzionale, usa predefinito
  "tipoDocumento": "TD01"   // opzionale, default TD01
}
```

**Logica:**
1. Verificare che l'operazione sia FATTURA_ATTIVA e non eliminata
2. Verificare che non esista gia una FatturaElettronica per questa operazione
3. Caricare operazione + societa + anagrafica cliente + eventuale ritenuta
4. Verificare completezza dati societa (P.IVA, indirizzo, regime fiscale, ecc.)
5. Verificare completezza dati cliente (almeno P.IVA o CF, indirizzo)
6. Determinare sezionale (passato o predefinito per il tipo documento)
7. Generare numero progressivo (sezionale.ts)
8. Costruire struttura FatturaPA (mapping.ts)
9. Validare (xml-validator.ts) — se errori bloccanti, restituire 400
10. Generare XML (xml-builder.ts)
11. Generare nome file e progressivo file
12. Calcolare hash SHA-256
13. Salvare record FatturaElettronica con stato GENERATA
14. Restituire il record con XML

**Output:** `201` con il record FatturaElettronica (senza xmlContent nel body, solo metadata)

**Errori:**
- `400` — dati incompleti o validazione fallita (con dettaglio errori)
- `404` — operazione non trovata
- `409` — fattura elettronica gia generata per questa operazione

### 4.2 GET /api/fatture-elettroniche/[id]/xml

Scarica l'XML della fattura elettronica.

**Output:** file XML con headers:
- `Content-Type: application/xml`
- `Content-Disposition: attachment; filename="{nomeFile}"`

### 4.3 GET /api/fatture-elettroniche

Lista fatture elettroniche con filtri.

**Query params:**
- `anno` — filtro anno
- `stato` — filtro stato
- `tipoDocumento` — filtro tipo
- `page`, `limit` — paginazione

**Output:** lista paginata con metadata (senza xmlContent).

### 4.4 POST /api/fatture-elettroniche/[id]/invia

Placeholder per futuro invio a SDI via provider.

**Logica attuale:**
- Restituire `501 Not Implemented` con messaggio "Invio automatico non ancora disponibile. Scaricare l'XML e caricarlo manualmente su SDI."
- Predisporre l'interfaccia per accettare il provider dalla configurazione

### 4.5 GET /api/sezionali

Lista sezionali della societa corrente.

### 4.6 POST /api/sezionali

Crea nuovo sezionale.

**Input:**
```json
{
  "codice": "FV",
  "descrizione": "Fatture vendita",
  "prefisso": "FV/",
  "tipiDocumento": ["TD01", "TD24"],
  "numeroIniziale": 1,
  "paddingCifre": 3,
  "predefinito": true
}
```

### 4.7 PUT /api/sezionali/[id]

Modifica sezionale (non il contatore, solo configurazione).

### 4.8 GET /api/configurazione/provider-fe

Restituisce configurazione provider per la societa corrente.

### 4.9 POST /api/configurazione/provider-fe

Salva/aggiorna configurazione provider.

---

## 5. Interfaccia Utente

### 5.1 Pagina /fatture-elettroniche

Lista delle fatture elettroniche generate, con:
- Tabella: numero, data, cliente, importo, tipo documento, stato, azioni
- Filtri: anno, stato, tipo documento
- Badge colorati per stato (verde=CONSEGNATA, giallo=GENERATA, rosso=SCARTATA, grigio=BOZZA)
- Azione "Scarica XML" per ogni riga
- Azione "Rigenera" per fatture BOZZA o SCARTATA

### 5.2 Bottone "Genera XML" su operazione FATTURA_ATTIVA

- Visibile nella pagina dettaglio operazione per FATTURA_ATTIVA
- Se fattura gia generata: mostra stato e link a download
- Se non generata: bottone "Genera Fattura Elettronica"
- Click → dialog di conferma con preview dati (cedente, cessionario, importo, numero)
- Dopo generazione → redirect a pagina fatture o download diretto

### 5.3 Configurazione /configurazione/fatturazione

Wizard in due sezioni:

**Sezione 1 — Sezionali:**
- Lista sezionali con possibilita di aggiungere/modificare
- Per ogni sezionale: codice, descrizione, prefisso, tipi documento associati, padding, numero iniziale
- Preview del formato risultante (es. "FV/001")

**Sezione 2 — Provider:**
- Selezione provider: "Manuale (download XML)" / "Aruba" / "Altro" (disabilitati)
- Per provider Manuale: nessuna configurazione aggiuntiva
- Per provider futuri: form con campi specifici (API key, username, ecc.)
- Pulsante "Testa Connessione" (per provider futuri)

### 5.4 Completamento dati Societa

Se la societa non ha tutti i campi richiesti per FatturaPA (CAP, citta, provincia, dati REA), l'API restituira errore 400 con l'elenco dei campi mancanti. La UI mostrera un dialog/banner che guida l'utente a completare i dati in `/configurazione/azienda`.

---

## 6. Flusso Completo

```
1. Utente crea FATTURA_ATTIVA (operazione con cliente, importo, IVA)
2. Nella pagina operazione, clicca "Genera Fattura Elettronica"
3. Sistema verifica completezza dati (societa + cliente)
4. Sistema assegna numero dal sezionale appropriato
5. Sistema genera struttura FatturaPA (mapping)
6. Sistema valida (business rules)
7. Sistema genera XML
8. Sistema salva record FatturaElettronica (stato: GENERATA)
9. Utente scarica XML
10. Utente carica manualmente su SDI (portale AdE / provider esterno)
11. [Futuro] Utente aggiorna stato manualmente o sistema riceve notifica
```

---

## 7. Casi Speciali

### 7.1 Bollo virtuale
- Se `operazione.bolloVirtuale = true`, includere `DatiBollo` con `BolloVirtuale: "SI"` e `ImportoBollo` dal campo operazione (default 2.00)
- Il bollo NON va incluso nell'ImportoTotaleDocumento (e un'informazione accessoria)

### 7.2 Split payment
- Se `operazione.splitPayment = true`, il `DatiRiepilogo.EsigibilitaIVA = "S"`
- L'ImportoPagamento nei DatiPagamento sara al netto dell'IVA

### 7.3 Ritenuta d'acconto
- Se l'operazione ha una Ritenuta collegata:
  - `DatiRitenuta.TipoRitenuta` = RT01 (o RT02 se persona giuridica)
  - `DatiRitenuta.ImportoRitenuta` = ritenuta.importoRitenuta
  - `DatiRitenuta.AliquotaRitenuta` = ritenuta.aliquota
  - `DatiRitenuta.CausalePagamento` = da TIPO_RITENUTA_MAP
  - La linea corrispondente avra `Ritenuta: "SI"`
  - ImportoPagamento = importoTotale - importoRitenuta

### 7.4 Cassa previdenziale
- Se la Ritenuta ha `cassaPrevidenza > 0`:
  - `DatiCassaPrevidenziale.TipoCassa` = determinata dal tipo (default TC22 per INPS)
  - `DatiCassaPrevidenziale.ImportoContributoCassa` = cassaPrevidenza
  - `DatiCassaPrevidenziale.AliquotaIVA` = stessa aliquota dell'operazione

### 7.5 Note di credito (TD04)
- Stessa logica di mapping, ma TipoDocumento = TD04
- Il sezionale puo essere lo stesso o dedicato (es. "NC/")
- Gli importi sono positivi nel XML (il tipo documento indica che e un credito)

### 7.6 Fattura differita (TD24)
- Come TD01 ma con TipoDocumento = TD24
- Possibilita di referenziare DDT in DatiDDT (futuro)

### 7.7 Soggetto estero
- Se `anagrafica.nazione != "IT"`:
  - `CodiceDestinatario = "XXXXXXX"`
  - `PECDestinatario` non compilato
  - `IdFiscaleIVA.IdPaese` = nazione dell'anagrafica

---

## 8. Sicurezza e Multi-tenancy

- Tutti gli endpoint filtrano per `societaId` della societa corrente (RLS)
- L'XML generato contiene solo dati della societa e del cliente specifico
- Le configurazioni provider sono per societa (credenziali non condivise)
- Il progressivo file e univoco per P.IVA trasmittente (societa)

---

## 9. Testing

### 9.1 Unit test (TDD)
- **xml-builder.ts**: dato un oggetto FatturaPA, produce XML valido
- **xml-validator.ts**: tutti i controlli di validazione con casi positivi e negativi
- **sezionale.ts**: numerazione progressiva, cambio anno, padding
- **mapping.ts**: ogni funzione di mapping con dati realistici
- **constants.ts**: mapping codes corretti

### 9.2 Integration test
- Flusso completo: crea operazione → genera fattura → scarica XML → verifica struttura
- Verifica che l'XML generato passi i controlli aritmetici
- Verifica unicita numerazione in caso di generazione concorrente
- Verifica gestione errori (dati incompleti, operazione non trovata, duplicato)
