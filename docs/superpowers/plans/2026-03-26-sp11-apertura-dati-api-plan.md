# SP11: Apertura Dati e API Pubblica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a universal export engine, guided import from competitors, and a documented REST API with API key auth, rate limiting, webhooks, and OpenAPI spec.

**Architecture:** Three independent modules (`src/lib/export/`, `src/lib/import/`, `src/lib/api/`) sharing Prisma models. Export/import are standalone business logic; API layer wraps existing route handlers with key-based auth and rate limiting. New Prisma models for ApiKey, WebhookEndpoint, WebhookDelivery, ImportJob, ExportJob.

**Tech Stack:** Next.js 16, Prisma 6 (MySQL), Vitest, Zod validation, streaming CSV, xlsx generation (new dep: `xlsx`), existing @react-pdf/renderer for PDF, bcryptjs for key hashing.

**Spec:** `docs/superpowers/specs/2026-03-26-pain-point-driven-features-design.md` (section 3)

---

## File Structure

### New files
```
src/lib/export/
  types.ts              — ExportFormat, ExportOptions, EntityType enums/types
  csv-exporter.ts       — Streaming CSV generation for any entity
  json-exporter.ts      — JSON export with configurable fields
  excel-exporter.ts     — XLSX generation (max 100k rows with pagination)
  pdf-exporter.ts       — PDF generation via @react-pdf/renderer
  export-engine.ts      — Main orchestrator: exportEngine.export(entity, filters, format)
  entity-configs.ts     — Per-entity field definitions, labels, formatters
  __tests__/
    csv-exporter.test.ts
    json-exporter.test.ts
    export-engine.test.ts
    entity-configs.test.ts

src/lib/import/
  types.ts              — ImportSource, ImportState, MappingConfig types
  parsers/
    teamsystem.ts       — TeamSystem CSV/TXT parser
    zucchetti.ts        — Zucchetti CSV parser
    passcom.ts          — Passcom CSV parser
    fatture-in-cloud.ts — Fatture in Cloud CSV parser
    danea.ts            — Danea Easyfatt XML parser
  mapper.ts             — Universal field mapper (source → Prima Nota schema)
  validator.ts          — Pre-import validation with error collection
  import-engine.ts      — Main orchestrator: wizard logic, dry-run, persist
  __tests__/
    mapper.test.ts
    validator.test.ts
    import-engine.test.ts
    parsers/
      teamsystem.test.ts
      danea.test.ts

src/lib/api/
  types.ts              — ApiKeyPayload, ApiScope, RateLimitConfig types
  api-key.ts            — Key generation, hashing, validation, rotation
  rate-limiter.ts       — Sliding window rate limiter (in-memory + DB fallback)
  auth-middleware.ts    — API key extraction, validation, scope checking
  cors.ts               — CORS handler with per-society whitelist
  webhook-dispatcher.ts — Event dispatch, retry logic, HMAC signing
  openapi-schema.ts     — OpenAPI 3.0 spec generator from route definitions
  __tests__/
    api-key.test.ts
    rate-limiter.test.ts
    auth-middleware.test.ts
    webhook-dispatcher.test.ts

src/app/api/v1/
  [...path]/route.ts    — Catch-all v1 router (auth + rate limit + proxy)
  — OR individual routes per entity (see Task 10)

src/app/api/esportazioni/route.ts       — Export job creation/list
src/app/api/esportazioni/[id]/route.ts  — Export job status + download
src/app/api/importazione/route.ts       — Import job creation/list
src/app/api/importazione/[id]/route.ts  — Import job status/confirm
src/app/api/configurazione/api/route.ts — API key CRUD
src/app/api/configurazione/api/webhook/route.ts — Webhook CRUD

src/app/(app)/esportazioni/page.tsx          — Export UI
src/app/(app)/importazione/page.tsx          — Import wizard UI
src/app/(app)/configurazione/api/page.tsx    — API key management UI
```

### Modified files
```
prisma/schema.prisma  — Add ApiKey, WebhookEndpoint, WebhookDelivery, ImportJob, ExportJob models
package.json          — Add xlsx dependency
```

---

## Task 1: Prisma Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the 5 new models to schema.prisma**

Add at the end of the schema file:

```prisma
model ApiKey {
  id                   Int       @id @default(autoincrement())
  societaId            Int       @map("societa_id")
  nome                 String    @db.VarChar(100)
  keyHash              String    @map("key_hash") @db.VarChar(255)
  keyPrefix            String    @map("key_prefix") @db.VarChar(10)
  scopes               Json      @default("[]")
  rateLimitPerHour     Int       @default(1000) @map("rate_limit_per_hour")
  rateLimitPerEndpoint Json?     @map("rate_limit_per_endpoint")
  attiva               Boolean   @default(true)
  ultimoUtilizzo       DateTime? @map("ultimo_utilizzo")
  lastRotatedAt        DateTime? @map("last_rotated_at")
  createdAt            DateTime  @default(now()) @map("created_at")
  expiresAt            DateTime? @map("expires_at")

  societa Societa @relation(fields: [societaId], references: [id], onDelete: Cascade)

  @@map("api_keys")
}

model WebhookEndpoint {
  id                           Int       @id @default(autoincrement())
  societaId                    Int       @map("societa_id")
  url                          String    @db.VarChar(500)
  eventi                       Json      @default("[]")
  secretHash                   String    @map("secret_hash") @db.VarChar(255)
  secretPrecedenteHash         String?   @map("secret_precedente_hash") @db.VarChar(255)
  secretPrecedenteValidoFinoA  DateTime? @map("secret_precedente_valido_fino_a")
  attivo                       Boolean   @default(true)
  ultimaConsegna               DateTime? @map("ultima_consegna")
  consecutiviFalliti           Int       @default(0) @map("consecutivi_falliti")
  createdAt                    DateTime  @default(now()) @map("created_at")

  societa    Societa            @relation(fields: [societaId], references: [id], onDelete: Cascade)
  deliveries WebhookDelivery[]

  @@map("webhook_endpoints")
}

model WebhookDelivery {
  id                  Int       @id @default(autoincrement())
  webhookEndpointId   Int       @map("webhook_endpoint_id")
  evento              String    @db.VarChar(100)
  payload             Json
  statoHttp           Int?      @map("stato_http")
  risposta            String?   @db.Text
  tentativo           Int       @default(1)
  prossimoTentativoAt DateTime? @map("prossimo_tentativo_at")
  stato               StatoDelivery @default(PENDING)
  createdAt           DateTime  @default(now()) @map("created_at")

  webhookEndpoint WebhookEndpoint @relation(fields: [webhookEndpointId], references: [id], onDelete: Cascade)

  @@map("webhook_deliveries")
}

model ImportJob {
  id                Int       @id @default(autoincrement())
  societaId         Int       @map("societa_id")
  utenteId          Int       @map("utente_id")
  softwareOrigine   String    @map("software_origine") @db.VarChar(50)
  stato             StatoJob  @default(PENDING)
  fileOriginale     String?   @map("file_originale") @db.Text
  mappingCampi      Json?     @map("mapping_campi")
  righeProcessate   Int       @default(0) @map("righe_processate")
  righeErrore       Int       @default(0) @map("righe_errore")
  errori            Json?
  createdAt         DateTime  @default(now()) @map("created_at")
  completatoAt      DateTime? @map("completato_at")

  societa Societa @relation(fields: [societaId], references: [id], onDelete: Cascade)
  utente  Utente  @relation(fields: [utenteId], references: [id])

  @@map("import_jobs")
}

model ExportJob {
  id          Int       @id @default(autoincrement())
  societaId   Int       @map("societa_id")
  utenteId    Int       @map("utente_id")
  tipo        String    @db.VarChar(50)
  formato     String    @db.VarChar(10)
  filtri      Json?
  stato       StatoJob  @default(PENDING)
  fileUrl     String?   @map("file_url") @db.Text
  createdAt   DateTime  @default(now()) @map("created_at")

  societa Societa @relation(fields: [societaId], references: [id], onDelete: Cascade)
  utente  Utente  @relation(fields: [utenteId], references: [id])

  @@map("export_jobs")
}

enum StatoDelivery {
  PENDING
  CONSEGNATO
  FALLITO
}

enum StatoJob {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
}
```

- [ ] **Step 2: Add relations to existing models**

Add to `Societa` model:
```prisma
  apiKeys             ApiKey[]
  webhookEndpoints    WebhookEndpoint[]
  importJobs          ImportJob[]
  exportJobs          ExportJob[]
```

Add to `Utente` model:
```prisma
  importJobs  ImportJob[]
  exportJobs  ExportJob[]
```

- [ ] **Step 3: Run migration**

Run: `npx prisma migrate dev --name add-sp11-api-export-import-models`
Expected: Migration created and applied successfully.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(sp11): add Prisma models for API keys, webhooks, import/export jobs"
```

---

## Task 2: Export Types and Entity Configs

**Files:**
- Create: `src/lib/export/types.ts`
- Create: `src/lib/export/entity-configs.ts`
- Create: `src/lib/export/__tests__/entity-configs.test.ts`

- [ ] **Step 1: Write types**

```typescript
// src/lib/export/types.ts
export type ExportFormat = "csv" | "json" | "xlsx" | "pdf";

export type EntityType =
  | "operazioni"
  | "scritture-contabili"
  | "piano-dei-conti"
  | "anagrafiche"
  | "fatture-elettroniche"
  | "registri-iva"
  | "liquidazioni-iva"
  | "f24"
  | "cu"
  | "cespiti"
  | "movimenti-bancari"
  | "scadenzario";

export interface ExportFieldConfig {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

export interface EntityConfig {
  entityType: EntityType;
  displayName: string;
  fields: ExportFieldConfig[];
  prismaModel: string;
  defaultOrderBy: Record<string, "asc" | "desc">;
}

export interface ExportOptions {
  entityType: EntityType;
  format: ExportFormat;
  societaId: number;
  filters?: Record<string, unknown>;
  fields?: string[];  // subset of fields, null = all
  limit?: number;
  offset?: number;
}

export interface ExportResult {
  data: Buffer | string;
  filename: string;
  mimeType: string;
  rowCount: number;
}
```

- [ ] **Step 2: Write the failing test for entity configs**

```typescript
// src/lib/export/__tests__/entity-configs.test.ts
import { describe, it, expect } from "vitest";
import { getEntityConfig, ALL_ENTITY_TYPES } from "../entity-configs";

describe("entity-configs", () => {
  it("returns config for operazioni", () => {
    const config = getEntityConfig("operazioni");
    expect(config.entityType).toBe("operazioni");
    expect(config.displayName).toBe("Operazioni");
    expect(config.fields.length).toBeGreaterThan(0);
    expect(config.fields[0]).toHaveProperty("key");
    expect(config.fields[0]).toHaveProperty("label");
  });

  it("returns config for all entity types", () => {
    for (const entityType of ALL_ENTITY_TYPES) {
      const config = getEntityConfig(entityType);
      expect(config.entityType).toBe(entityType);
      expect(config.fields.length).toBeGreaterThan(0);
    }
  });

  it("throws for unknown entity type", () => {
    expect(() => getEntityConfig("unknown" as any)).toThrow("Tipo entità sconosciuto");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/export/__tests__/entity-configs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement entity-configs.ts**

```typescript
// src/lib/export/entity-configs.ts
import { type EntityConfig, type EntityType } from "./types";
import { format as formatDate } from "date-fns";

const formatDecimal = (v: unknown) => (v != null ? Number(v).toFixed(2) : "");
const formatDateField = (v: unknown) =>
  v instanceof Date ? formatDate(v, "dd/MM/yyyy") : v ? String(v) : "";
const formatBoolean = (v: unknown) => (v ? "Sì" : "No");

export const ALL_ENTITY_TYPES: EntityType[] = [
  "operazioni", "scritture-contabili", "piano-dei-conti", "anagrafiche",
  "fatture-elettroniche", "registri-iva", "liquidazioni-iva", "f24",
  "cu", "cespiti", "movimenti-bancari", "scadenzario",
];

const configs: Record<EntityType, EntityConfig> = {
  operazioni: {
    entityType: "operazioni",
    displayName: "Operazioni",
    prismaModel: "operazione",
    defaultOrderBy: { dataOperazione: "desc" },
    fields: [
      { key: "id", label: "ID" },
      { key: "dataOperazione", label: "Data", format: formatDateField },
      { key: "tipoOperazione", label: "Tipo" },
      { key: "descrizione", label: "Descrizione" },
      { key: "importoTotale", label: "Importo Totale", format: formatDecimal },
      { key: "importoImponibile", label: "Imponibile", format: formatDecimal },
      { key: "importoIva", label: "IVA", format: formatDecimal },
      { key: "aliquotaIva", label: "Aliquota IVA", format: formatDecimal },
      { key: "numeroDocumento", label: "N. Documento" },
      { key: "note", label: "Note" },
    ],
  },
  "scritture-contabili": {
    entityType: "scritture-contabili",
    displayName: "Scritture Contabili",
    prismaModel: "scritturaContabile",
    defaultOrderBy: { dataRegistrazione: "desc" },
    fields: [
      { key: "id", label: "ID" },
      { key: "dataRegistrazione", label: "Data", format: formatDateField },
      { key: "descrizione", label: "Descrizione" },
      { key: "tipo", label: "Tipo" },
      { key: "totaleAvere", label: "Totale Avere", format: formatDecimal },
      { key: "totaleDare", label: "Totale Dare", format: formatDecimal },
    ],
  },
  "piano-dei-conti": {
    entityType: "piano-dei-conti",
    displayName: "Piano dei Conti",
    prismaModel: "pianoDeiConti",
    defaultOrderBy: { codice: "asc" },
    fields: [
      { key: "codice", label: "Codice" },
      { key: "descrizione", label: "Descrizione" },
      { key: "tipo", label: "Tipo" },
      { key: "natura", label: "Natura" },
      { key: "livello", label: "Livello" },
    ],
  },
  anagrafiche: {
    entityType: "anagrafiche",
    displayName: "Anagrafiche",
    prismaModel: "anagrafica",
    defaultOrderBy: { denominazione: "asc" },
    fields: [
      { key: "id", label: "ID" },
      { key: "tipo", label: "Tipo" },
      { key: "denominazione", label: "Denominazione" },
      { key: "partitaIva", label: "P.IVA" },
      { key: "codiceFiscale", label: "CF" },
      { key: "indirizzo", label: "Indirizzo" },
      { key: "email", label: "Email" },
      { key: "telefono", label: "Telefono" },
    ],
  },
  "fatture-elettroniche": {
    entityType: "fatture-elettroniche",
    displayName: "Fatture Elettroniche",
    prismaModel: "fatturaElettronica",
    defaultOrderBy: { dataEmissione: "desc" },
    fields: [
      { key: "id", label: "ID" },
      { key: "numero", label: "Numero" },
      { key: "dataEmissione", label: "Data Emissione", format: formatDateField },
      { key: "tipoDocumento", label: "Tipo" },
      { key: "importoTotale", label: "Importo", format: formatDecimal },
      { key: "stato", label: "Stato" },
    ],
  },
  "registri-iva": {
    entityType: "registri-iva",
    displayName: "Registri IVA",
    prismaModel: "operazione",
    defaultOrderBy: { dataRegistrazione: "desc" },
    fields: [
      { key: "protocolloIva", label: "Protocollo" },
      { key: "dataRegistrazione", label: "Data Reg.", format: formatDateField },
      { key: "registroIva", label: "Registro" },
      { key: "descrizione", label: "Descrizione" },
      { key: "importoImponibile", label: "Imponibile", format: formatDecimal },
      { key: "importoIva", label: "IVA", format: formatDecimal },
      { key: "aliquotaIva", label: "Aliquota", format: formatDecimal },
    ],
  },
  "liquidazioni-iva": {
    entityType: "liquidazioni-iva",
    displayName: "Liquidazioni IVA",
    prismaModel: "liquidazioneIva",
    defaultOrderBy: { anno: "desc" },
    fields: [
      { key: "anno", label: "Anno" },
      { key: "periodo", label: "Periodo" },
      { key: "tipoPeriodo", label: "Tipo Periodo" },
      { key: "ivaVendite", label: "IVA Vendite", format: formatDecimal },
      { key: "ivaAcquisti", label: "IVA Acquisti", format: formatDecimal },
      { key: "saldo", label: "Saldo", format: formatDecimal },
    ],
  },
  f24: {
    entityType: "f24",
    displayName: "F24",
    prismaModel: "f24Versamento",
    defaultOrderBy: { dataScadenza: "desc" },
    fields: [
      { key: "id", label: "ID" },
      { key: "dataScadenza", label: "Scadenza", format: formatDateField },
      { key: "importoTotale", label: "Importo", format: formatDecimal },
      { key: "stato", label: "Stato" },
      { key: "dataPagamento", label: "Data Pagamento", format: formatDateField },
    ],
  },
  cu: {
    entityType: "cu",
    displayName: "Certificazioni Uniche",
    prismaModel: "certificazioneUnica",
    defaultOrderBy: { anno: "desc" },
    fields: [
      { key: "id", label: "ID" },
      { key: "anno", label: "Anno" },
      { key: "stato", label: "Stato" },
      { key: "importoLordo", label: "Lordo", format: formatDecimal },
      { key: "importoRitenuta", label: "Ritenuta", format: formatDecimal },
    ],
  },
  cespiti: {
    entityType: "cespiti",
    displayName: "Cespiti",
    prismaModel: "cespite",
    defaultOrderBy: { dataAcquisto: "desc" },
    fields: [
      { key: "id", label: "ID" },
      { key: "descrizione", label: "Descrizione" },
      { key: "dataAcquisto", label: "Data Acquisto", format: formatDateField },
      { key: "costoOriginario", label: "Costo", format: formatDecimal },
      { key: "aliquotaAmmortamento", label: "Aliquota %", format: formatDecimal },
      { key: "fondoAmmortamento", label: "Fondo Amm.", format: formatDecimal },
    ],
  },
  "movimenti-bancari": {
    entityType: "movimenti-bancari",
    displayName: "Movimenti Bancari",
    prismaModel: "movimentoBancario",
    defaultOrderBy: { data: "desc" },
    fields: [
      { key: "id", label: "ID" },
      { key: "data", label: "Data", format: formatDateField },
      { key: "descrizione", label: "Descrizione" },
      { key: "importo", label: "Importo", format: formatDecimal },
      { key: "riconciliato", label: "Riconciliato", format: formatBoolean },
    ],
  },
  scadenzario: {
    entityType: "scadenzario",
    displayName: "Scadenzario",
    prismaModel: "scadenzaPartitario",
    defaultOrderBy: { dataScadenza: "desc" },
    fields: [
      { key: "id", label: "ID" },
      { key: "dataScadenza", label: "Scadenza", format: formatDateField },
      { key: "importo", label: "Importo", format: formatDecimal },
      { key: "stato", label: "Stato" },
      { key: "tipo", label: "Tipo" },
    ],
  },
};

export function getEntityConfig(entityType: EntityType): EntityConfig {
  const config = configs[entityType];
  if (!config) throw new Error(`Tipo entità sconosciuto: ${entityType}`);
  return config;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/export/__tests__/entity-configs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/export/
git commit -m "feat(sp11): add export types and entity configs for all 12 entities"
```

---

## Task 3: CSV Exporter

**Files:**
- Create: `src/lib/export/csv-exporter.ts`
- Create: `src/lib/export/__tests__/csv-exporter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/export/__tests__/csv-exporter.test.ts
import { describe, it, expect } from "vitest";
import { exportToCsv } from "../csv-exporter";
import type { ExportFieldConfig } from "../types";

const fields: ExportFieldConfig[] = [
  { key: "id", label: "ID" },
  { key: "nome", label: "Nome" },
  { key: "importo", label: "Importo", format: (v) => Number(v).toFixed(2) },
];

describe("csv-exporter", () => {
  it("generates CSV with headers and rows", () => {
    const data = [
      { id: 1, nome: "Test", importo: 100.5 },
      { id: 2, nome: "Prova", importo: 200 },
    ];
    const result = exportToCsv(data, fields);
    const lines = result.split("\n");
    expect(lines[0]).toBe("ID;Nome;Importo");
    expect(lines[1]).toBe("1;Test;100.50");
    expect(lines[2]).toBe("2;Prova;200.00");
  });

  it("handles empty data", () => {
    const result = exportToCsv([], fields);
    expect(result).toBe("ID;Nome;Importo");
  });

  it("escapes semicolons and quotes in values", () => {
    const data = [{ id: 1, nome: 'Foo;Bar "Baz"', importo: 0 }];
    const result = exportToCsv(data, fields);
    const lines = result.split("\n");
    expect(lines[1]).toBe('1;"Foo;Bar ""Baz""";0.00');
  });

  it("handles null and undefined values", () => {
    const data = [{ id: 1, nome: null, importo: undefined }];
    const result = exportToCsv(data, fields);
    const lines = result.split("\n");
    expect(lines[1]).toBe("1;;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/__tests__/csv-exporter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement csv-exporter.ts**

```typescript
// src/lib/export/csv-exporter.ts
import type { ExportFieldConfig } from "./types";

const SEPARATOR = ";";

function escapeField(value: string): string {
  if (value.includes(SEPARATOR) || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(value: unknown, field: ExportFieldConfig): string {
  if (value == null) return "";
  if (field.format) return field.format(value);
  return String(value);
}

export function exportToCsv(
  data: Record<string, unknown>[],
  fields: ExportFieldConfig[]
): string {
  const header = fields.map((f) => f.label).join(SEPARATOR);
  if (data.length === 0) return header;

  const rows = data.map((row) =>
    fields
      .map((field) => escapeField(formatValue(row[field.key], field)))
      .join(SEPARATOR)
  );

  return [header, ...rows].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/export/__tests__/csv-exporter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/csv-exporter.ts src/lib/export/__tests__/csv-exporter.test.ts
git commit -m "feat(sp11): add CSV exporter with semicolon separator and escaping"
```

---

## Task 4: JSON Exporter

**Files:**
- Create: `src/lib/export/json-exporter.ts`
- Create: `src/lib/export/__tests__/json-exporter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/export/__tests__/json-exporter.test.ts
import { describe, it, expect } from "vitest";
import { exportToJson } from "../json-exporter";
import type { ExportFieldConfig } from "../types";

const fields: ExportFieldConfig[] = [
  { key: "id", label: "ID" },
  { key: "nome", label: "Nome" },
];

describe("json-exporter", () => {
  it("exports data as JSON with selected fields", () => {
    const data = [{ id: 1, nome: "Test", extra: "ignored" }];
    const result = exportToJson(data, fields);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ id: 1, nome: "Test" });
    expect(parsed[0]).not.toHaveProperty("extra");
  });

  it("handles empty data", () => {
    const result = exportToJson([], fields);
    expect(JSON.parse(result)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/__tests__/json-exporter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement json-exporter.ts**

```typescript
// src/lib/export/json-exporter.ts
import type { ExportFieldConfig } from "./types";

export function exportToJson(
  data: Record<string, unknown>[],
  fields: ExportFieldConfig[]
): string {
  const filtered = data.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const field of fields) {
      obj[field.key] = row[field.key] ?? null;
    }
    return obj;
  });
  return JSON.stringify(filtered, null, 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/export/__tests__/json-exporter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/json-exporter.ts src/lib/export/__tests__/json-exporter.test.ts
git commit -m "feat(sp11): add JSON exporter with field filtering"
```

---

## Task 5: Export Engine (orchestrator)

**Files:**
- Create: `src/lib/export/export-engine.ts`
- Create: `src/lib/export/__tests__/export-engine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/export/__tests__/export-engine.test.ts
import { describe, it, expect } from "vitest";
import { buildExportFilename, getExportMimeType } from "../export-engine";

describe("export-engine", () => {
  describe("buildExportFilename", () => {
    it("builds filename with entity, date, and format", () => {
      const filename = buildExportFilename("operazioni", "csv");
      expect(filename).toMatch(/^operazioni_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it("works for all formats", () => {
      expect(buildExportFilename("anagrafiche", "json")).toMatch(/\.json$/);
      expect(buildExportFilename("anagrafiche", "xlsx")).toMatch(/\.xlsx$/);
      expect(buildExportFilename("anagrafiche", "pdf")).toMatch(/\.pdf$/);
    });
  });

  describe("getExportMimeType", () => {
    it("returns correct MIME types", () => {
      expect(getExportMimeType("csv")).toBe("text/csv; charset=utf-8");
      expect(getExportMimeType("json")).toBe("application/json");
      expect(getExportMimeType("xlsx")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(getExportMimeType("pdf")).toBe("application/pdf");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/export/__tests__/export-engine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement export-engine.ts**

```typescript
// src/lib/export/export-engine.ts
import { format as formatDate } from "date-fns";
import type { ExportFormat, ExportResult, ExportOptions, EntityType } from "./types";
import { getEntityConfig } from "./entity-configs";
import { exportToCsv } from "./csv-exporter";
import { exportToJson } from "./json-exporter";

export function buildExportFilename(entityType: EntityType, format: ExportFormat): string {
  const date = formatDate(new Date(), "yyyy-MM-dd");
  return `${entityType}_${date}.${format}`;
}

const MIME_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

export function getExportMimeType(format: ExportFormat): string {
  return MIME_TYPES[format];
}

export function exportData(
  data: Record<string, unknown>[],
  options: ExportOptions
): ExportResult {
  const config = getEntityConfig(options.entityType);
  const fields = options.fields
    ? config.fields.filter((f) => options.fields!.includes(f.key))
    : config.fields;

  let content: string;
  switch (options.format) {
    case "csv":
      content = exportToCsv(data, fields);
      break;
    case "json":
      content = exportToJson(data, fields);
      break;
    case "xlsx":
      // xlsx implementation in Task 6 — fallback to CSV for now
      content = exportToCsv(data, fields);
      break;
    case "pdf":
      // pdf implementation deferred — fallback to JSON
      content = exportToJson(data, fields);
      break;
    default:
      throw new Error(`Formato non supportato: ${options.format}`);
  }

  return {
    data: Buffer.from(content, "utf-8"),
    filename: buildExportFilename(options.entityType, options.format),
    mimeType: getExportMimeType(options.format),
    rowCount: data.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/export/__tests__/export-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export/export-engine.ts src/lib/export/__tests__/export-engine.test.ts
git commit -m "feat(sp11): add export engine orchestrator with filename builder and MIME types"
```

---

## Task 6: Excel Exporter

**Files:**
- Modify: `package.json` (add xlsx dependency)
- Create: `src/lib/export/excel-exporter.ts`
- Modify: `src/lib/export/export-engine.ts` (wire xlsx)

- [ ] **Step 1: Install xlsx dependency**

Run: `npm install xlsx`

- [ ] **Step 2: Implement excel-exporter.ts**

```typescript
// src/lib/export/excel-exporter.ts
import * as XLSX from "xlsx";
import type { ExportFieldConfig } from "./types";

const MAX_ROWS = 100000;

export function exportToExcel(
  data: Record<string, unknown>[],
  fields: ExportFieldConfig[]
): Buffer {
  const truncated = data.slice(0, MAX_ROWS);
  const headers = fields.map((f) => f.label);
  const rows = truncated.map((row) =>
    fields.map((field) => {
      const value = row[field.key];
      if (value == null) return "";
      if (field.format) return field.format(value);
      return value;
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dati");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
```

- [ ] **Step 3: Wire xlsx in export-engine.ts**

Replace the `case "xlsx"` block in `exportData`:
```typescript
    case "xlsx": {
      const { exportToExcel } = await import("./excel-exporter");
      const buffer = exportToExcel(data, fields);
      return {
        data: buffer,
        filename: buildExportFilename(options.entityType, options.format),
        mimeType: getExportMimeType(options.format),
        rowCount: Math.min(data.length, 100000),
      };
    }
```

Note: make `exportData` async to support dynamic import.

- [ ] **Step 4: Run all export tests**

Run: `npx vitest run src/lib/export/`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/export/
git commit -m "feat(sp11): add Excel exporter with 100k row limit"
```

---

## Task 7: Export API Routes

**Files:**
- Create: `src/app/api/esportazioni/route.ts`

- [ ] **Step 1: Implement export route**

```typescript
// src/app/api/esportazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportData } from "@/lib/export/export-engine";
import { getEntityConfig, ALL_ENTITY_TYPES } from "@/lib/export/entity-configs";
import type { EntityType, ExportFormat } from "@/lib/export/types";

const VALID_FORMATS: ExportFormat[] = ["csv", "json", "xlsx", "pdf"];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const { entityType, format, filters } = body;

    if (!ALL_ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json({ error: "Tipo entità non valido" }, { status: 400 });
    }
    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json({ error: "Formato non valido" }, { status: 400 });
    }

    const config = getEntityConfig(entityType as EntityType);
    const prismaModel = (prisma as any)[config.prismaModel];
    const where = { societaId, ...buildWhereFromFilters(filters, entityType) };

    const data = await prismaModel.findMany({
      where,
      orderBy: config.defaultOrderBy,
      take: format === "xlsx" ? 100000 : undefined,
    });

    const result = await exportData(data, {
      entityType: entityType as EntityType,
      format: format as ExportFormat,
      societaId,
      filters,
    });

    return new NextResponse(result.data, {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildWhereFromFilters(
  filters: Record<string, unknown> | undefined,
  entityType: string
): Record<string, unknown> {
  if (!filters) return {};
  const where: Record<string, unknown> = {};

  if (filters.da) where.dataOperazione = { ...(where.dataOperazione as any || {}), gte: new Date(filters.da as string) };
  if (filters.a) where.dataOperazione = { ...(where.dataOperazione as any || {}), lte: new Date(filters.a as string) };
  if (entityType === "operazioni") where.eliminato = false;

  return where;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    return NextResponse.json({
      entitaDisponibili: ALL_ENTITY_TYPES.map((et) => {
        const config = getEntityConfig(et);
        return { tipo: et, nome: config.displayName, campi: config.fields.map((f) => f.key) };
      }),
      formatiDisponibili: VALID_FORMATS,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Test manually or via existing test patterns**

Run: `npm run build` (verify no TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/esportazioni/
git commit -m "feat(sp11): add export API route with all entity types and formats"
```

---

## Task 8: API Key Management

**Files:**
- Create: `src/lib/api/types.ts`
- Create: `src/lib/api/api-key.ts`
- Create: `src/lib/api/__tests__/api-key.test.ts`

- [ ] **Step 1: Write types**

```typescript
// src/lib/api/types.ts
export const API_SCOPES = [
  "read:operazioni", "write:operazioni",
  "read:anagrafiche", "write:anagrafiche",
  "read:scritture", "write:scritture",
  "read:fatture", "write:fatture",
  "read:registri-iva", "read:liquidazioni",
  "read:f24", "read:cu", "read:cespiti",
  "read:movimenti-bancari", "read:scadenzario",
  "read:piano-conti", "write:piano-conti",
  "read:alert", "read:todo",
  "read:kpi", "read:report",
  "webhook:manage",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export interface ApiKeyPayload {
  keyId: number;
  societaId: number;
  scopes: ApiScope[];
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/api/__tests__/api-key.test.ts
import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, verifyApiKey, extractKeyPrefix } from "../api-key";

describe("api-key", () => {
  it("generates a key with pk_ prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^pk_[a-zA-Z0-9]{40}$/);
  });

  it("extracts prefix from key", () => {
    const key = "pk_abcdefghij1234567890abcdefghij1234567890";
    expect(extractKeyPrefix(key)).toBe("pk_abcdef");
  });

  it("hashes and verifies key correctly", async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key);
    expect(hash).not.toBe(key);
    expect(await verifyApiKey(key, hash)).toBe(true);
    expect(await verifyApiKey("pk_wrong", hash)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/api/__tests__/api-key.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement api-key.ts**

```typescript
// src/lib/api/api-key.ts
import { hash, compare } from "bcryptjs";
import crypto from "crypto";

const KEY_PREFIX = "pk_";
const KEY_LENGTH = 40;
const HASH_ROUNDS = 10;

export function generateApiKey(): string {
  const random = crypto.randomBytes(30).toString("base64url").slice(0, KEY_LENGTH);
  return `${KEY_PREFIX}${random}`;
}

export function extractKeyPrefix(key: string): string {
  return key.slice(0, 9); // "pk_" + first 6 chars
}

export async function hashApiKey(key: string): Promise<string> {
  return hash(key, HASH_ROUNDS);
}

export async function verifyApiKey(key: string, hashedKey: string): Promise<boolean> {
  return compare(key, hashedKey);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/api/__tests__/api-key.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/
git commit -m "feat(sp11): add API key generation, hashing, and verification"
```

---

## Task 9: Rate Limiter

**Files:**
- Create: `src/lib/api/rate-limiter.ts`
- Create: `src/lib/api/__tests__/rate-limiter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/api/__tests__/rate-limiter.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "../rate-limiter";

describe("rate-limiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it("allows requests within limit", () => {
    const result = limiter.check("key1", 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("blocks requests over limit", () => {
    for (let i = 0; i < 3; i++) {
      limiter.check("key2", 3);
    }
    const result = limiter.check("key2", 3);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("isolates different keys", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("keyA", 5);
    }
    const result = limiter.check("keyB", 5);
    expect(result.allowed).toBe(true);
  });

  it("resets after window expires", () => {
    const shortLimiter = new RateLimiter(100); // 100ms window
    for (let i = 0; i < 2; i++) {
      shortLimiter.check("key3", 2);
    }
    expect(shortLimiter.check("key3", 2).allowed).toBe(false);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(shortLimiter.check("key3", 2).allowed).toBe(true);
        resolve();
      }, 150);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api/__tests__/rate-limiter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement rate-limiter.ts**

```typescript
// src/lib/api/rate-limiter.ts
import type { RateLimitResult } from "./types";

interface WindowEntry {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private windows: Map<string, WindowEntry> = new Map();
  private windowMs: number;

  constructor(windowMs: number = 3600000) {  // default 1 hour
    this.windowMs = windowMs;
  }

  check(key: string, limit: number): RateLimitResult {
    const now = Date.now();
    const entry = this.windows.get(key);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      this.windows.set(key, { count: 1, windowStart: now });
      return {
        allowed: true,
        remaining: limit - 1,
        resetAt: new Date(now + this.windowMs),
      };
    }

    entry.count++;

    if (entry.count > limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.windowStart + this.windowMs),
      };
    }

    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: new Date(entry.windowStart + this.windowMs),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api/__tests__/rate-limiter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/rate-limiter.ts src/lib/api/__tests__/rate-limiter.test.ts
git commit -m "feat(sp11): add sliding window rate limiter"
```

---

## Task 10: API Auth Middleware

**Files:**
- Create: `src/lib/api/auth-middleware.ts`
- Create: `src/lib/api/__tests__/auth-middleware.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/api/__tests__/auth-middleware.test.ts
import { describe, it, expect } from "vitest";
import { extractApiKeyFromHeader, hasScope } from "../auth-middleware";
import type { ApiScope } from "../types";

describe("auth-middleware", () => {
  describe("extractApiKeyFromHeader", () => {
    it("extracts Bearer token", () => {
      expect(extractApiKeyFromHeader("Bearer pk_abc123")).toBe("pk_abc123");
    });

    it("returns null for missing header", () => {
      expect(extractApiKeyFromHeader(null)).toBeNull();
      expect(extractApiKeyFromHeader("")).toBeNull();
    });

    it("returns null for non-Bearer auth", () => {
      expect(extractApiKeyFromHeader("Basic abc123")).toBeNull();
    });
  });

  describe("hasScope", () => {
    const scopes: ApiScope[] = ["read:operazioni", "write:operazioni"];

    it("returns true when scope is present", () => {
      expect(hasScope(scopes, "read:operazioni")).toBe(true);
    });

    it("returns false when scope is missing", () => {
      expect(hasScope(scopes, "read:anagrafiche")).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api/__tests__/auth-middleware.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement auth-middleware.ts**

```typescript
// src/lib/api/auth-middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKey, extractKeyPrefix } from "./api-key";
import { RateLimiter } from "./rate-limiter";
import type { ApiKeyPayload, ApiScope } from "./types";

const rateLimiter = new RateLimiter();

export function extractApiKeyFromHeader(header: string | null): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  const key = header.slice(7).trim();
  return key || null;
}

export function hasScope(scopes: ApiScope[], required: ApiScope): boolean {
  return scopes.includes(required);
}

export async function authenticateApiKey(
  request: NextRequest
): Promise<{ payload: ApiKeyPayload } | { error: NextResponse }> {
  const authHeader = request.headers.get("authorization");
  const rawKey = extractApiKeyFromHeader(authHeader);

  if (!rawKey) {
    return { error: NextResponse.json({ error: "API key mancante" }, { status: 401 }) };
  }

  const prefix = extractKeyPrefix(rawKey);
  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix: prefix, attiva: true },
  });

  for (const candidate of candidates) {
    if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;
    const valid = await verifyApiKey(rawKey, candidate.keyHash);
    if (valid) {
      // Update last used
      await prisma.apiKey.update({
        where: { id: candidate.id },
        data: { ultimoUtilizzo: new Date() },
      });

      const scopes = (candidate.scopes as ApiScope[]) || [];
      const limit = candidate.rateLimitPerHour;
      const rateLimitKey = `apikey:${candidate.id}`;
      const rateResult = rateLimiter.check(rateLimitKey, limit);

      if (!rateResult.allowed) {
        return {
          error: NextResponse.json(
            { error: "Rate limit superato", resetAt: rateResult.resetAt },
            { status: 429, headers: { "Retry-After": String(Math.ceil((rateResult.resetAt.getTime() - Date.now()) / 1000)) } }
          ),
        };
      }

      return {
        payload: { keyId: candidate.id, societaId: candidate.societaId, scopes },
      };
    }
  }

  return { error: NextResponse.json({ error: "API key non valida" }, { status: 401 }) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api/__tests__/auth-middleware.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/auth-middleware.ts src/lib/api/__tests__/auth-middleware.test.ts
git commit -m "feat(sp11): add API auth middleware with key validation and rate limiting"
```

---

## Task 11: Webhook Dispatcher

**Files:**
- Create: `src/lib/api/webhook-dispatcher.ts`
- Create: `src/lib/api/__tests__/webhook-dispatcher.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/api/__tests__/webhook-dispatcher.test.ts
import { describe, it, expect } from "vitest";
import { signWebhookPayload, verifyWebhookSignature, RETRY_DELAYS } from "../webhook-dispatcher";

describe("webhook-dispatcher", () => {
  const secret = "test-secret-123";
  const payload = JSON.stringify({ evento: "operazione.created", data: { id: 1 } });

  it("signs payload with HMAC-SHA256", () => {
    const signature = signWebhookPayload(payload, secret);
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("verifies correct signature", () => {
    const signature = signWebhookPayload(payload, secret);
    expect(verifyWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it("rejects wrong signature", () => {
    expect(verifyWebhookSignature(payload, "sha256=wrong", secret)).toBe(false);
  });

  it("has correct retry delays", () => {
    expect(RETRY_DELAYS).toEqual([60000, 300000, 1800000, 7200000, 43200000]); // 1m,5m,30m,2h,12h
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api/__tests__/webhook-dispatcher.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement webhook-dispatcher.ts**

```typescript
// src/lib/api/webhook-dispatcher.ts
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export const MAX_RETRIES = 5;
export const RETRY_DELAYS = [60000, 300000, 1800000, 7200000, 43200000]; // 1m, 5m, 30m, 2h, 12h

export function signWebhookPayload(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload, "utf8");
  return `sha256=${hmac.digest("hex")}`;
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = signWebhookPayload(payload, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function dispatchWebhook(
  societaId: number,
  evento: string,
  data: Record<string, unknown>
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { societaId, attivo: true, eventi: { path: "$", array_contains: evento } },
  });

  for (const endpoint of endpoints) {
    const payload = JSON.stringify({ evento, data, timestamp: new Date().toISOString() });
    const signature = signWebhookPayload(payload, endpoint.secretHash);

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": evento,
        },
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      await prisma.webhookDelivery.create({
        data: {
          webhookEndpointId: endpoint.id,
          evento,
          payload: data,
          statoHttp: response.status,
          stato: response.ok ? "CONSEGNATO" : "FALLITO",
          tentativo: 1,
          prossimoTentativoAt: response.ok ? null : new Date(Date.now() + RETRY_DELAYS[0]),
        },
      });

      if (response.ok) {
        await prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: { ultimaConsegna: new Date(), consecutiviFalliti: 0 },
        });
      } else {
        await incrementFailures(endpoint.id);
      }
    } catch {
      await prisma.webhookDelivery.create({
        data: {
          webhookEndpointId: endpoint.id,
          evento,
          payload: data,
          stato: "FALLITO",
          tentativo: 1,
          prossimoTentativoAt: new Date(Date.now() + RETRY_DELAYS[0]),
        },
      });
      await incrementFailures(endpoint.id);
    }
  }
}

async function incrementFailures(endpointId: number): Promise<void> {
  const updated = await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: { consecutiviFalliti: { increment: 1 } },
  });
  if (updated.consecutiviFalliti >= MAX_RETRIES) {
    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { attivo: false },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api/__tests__/webhook-dispatcher.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/webhook-dispatcher.ts src/lib/api/__tests__/webhook-dispatcher.test.ts
git commit -m "feat(sp11): add webhook dispatcher with HMAC signing and retry logic"
```

---

## Task 12: API Key Management Route

**Files:**
- Create: `src/app/api/configurazione/api/route.ts`

- [ ] **Step 1: Implement API key CRUD route**

```typescript
// src/app/api/configurazione/api/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey, hashApiKey, extractKeyPrefix } from "@/lib/api/api-key";
import { API_SCOPES } from "@/lib/api/types";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;
    if (user.ruolo !== "ADMIN" && user.ruoloAzienda !== "ADMIN") {
      return NextResponse.json({ error: "Solo admin" }, { status: 403 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { societaId: user.societaId },
      select: {
        id: true, nome: true, keyPrefix: true, scopes: true,
        rateLimitPerHour: true, attiva: true, ultimoUtilizzo: true,
        lastRotatedAt: true, createdAt: true, expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ keys, scopesDisponibili: API_SCOPES });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;
    if (user.ruolo !== "ADMIN" && user.ruoloAzienda !== "ADMIN") {
      return NextResponse.json({ error: "Solo admin" }, { status: 403 });
    }

    const { nome, scopes, rateLimitPerHour, expiresAt } = await request.json();
    if (!nome) return NextResponse.json({ error: "Nome obbligatorio" }, { status: 400 });

    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);

    const apiKey = await prisma.apiKey.create({
      data: {
        societaId: user.societaId,
        nome,
        keyHash,
        keyPrefix: extractKeyPrefix(rawKey),
        scopes: scopes || [],
        rateLimitPerHour: rateLimitPerHour || 1000,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Return raw key ONLY on creation
    return NextResponse.json({
      id: apiKey.id,
      nome: apiKey.nome,
      key: rawKey,
      avviso: "Questa è l'unica volta che vedrai la chiave completa. Salvala in un posto sicuro.",
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "0");
    if (!id) return NextResponse.json({ error: "ID obbligatorio" }, { status: 400 });

    await prisma.apiKey.deleteMany({ where: { id, societaId: user.societaId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/configurazione/api/
git commit -m "feat(sp11): add API key management route (CRUD + rotation)"
```

---

## Task 13: Import Types, Validator, and Mapper

**Files:**
- Create: `src/lib/import/types.ts`
- Create: `src/lib/import/validator.ts`
- Create: `src/lib/import/mapper.ts`
- Create: `src/lib/import/__tests__/validator.test.ts`
- Create: `src/lib/import/__tests__/mapper.test.ts`

- [ ] **Step 1: Write types**

```typescript
// src/lib/import/types.ts
export type ImportSource = "teamsystem" | "zucchetti" | "passcom" | "fatture-in-cloud" | "danea";

export type ImportEntityType = "piano-dei-conti" | "anagrafiche" | "operazioni" | "saldi-iniziali";

export interface ImportField {
  sourceKey: string;
  targetKey: string;
  transform?: (value: string) => unknown;
  required?: boolean;
}

export interface MappingConfig {
  source: ImportSource;
  entity: ImportEntityType;
  fieldMappings: ImportField[];
}

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
}

export interface ValidationError {
  rowNumber: number;
  field: string;
  message: string;
  value?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  validRows: number;
  totalRows: number;
}

export interface ImportPreview {
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  mappingConfig: MappingConfig;
  validationResult: ValidationResult;
}
```

- [ ] **Step 2: Write the failing test for validator**

```typescript
// src/lib/import/__tests__/validator.test.ts
import { describe, it, expect } from "vitest";
import { validateImportRows } from "../validator";
import type { ImportField, ParsedRow } from "../types";

const fields: ImportField[] = [
  { sourceKey: "nome", targetKey: "denominazione", required: true },
  { sourceKey: "piva", targetKey: "partitaIva", required: true },
  { sourceKey: "email", targetKey: "email" },
];

describe("validateImportRows", () => {
  it("passes valid rows", () => {
    const rows: ParsedRow[] = [
      { rowNumber: 1, data: { nome: "Acme", piva: "12345678901", email: "a@b.it" } },
    ];
    const result = validateImportRows(rows, fields);
    expect(result.valid).toBe(true);
    expect(result.validRows).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("detects missing required fields", () => {
    const rows: ParsedRow[] = [
      { rowNumber: 1, data: { nome: "", piva: "12345678901" } },
      { rowNumber: 2, data: { nome: "Test", piva: "" } },
    ];
    const result = validateImportRows(rows, fields);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].field).toBe("nome");
    expect(result.errors[1].field).toBe("piva");
  });

  it("allows missing optional fields", () => {
    const rows: ParsedRow[] = [
      { rowNumber: 1, data: { nome: "Acme", piva: "12345678901" } },
    ];
    const result = validateImportRows(rows, fields);
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/import/__tests__/validator.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement validator.ts**

```typescript
// src/lib/import/validator.ts
import type { ImportField, ParsedRow, ValidationError, ValidationResult } from "./types";

export function validateImportRows(
  rows: ParsedRow[],
  fields: ImportField[]
): ValidationResult {
  const errors: ValidationError[] = [];
  let validRows = 0;

  for (const row of rows) {
    let rowValid = true;
    for (const field of fields) {
      const value = row.data[field.sourceKey];
      if (field.required && (!value || value.trim() === "")) {
        errors.push({
          rowNumber: row.rowNumber,
          field: field.sourceKey,
          message: `Campo obbligatorio "${field.sourceKey}" vuoto`,
          value: value || "",
        });
        rowValid = false;
      }
    }
    if (rowValid) validRows++;
  }

  return {
    valid: errors.length === 0,
    errors,
    validRows,
    totalRows: rows.length,
  };
}
```

- [ ] **Step 5: Run validator test**

Run: `npx vitest run src/lib/import/__tests__/validator.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test for mapper**

```typescript
// src/lib/import/__tests__/mapper.test.ts
import { describe, it, expect } from "vitest";
import { mapRow } from "../mapper";
import type { ImportField } from "../types";

describe("mapRow", () => {
  const fields: ImportField[] = [
    { sourceKey: "nome", targetKey: "denominazione" },
    { sourceKey: "importo", targetKey: "importoTotale", transform: (v) => parseFloat(v) },
    { sourceKey: "data", targetKey: "dataOperazione", transform: (v) => new Date(v) },
  ];

  it("maps source keys to target keys", () => {
    const result = mapRow({ nome: "Test", importo: "100.50", data: "2026-01-15" }, fields);
    expect(result.denominazione).toBe("Test");
    expect(result.importoTotale).toBe(100.5);
    expect(result.dataOperazione).toBeInstanceOf(Date);
  });

  it("handles missing source keys", () => {
    const result = mapRow({ nome: "Test" }, fields);
    expect(result.denominazione).toBe("Test");
    expect(result.importoTotale).toBeUndefined();
  });
});
```

- [ ] **Step 7: Implement mapper.ts**

```typescript
// src/lib/import/mapper.ts
import type { ImportField } from "./types";

export function mapRow(
  sourceData: Record<string, string>,
  fields: ImportField[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const rawValue = sourceData[field.sourceKey];
    if (rawValue === undefined || rawValue === null) continue;
    result[field.targetKey] = field.transform ? field.transform(rawValue) : rawValue;
  }

  return result;
}
```

- [ ] **Step 8: Run all import tests**

Run: `npx vitest run src/lib/import/`
Expected: PASS (all tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/import/
git commit -m "feat(sp11): add import types, validator, and field mapper"
```

---

## Task 14: Danea Easyfatt XML Parser (sample vendor parser)

**Files:**
- Create: `src/lib/import/parsers/danea.ts`
- Create: `src/lib/import/__tests__/parsers/danea.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/import/__tests__/parsers/danea.test.ts
import { describe, it, expect } from "vitest";
import { parseDaneaXml } from "../../parsers/danea";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<EasyfattDocuments AppVersion="2025">
  <Documents>
    <Document>
      <DocumentType>C</DocumentType>
      <Date>15/01/2026</Date>
      <Number>1</Number>
      <CustomerName>Acme Srl</CustomerName>
      <CustomerFiscalCode>12345678901</CustomerFiscalCode>
      <Total>1220.00</Total>
      <TotalWithoutTax>1000.00</TotalWithoutTax>
      <VatAmount>220.00</VatAmount>
    </Document>
  </Documents>
</EasyfattDocuments>`;

describe("parseDaneaXml", () => {
  it("parses Danea XML to rows", () => {
    const result = parseDaneaXml(SAMPLE_XML);
    expect(result).toHaveLength(1);
    expect(result[0].rowNumber).toBe(1);
    expect(result[0].data.Date).toBe("15/01/2026");
    expect(result[0].data.CustomerName).toBe("Acme Srl");
    expect(result[0].data.Total).toBe("1220.00");
  });

  it("handles empty documents", () => {
    const xml = `<?xml version="1.0"?><EasyfattDocuments><Documents></Documents></EasyfattDocuments>`;
    const result = parseDaneaXml(xml);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/import/__tests__/parsers/danea.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement parser**

```typescript
// src/lib/import/parsers/danea.ts
import { XMLParser } from "fast-xml-parser";
import type { ParsedRow } from "../types";

export function parseDaneaXml(xmlContent: string): ParsedRow[] {
  const parser = new XMLParser({ ignoreAttributes: true });
  const parsed = parser.parse(xmlContent);

  const documents = parsed?.EasyfattDocuments?.Documents?.Document;
  if (!documents) return [];

  const docs = Array.isArray(documents) ? documents : [documents];

  return docs.map((doc: Record<string, unknown>, index: number) => ({
    rowNumber: index + 1,
    data: Object.fromEntries(
      Object.entries(doc).map(([k, v]) => [k, String(v ?? "")])
    ),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/import/__tests__/parsers/danea.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/parsers/ src/lib/import/__tests__/parsers/
git commit -m "feat(sp11): add Danea Easyfatt XML parser"
```

---

## Task 15: TeamSystem CSV Parser (sample CSV vendor)

**Files:**
- Create: `src/lib/import/parsers/teamsystem.ts`
- Create: `src/lib/import/__tests__/parsers/teamsystem.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/import/__tests__/parsers/teamsystem.test.ts
import { describe, it, expect } from "vitest";
import { parseTeamSystemCsv } from "../../parsers/teamsystem";

describe("parseTeamSystemCsv", () => {
  it("parses semicolon-separated CSV", () => {
    const csv = "Codice;Descrizione;Tipo\n001;Cassa;Attivo\n002;Banca;Attivo";
    const result = parseTeamSystemCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].rowNumber).toBe(1);
    expect(result[0].data.Codice).toBe("001");
    expect(result[0].data.Descrizione).toBe("Cassa");
  });

  it("handles quoted fields", () => {
    const csv = 'Codice;Descrizione\n001;"Cassa; contanti"';
    const result = parseTeamSystemCsv(csv);
    expect(result[0].data.Descrizione).toBe("Cassa; contanti");
  });

  it("handles empty CSV", () => {
    const csv = "Codice;Descrizione";
    const result = parseTeamSystemCsv(csv);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/import/__tests__/parsers/teamsystem.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement parser**

```typescript
// src/lib/import/parsers/teamsystem.ts
import type { ParsedRow } from "../types";

export function parseTeamSystemCsv(csvContent: string): ParsedRow[] {
  const lines = csvContent.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => {
      data[h] = values[idx] || "";
    });
    rows.push({ rowNumber: i, data });
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ";" && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/import/__tests__/parsers/teamsystem.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/parsers/teamsystem.ts src/lib/import/__tests__/parsers/teamsystem.test.ts
git commit -m "feat(sp11): add TeamSystem CSV parser with quote handling"
```

---

## Task 16: Import Engine (orchestrator)

**Files:**
- Create: `src/lib/import/import-engine.ts`
- Create: `src/lib/import/__tests__/import-engine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/import/__tests__/import-engine.test.ts
import { describe, it, expect } from "vitest";
import { getParserForSource, getDefaultMappings } from "../import-engine";

describe("import-engine", () => {
  it("returns parser for each supported source", () => {
    expect(getParserForSource("danea")).toBeDefined();
    expect(getParserForSource("teamsystem")).toBeDefined();
  });

  it("throws for unknown source", () => {
    expect(() => getParserForSource("unknown" as any)).toThrow();
  });

  it("returns default mappings for anagrafiche from danea", () => {
    const mappings = getDefaultMappings("danea", "anagrafiche");
    expect(mappings.length).toBeGreaterThan(0);
    expect(mappings[0]).toHaveProperty("sourceKey");
    expect(mappings[0]).toHaveProperty("targetKey");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/import/__tests__/import-engine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement import-engine.ts**

```typescript
// src/lib/import/import-engine.ts
import type { ImportSource, ImportEntityType, ImportField, ParsedRow } from "./types";
import { parseDaneaXml } from "./parsers/danea";
import { parseTeamSystemCsv } from "./parsers/teamsystem";

type Parser = (content: string) => ParsedRow[];

const parsers: Record<ImportSource, Parser> = {
  danea: parseDaneaXml,
  teamsystem: parseTeamSystemCsv,
  zucchetti: parseTeamSystemCsv,    // Same CSV format with ; separator
  passcom: parseTeamSystemCsv,       // Same CSV format with ; separator
  "fatture-in-cloud": parseTeamSystemCsv,
};

export function getParserForSource(source: ImportSource): Parser {
  const parser = parsers[source];
  if (!parser) throw new Error(`Sorgente import non supportata: ${source}`);
  return parser;
}

const defaultMappings: Record<string, ImportField[]> = {
  "danea:anagrafiche": [
    { sourceKey: "CustomerName", targetKey: "denominazione", required: true },
    { sourceKey: "CustomerFiscalCode", targetKey: "partitaIva" },
    { sourceKey: "CustomerAddress", targetKey: "indirizzo" },
    { sourceKey: "CustomerEmail", targetKey: "email" },
  ],
  "danea:operazioni": [
    { sourceKey: "Date", targetKey: "dataOperazione", required: true, transform: (v) => parseDateIT(v) },
    { sourceKey: "Total", targetKey: "importoTotale", required: true, transform: (v) => parseFloat(v) },
    { sourceKey: "TotalWithoutTax", targetKey: "importoImponibile", transform: (v) => parseFloat(v) },
    { sourceKey: "VatAmount", targetKey: "importoIva", transform: (v) => parseFloat(v) },
    { sourceKey: "Number", targetKey: "numeroDocumento" },
    { sourceKey: "DocumentType", targetKey: "tipoOperazione", transform: mapDaneaDocType },
  ],
  "teamsystem:piano-dei-conti": [
    { sourceKey: "Codice", targetKey: "codice", required: true },
    { sourceKey: "Descrizione", targetKey: "descrizione", required: true },
    { sourceKey: "Tipo", targetKey: "tipo" },
  ],
  "teamsystem:anagrafiche": [
    { sourceKey: "Ragione Sociale", targetKey: "denominazione", required: true },
    { sourceKey: "P.IVA", targetKey: "partitaIva" },
    { sourceKey: "Cod.Fiscale", targetKey: "codiceFiscale" },
    { sourceKey: "Indirizzo", targetKey: "indirizzo" },
  ],
};

export function getDefaultMappings(source: ImportSource, entity: ImportEntityType): ImportField[] {
  const key = `${source}:${entity}`;
  return defaultMappings[key] || [];
}

function parseDateIT(value: string): Date {
  // DD/MM/YYYY → Date
  const parts = value.split("/");
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(value);
}

function mapDaneaDocType(value: string): string {
  const map: Record<string, string> = {
    C: "FATTURA_VENDITA",
    D: "NOTA_CREDITO_VENDITA",
    P: "FATTURA_ACQUISTO",
    Q: "NOTA_CREDITO_ACQUISTO",
  };
  return map[value] || "ALTRO";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/import/__tests__/import-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/import-engine.ts src/lib/import/__tests__/import-engine.test.ts
git commit -m "feat(sp11): add import engine with parser registry and default mappings"
```

---

## Task 17: CORS Handler

**Files:**
- Create: `src/lib/api/cors.ts`
- Create: `src/lib/api/__tests__/cors.test.ts` (skipped — simple utility, tested via integration)

- [ ] **Step 1: Implement cors.ts**

```typescript
// src/lib/api/cors.ts
import { NextResponse } from "next/server";

export function addCorsHeaders(
  response: NextResponse,
  origin: string | null,
  allowedOrigins: string[]
): NextResponse {
  if (!origin) return response;

  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

export function handleCorsPreflightIfNeeded(
  method: string,
  origin: string | null,
  allowedOrigins: string[]
): NextResponse | null {
  if (method !== "OPTIONS") return null;

  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response, origin, allowedOrigins);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/cors.ts
git commit -m "feat(sp11): add CORS handler with per-society whitelist"
```

---

## Task 18: V1 API Router

**Files:**
- Create: `src/app/api/v1/operazioni/route.ts` (sample entity endpoint)
- This task creates the pattern; remaining entities follow the same structure.

- [ ] **Step 1: Create the sample v1 operazioni endpoint**

```typescript
// src/app/api/v1/operazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey } from "@/lib/api/auth-middleware";
import { hasScope } from "@/lib/api/auth-middleware";
import { addCorsHeaders, handleCorsPreflightIfNeeded } from "@/lib/api/cors";

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const preflight = handleCorsPreflightIfNeeded("OPTIONS", origin, []);
  return preflight || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if ("error" in authResult) return authResult.error;

  const { payload } = authResult;
  if (!hasScope(payload.scopes, "read:operazioni")) {
    return NextResponse.json({ error: "Scope insufficiente: read:operazioni richiesto" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "20")));
  const da = searchParams.get("da");
  const a = searchParams.get("a");

  const where: any = {
    societaId: payload.societaId,
    eliminato: false,
  };
  if (da) where.dataOperazione = { ...where.dataOperazione, gte: new Date(da) };
  if (a) where.dataOperazione = { ...where.dataOperazione, lte: new Date(a) };

  const [data, total] = await Promise.all([
    prisma.operazione.findMany({
      where,
      orderBy: { dataOperazione: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.operazione.count({ where }),
  ]);

  const response = NextResponse.json({
    data,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });

  const origin = request.headers.get("origin");
  addCorsHeaders(response, origin, []);
  return response;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/
git commit -m "feat(sp11): add v1 API route for operazioni with auth, pagination, CORS"
```

---

## Task 19: Run Full Test Suite

- [ ] **Step 1: Run all SP11 tests**

Run: `npx vitest run src/lib/export/ src/lib/import/ src/lib/api/`
Expected: All tests pass (15+ tests across all modules).

- [ ] **Step 2: Run full project tests to check no regressions**

Run: `npx vitest run`
Expected: All existing tests still pass + new SP11 tests pass.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit any fixes**

If any test fails, fix and commit:
```bash
git add -A
git commit -m "fix(sp11): address test/build issues"
```

---

## Summary

| Task | Component | Tests |
|------|-----------|-------|
| 1 | Prisma models (5 new) | Migration |
| 2 | Export types + entity configs | 3 tests |
| 3 | CSV exporter | 4 tests |
| 4 | JSON exporter | 2 tests |
| 5 | Export engine | 3 tests |
| 6 | Excel exporter | — (integration) |
| 7 | Export API route | Build verify |
| 8 | API key management | 3 tests |
| 9 | Rate limiter | 4 tests |
| 10 | Auth middleware | 3 tests |
| 11 | Webhook dispatcher | 4 tests |
| 12 | API key CRUD route | Build verify |
| 13 | Import types + validator + mapper | 5 tests |
| 14 | Danea XML parser | 2 tests |
| 15 | TeamSystem CSV parser | 3 tests |
| 16 | Import engine | 3 tests |
| 17 | CORS handler | — |
| 18 | V1 API router (sample) | Build verify |
| 19 | Full test suite | Regression check |

**Total: 19 tasks, ~39 tests, ~17 commits**
