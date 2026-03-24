# Fatturazione Elettronica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate FatturaPA XML (FPR12 v1.2.2) for active invoices (FATTURA_ATTIVA), with configurable numbering (sezionali) and download for manual upload to SDI. Architecture predisposed for future provider integration.

**Architecture:** A generator module (`src/lib/fatturazione/`) maps internal data (Operazione + Societa + Anagrafica) to FatturaPA XML via an intermediate TypeScript structure. Configurable sezionali manage numbering. A provider config table enables future automatic sending. The UI adds a generation button on active invoices and a list page for generated electronic invoices.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma (MySQL), Vitest, Tailwind CSS, Shadcn UI

**Spec:** `docs/superpowers/specs/2026-03-24-fatturazione-elettronica-design.md`
**Normative reference:** `docs/normativa/fatturazione-elettronica-riferimenti.md`

---

## Task 1: Prisma Schema — New Tables and Enums

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add StatoFatturaElettronica enum**

```prisma
enum StatoFatturaElettronica {
  BOZZA
  GENERATA
  INVIATA
  CONSEGNATA
  SCARTATA
  MANCATA_CONSEGNA
  IMPOSSIBILITA_RECAPITO
  ANNULLATA

  @@map("stato_fattura_elettronica")
}
```

- [ ] **Step 2: Add FatturaElettronica model**

```prisma
model FatturaElettronica {
  id                  Int                       @id @default(autoincrement()) @map("fattura_elettronica_id")
  societaId           Int                       @map("societa_id")
  operazioneId        Int                       @unique @map("operazione_id")
  sezionaleId         Int                       @map("sezionale_id")
  numero              String                    @db.VarChar(20)
  annoRiferimento     Int                       @map("anno_riferimento")
  progressivoFile     String                    @db.VarChar(5) @map("progressivo_file")
  nomeFile            String                    @db.VarChar(50) @map("nome_file")
  stato               StatoFatturaElettronica   @default(GENERATA)
  tipoDocumento       TipoDocumentoSdi          @map("tipo_documento")
  xmlContent          String                    @db.LongText @map("xml_content")
  xmlHash             String?                   @db.VarChar(64) @map("xml_hash")
  importoTotale       Decimal                   @db.Decimal(12, 2) @map("importo_totale")
  dataDocumento       DateTime                  @db.Date @map("data_documento")
  dataGenerazione     DateTime                  @default(now()) @map("data_generazione")
  dataInvio           DateTime?                 @map("data_invio")
  dataEsitoSdi        DateTime?                 @map("data_esito_sdi")
  identificativoSdi   String?                   @db.VarChar(50) @map("identificativo_sdi")
  erroriSdi           String?                   @db.Text @map("errori_sdi")
  createdByUserId     Int                       @map("created_by_user_id")
  createdAt           DateTime                  @default(now()) @map("created_at")
  updatedAt           DateTime                  @updatedAt @map("updated_at")

  societa    Societa            @relation(fields: [societaId], references: [id])
  operazione Operazione         @relation(fields: [operazioneId], references: [id])
  sezionale  SezionaleFattura   @relation(fields: [sezionaleId], references: [id])
  createdBy  Utente             @relation(fields: [createdByUserId], references: [id])

  @@unique([societaId, sezionaleId, annoRiferimento, numero])
  @@unique([societaId, nomeFile])
  @@index([societaId, stato])
  @@index([societaId, annoRiferimento])
  @@map("fatture_elettroniche")
}
```

- [ ] **Step 3: Add SezionaleFattura model**

```prisma
model SezionaleFattura {
  id              Int      @id @default(autoincrement()) @map("sezionale_id")
  societaId       Int      @map("societa_id")
  codice          String   @db.VarChar(10)
  descrizione     String   @db.VarChar(100)
  prefisso        String   @db.VarChar(10)
  separatore      String   @db.VarChar(5) @default("/")
  tipiDocumento   Json     @map("tipi_documento")
  ultimoNumero    Int      @default(0) @map("ultimo_numero")
  numeroIniziale  Int      @default(1) @map("numero_iniziale")
  annoCorrente    Int      @map("anno_corrente")
  formato         String   @db.VarChar(50) @default("{prefisso}{numero}")
  paddingCifre    Int      @default(1) @map("padding_cifre")
  attivo          Boolean  @default(true)
  predefinito     Boolean  @default(false)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  societa             Societa              @relation(fields: [societaId], references: [id])
  fattureElettroniche FatturaElettronica[]

  @@unique([societaId, codice])
  @@index([societaId, attivo])
  @@map("sezionali_fattura")
}
```

- [ ] **Step 4: Add ConfigurazioneProvider model**

```prisma
model ConfigurazioneProvider {
  id              Int       @id @default(autoincrement()) @map("config_id")
  societaId       Int       @unique @map("societa_id")
  provider        String    @db.VarChar(30) @default("MANUALE")
  attivo          Boolean   @default(false)
  configurazione  Json?
  ultimoTest      DateTime? @map("ultimo_test")
  esitoTest       Boolean?  @map("esito_test")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  societa Societa @relation(fields: [societaId], references: [id])

  @@map("configurazione_provider")
}
```

- [ ] **Step 5: Add new fields to Societa model**

Add these optional fields for FatturaPA CedentePrestatore data:

```prisma
// Fatturazione elettronica - dati CedentePrestatore
reaUfficio         String?  @map("rea_ufficio") @db.VarChar(2)
reaNumero          String?  @map("rea_numero") @db.VarChar(20)
socioUnico         String?  @map("socio_unico") @db.VarChar(2)
statoLiquidazione  String?  @map("stato_liquidazione") @db.VarChar(2) @default("LN")
telefonoAzienda    String?  @map("telefono_azienda") @db.VarChar(20)
emailAzienda       String?  @map("email_azienda") @db.VarChar(255)
cap                String?  @map("cap") @db.VarChar(5)
citta              String?  @map("citta") @db.VarChar(60)
provincia          String?  @map("provincia") @db.VarChar(2)
nazione            String?  @map("nazione") @db.VarChar(2) @default("IT")
```

Also add relation arrays to Societa:
```prisma
fattureElettroniche    FatturaElettronica[]
sezionaliFattura       SezionaleFattura[]
configurazioneProvider ConfigurazioneProvider?
```

And add relation to Operazione:
```prisma
fatturaElettronica FatturaElettronica?
```

And add relation to Utente:
```prisma
fattureElettronicheCreate FatturaElettronica[]
```

- [ ] **Step 6: Run prisma migrate dev**

```bash
npx prisma migrate dev --name fatturazione-elettronica
```

---

## Task 2: Constants — Normativa Codes and Mappings

**Files:**
- Create: `src/lib/fatturazione/constants.ts`

- [ ] **Step 1: Create constants.ts with all FatturaPA codes**

Include:
- `FATTURAPA_NAMESPACE`, `FATTURAPA_SCHEMA_VERSION` ("FPR12")
- `TIPO_DOCUMENTO_LABELS` — record TD01-TD28 with Italian descriptions
- `NATURA_IVA_MAP` — maps app enum values (N1, N2_1, ...) to FatturaPA codes (N1, N2.1, ...)
- `NATURA_IVA_LABELS` — descriptions for each Natura code
- `REGIME_FISCALE_MAP` — maps ORDINARIO→RF01, FORFETTARIO→RF19
- `MODALITA_PAGAMENTO_LABELS` — MP01-MP23
- `TIPO_CASSA_LABELS` — TC01-TC22
- `TIPO_RITENUTA_SDI_MAP` — maps app TipoRitenuta to { tipo: string, causale: string }
- `ESIGIBILITA_IVA` — I, D, S with descriptions
- `BOLLO_IMPORTO_SOGLIA` = 77.47
- `BOLLO_IMPORTO` = 2.00

Reference: `docs/normativa/fatturazione-elettronica-riferimenti.md` sections 3 and 11.

---

## Task 3: Types — FatturaPA Intermediate Structure

**Files:**
- Create: `src/lib/fatturazione/types.ts`

- [ ] **Step 1: Define TypeScript interfaces matching FatturaPA XML structure**

Create interfaces for the complete FatturaPA tree:
- `FatturaPA` (root)
- `FatturaElettronicaHeader` with `DatiTrasmissione`, `CedentePrestatore`, `CessionarioCommittente`
- `FatturaElettronicaBody` with `DatiGenerali`, `DatiBeniServizi`, `DatiPagamento`
- All sub-structures: `IdFiscaleIVA`, `Anagrafica`, `Sede`, `IscrizioneREA`, `DatiGeneraliDocumento`, `DatiRitenuta`, `DatiBollo`, `DatiCassaPrevidenziale`, `DettaglioLinee`, `DatiRiepilogo`, `DettaglioPagamento`
- All fields optional where schema allows [0..1]

Reference: spec section 3.3 and normativa section 2.2.

---

## Task 4: XML Builder (TDD)

**Files:**
- Create: `src/lib/fatturazione/xml-builder.ts`
- Create: `src/lib/fatturazione/__tests__/xml-builder.test.ts`

- [ ] **Step 1: Write tests first**

Test cases:
1. Minimal valid FatturaPA produces well-formed XML with correct namespace and versione
2. CedentePrestatore section renders all fields correctly
3. CessionarioCommittente section renders correctly
4. DettaglioLinee produces correct NumeroLinea, Descrizione, importi
5. DatiRiepilogo renders AliquotaIVA, ImponibileImporto, Imposta
6. DatiBollo section rendered when present
7. DatiRitenuta section rendered when present
8. DatiPagamento section rendered correctly
9. Causale split into 200-char blocks
10. XML declaration and encoding correct

- [ ] **Step 2: Implement xml-builder.ts**

```typescript
export function buildFatturaPAXml(data: FatturaPA): string
```

Use `fast-xml-parser` (already a dependency for OCR XML parsing) or `xmlbuilder2`. Build the XML tree from the intermediate structure. Ensure proper namespace declaration and versione attribute on root element.

---

## Task 5: XML Validator (TDD)

**Files:**
- Create: `src/lib/fatturazione/xml-validator.ts`
- Create: `src/lib/fatturazione/__tests__/xml-validator.test.ts`

- [ ] **Step 1: Write tests first**

Test cases for each validation rule:
1. AliquotaIVA=0 without Natura → error
2. AliquotaIVA>0 with Natura → error
3. PrezzoTotale arithmetic check (within 0.01 tolerance)
4. Imposta arithmetic check (within 0.01 tolerance)
5. Numero without digits → error
6. Future date → error
7. CodiceDestinatario invalid format → error
8. Missing IdFiscaleIVA and CodiceFiscale for cessionario → error
9. BolloVirtuale without ImportoBollo → error
10. DatiRitenuta without linee Ritenuta=SI → error
11. Valid fattura → no errors

- [ ] **Step 2: Implement xml-validator.ts**

```typescript
export interface ValidationError { code: string; field: string; message: string; }
export interface ValidationWarning { code: string; field: string; message: string; }
export interface ValidationResult { valid: boolean; errors: ValidationError[]; warnings: ValidationWarning[]; }
export function validateFattura(data: FatturaPA): ValidationResult
```

---

## Task 6: Sezionale Numbering Logic (TDD)

**Files:**
- Create: `src/lib/fatturazione/sezionale.ts`
- Create: `src/lib/fatturazione/__tests__/sezionale.test.ts`

- [ ] **Step 1: Write tests first**

Test cases:
1. First number of the year returns numeroIniziale
2. Subsequent calls increment correctly
3. Year change resets counter to numeroIniziale
4. Padding applied correctly (paddingCifre=3 → "001")
5. Format template applied correctly ("{prefisso}{numero}" → "FV/1")
6. getNextProgressivoFile returns zero-padded 5-char string

- [ ] **Step 2: Implement sezionale.ts**

```typescript
export async function getNextNumero(prisma, societaId, sezionaleId, anno): Promise<{ numero: string; progressivo: number }>
export async function getNextProgressivoFile(prisma, societaId): Promise<string>
export function formatNumero(prefisso, separatore, progressivo, paddingCifre, formato): string
```

Use `$queryRaw` with `SELECT ... FOR UPDATE` for the sezionale lock to prevent race conditions.

---

## Task 7: Mapping — Societa to CedentePrestatore

**Files:**
- Create: `src/lib/fatturazione/mapping.ts`
- Create: `src/lib/fatturazione/__tests__/mapping.test.ts`

- [ ] **Step 1: Write tests for mapCedentePrestatore**

Test with complete Societa data, verify all fields mapped:
- IdFiscaleIVA.IdPaese = "IT", IdCodice = partitaIva
- CodiceFiscale
- Anagrafica.Denominazione = ragioneSociale
- RegimeFiscale = RF01 for ORDINARIO
- Sede fields from indirizzo, cap, citta, provincia, nazione
- IscrizioneREA fields when present

- [ ] **Step 2: Implement mapCedentePrestatore**

```typescript
export function mapCedentePrestatore(societa: SocietaWithFEFields): CedentePrestatore
```

---

## Task 8: Mapping — Anagrafica to CessionarioCommittente

**Files:**
- Modify: `src/lib/fatturazione/mapping.ts`
- Modify: `src/lib/fatturazione/__tests__/mapping.test.ts`

- [ ] **Step 1: Write tests for mapCessionarioCommittente**

Test cases:
- AZIENDA with P.IVA → Denominazione + IdFiscaleIVA
- PERSONA_FISICA with CF only → Nome/Cognome + CodiceFiscale
- Italian client → codiceDestinatario as-is
- Foreign client (nazione != IT) → codiceDestinatario = "XXXXXXX"
- Client with PEC, no codice destinatario → "0000000" + PECDestinatario

- [ ] **Step 2: Implement mapCessionarioCommittente**

```typescript
export function mapCessionarioCommittente(anagrafica: Anagrafica): CessionarioCommittente
```

---

## Task 9: Mapping — Operazione to DatiGenerali + DettaglioLinee + DatiRiepilogo

**Files:**
- Modify: `src/lib/fatturazione/mapping.ts`
- Modify: `src/lib/fatturazione/__tests__/mapping.test.ts`

- [ ] **Step 1: Write tests for mapDatiGeneraliDocumento, mapDettaglioLinee, mapDatiRiepilogo**

Test cases:
- Standard TD01 fattura with IVA 22%
- Fattura with Natura (IVA=0, esente)
- Causale > 200 chars split into multiple Causale elements
- DatiRiepilogo arithmetic correct

- [ ] **Step 2: Implement mapping functions**

```typescript
export function mapDatiGeneraliDocumento(operazione, fatturaNumero, tipoDocumento): DatiGeneraliDocumento
export function mapDettaglioLinee(operazione): DettaglioLinee[]
export function mapDatiRiepilogo(operazione): DatiRiepilogo[]
export function mapDatiPagamento(operazione, importoPagamento): DatiPagamento
```

---

## Task 10: Mapping — Special Cases (Ritenuta, Cassa, Bollo, Split Payment)

**Files:**
- Modify: `src/lib/fatturazione/mapping.ts`
- Modify: `src/lib/fatturazione/__tests__/mapping.test.ts`

- [ ] **Step 1: Write tests for special cases**

Test cases:
1. Operazione with bolloVirtuale → DatiBollo section present
2. Operazione with splitPayment → EsigibilitaIVA = "S"
3. Operazione with Ritenuta → DatiRitenuta + linea Ritenuta="SI" + ImportoPagamento reduced
4. Ritenuta with cassaPrevidenza → DatiCassaPrevidenziale section
5. RT01 vs RT02 based on TipoSoggetto (persona fisica vs giuridica)

- [ ] **Step 2: Implement special case mappings**

Extend the existing mapping functions:
- `mapDatiBollo(operazione)` → optional DatiBollo
- `mapDatiRitenuta(ritenuta, tipoSoggetto)` → optional DatiRitenuta
- `mapDatiCassaPrevidenziale(ritenuta, aliquotaIva)` → optional DatiCassaPrevidenziale
- Update `mapDatiRiepilogo` to handle EsigibilitaIVA based on splitPayment

---

## Task 11: API — Genera XML from Operation

**Files:**
- Create: `src/app/api/fatture-elettroniche/genera/route.ts`

- [ ] **Step 1: Implement POST /api/fatture-elettroniche/genera**

Logic:
1. Parse input: `{ operazioneId, sezionaleId?, tipoDocumento? }`
2. Load operation with societa, cliente anagrafica, ritenuta
3. Validate operation is FATTURA_ATTIVA, not eliminata
4. Check no existing FatturaElettronica for this operation (409 if exists)
5. Validate completeness of societa and anagrafica fields (400 with missing fields list)
6. Determine sezionale (use passed or find predefinito for tipoDocumento)
7. In a transaction:
   - Get next numero (sezionale.ts)
   - Get next progressivo file
   - Build FatturaPA structure (mapping.ts)
   - Validate (xml-validator.ts)
   - Generate XML (xml-builder.ts)
   - Compute SHA-256 hash
   - Build nomeFile: `IT{societa.partitaIva}_{progressivoFile}.xml`
   - Save FatturaElettronica record
8. Return 201 with record metadata (without xmlContent)

---

## Task 12: API — Download XML

**Files:**
- Create: `src/app/api/fatture-elettroniche/[id]/xml/route.ts`

- [ ] **Step 1: Implement GET /api/fatture-elettroniche/[id]/xml**

Logic:
1. Load FatturaElettronica by id, filtered by societaId
2. Return XML with `Content-Type: application/xml` and `Content-Disposition: attachment; filename="{nomeFile}"`

---

## Task 13: API — List Fatture Elettroniche

**Files:**
- Create: `src/app/api/fatture-elettroniche/route.ts`

- [ ] **Step 1: Implement GET /api/fatture-elettroniche**

Query params: `anno`, `stato`, `tipoDocumento`, `page`, `limit`.

Return paginated list with fields: id, numero, dataDocumento, importoTotale, tipoDocumento, stato, nomeFile, cliente (denominazione from linked operazione.cliente). Exclude xmlContent from response.

---

## Task 14: API — Sezionali CRUD

**Files:**
- Create: `src/app/api/sezionali/route.ts`
- Create: `src/app/api/sezionali/[id]/route.ts`

- [ ] **Step 1: Implement GET /api/sezionali**

Return all sezionali for current societa, ordered by codice.

- [ ] **Step 2: Implement POST /api/sezionali**

Create new sezionale. Validate: codice unique per societa, tipiDocumento is valid array of TipoDocumentoSdi. If `predefinito=true`, unset predefinito on other sezionali with overlapping tipiDocumento.

- [ ] **Step 3: Implement PUT /api/sezionali/[id]**

Update sezionale configuration (not ultimoNumero or annoCorrente — those are managed by sezionale.ts).

---

## Task 15: API — Provider Configuration

**Files:**
- Create: `src/app/api/configurazione/provider-fe/route.ts`

- [ ] **Step 1: Implement GET /api/configurazione/provider-fe**

Return current ConfigurazioneProvider for societa, or default { provider: "MANUALE", attivo: false }.

- [ ] **Step 2: Implement POST /api/configurazione/provider-fe**

Upsert ConfigurazioneProvider. For now only accept provider="MANUALE".

---

## Task 16: UI — Fatture Elettroniche List Page

**Files:**
- Create: `src/app/(app)/fatture-elettroniche/page.tsx`
- Create: `src/components/fatture-elettroniche/fatture-list.tsx`
- Create: `src/components/fatture-elettroniche/fattura-status-badge.tsx`

- [ ] **Step 1: Create the list page**

Table columns: Numero, Data, Cliente, Importo, Tipo Documento, Stato, Azioni (download XML).

Filters: anno (select), stato (select), tipo documento (select).

Status badges with colors:
- BOZZA → gray
- GENERATA → blue
- INVIATA → yellow
- CONSEGNATA → green
- SCARTATA → red
- MANCATA_CONSEGNA → orange
- ANNULLATA → gray strikethrough

- [ ] **Step 2: Add navigation link**

Add "Fatture Elettroniche" to the sidebar navigation (visible in avanzata and commercialista modes).

---

## Task 17: UI — Genera XML Button on Operation Detail

**Files:**
- Modify: operation detail page/component (where FATTURA_ATTIVA operations are displayed)
- Create: `src/components/fatture-elettroniche/genera-fattura-dialog.tsx`

- [ ] **Step 1: Add "Genera Fattura Elettronica" button**

Show on FATTURA_ATTIVA operations:
- If no FatturaElettronica linked → show "Genera Fattura Elettronica" button
- If FatturaElettronica exists → show status badge + "Scarica XML" button

- [ ] **Step 2: Create generation dialog**

Dialog shows:
- Preview: cedente (ragione sociale), cessionario (denominazione), importo, tipo documento, sezionale
- Sezionale selector (if multiple active)
- Tipo documento selector (default TD01)
- "Genera" and "Annulla" buttons
- After generation: success message + download link

- [ ] **Step 3: Handle missing data**

If societa or anagrafica fields incomplete, show error with list of missing fields and link to configuration page.

---

## Task 18: UI — Configuration Wizard (Sezionali + Provider)

**Files:**
- Create: `src/app/(app)/configurazione/fatturazione/page.tsx`
- Create: `src/components/fatturazione/sezionali-config.tsx`
- Create: `src/components/fatturazione/provider-config.tsx`

- [ ] **Step 1: Create sezionali configuration section**

- List of sezionali with inline editing
- "Aggiungi sezionale" button with form: codice, descrizione, prefisso, separatore, tipi documento (multi-select), padding, numero iniziale, predefinito
- Live preview of format (es. "FV/001")
- Delete button (disabled if sezionale has fatture linked)

- [ ] **Step 2: Create provider configuration section**

- Provider selector: "Manuale (download e caricamento su SDI)" selected, others disabled with "Prossimamente" label
- For Manuale: info text explaining the workflow
- "Salva" button

- [ ] **Step 3: Add link to configuration menu**

Add "Fatturazione Elettronica" under the configuration section in navigation.

---

## Task 19: Integration Tests

**Files:**
- Create: `src/lib/fatturazione/__tests__/integration.test.ts`

- [ ] **Step 1: Full flow integration test**

Test the complete flow:
1. Create test societa with all FE fields
2. Create test anagrafica (cliente) with P.IVA, indirizzo, codice destinatario
3. Create test operazione FATTURA_ATTIVA
4. Create test sezionale
5. Call genera logic
6. Verify FatturaElettronica record created with correct stato
7. Verify XML is well-formed
8. Verify XML contains correct cedente/cessionario/importi
9. Verify numbering is correct

- [ ] **Step 2: Validation error test**

Test generation with incomplete data → verify appropriate errors returned.

- [ ] **Step 3: Duplicate prevention test**

Generate fattura, try to generate again for same operazione → verify 409.

- [ ] **Step 4: Concurrent numbering test**

Simulate concurrent requests → verify no duplicate numbers (SELECT FOR UPDATE works).

---

## Task 20: Seed Default Sezionali

**Files:**
- Modify: `prisma/seed.ts` (or wherever seed logic lives)

- [ ] **Step 1: Add default sezionali for each societa**

When seeding or on first access, create default sezionali:

```typescript
const defaultSezionali = [
  {
    codice: "FV",
    descrizione: "Fatture di vendita",
    prefisso: "FV",
    separatore: "/",
    tipiDocumento: ["TD01", "TD24", "TD25"],
    formato: "{prefisso}{separatore}{numero}",
    paddingCifre: 1,
    predefinito: true,
  },
  {
    codice: "NC",
    descrizione: "Note di credito",
    prefisso: "NC",
    separatore: "/",
    tipiDocumento: ["TD04"],
    formato: "{prefisso}{separatore}{numero}",
    paddingCifre: 1,
    predefinito: true,
  },
];
```

- [ ] **Step 2: Add default ConfigurazioneProvider**

Create default provider configuration with `provider: "MANUALE"`, `attivo: false`.

- [ ] **Step 3: Verify seed idempotency**

Ensure running seed twice does not create duplicate sezionali (use upsert on societaId + codice).
