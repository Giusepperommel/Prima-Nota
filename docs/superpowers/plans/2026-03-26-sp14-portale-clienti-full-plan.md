# SP14: Portale Clienti Full — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-featured client portal with granular permissions, contextual messaging, simplified first note (operations as drafts), enhanced document management, self-service fiscal views, and a unified commercialista inbox — consuming SP12 alerts, SP13 KPIs, and SP11 webhooks.

**Architecture:** Backend API routes under `src/app/api/portale/` using existing JWT auth from `src/lib/portale/auth.ts`. New Prisma models (MessaggioPortale, ThreadPortale, OperazionePortale, PermessoPortale, AllegatoMessaggio) integrate with existing AccessoCliente. Permission checks via `src/lib/portale/permissions.ts`. All client operations enter as drafts (commercialista validates).

**Tech Stack:** Next.js 16, Prisma 6 (MySQL), Vitest, existing JWT portal auth, existing DocumentoCondiviso model, SP12 AlertGenerato/TodoGenerato, SP13 KpiValore/ReportGeneratoBI.

**Spec:** `docs/superpowers/specs/2026-03-26-pain-point-driven-features-design.md` (section 6)

---

## File Structure

### New files
```
src/lib/portale/
  permissions.ts              — Permission checker: hasPortalePermission(accessoClienteId, sezione, azione)
  __tests__/
    permissions.test.ts

src/lib/portale/messaging/
  types.ts                    — Thread, message types
  thread-manager.ts           — Create/close threads, list by context
  message-sender.ts           — Send message, mark as read, attach files
  __tests__/
    thread-manager.test.ts
    message-sender.test.ts

src/lib/portale/operations/
  types.ts                    — OperazionePortale types (INCASSO/PAGAMENTO/FATTURA)
  operation-handler.ts        — Create draft operations, validate, approve/reject
  __tests__/
    operation-handler.test.ts

src/app/api/portale/messaggi/route.ts                  — List messages / send message
src/app/api/portale/messaggi/thread/route.ts           — Create/list threads
src/app/api/portale/messaggi/thread/[id]/route.ts      — Thread detail + messages
src/app/api/portale/operazioni/route.ts                — Create/list portal operations
src/app/api/portale/operazioni/[id]/route.ts           — Get/validate operation
src/app/api/portale/kpi/route.ts                       — Client KPI dashboard
src/app/api/portale/fiscale/route.ts                   — Self-service fiscal data
src/app/api/portale/permessi/route.ts                  — Manage permissions (commercialista)
src/app/api/portale/inbox/route.ts                     — Commercialista unified inbox
```

### Modified files
```
prisma/schema.prisma  — Add 5 new models + 4 enums, relations to AccessoCliente/Societa
```

---

## Task 1: Prisma Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and 5 new models to schema.prisma**

Add at the end of the schema file:

```prisma
enum MittenteTipoPortale {
  CLIENTE
  COMMERCIALISTA
}

enum ContestoTipoPortale {
  DOCUMENTO
  SCADENZA
  OPERAZIONE
  ALERT
  LIBERO
}

enum StatoThread {
  APERTO
  CHIUSO
}

enum StatoOperazionePortale {
  BOZZA
  VALIDATA
  RIFIUTATA
}

enum TipoOperazionePortale {
  INCASSO
  PAGAMENTO
  FATTURA
}

enum SezionePortale {
  KPI
  PRIMA_NOTA
  DOCUMENTI
  CHAT
  IVA
  SCADENZARIO
  FATTURE
  F24
  BILANCIO
  REPORT
}

model ThreadPortale {
  id                  Int                  @id @default(autoincrement())
  societaId           Int                  @map("societa_id")
  accessoClienteId    Int                  @map("accesso_cliente_id")
  oggetto             String               @db.VarChar(255)
  contestoTipo        ContestoTipoPortale? @map("contesto_tipo")
  contestoId          Int?                 @map("contesto_id")
  stato               StatoThread          @default(APERTO)
  createdAt           DateTime             @default(now()) @map("created_at")
  ultimoMessaggioAt   DateTime?            @map("ultimo_messaggio_at")

  societa             Societa              @relation(fields: [societaId], references: [id], onDelete: Cascade)
  accessoCliente      AccessoCliente       @relation(fields: [accessoClienteId], references: [id])
  messaggi            MessaggioPortale[]

  @@index([societaId, accessoClienteId])
  @@index([societaId, stato])
  @@map("thread_portale")
}

model MessaggioPortale {
  id                  Int                  @id @default(autoincrement())
  societaId           Int                  @map("societa_id")
  threadId            Int                  @map("thread_id")
  accessoClienteId    Int                  @map("accesso_cliente_id")
  mittenteTipo        MittenteTipoPortale  @map("mittente_tipo")
  mittenteId          Int                  @map("mittente_id")
  testo               String               @db.Text
  letto               Boolean              @default(false)
  lettoAt             DateTime?            @map("letto_at")
  createdAt           DateTime             @default(now()) @map("created_at")

  societa             Societa              @relation(fields: [societaId], references: [id], onDelete: Cascade)
  thread              ThreadPortale        @relation(fields: [threadId], references: [id], onDelete: Cascade)
  accessoCliente      AccessoCliente       @relation(fields: [accessoClienteId], references: [id])
  allegati            AllegatoMessaggio[]

  @@index([threadId, createdAt])
  @@index([societaId, letto])
  @@map("messaggi_portale")
}

model AllegatoMessaggio {
  id                  Int                  @id @default(autoincrement())
  messaggioId         Int                  @map("messaggio_id")
  nome                String               @db.VarChar(255)
  mimeType            String               @map("mime_type") @db.VarChar(100)
  dimensione          Int
  fileUrl             String               @map("file_url") @db.Text
  documentoCondivisoId Int?                @map("documento_condiviso_id")
  createdAt           DateTime             @default(now()) @map("created_at")

  messaggio           MessaggioPortale     @relation(fields: [messaggioId], references: [id], onDelete: Cascade)
  documentoCondiviso  DocumentoCondiviso?  @relation(fields: [documentoCondivisoId], references: [id])

  @@map("allegati_messaggio")
}

model OperazionePortale {
  id                  Int                       @id @default(autoincrement())
  societaId           Int                       @map("societa_id")
  accessoClienteId    Int                       @map("accesso_cliente_id")
  tipo                TipoOperazionePortale
  dati                Json
  documentoAllegato   String?                   @map("documento_allegato") @db.Text
  stato               StatoOperazionePortale    @default(BOZZA)
  operazioneId        Int?                      @map("operazione_id")
  noteCommercialista  String?                   @map("note_commercialista") @db.Text
  validataAt          DateTime?                 @map("validata_at")
  createdAt           DateTime                  @default(now()) @map("created_at")

  societa             Societa                   @relation(fields: [societaId], references: [id], onDelete: Cascade)
  accessoCliente      AccessoCliente            @relation(fields: [accessoClienteId], references: [id])
  operazione          Operazione?               @relation(fields: [operazioneId], references: [id])

  @@index([societaId, stato])
  @@index([accessoClienteId])
  @@map("operazioni_portale")
}

model PermessoPortale {
  id                  Int               @id @default(autoincrement())
  accessoClienteId    Int               @map("accesso_cliente_id")
  sezione             SezionePortale
  lettura             Boolean           @default(true)
  scrittura           Boolean           @default(false)
  createdAt           DateTime          @default(now()) @map("created_at")

  accessoCliente      AccessoCliente    @relation(fields: [accessoClienteId], references: [id], onDelete: Cascade)

  @@unique([accessoClienteId, sezione])
  @@map("permessi_portale")
}
```

- [ ] **Step 2: Add relations to existing models**

Add to `Societa` model:
```prisma
  threadPortale       ThreadPortale[]
  messaggiPortale     MessaggioPortale[]
  operazioniPortale   OperazionePortale[]
```

Add to `AccessoCliente` model:
```prisma
  threadPortale       ThreadPortale[]
  messaggiPortale     MessaggioPortale[]
  operazioniPortale   OperazionePortale[]
  permessi            PermessoPortale[]
```

Add to `DocumentoCondiviso` model:
```prisma
  allegatiMessaggio   AllegatoMessaggio[]
```

Add to `Operazione` model:
```prisma
  operazioniPortale   OperazionePortale[]
```

- [ ] **Step 3: Run migration**

Run: `npx prisma migrate dev --name add-sp14-portale-full-models`
Expected: Migration created and applied successfully.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(sp14): add Prisma models for messaging, operations, permissions"
```

---

## Task 2: Portal Permissions System

**Files:**
- Create: `src/lib/portale/permissions.ts`
- Create: `src/lib/portale/__tests__/permissions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/portale/__tests__/permissions.test.ts
import { describe, it, expect } from "vitest";
import { checkPermission, DEFAULT_PERMISSIONS } from "../permissions";

describe("portal permissions", () => {
  it("DEFAULT_PERMISSIONS has all sections", () => {
    expect(DEFAULT_PERMISSIONS).toHaveLength(10);
    const sezioni = DEFAULT_PERMISSIONS.map((p) => p.sezione);
    expect(sezioni).toContain("KPI");
    expect(sezioni).toContain("PRIMA_NOTA");
    expect(sezioni).toContain("DOCUMENTI");
    expect(sezioni).toContain("CHAT");
  });

  it("checkPermission returns true for allowed action", () => {
    const permessi = [
      { sezione: "KPI" as const, lettura: true, scrittura: false },
      { sezione: "DOCUMENTI" as const, lettura: true, scrittura: true },
    ];
    expect(checkPermission(permessi, "KPI", "lettura")).toBe(true);
    expect(checkPermission(permessi, "KPI", "scrittura")).toBe(false);
    expect(checkPermission(permessi, "DOCUMENTI", "scrittura")).toBe(true);
  });

  it("checkPermission returns false for missing section", () => {
    expect(checkPermission([], "KPI", "lettura")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/portale/__tests__/permissions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement permissions**

```typescript
// src/lib/portale/permissions.ts
import { prisma } from "@/lib/prisma";

type Sezione = "KPI" | "PRIMA_NOTA" | "DOCUMENTI" | "CHAT" | "IVA" | "SCADENZARIO" | "FATTURE" | "F24" | "BILANCIO" | "REPORT";

interface PermessoEntry {
  sezione: Sezione;
  lettura: boolean;
  scrittura: boolean;
}

export const DEFAULT_PERMISSIONS: PermessoEntry[] = [
  { sezione: "KPI", lettura: true, scrittura: false },
  { sezione: "PRIMA_NOTA", lettura: true, scrittura: false },
  { sezione: "DOCUMENTI", lettura: true, scrittura: true },
  { sezione: "CHAT", lettura: true, scrittura: true },
  { sezione: "IVA", lettura: true, scrittura: false },
  { sezione: "SCADENZARIO", lettura: true, scrittura: false },
  { sezione: "FATTURE", lettura: true, scrittura: false },
  { sezione: "F24", lettura: true, scrittura: false },
  { sezione: "BILANCIO", lettura: true, scrittura: false },
  { sezione: "REPORT", lettura: true, scrittura: false },
];

export function checkPermission(
  permessi: PermessoEntry[],
  sezione: Sezione,
  azione: "lettura" | "scrittura"
): boolean {
  const p = permessi.find((e) => e.sezione === sezione);
  if (!p) return false;
  return p[azione];
}

export async function getClientPermissions(accessoClienteId: number): Promise<PermessoEntry[]> {
  const dbPerms = await prisma.permessoPortale.findMany({
    where: { accessoClienteId },
  });

  if (dbPerms.length === 0) return DEFAULT_PERMISSIONS;

  return dbPerms.map((p) => ({
    sezione: p.sezione as Sezione,
    lettura: p.lettura,
    scrittura: p.scrittura,
  }));
}

export async function hasPortalePermission(
  accessoClienteId: number,
  sezione: Sezione,
  azione: "lettura" | "scrittura"
): Promise<boolean> {
  const perms = await getClientPermissions(accessoClienteId);
  return checkPermission(perms, sezione, azione);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/portale/__tests__/permissions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/portale/permissions.ts src/lib/portale/__tests__/permissions.test.ts
git commit -m "feat(sp14): add portal permission system with defaults and granular checks"
```

---

## Task 3: Messaging Types and Thread Manager

**Files:**
- Create: `src/lib/portale/messaging/types.ts`
- Create: `src/lib/portale/messaging/thread-manager.ts`
- Create: `src/lib/portale/messaging/__tests__/thread-manager.test.ts`

- [ ] **Step 1: Write types**

```typescript
// src/lib/portale/messaging/types.ts
export interface CreateThreadInput {
  societaId: number;
  accessoClienteId: number;
  oggetto: string;
  contestoTipo?: "DOCUMENTO" | "SCADENZA" | "OPERAZIONE" | "ALERT" | "LIBERO";
  contestoId?: number;
  testoIniziale: string;
  mittenteTipo: "CLIENTE" | "COMMERCIALISTA";
  mittenteId: number;
}

export interface SendMessageInput {
  threadId: number;
  societaId: number;
  accessoClienteId: number;
  mittenteTipo: "CLIENTE" | "COMMERCIALISTA";
  mittenteId: number;
  testo: string;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/portale/messaging/__tests__/thread-manager.test.ts
import { describe, it, expect } from "vitest";
import { validateThreadInput } from "../thread-manager";

describe("thread-manager", () => {
  it("validates valid thread input", () => {
    const result = validateThreadInput({
      societaId: 1,
      accessoClienteId: 1,
      oggetto: "Test subject",
      testoIniziale: "Hello",
      mittenteTipo: "CLIENTE",
      mittenteId: 1,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty oggetto", () => {
    const result = validateThreadInput({
      societaId: 1,
      accessoClienteId: 1,
      oggetto: "",
      testoIniziale: "Hello",
      mittenteTipo: "CLIENTE",
      mittenteId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Oggetto obbligatorio");
  });

  it("rejects empty testoIniziale", () => {
    const result = validateThreadInput({
      societaId: 1,
      accessoClienteId: 1,
      oggetto: "Test",
      testoIniziale: "",
      mittenteTipo: "CLIENTE",
      mittenteId: 1,
    });
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/portale/messaging/__tests__/thread-manager.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement thread manager**

```typescript
// src/lib/portale/messaging/thread-manager.ts
import { prisma } from "@/lib/prisma";
import type { CreateThreadInput } from "./types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateThreadInput(input: CreateThreadInput): ValidationResult {
  const errors: string[] = [];
  if (!input.oggetto || input.oggetto.trim() === "") errors.push("Oggetto obbligatorio");
  if (!input.testoIniziale || input.testoIniziale.trim() === "") errors.push("Messaggio iniziale obbligatorio");
  if (!input.mittenteTipo) errors.push("Tipo mittente obbligatorio");
  return { valid: errors.length === 0, errors };
}

export async function createThread(input: CreateThreadInput): Promise<{ threadId: number; messaggioId: number }> {
  const validation = validateThreadInput(input);
  if (!validation.valid) throw new Error(validation.errors.join(", "));

  const thread = await prisma.threadPortale.create({
    data: {
      societaId: input.societaId,
      accessoClienteId: input.accessoClienteId,
      oggetto: input.oggetto,
      contestoTipo: input.contestoTipo as any,
      contestoId: input.contestoId,
      ultimoMessaggioAt: new Date(),
    },
  });

  const messaggio = await prisma.messaggioPortale.create({
    data: {
      societaId: input.societaId,
      threadId: thread.id,
      accessoClienteId: input.accessoClienteId,
      mittenteTipo: input.mittenteTipo as any,
      mittenteId: input.mittenteId,
      testo: input.testoIniziale,
    },
  });

  return { threadId: thread.id, messaggioId: messaggio.id };
}

export async function closeThread(threadId: number): Promise<void> {
  await prisma.threadPortale.update({
    where: { id: threadId },
    data: { stato: "CHIUSO" },
  });
}

export async function listThreads(
  societaId: number,
  accessoClienteId: number,
  options?: { stato?: string; limit?: number }
): Promise<any[]> {
  return prisma.threadPortale.findMany({
    where: {
      societaId,
      accessoClienteId,
      ...(options?.stato && { stato: options.stato as any }),
    },
    orderBy: { ultimoMessaggioAt: "desc" },
    take: options?.limit || 20,
    include: {
      messaggi: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messaggi: true } },
    },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/portale/messaging/__tests__/thread-manager.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/portale/messaging/
git commit -m "feat(sp14): add messaging types and thread manager with validation"
```

---

## Task 4: Message Sender

**Files:**
- Create: `src/lib/portale/messaging/message-sender.ts`
- Create: `src/lib/portale/messaging/__tests__/message-sender.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/portale/messaging/__tests__/message-sender.test.ts
import { describe, it, expect } from "vitest";
import { validateMessageInput } from "../message-sender";

describe("message-sender", () => {
  it("validates valid message input", () => {
    const result = validateMessageInput({
      threadId: 1,
      societaId: 1,
      accessoClienteId: 1,
      mittenteTipo: "CLIENTE",
      mittenteId: 1,
      testo: "Hello",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects empty testo", () => {
    const result = validateMessageInput({
      threadId: 1,
      societaId: 1,
      accessoClienteId: 1,
      mittenteTipo: "CLIENTE",
      mittenteId: 1,
      testo: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Testo messaggio obbligatorio");
  });
});
```

- [ ] **Step 2: Implement message sender**

```typescript
// src/lib/portale/messaging/message-sender.ts
import { prisma } from "@/lib/prisma";
import type { SendMessageInput } from "./types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateMessageInput(input: SendMessageInput): ValidationResult {
  const errors: string[] = [];
  if (!input.testo || input.testo.trim() === "") errors.push("Testo messaggio obbligatorio");
  if (!input.threadId) errors.push("Thread ID obbligatorio");
  return { valid: errors.length === 0, errors };
}

export async function sendMessage(input: SendMessageInput): Promise<number> {
  const validation = validateMessageInput(input);
  if (!validation.valid) throw new Error(validation.errors.join(", "));

  const messaggio = await prisma.messaggioPortale.create({
    data: {
      societaId: input.societaId,
      threadId: input.threadId,
      accessoClienteId: input.accessoClienteId,
      mittenteTipo: input.mittenteTipo as any,
      mittenteId: input.mittenteId,
      testo: input.testo,
    },
  });

  await prisma.threadPortale.update({
    where: { id: input.threadId },
    data: { ultimoMessaggioAt: new Date() },
  });

  return messaggio.id;
}

export async function markMessagesAsRead(
  threadId: number,
  readerType: "CLIENTE" | "COMMERCIALISTA"
): Promise<number> {
  const oppositeType = readerType === "CLIENTE" ? "COMMERCIALISTA" : "CLIENTE";
  const result = await prisma.messaggioPortale.updateMany({
    where: { threadId, mittenteTipo: oppositeType as any, letto: false },
    data: { letto: true, lettoAt: new Date() },
  });
  return result.count;
}

export async function getUnreadCount(
  societaId: number,
  accessoClienteId: number,
  viewerType: "CLIENTE" | "COMMERCIALISTA"
): Promise<number> {
  const oppositeType = viewerType === "CLIENTE" ? "COMMERCIALISTA" : "CLIENTE";
  return prisma.messaggioPortale.count({
    where: {
      societaId,
      accessoClienteId,
      mittenteTipo: oppositeType as any,
      letto: false,
    },
  });
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/lib/portale/messaging/__tests__/message-sender.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/portale/messaging/message-sender.ts src/lib/portale/messaging/__tests__/message-sender.test.ts
git commit -m "feat(sp14): add message sender with read tracking and unread count"
```

---

## Task 5: Portal Operation Handler (Simplified First Note)

**Files:**
- Create: `src/lib/portale/operations/types.ts`
- Create: `src/lib/portale/operations/operation-handler.ts`
- Create: `src/lib/portale/operations/__tests__/operation-handler.test.ts`

- [ ] **Step 1: Write types**

```typescript
// src/lib/portale/operations/types.ts
export interface IncassoData {
  importo: number;
  cliente: string;
  data: string;
  metodoPagamento: string;
  descrizione?: string;
}

export interface PagamentoData {
  importo: number;
  fornitore: string;
  data: string;
  categoria?: string;
  descrizione?: string;
}

export interface FatturaData {
  fileUrl: string;
  note?: string;
}

export type OperazionePortaleData = IncassoData | PagamentoData | FatturaData;

export interface CreateOperazioneInput {
  societaId: number;
  accessoClienteId: number;
  tipo: "INCASSO" | "PAGAMENTO" | "FATTURA";
  dati: OperazionePortaleData;
  documentoAllegato?: string;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/portale/operations/__tests__/operation-handler.test.ts
import { describe, it, expect } from "vitest";
import { validateOperazione } from "../operation-handler";

describe("operation-handler", () => {
  it("validates incasso operation", () => {
    const result = validateOperazione({
      societaId: 1,
      accessoClienteId: 1,
      tipo: "INCASSO",
      dati: { importo: 100, cliente: "Acme", data: "2026-01-15", metodoPagamento: "bonifico" },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects incasso without importo", () => {
    const result = validateOperazione({
      societaId: 1,
      accessoClienteId: 1,
      tipo: "INCASSO",
      dati: { importo: 0, cliente: "Acme", data: "2026-01-15", metodoPagamento: "bonifico" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Importo obbligatorio e maggiore di zero");
  });

  it("validates pagamento operation", () => {
    const result = validateOperazione({
      societaId: 1,
      accessoClienteId: 1,
      tipo: "PAGAMENTO",
      dati: { importo: 50, fornitore: "Supplier", data: "2026-01-15" },
    });
    expect(result.valid).toBe(true);
  });

  it("validates fattura operation", () => {
    const result = validateOperazione({
      societaId: 1,
      accessoClienteId: 1,
      tipo: "FATTURA",
      dati: { fileUrl: "/uploads/doc.pdf" },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects fattura without fileUrl", () => {
    const result = validateOperazione({
      societaId: 1,
      accessoClienteId: 1,
      tipo: "FATTURA",
      dati: { fileUrl: "" },
    });
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/portale/operations/__tests__/operation-handler.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement operation handler**

```typescript
// src/lib/portale/operations/operation-handler.ts
import { prisma } from "@/lib/prisma";
import type { CreateOperazioneInput, IncassoData, PagamentoData, FatturaData } from "./types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateOperazione(input: CreateOperazioneInput): ValidationResult {
  const errors: string[] = [];
  const { tipo, dati } = input;

  if (tipo === "INCASSO") {
    const d = dati as IncassoData;
    if (!d.importo || d.importo <= 0) errors.push("Importo obbligatorio e maggiore di zero");
    if (!d.cliente) errors.push("Cliente obbligatorio");
    if (!d.data) errors.push("Data obbligatoria");
    if (!d.metodoPagamento) errors.push("Metodo pagamento obbligatorio");
  } else if (tipo === "PAGAMENTO") {
    const d = dati as PagamentoData;
    if (!d.importo || d.importo <= 0) errors.push("Importo obbligatorio e maggiore di zero");
    if (!d.fornitore) errors.push("Fornitore obbligatorio");
    if (!d.data) errors.push("Data obbligatoria");
  } else if (tipo === "FATTURA") {
    const d = dati as FatturaData;
    if (!d.fileUrl) errors.push("File fattura obbligatorio");
  }

  return { valid: errors.length === 0, errors };
}

export async function createPortalOperation(input: CreateOperazioneInput): Promise<number> {
  const validation = validateOperazione(input);
  if (!validation.valid) throw new Error(validation.errors.join(", "));

  const op = await prisma.operazionePortale.create({
    data: {
      societaId: input.societaId,
      accessoClienteId: input.accessoClienteId,
      tipo: input.tipo as any,
      dati: input.dati as any,
      documentoAllegato: input.documentoAllegato,
    },
  });

  return op.id;
}

export async function validatePortalOperation(
  operazioneId: number,
  azione: "VALIDATA" | "RIFIUTATA",
  noteCommercialista?: string
): Promise<void> {
  await prisma.operazionePortale.update({
    where: { id: operazioneId },
    data: {
      stato: azione as any,
      noteCommercialista,
      validataAt: azione === "VALIDATA" ? new Date() : null,
    },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/portale/operations/__tests__/operation-handler.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/portale/operations/
git commit -m "feat(sp14): add portal operation handler for simplified first note"
```

---

## Task 6: Messaging API Routes

**Files:**
- Create: `src/app/api/portale/messaggi/route.ts`
- Create: `src/app/api/portale/messaggi/thread/route.ts`
- Create: `src/app/api/portale/messaggi/thread/[id]/route.ts`

- [ ] **Step 1: Implement message thread routes**

Read `src/lib/portale/auth.ts` and `src/app/api/portale/dashboard/route.ts` first to match the existing portal auth pattern (`getPortaleAuth` helper extracting Bearer JWT).

```typescript
// src/app/api/portale/messaggi/thread/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { createThread, listThreads } from "@/lib/portale/messaging/thread-manager";
import { hasPortalePermission } from "@/lib/portale/permissions";

async function getPortaleAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try { return await verifyPortaleToken(authHeader.slice(7)); } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!(await hasPortalePermission(auth.accessoClienteId, "CHAT", "lettura")))
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

    const threads = await listThreads(auth.societaId, auth.accessoClienteId);
    return NextResponse.json({ threads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!(await hasPortalePermission(auth.accessoClienteId, "CHAT", "scrittura")))
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

    const { oggetto, testo, contestoTipo, contestoId } = await request.json();
    const result = await createThread({
      societaId: auth.societaId,
      accessoClienteId: auth.accessoClienteId,
      oggetto,
      testoIniziale: testo,
      contestoTipo,
      contestoId,
      mittenteTipo: "CLIENTE",
      mittenteId: auth.accessoClienteId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

```typescript
// src/app/api/portale/messaggi/thread/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { markMessagesAsRead } from "@/lib/portale/messaging/message-sender";

async function getPortaleAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try { return await verifyPortaleToken(authHeader.slice(7)); } catch { return null; }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const { id } = await params;

    const thread = await prisma.threadPortale.findFirst({
      where: { id: parseInt(id), accessoClienteId: auth.accessoClienteId },
      include: {
        messaggi: { orderBy: { createdAt: "asc" }, include: { allegati: true } },
      },
    });

    if (!thread) return NextResponse.json({ error: "Thread non trovato" }, { status: 404 });

    // Mark as read
    await markMessagesAsRead(thread.id, "CLIENTE");

    return NextResponse.json({ thread });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

```typescript
// src/app/api/portale/messaggi/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { sendMessage, getUnreadCount } from "@/lib/portale/messaging/message-sender";
import { hasPortalePermission } from "@/lib/portale/permissions";

async function getPortaleAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try { return await verifyPortaleToken(authHeader.slice(7)); } catch { return null; }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!(await hasPortalePermission(auth.accessoClienteId, "CHAT", "scrittura")))
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

    const { threadId, testo } = await request.json();
    const msgId = await sendMessage({
      threadId,
      societaId: auth.societaId,
      accessoClienteId: auth.accessoClienteId,
      mittenteTipo: "CLIENTE",
      mittenteId: auth.accessoClienteId,
      testo,
    });
    return NextResponse.json({ id: msgId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const unread = await getUnreadCount(auth.societaId, auth.accessoClienteId, "CLIENTE");
    return NextResponse.json({ nonLetti: unread });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/portale/messaggi/
git commit -m "feat(sp14): add messaging API routes (threads, send, read)"
```

---

## Task 7: Portal Operations API Routes

**Files:**
- Create: `src/app/api/portale/operazioni/route.ts`
- Create: `src/app/api/portale/operazioni/[id]/route.ts`

- [ ] **Step 1: Implement operation routes**

```typescript
// src/app/api/portale/operazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { createPortalOperation } from "@/lib/portale/operations/operation-handler";
import { hasPortalePermission } from "@/lib/portale/permissions";

async function getPortaleAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try { return await verifyPortaleToken(authHeader.slice(7)); } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const operazioni = await prisma.operazionePortale.findMany({
      where: { accessoClienteId: auth.accessoClienteId, societaId: auth.societaId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ operazioni });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!(await hasPortalePermission(auth.accessoClienteId, "PRIMA_NOTA", "scrittura")))
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

    const { tipo, dati, documentoAllegato } = await request.json();

    const opId = await createPortalOperation({
      societaId: auth.societaId,
      accessoClienteId: auth.accessoClienteId,
      tipo,
      dati,
      documentoAllegato,
    });

    return NextResponse.json({ id: opId, stato: "BOZZA" }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

```typescript
// src/app/api/portale/operazioni/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validatePortalOperation } from "@/lib/portale/operations/operation-handler";

async function getPortaleAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try { return await verifyPortaleToken(authHeader.slice(7)); } catch { return null; }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Support both portal JWT and main session
    const portaleAuth = await getPortaleAuth(request);
    const { id } = await params;
    const opId = parseInt(id);

    const where: any = { id: opId };
    if (portaleAuth) where.accessoClienteId = portaleAuth.accessoClienteId;

    const op = await prisma.operazionePortale.findFirst({ where });
    if (!op) return NextResponse.json({ error: "Operazione non trovata" }, { status: 404 });

    return NextResponse.json({ operazione: op });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only commercialista (main auth) can validate
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { id } = await params;
    const { azione, note } = await request.json();

    if (!["VALIDATA", "RIFIUTATA"].includes(azione)) {
      return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
    }

    await validatePortalOperation(parseInt(id), azione, note);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/portale/operazioni/
git commit -m "feat(sp14): add portal operations API routes (create draft, validate)"
```

---

## Task 8: Client KPI Dashboard API

**Files:**
- Create: `src/app/api/portale/kpi/route.ts`

- [ ] **Step 1: Implement KPI dashboard route**

```typescript
// src/app/api/portale/kpi/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { hasPortalePermission } from "@/lib/portale/permissions";

async function getPortaleAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try { return await verifyPortaleToken(authHeader.slice(7)); } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    if (!(await hasPortalePermission(auth.accessoClienteId, "KPI", "lettura")))
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });

    const now = new Date();
    const anno = now.getFullYear();
    const mese = now.getMonth() + 1;

    // Health Score
    const healthScore = await prisma.healthScore.findFirst({
      where: { societaId: auth.societaId, anno, mese },
      orderBy: { calcolatoAt: "desc" },
    });

    // KPI values (latest cached)
    const kpis = await prisma.kpiValore.findMany({
      where: { societaId: auth.societaId, periodoTipo: "MESE" },
      orderBy: { calcolatoAt: "desc" },
      include: { kpi: { select: { codice: true, nome: true, categoria: true } } },
      distinct: ["kpiId"],
    });

    // Next 5 deadlines
    const scadenze = await prisma.scadenzaFiscale.findMany({
      where: {
        societaId: auth.societaId,
        scadenza: { gte: now },
        stato: { in: ["NON_INIZIATA", "IN_PREPARAZIONE", "PRONTA"] },
      },
      orderBy: { scadenza: "asc" },
      take: 5,
    });

    // Active alerts
    const alerts = await prisma.alertGenerato.findMany({
      where: { societaId: auth.societaId, stato: { in: ["NUOVO", "VISTO"] } },
      orderBy: [{ gravita: "desc" }, { createdAt: "desc" }],
      take: 5,
    });

    return NextResponse.json({
      healthScore,
      kpis: kpis.map((k) => ({
        codice: k.kpi.codice,
        nome: k.kpi.nome,
        categoria: k.kpi.categoria,
        valore: k.valore,
        variazione: k.variazione,
        trend: k.trend,
      })),
      scadenze,
      alerts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/portale/kpi/
git commit -m "feat(sp14): add client KPI dashboard API (health, KPIs, deadlines, alerts)"
```

---

## Task 9: Self-Service Fiscal API

**Files:**
- Create: `src/app/api/portale/fiscale/route.ts`

- [ ] **Step 1: Implement fiscal data route**

```typescript
// src/app/api/portale/fiscale/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { hasPortalePermission } from "@/lib/portale/permissions";

async function getPortaleAuth(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try { return await verifyPortaleToken(authHeader.slice(7)); } catch { return null; }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sezione = searchParams.get("sezione");
    const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));

    const result: Record<string, unknown> = {};

    if (!sezione || sezione === "iva") {
      if (await hasPortalePermission(auth.accessoClienteId, "IVA", "lettura")) {
        result.liquidazioniIva = await prisma.liquidazioneIva.findMany({
          where: { societaId: auth.societaId, anno },
          orderBy: { periodo: "asc" },
        });
      }
    }

    if (!sezione || sezione === "scadenzario") {
      if (await hasPortalePermission(auth.accessoClienteId, "SCADENZARIO", "lettura")) {
        result.scadenze = await prisma.scadenzaFiscale.findMany({
          where: { societaId: auth.societaId, anno },
          orderBy: { scadenza: "asc" },
        });
      }
    }

    if (!sezione || sezione === "fatture") {
      if (await hasPortalePermission(auth.accessoClienteId, "FATTURE", "lettura")) {
        result.fatture = await prisma.fatturaElettronica.findMany({
          where: { societaId: auth.societaId, annoRiferimento: anno },
          orderBy: { dataDocumento: "desc" },
          take: 50,
          select: {
            id: true, numero: true, annoRiferimento: true,
            stato: true, importoTotale: true, dataDocumento: true,
          },
        });
      }
    }

    if (!sezione || sezione === "report") {
      if (await hasPortalePermission(auth.accessoClienteId, "REPORT", "lettura")) {
        result.reports = await prisma.reportGeneratoBI.findMany({
          where: { societaId: auth.societaId, stato: "GENERATO" },
          orderBy: { generatoAt: "desc" },
          take: 10,
          include: { template: { select: { nome: true, tipo: true } } },
        });
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/portale/fiscale/
git commit -m "feat(sp14): add self-service fiscal API (IVA, scadenze, fatture, report)"
```

---

## Task 10: Portal Permissions Management API

**Files:**
- Create: `src/app/api/portale/permessi/route.ts`

- [ ] **Step 1: Implement permissions CRUD**

```typescript
// src/app/api/portale/permessi/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PERMISSIONS } from "@/lib/portale/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const accessoClienteId = parseInt(searchParams.get("clienteId") || "0");
    if (!accessoClienteId) return NextResponse.json({ error: "clienteId obbligatorio" }, { status: 400 });

    const permessi = await prisma.permessoPortale.findMany({
      where: { accessoClienteId },
    });

    return NextResponse.json({
      permessi: permessi.length > 0 ? permessi : DEFAULT_PERMISSIONS.map((p) => ({ ...p, accessoClienteId })),
      sezioniDisponibili: DEFAULT_PERMISSIONS.map((p) => p.sezione),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { accessoClienteId, permessi } = await request.json();
    if (!accessoClienteId || !Array.isArray(permessi)) {
      return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
    }

    // Upsert all permissions
    for (const p of permessi) {
      await prisma.permessoPortale.upsert({
        where: { accessoClienteId_sezione: { accessoClienteId, sezione: p.sezione } },
        update: { lettura: p.lettura, scrittura: p.scrittura },
        create: { accessoClienteId, sezione: p.sezione, lettura: p.lettura, scrittura: p.scrittura },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/portale/permessi/
git commit -m "feat(sp14): add portal permissions management API"
```

---

## Task 11: Commercialista Unified Inbox

**Files:**
- Create: `src/app/api/portale/inbox/route.ts`

- [ ] **Step 1: Implement inbox route**

```typescript
// src/app/api/portale/inbox/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    // Multi-client threads with unread messages (for commercialista)
    const threads = await prisma.threadPortale.findMany({
      where: {
        societaId: user.societaId,
        stato: "APERTO",
      },
      orderBy: { ultimoMessaggioAt: "desc" },
      take: 50,
      include: {
        accessoCliente: { select: { id: true, nome: true, email: true } },
        messaggi: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { testo: true, mittenteTipo: true, letto: true, createdAt: true },
        },
        _count: {
          select: {
            messaggi: { where: { mittenteTipo: "CLIENTE", letto: false } },
          },
        },
      },
    });

    // Pending portal operations
    const operazioniPending = await prisma.operazionePortale.findMany({
      where: { societaId: user.societaId, stato: "BOZZA" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        accessoCliente: { select: { id: true, nome: true } },
      },
    });

    // Count unread messages total
    const totalNonLetti = await prisma.messaggioPortale.count({
      where: {
        societaId: user.societaId,
        mittenteTipo: "CLIENTE",
        letto: false,
      },
    });

    return NextResponse.json({
      threads,
      operazioniPending,
      totalNonLetti,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/portale/inbox/
git commit -m "feat(sp14): add commercialista unified inbox (threads, pending ops, unread)"
```

---

## Task 12: Run Full Test Suite

- [ ] **Step 1: Run all SP14 tests**

Run: `npx vitest run src/lib/portale/`
Expected: All tests pass.

- [ ] **Step 2: Run full project tests**

Run: `npx vitest run`
Expected: All existing tests still pass + new SP14 tests pass.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit any fixes**

If any test/build fails, fix and commit:
```bash
git add -A
git commit -m "fix(sp14): address test/build issues"
```

---

## Summary

| Task | Component | Tests |
|------|-----------|-------|
| 1 | Prisma models (5 new + 6 enums) | Migration |
| 2 | Permission system | 3 tests |
| 3 | Thread manager + types | 3 tests |
| 4 | Message sender | 2 tests |
| 5 | Operation handler (simplified first note) | 5 tests |
| 6 | Messaging API routes | Build verify |
| 7 | Operations API routes | Build verify |
| 8 | Client KPI dashboard API | Build verify |
| 9 | Self-service fiscal API | Build verify |
| 10 | Permissions management API | Build verify |
| 11 | Commercialista unified inbox | Build verify |
| 12 | Full test suite | Regression check |

**Total: 12 tasks, ~13 tests, ~12 commits**

### Deferred to subsequent iteration
- OCR integration for uploaded invoices (existing `/api/ocr` endpoint — separate wiring)
- Document status pipeline UI (Caricato → In lavorazione → Registrato → Archiviato)
- Portal frontend pages (React components using these APIs)
- Full-text search on MessaggioPortale.testo (FULLTEXT index to add when needed)
- Email notifications on new messages (requires email infrastructure)
- Portal branding config (logo, colors — separate config task)
- Firma digitale (FEA sub-project)
- Migration of old RichiestaDocumento/DomandaCliente endpoints (3-month sunset)
