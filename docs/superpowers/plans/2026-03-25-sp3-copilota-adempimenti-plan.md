# Sub-project 3: Copilota Adempimenti — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an intelligent fiscal deadline management system that auto-generates deadlines per company, tracks preparation progress with auto-verified checklists, and provides a multi-company copilot view with batch actions.

**Architecture:** New `src/lib/adempimenti/` module with calendar generator, checklist verifier, and batch operations. Schema adds `ScadenzaFiscale` and `ChecklistAdempimento` models. Dashboard at `/copilota-adempimenti`. Coexists with existing `ScadenzaAzienda` (manual deadlines).

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 6 (MySQL), Vitest, Tailwind CSS, Shadcn UI

**Spec:** `docs/superpowers/specs/2026-03-25-automazioni-commercialista-design.md` (Section: Sub-project 3)

---

## Task 1: Schema — ScadenzaFiscale & ChecklistAdempimento

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and models**

```prisma
// ─── Copilota Adempimenti ─────────────────────────────────────────────────────

enum ScadenzaFiscaleTipo {
  F24_IVA
  F24_RITENUTE
  F24_ACCONTO_IRES
  F24_ACCONTO_IRPEF
  LIPE
  CU
  DICHIARAZIONE_IVA
  DICHIARAZIONE_770
  REDDITI
  IRAP
  BILANCIO_DEPOSITO
  DIRITTO_CCIAA
  ACCONTO_IVA
  CONSERVAZIONE
}

enum ScadenzaFiscaleStato {
  NON_INIZIATA
  IN_PREPARAZIONE
  PRONTA
  COMPLETATA
  SCADUTA
}

model ScadenzaFiscale {
  id                        Int                  @id @default(autoincrement())
  societaId                 Int                  @map("societa_id")
  tipo                      ScadenzaFiscaleTipo  @map("tipo")
  anno                      Int                  @map("anno")
  periodo                   Int?                 @map("periodo")
  scadenza                  DateTime             @map("scadenza") @db.Date
  stato                     ScadenzaFiscaleStato @default(NON_INIZIATA) @map("stato")
  percentualeCompletamento  Int                  @default(0) @map("percentuale_completamento")
  entityGenerataId          Int?                 @map("entity_generata_id")
  entityGenerataTipo        String?              @map("entity_generata_tipo") @db.VarChar(50)
  bloccataDa                String?              @map("bloccata_da") @db.VarChar(500)
  createdAt                 DateTime             @default(now()) @map("created_at")
  updatedAt                 DateTime             @updatedAt @map("updated_at")

  societa                   Societa              @relation(fields: [societaId], references: [id])
  checklist                 ChecklistAdempimento[]

  @@unique([societaId, tipo, anno, periodo])
  @@index([societaId, scadenza])
  @@index([stato])
  @@map("scadenze_fiscali")
}

model ChecklistAdempimento {
  id                    Int      @id @default(autoincrement())
  scadenzaFiscaleId     Int      @map("scadenza_fiscale_id")
  ordine                Int      @map("ordine")
  descrizione           String   @map("descrizione") @db.VarChar(255)
  verificaAutomatica    Boolean  @default(false) @map("verifica_automatica")
  queryVerifica         String?  @map("query_verifica") @db.VarChar(100)
  completata            Boolean  @default(false) @map("completata")
  completataAt          DateTime? @map("completata_at")

  scadenzaFiscale       ScadenzaFiscale @relation(fields: [scadenzaFiscaleId], references: [id], onDelete: Cascade)

  @@index([scadenzaFiscaleId])
  @@map("checklist_adempimenti")
}
```

Add to Societa: `scadenzeFiscali ScadenzaFiscale[]`

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name sp3-scadenze-fiscali
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(sp3): add ScadenzaFiscale and ChecklistAdempimento models"
```

---

## Task 2: Calendar Generator

**Files:**
- Create: `src/lib/adempimenti/types.ts`
- Create: `src/lib/adempimenti/calendar.ts`
- Test: `src/lib/__tests__/adempimenti-calendar.test.ts`

- [ ] **Step 1: Create types**

Create `src/lib/adempimenti/types.ts`:

```typescript
import type { ScadenzaFiscaleTipo } from "@prisma/client";

export type ScadenzaTemplate = {
  tipo: ScadenzaFiscaleTipo;
  nome: string;
  frequenza: "MENSILE" | "TRIMESTRALE" | "ANNUALE";
  giornoScadenza: number;        // day of month, or days offset
  meseScadenza?: number;         // for annual deadlines
  condizione: (ctx: SocietaContext) => boolean;
  checklist: ChecklistTemplate[];
};

export type ChecklistTemplate = {
  descrizione: string;
  verificaAutomatica: boolean;
  queryVerifica?: string;
};

export type SocietaContext = {
  tipoAttivita: string;
  regimeFiscale: string;
  periodicityIva?: "MENSILE" | "TRIMESTRALE";
  hasRitenute: boolean;
  hasCespiti: boolean;
  hasFattureElettroniche: boolean;
};

export type GeneraCalendarioResult = {
  scadenzeGenerate: number;
  scadenzeEsistenti: number;
};
```

- [ ] **Step 2: Write tests (TDD)**

Create `src/lib/__tests__/adempimenti-calendar.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generaCalendarioFiscale, getScadenzePerSocieta } from "../adempimenti/calendar";

vi.mock("../prisma", () => ({
  prisma: {
    societa: { findUnique: vi.fn() },
    operazione: { count: vi.fn() },
    cespite: { count: vi.fn() },
    scadenzaFiscale: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    checklistAdempimento: { createMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";

describe("generaCalendarioFiscale", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("generates monthly F24 IVA for monthly IVA società", async () => {
    vi.mocked(prisma.societa.findUnique).mockResolvedValue({
      id: 1, tipoAttivita: "SRL", regimeFiscale: "ORDINARIO",
    } as any);
    vi.mocked(prisma.operazione.count).mockResolvedValue(5);  // has ritenute
    vi.mocked(prisma.cespite.count).mockResolvedValue(0);
    vi.mocked(prisma.scadenzaFiscale.findFirst).mockResolvedValue(null);

    const result = await generaCalendarioFiscale(1, 2026);
    expect(result.scadenzeGenerate).toBeGreaterThan(0);
    expect(prisma.scadenzaFiscale.create).toHaveBeenCalled();
  });

  it("skips already existing deadlines", async () => {
    vi.mocked(prisma.societa.findUnique).mockResolvedValue({
      id: 1, tipoAttivita: "SRL", regimeFiscale: "ORDINARIO",
    } as any);
    vi.mocked(prisma.operazione.count).mockResolvedValue(0);
    vi.mocked(prisma.cespite.count).mockResolvedValue(0);
    vi.mocked(prisma.scadenzaFiscale.findFirst).mockResolvedValue({ id: 1 } as any);

    const result = await generaCalendarioFiscale(1, 2026);
    expect(result.scadenzeEsistenti).toBeGreaterThan(0);
  });
});

describe("getScadenzePerSocieta", () => {
  it("returns deadlines with checklist", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([
      { id: 1, tipo: "F24_IVA", scadenza: new Date("2026-04-16"), stato: "NON_INIZIATA", checklist: [] },
    ] as any);

    const result = await getScadenzePerSocieta(1, 2026);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Implement calendar generator**

Create `src/lib/adempimenti/calendar.ts` with:
- `SCADENZE_TEMPLATES` array — all 13 deadline templates from the spec
- `generaCalendarioFiscale(societaId, anno)` — reads società context, iterates templates, creates ScadenzaFiscale + ChecklistAdempimento for applicable ones
- `getScadenzePerSocieta(societaId, anno)` — returns deadlines with checklist

Key templates (F24_IVA example):
```typescript
{
  tipo: "F24_IVA",
  nome: "F24 IVA",
  frequenza: "MENSILE",
  giornoScadenza: 16,
  condizione: () => true,  // always applicable
  checklist: [
    { descrizione: "Fatture del mese registrate", verificaAutomatica: true, queryVerifica: "fattureMeseRegistrate" },
    { descrizione: "Registri IVA quadrano", verificaAutomatica: true, queryVerifica: "registriIvaQuadrano" },
    { descrizione: "Liquidazione IVA calcolata", verificaAutomatica: true, queryVerifica: "liquidazioneCalcolata" },
    { descrizione: "F24 generato", verificaAutomatica: true, queryVerifica: "f24Generato" },
    { descrizione: "F24 pagato/inviato", verificaAutomatica: true, queryVerifica: "f24Pagato" },
  ],
}
```

For monthly deadlines, generate one per month (1-12). For quarterly, one per quarter (1-4). For annual, one per year.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run src/lib/__tests__/adempimenti-calendar.test.ts
git add src/lib/adempimenti/ src/lib/__tests__/adempimenti-calendar.test.ts
git commit -m "feat(sp3): add fiscal calendar generator with 13 deadline templates"
```

---

## Task 3: Checklist Verifier

**Files:**
- Create: `src/lib/adempimenti/verifier.ts`
- Test: `src/lib/__tests__/adempimenti-verifier.test.ts`

- [ ] **Step 1: Write tests (TDD)**

Create `src/lib/__tests__/adempimenti-verifier.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { verificaChecklist, aggiornaProgressoScadenza } from "../adempimenti/verifier";

vi.mock("../prisma", () => ({
  prisma: {
    operazione: { count: vi.fn() },
    liquidazioneIva: { findFirst: vi.fn() },
    f24Versamento: { findFirst: vi.fn() },
    checklistAdempimento: { update: vi.fn() },
    scadenzaFiscale: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";

describe("verificaChecklist", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("marks checklist item as complete when query returns true", async () => {
    vi.mocked(prisma.operazione.count).mockResolvedValue(10);  // fatture registrate

    const result = await verificaChecklist(1, {
      id: 1, queryVerifica: "fattureMeseRegistrate",
      scadenzaFiscaleId: 1, ordine: 1, descrizione: "Test",
      verificaAutomatica: true, completata: false, completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(true);
  });

  it("returns false when query returns 0", async () => {
    vi.mocked(prisma.operazione.count).mockResolvedValue(0);

    const result = await verificaChecklist(1, {
      id: 1, queryVerifica: "fattureMeseRegistrate",
      scadenzaFiscaleId: 1, ordine: 1, descrizione: "Test",
      verificaAutomatica: true, completata: false, completataAt: null,
    }, 2026, 3);

    expect(result.completata).toBe(false);
  });
});

describe("aggiornaProgressoScadenza", () => {
  it("calculates percentage from completed checklist items", async () => {
    vi.mocked(prisma.scadenzaFiscale.findUnique).mockResolvedValue({
      id: 1, checklist: [
        { completata: true },
        { completata: true },
        { completata: false },
        { completata: false },
        { completata: false },
      ],
    } as any);

    await aggiornaProgressoScadenza(1);
    expect(prisma.scadenzaFiscale.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        percentualeCompletamento: 40,
        stato: "IN_PREPARAZIONE",
      }),
    });
  });
});
```

- [ ] **Step 2: Implement verifier**

Create `src/lib/adempimenti/verifier.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { ChecklistAdempimento } from "@prisma/client";

type VerificaResult = { completata: boolean; dettaglio?: string };

// Registry of verification functions
const VERIFICHE: Record<string, (societaId: number, anno: number, periodo: number) => Promise<VerificaResult>> = {
  fattureMeseRegistrate: async (societaId, anno, periodo) => {
    const count = await prisma.operazione.count({
      where: {
        societaId,
        tipoOperazione: "COSTO",
        bozza: false,
        dataOperazione: {
          gte: new Date(anno, periodo - 1, 1),
          lt: new Date(anno, periodo, 1),
        },
      },
    });
    return { completata: count > 0, dettaglio: `${count} fatture registrate` };
  },

  registriIvaQuadrano: async (societaId, anno, periodo) => {
    // Simplified: check if any operations exist for the period
    const count = await prisma.operazione.count({
      where: {
        societaId,
        bozza: false,
        registroIva: { not: null },
        dataRegistrazione: {
          gte: new Date(anno, periodo - 1, 1),
          lt: new Date(anno, periodo, 1),
        },
      },
    });
    return { completata: count > 0 };
  },

  liquidazioneCalcolata: async (societaId, anno, periodo) => {
    const liq = await prisma.liquidazioneIva.findFirst({
      where: { societaId, anno, periodo },
    });
    return { completata: liq !== null };
  },

  f24Generato: async (societaId, anno, periodo) => {
    const f24 = await prisma.f24Versamento.findFirst({
      where: { societaId, anno, mese: periodo },
    });
    return { completata: f24 !== null };
  },

  f24Pagato: async (societaId, anno, periodo) => {
    const f24 = await prisma.f24Versamento.findFirst({
      where: { societaId, anno, mese: periodo, stato: "PAGATO" },
    });
    return { completata: f24 !== null };
  },

  ritenuteVersate: async (societaId, anno, periodo) => {
    const nonVersate = await prisma.ritenuta.count({
      where: {
        societaId,
        dataOperazione: {
          gte: new Date(anno, periodo - 1, 1),
          lt: new Date(anno, periodo, 1),
        },
        versata: false,
      },
    });
    return { completata: nonVersate === 0 };
  },

  cuGenerata: async (societaId, anno) => {
    const cu = await prisma.certificazioneUnica.findFirst({
      where: { societaId, anno },
    });
    return { completata: cu !== null };
  },

  lipeGenerata: async (societaId, anno, periodo) => {
    const lipe = await prisma.lipeInvio.findFirst({
      where: { societaId, anno, trimestre: periodo },
    });
    return { completata: lipe !== null };
  },

  bilancioGenerato: async (societaId, anno) => {
    const bilancio = await prisma.bilancioGenerato.findFirst({
      where: { societaId, anno },
    });
    return { completata: bilancio !== null };
  },
};

export async function verificaChecklist(
  societaId: number,
  item: ChecklistAdempimento,
  anno: number,
  periodo: number,
): Promise<VerificaResult> {
  if (!item.verificaAutomatica || !item.queryVerifica) {
    return { completata: item.completata };
  }

  const fn = VERIFICHE[item.queryVerifica];
  if (!fn) return { completata: false, dettaglio: `Verifica sconosciuta: ${item.queryVerifica}` };

  return fn(societaId, anno, periodo);
}

export async function aggiornaProgressoScadenza(scadenzaId: number): Promise<void> {
  const scadenza = await prisma.scadenzaFiscale.findUnique({
    where: { id: scadenzaId },
    include: { checklist: true },
  });

  if (!scadenza || scadenza.checklist.length === 0) return;

  const completate = scadenza.checklist.filter((c: any) => c.completata).length;
  const percentuale = Math.round((completate / scadenza.checklist.length) * 100);

  let stato: string;
  if (percentuale === 0) stato = "NON_INIZIATA";
  else if (percentuale === 100) stato = "PRONTA";
  else stato = "IN_PREPARAZIONE";

  await prisma.scadenzaFiscale.update({
    where: { id: scadenzaId },
    data: { percentualeCompletamento: percentuale, stato: stato as any },
  });
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run src/lib/__tests__/adempimenti-verifier.test.ts
git add src/lib/adempimenti/verifier.ts src/lib/__tests__/adempimenti-verifier.test.ts
git commit -m "feat(sp3): add checklist verifier with 9 auto-verification functions"
```

---

## Task 4: Batch Operations

**Files:**
- Create: `src/lib/adempimenti/batch.ts`
- Test: `src/lib/__tests__/adempimenti-batch.test.ts`

- [ ] **Step 1: Write tests (TDD)**

Create `src/lib/__tests__/adempimenti-batch.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generaTuttiF24Pronti, calcolaTutteLiquidazioni } from "../adempimenti/batch";

vi.mock("../prisma", () => ({
  prisma: {
    scadenzaFiscale: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";

describe("generaTuttiF24Pronti", () => {
  it("returns list of società with ready F24s", async () => {
    vi.mocked(prisma.scadenzaFiscale.findMany).mockResolvedValue([
      { id: 1, societaId: 1, tipo: "F24_IVA", stato: "PRONTA", societa: { ragioneSociale: "A SRL" } },
      { id: 2, societaId: 2, tipo: "F24_IVA", stato: "PRONTA", societa: { ragioneSociale: "B SRL" } },
    ] as any);

    const result = await generaTuttiF24Pronti([1, 2], 2026, 3);
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Implement batch operations**

Create `src/lib/adempimenti/batch.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export async function generaTuttiF24Pronti(
  societaIds: number[],
  anno: number,
  periodo: number,
) {
  return prisma.scadenzaFiscale.findMany({
    where: {
      societaId: { in: societaIds },
      tipo: { in: ["F24_IVA", "F24_RITENUTE"] },
      anno,
      periodo,
      stato: "PRONTA",
    },
    include: { societa: { select: { ragioneSociale: true } } },
  });
}

export async function calcolaTutteLiquidazioni(
  societaIds: number[],
  anno: number,
  periodo: number,
) {
  return prisma.scadenzaFiscale.findMany({
    where: {
      societaId: { in: societaIds },
      tipo: "F24_IVA",
      anno,
      periodo,
      stato: "IN_PREPARAZIONE",
    },
    include: { societa: { select: { ragioneSociale: true } }, checklist: true },
  });
}

export async function getScadenzeMultiSocieta(
  societaIds: number[],
  anno: number,
  mese: number,
) {
  const now = new Date();
  const startOfMonth = new Date(anno, mese - 1, 1);
  const endOfMonth = new Date(anno, mese, 0);

  return prisma.scadenzaFiscale.findMany({
    where: {
      societaId: { in: societaIds },
      scadenza: { gte: startOfMonth, lte: endOfMonth },
    },
    include: {
      societa: { select: { ragioneSociale: true } },
      checklist: true,
    },
    orderBy: { scadenza: "asc" },
  });
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run src/lib/__tests__/adempimenti-batch.test.ts
git add src/lib/adempimenti/batch.ts src/lib/__tests__/adempimenti-batch.test.ts
git commit -m "feat(sp3): add batch operations for multi-company fiscal deadlines"
```

---

## Task 5: API Routes

**Files:**
- Create: `src/app/api/scadenze-fiscali/route.ts`
- Create: `src/app/api/scadenze-fiscali/genera/route.ts`
- Create: `src/app/api/scadenze-fiscali/[id]/verifica/route.ts`
- Create: `src/app/api/scadenze-fiscali/batch/route.ts`

- [ ] **Step 1: Implement routes**

`src/app/api/scadenze-fiscali/route.ts`:
- GET: List deadlines for current società + anno. Include checklist. Filter by stato.

`src/app/api/scadenze-fiscali/genera/route.ts`:
- POST: Generate fiscal calendar for current società + anno. Calls `generaCalendarioFiscale`.

`src/app/api/scadenze-fiscali/[id]/verifica/route.ts`:
- POST: Verify all checklist items for a deadline. Calls `verificaChecklist` for each item, updates DB, recalculates progress via `aggiornaProgressoScadenza`.

`src/app/api/scadenze-fiscali/batch/route.ts`:
- GET: Multi-company deadlines for the current month. Uses `getScadenzeMultiSocieta`.
- POST: Batch actions — `{ action: "generaTuttiF24" | "calcolaTutteLiquidazioni", anno, periodo }`.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/scadenze-fiscali/
git commit -m "feat(sp3): add fiscal deadline API routes with calendar generation and verification"
```

---

## Task 6: Copilota Adempimenti Dashboard

**Files:**
- Create: `src/app/copilota-adempimenti/page.tsx` (or `src/app/(protected)/copilota-adempimenti/`)

- [ ] **Step 1: Create dashboard page**

The page shows (matching spec wireframe):

1. **This week section** — deadlines in next 7 days, grouped by type, showing count of ready/almost-ready/blocked per società
2. **Next 2 weeks section** — upcoming deadlines
3. **Batch actions** — "Genera tutti F24 pronti", "Calcola tutte liquidazioni", "Invia reminder clienti"
4. **Per-company summary** — progress bars per company showing completed/total

Fetch from:
- `GET /api/scadenze-fiscali?anno=2026` — current company deadlines
- `GET /api/scadenze-fiscali/batch` — multi-company view
- `POST /api/scadenze-fiscali/genera` — generate calendar
- `POST /api/scadenze-fiscali/{id}/verifica` — verify checklist

Each deadline shows: tipo, scadenza date, percentualeCompletamento bar, stato badge, checklist items with checkmarks, "Prossima azione" button.

- [ ] **Step 2: Commit**

```bash
git add src/app/copilota-adempimenti/ || git add src/app/\(protected\)/copilota-adempimenti/
git commit -m "feat(sp3): add Copilota Adempimenti dashboard page"
```

---

## Task 7: Run All Tests & Verify Build

- [ ] **Step 1: Run all new tests**

```bash
npx vitest run src/lib/__tests__/adempimenti-calendar.test.ts src/lib/__tests__/adempimenti-verifier.test.ts src/lib/__tests__/adempimenti-batch.test.ts
```

- [ ] **Step 2: Full test suite + TypeScript**

```bash
npx vitest run && npx tsc --noEmit
```

- [ ] **Step 3: Commit fixes if needed**
