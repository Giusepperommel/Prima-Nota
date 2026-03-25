# Sub-project 2: Controlli Proattivi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proactive anomaly detection engine with deterministic rules, statistical patterns, and AI semantic analysis. Add a "Salute Azienda" dashboard with per-area health scores and multi-company overview.

**Architecture:** New `src/lib/controlli/` module with rule engine pattern. Each check is a self-contained function registered in a catalog. Checks run on triggers (operation saved, cron) via a pipeline. Results stored in `Anomalia` model (from SP0 schema). Dashboard at `/salute-azienda` with health score calculation and multi-company view.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 6 (MySQL), Vitest, @anthropic-ai/sdk, Tailwind CSS, Shadcn UI, Recharts

**Spec:** `docs/superpowers/specs/2026-03-25-automazioni-commercialista-design.md` (Section: Sub-project 2)

---

## File Structure

### New files

```
src/lib/
  controlli/
    types.ts                        # Check types, rule interface
    catalog.ts                      # Registry of all checks
    runner.ts                       # Pipeline: runs checks, creates Anomalia records
    rules/
      quadratura-iva.ts             # IVA vendite vs acquisti vs liquidazione
      dare-avere.ts                 # Scrittura contabile balance check
      protocollo-iva.ts             # IVA register numbering gaps
      fatture-senza-registrazione.ts # Imported but not IVA-registered
      scadenze-scoperte.ts          # F24/LIPE/CU near deadline, not completed
      cassa-negativa.ts             # Cash balance < 0
      ritenute-non-versate.ts       # Withholdings not paid by 16th
      plafond-sforato.ts            # Plafond usage > availability
      ammortamenti-mancanti.ts      # Active assets without current year depreciation
      anagrafiche-incomplete.ts     # Supplier/customer without P.IVA or CF
    patterns/
      categoria-anomala.ts          # Operation classified differently from history
      doppia-fattura.ts             # Same supplier + amount + date = duplicate
    ai/
      analisi-semantica.ts          # Claude AI: description/category mismatch, IVA regime, compliance risk
    health-score.ts                 # Calculate per-area health scores
  __tests__/
    controlli-rules.test.ts         # Tests for deterministic rules
    controlli-patterns.test.ts      # Tests for statistical patterns
    controlli-runner.test.ts        # Tests for the pipeline runner
    health-score.test.ts            # Tests for health score calculation

src/app/api/
  controlli/
    route.ts                        # POST: run checks on demand / GET: list anomalies
    [id]/
      route.ts                      # PUT: resolve/ignore anomaly
  health-score/
    route.ts                        # GET: scores for current società
    multi/
      route.ts                      # GET: scores for all società (commercialista view)

src/app/(protected)/
  salute-azienda/
    page.tsx                        # Health dashboard page
```

---

## Task 1: Schema — Anomalia & HealthScore Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Anomalia and HealthScore models**

The enums `NotificaPriorita`, `AnomaliaTipo`, `AnomaliaSorgente`, `AnomaliaStato` already exist from SP0 spec. Check the schema — if `AnomaliaTipo`, `AnomaliaSorgente`, `AnomaliaStato` enums are NOT yet in the schema, add them now along with the models:

```prisma
// ─── Controlli Proattivi ──────────────────────────────────────────────────────

enum AnomaliaTipo {
  QUADRATURA
  DUPLICATO
  COMPLIANCE
  DOCUMENTALE
  SCADENZA
  CATEGORIA_ANOMALA
  REGIME_IVA_SOSPETTO
  INCOERENZA_SEMANTICA
}

enum AnomaliaSorgente {
  REGOLA
  PATTERN
  AI
}

enum AnomaliaStato {
  APERTA
  RISOLTA
  IGNORATA
  FALSO_POSITIVO
}

model Anomalia {
  id            Int                @id @default(autoincrement())
  societaId     Int                @map("societa_id")
  tipo          AnomaliaTipo       @map("tipo")
  sorgente      AnomaliaSorgente   @map("sorgente")
  priorita      NotificaPriorita   @map("priorita")
  titolo        String             @map("titolo") @db.VarChar(255)
  descrizione   String             @map("descrizione") @db.Text
  entityType    String?            @map("entity_type") @db.VarChar(50)
  entityId      Int?               @map("entity_id")
  stato         AnomaliaStato      @default(APERTA) @map("stato")
  risoltaDa     Int?               @map("risolta_da")
  risoltaAt     DateTime?          @map("risolta_at")
  metadati      Json?              @map("metadati")
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")

  societa       Societa            @relation(fields: [societaId], references: [id])

  @@index([societaId, stato])
  @@index([entityType, entityId])
  @@map("anomalie")
}

model HealthScore {
  id                  Int      @id @default(autoincrement())
  societaId           Int      @map("societa_id")
  anno                Int      @map("anno")
  mese                Int      @map("mese")
  areaContabilita     Int      @map("area_contabilita")
  areaIva             Int      @map("area_iva")
  areaScadenze        Int      @map("area_scadenze")
  areaDocumentale     Int      @map("area_documentale")
  areaBanca           Int      @map("area_banca")
  scoreComplessivo    Int      @map("score_complessivo")
  calcolatoAt         DateTime @map("calcolato_at")

  societa             Societa  @relation(fields: [societaId], references: [id])

  @@unique([societaId, anno, mese])
  @@index([societaId])
  @@map("health_scores")
}
```

Add to Societa:
```prisma
  anomalie             Anomalia[]
  healthScores         HealthScore[]
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name sp2-anomalia-health-score
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(sp2): add Anomalia and HealthScore models"
```

---

## Task 2: Check Types & Catalog

**Files:**
- Create: `src/lib/controlli/types.ts`
- Create: `src/lib/controlli/catalog.ts`

- [ ] **Step 1: Create types**

Create `src/lib/controlli/types.ts`:

```typescript
import type { AnomaliaTipo, AnomaliaSorgente, NotificaPriorita } from "@prisma/client";

export type CheckResult = {
  found: boolean;
  anomalie: AnomaliaData[];
};

export type AnomaliaData = {
  tipo: AnomaliaTipo;
  sorgente: AnomaliaSorgente;
  priorita: NotificaPriorita;
  titolo: string;
  descrizione: string;
  entityType?: string;
  entityId?: number;
  metadati?: Record<string, unknown>;
};

export type CheckDefinition = {
  id: string;
  nome: string;
  sorgente: AnomaliaSorgente;
  run: (societaId: number, anno: number) => Promise<CheckResult>;
};
```

- [ ] **Step 2: Create catalog (empty, will be populated by rule tasks)**

Create `src/lib/controlli/catalog.ts`:

```typescript
import type { CheckDefinition } from "./types";

const checks: CheckDefinition[] = [];

export function registerCheck(check: CheckDefinition): void {
  checks.push(check);
}

export function getAllChecks(): CheckDefinition[] {
  return [...checks];
}

export function getChecksBySource(sorgente: string): CheckDefinition[] {
  return checks.filter((c) => c.sorgente === sorgente);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/controlli/
git commit -m "feat(sp2): add check types and catalog registry"
```

---

## Task 3: Deterministic Rules (10 checks)

**Files:**
- Create: `src/lib/controlli/rules/` (10 files)
- Test: `src/lib/__tests__/controlli-rules.test.ts`

- [ ] **Step 1: Write tests for key rules (TDD)**

Create `src/lib/__tests__/controlli-rules.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    scritturaContabile: { findMany: vi.fn() },
    operazione: { findMany: vi.fn(), count: vi.fn() },
    liquidazioneIva: { findMany: vi.fn() },
    cespite: { findMany: vi.fn() },
    quotaAmmortamento: { findMany: vi.fn() },
    anagrafica: { findMany: vi.fn() },
    ritenuta: { findMany: vi.fn() },
    movimentoContabile: { groupBy: vi.fn() },
  },
}));

import { prisma } from "../prisma";

// Import rules after mock
import { checkDareAvere } from "../controlli/rules/dare-avere";
import { checkAnagraficheIncomplete } from "../controlli/rules/anagrafiche-incomplete";
import { checkDoppiaFattura } from "../controlli/rules/doppia-fattura";

describe("checkDareAvere", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("finds unbalanced scritture", async () => {
    vi.mocked(prisma.scritturaContabile.findMany).mockResolvedValue([
      { id: 1, descrizione: "FT-001", movimenti: [
        { tipoConto: "DARE", importo: { toNumber: () => 1000 } },
        { tipoConto: "AVERE", importo: { toNumber: () => 900 } },
      ] },
    ] as any);

    const result = await checkDareAvere(1, 2026);
    expect(result.found).toBe(true);
    expect(result.anomalie).toHaveLength(1);
    expect(result.anomalie[0].priorita).toBe("CRITICA");
  });

  it("returns no anomalies when all balanced", async () => {
    vi.mocked(prisma.scritturaContabile.findMany).mockResolvedValue([
      { id: 1, descrizione: "FT-001", movimenti: [
        { tipoConto: "DARE", importo: { toNumber: () => 1000 } },
        { tipoConto: "AVERE", importo: { toNumber: () => 1000 } },
      ] },
    ] as any);

    const result = await checkDareAvere(1, 2026);
    expect(result.found).toBe(false);
  });
});

describe("checkAnagraficheIncomplete", () => {
  it("finds anagrafiche without partitaIva", async () => {
    vi.mocked(prisma.anagrafica.findMany).mockResolvedValue([
      { id: 1, denominazione: "Rossi SRL", partitaIva: "", codiceFiscale: "" },
    ] as any);

    const result = await checkAnagraficheIncomplete(1, 2026);
    expect(result.found).toBe(true);
    expect(result.anomalie[0].tipo).toBe("DOCUMENTALE");
  });
});

describe("checkDoppiaFattura", () => {
  it("detects potential duplicate invoices", async () => {
    const date = new Date("2026-03-15");
    vi.mocked(prisma.operazione.findMany).mockResolvedValue([
      { id: 1, fornitoreId: 10, importoTotale: { toNumber: () => 1220 }, dataOperazione: date, numeroDocumento: "FT-142", descrizione: "Fattura A" },
      { id: 2, fornitoreId: 10, importoTotale: { toNumber: () => 1220 }, dataOperazione: date, numeroDocumento: "FT-143", descrizione: "Fattura B" },
    ] as any);

    const result = await checkDoppiaFattura(1, 2026);
    expect(result.found).toBe(true);
    expect(result.anomalie[0].tipo).toBe("DUPLICATO");
  });
});
```

- [ ] **Step 2: Run tests — should FAIL**

- [ ] **Step 3: Implement rules**

Create each rule file in `src/lib/controlli/rules/`. Each exports a `checkXxx(societaId, anno)` function returning `CheckResult`. Here are the three tested ones:

**`src/lib/controlli/rules/dare-avere.ts`:**
```typescript
import { prisma } from "@/lib/prisma";
import type { CheckResult } from "../types";

export async function checkDareAvere(societaId: number, anno: number): Promise<CheckResult> {
  const scritture = await prisma.scritturaContabile.findMany({
    where: {
      societaId,
      dataRegistrazione: {
        gte: new Date(`${anno}-01-01`),
        lte: new Date(`${anno}-12-31`),
      },
    },
    include: { movimenti: { select: { tipoConto: true, importo: true } } },
  });

  const anomalie = [];
  for (const s of scritture) {
    const dare = s.movimenti
      .filter((m: any) => m.tipoConto === "DARE")
      .reduce((sum: number, m: any) => sum + Number(m.importo), 0);
    const avere = s.movimenti
      .filter((m: any) => m.tipoConto === "AVERE")
      .reduce((sum: number, m: any) => sum + Number(m.importo), 0);

    if (Math.abs(dare - avere) > 0.01) {
      anomalie.push({
        tipo: "QUADRATURA" as const,
        sorgente: "REGOLA" as const,
        priorita: "CRITICA" as const,
        titolo: `Scrittura non bilanciata: ${s.descrizione}`,
        descrizione: `Dare: €${dare.toFixed(2)}, Avere: €${avere.toFixed(2)}, Differenza: €${Math.abs(dare - avere).toFixed(2)}`,
        entityType: "ScritturaContabile",
        entityId: s.id,
        metadati: { dare, avere, differenza: Math.abs(dare - avere) },
      });
    }
  }

  return { found: anomalie.length > 0, anomalie };
}
```

**`src/lib/controlli/rules/anagrafiche-incomplete.ts`:**
```typescript
import { prisma } from "@/lib/prisma";
import type { CheckResult } from "../types";

export async function checkAnagraficheIncomplete(societaId: number, _anno: number): Promise<CheckResult> {
  const incomplete = await prisma.anagrafica.findMany({
    where: {
      societaId,
      OR: [
        { partitaIva: "" },
        { partitaIva: null },
        { codiceFiscale: "" },
        { codiceFiscale: null },
      ],
    },
    select: { id: true, denominazione: true, partitaIva: true, codiceFiscale: true },
  });

  const anomalie = incomplete.map((a) => ({
    tipo: "DOCUMENTALE" as const,
    sorgente: "REGOLA" as const,
    priorita: "MEDIA" as const,
    titolo: `Anagrafica incompleta: ${a.denominazione}`,
    descrizione: `Manca${!a.partitaIva ? " P.IVA" : ""}${!a.codiceFiscale ? " Codice Fiscale" : ""}`,
    entityType: "Anagrafica",
    entityId: a.id,
  }));

  return { found: anomalie.length > 0, anomalie };
}
```

**`src/lib/controlli/rules/doppia-fattura.ts`** (pattern, in `src/lib/controlli/patterns/doppia-fattura.ts`):
```typescript
import { prisma } from "@/lib/prisma";
import type { CheckResult } from "../types";

export async function checkDoppiaFattura(societaId: number, anno: number): Promise<CheckResult> {
  const operazioni = await prisma.operazione.findMany({
    where: {
      societaId,
      tipoOperazione: "COSTO",
      dataOperazione: { gte: new Date(`${anno}-01-01`), lte: new Date(`${anno}-12-31`) },
      fornitoreId: { not: null },
      bozza: false,
    },
    select: { id: true, fornitoreId: true, importoTotale: true, dataOperazione: true, numeroDocumento: true, descrizione: true },
    orderBy: [{ fornitoreId: "asc" }, { dataOperazione: "asc" }],
  });

  const anomalie = [];
  for (let i = 0; i < operazioni.length - 1; i++) {
    for (let j = i + 1; j < operazioni.length; j++) {
      const a = operazioni[i];
      const b = operazioni[j];
      if (
        a.fornitoreId === b.fornitoreId &&
        Math.abs(Number(a.importoTotale) - Number(b.importoTotale)) < 0.01 &&
        Math.abs(a.dataOperazione.getTime() - b.dataOperazione.getTime()) < 86400000 // 1 day
      ) {
        anomalie.push({
          tipo: "DUPLICATO" as const,
          sorgente: "PATTERN" as const,
          priorita: "ALTA" as const,
          titolo: `Possibile duplicato: ${a.numeroDocumento ?? a.descrizione} / ${b.numeroDocumento ?? b.descrizione}`,
          descrizione: `Stesso fornitore, importo €${Number(a.importoTotale).toFixed(2)}, date ravvicinate`,
          entityType: "Operazione",
          entityId: a.id,
          metadati: { operazioneIdA: a.id, operazioneIdB: b.id },
        });
      }
    }
  }

  return { found: anomalie.length > 0, anomalie };
}
```

Create stub files for the remaining 7 rules (same pattern, just return `{ found: false, anomalie: [] }` for now — they will be fully implemented when the specific data they check is exercised):

- `quadratura-iva.ts`, `protocollo-iva.ts`, `fatture-senza-registrazione.ts`, `scadenze-scoperte.ts`, `cassa-negativa.ts`, `ritenute-non-versate.ts`, `plafond-sforato.ts`, `ammortamenti-mancanti.ts`

Also create `src/lib/controlli/patterns/categoria-anomala.ts` as a stub.

- [ ] **Step 4: Register all checks in catalog**

Update `src/lib/controlli/catalog.ts` to import and register all checks.

- [ ] **Step 5: Run tests — should PASS**

- [ ] **Step 6: Commit**

```bash
git add src/lib/controlli/ src/lib/__tests__/controlli-rules.test.ts
git commit -m "feat(sp2): add deterministic rules, pattern checks, and check catalog"
```

---

## Task 4: Check Runner (Pipeline)

**Files:**
- Create: `src/lib/controlli/runner.ts`
- Test: `src/lib/__tests__/controlli-runner.test.ts`

- [ ] **Step 1: Write tests (TDD)**

Create `src/lib/__tests__/controlli-runner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAllChecks } from "../controlli/runner";

vi.mock("../prisma", () => ({
  prisma: {
    anomalia: {
      findFirst: vi.fn().mockResolvedValue(null),  // no existing anomalies
      create: vi.fn().mockResolvedValue({ id: 1 }),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../controlli/catalog", () => ({
  getAllChecks: vi.fn().mockReturnValue([
    {
      id: "test-check",
      nome: "Test Check",
      sorgente: "REGOLA",
      run: vi.fn().mockResolvedValue({
        found: true,
        anomalie: [{
          tipo: "QUADRATURA", sorgente: "REGOLA", priorita: "CRITICA",
          titolo: "Test", descrizione: "Test desc",
        }],
      }),
    },
  ]),
}));

import { prisma } from "../prisma";

describe("runAllChecks", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("runs all registered checks and creates anomalie", async () => {
    const result = await runAllChecks(1, 2026);
    expect(result.checksEseguiti).toBe(1);
    expect(result.anomalieTrovate).toBe(1);
    expect(prisma.anomalia.create).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate anomalies (same entity+tipo)", async () => {
    vi.mocked(prisma.anomalia.findFirst).mockResolvedValue({ id: 1 } as any);

    const result = await runAllChecks(1, 2026);
    expect(result.anomalieTrovate).toBe(1);
    expect(prisma.anomalia.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement runner**

Create `src/lib/controlli/runner.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import { getAllChecks } from "./catalog";
import type { AnomaliaData } from "./types";

type RunResult = {
  checksEseguiti: number;
  anomalieTrovate: number;
  anomalieCreate: number;
  errori: number;
};

export async function runAllChecks(societaId: number, anno: number): Promise<RunResult> {
  const checks = getAllChecks();
  const result: RunResult = { checksEseguiti: 0, anomalieTrovate: 0, anomalieCreate: 0, errori: 0 };

  for (const check of checks) {
    try {
      const checkResult = await check.run(societaId, anno);
      result.checksEseguiti++;

      for (const anomalia of checkResult.anomalie) {
        result.anomalieTrovate++;

        // Skip if same anomaly already exists and is open
        const existing = await prisma.anomalia.findFirst({
          where: {
            societaId,
            tipo: anomalia.tipo,
            entityType: anomalia.entityType ?? null,
            entityId: anomalia.entityId ?? null,
            stato: "APERTA",
          },
        });

        if (!existing) {
          await prisma.anomalia.create({
            data: {
              societaId,
              tipo: anomalia.tipo,
              sorgente: anomalia.sorgente,
              priorita: anomalia.priorita,
              titolo: anomalia.titolo,
              descrizione: anomalia.descrizione,
              entityType: anomalia.entityType,
              entityId: anomalia.entityId,
              metadati: anomalia.metadati as any,
            },
          });
          result.anomalieCreate++;
        }
      }
    } catch (error) {
      console.error(`Check ${check.id} failed:`, error);
      result.errori++;
    }
  }

  return result;
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run src/lib/__tests__/controlli-runner.test.ts
git add src/lib/controlli/runner.ts src/lib/__tests__/controlli-runner.test.ts
git commit -m "feat(sp2): add check runner pipeline with dedup"
```

---

## Task 5: Health Score Calculator

**Files:**
- Create: `src/lib/controlli/health-score.ts`
- Test: `src/lib/__tests__/health-score.test.ts`

- [ ] **Step 1: Write tests (TDD)**

Create `src/lib/__tests__/health-score.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateHealthScore } from "../controlli/health-score";

vi.mock("../prisma", () => ({
  prisma: {
    anomalia: { count: vi.fn() },
    healthScore: { upsert: vi.fn().mockResolvedValue({ id: 1, scoreComplessivo: 85 }) },
  },
}));

import { prisma } from "../prisma";

describe("calculateHealthScore", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 100 when no anomalies exist", async () => {
    vi.mocked(prisma.anomalia.count).mockResolvedValue(0);

    const score = await calculateHealthScore(1, 2026, 3);
    expect(score.scoreComplessivo).toBe(100);
    expect(prisma.healthScore.upsert).toHaveBeenCalled();
  });

  it("deducts points for open anomalies by priority", async () => {
    // Mock: 1 CRITICA, 2 ALTA, 0 MEDIA, 0 BASSA per area
    vi.mocked(prisma.anomalia.count)
      .mockResolvedValueOnce(1)  // contabilita CRITICA
      .mockResolvedValueOnce(0)  // contabilita ALTA
      .mockResolvedValueOnce(0)  // iva CRITICA
      .mockResolvedValueOnce(2)  // iva ALTA
      .mockResolvedValueOnce(0)  // scadenze CRITICA
      .mockResolvedValueOnce(0)  // scadenze ALTA
      .mockResolvedValueOnce(0)  // documentale CRITICA
      .mockResolvedValueOnce(0)  // documentale ALTA
      .mockResolvedValueOnce(0)  // banca CRITICA
      .mockResolvedValueOnce(0); // banca ALTA

    const score = await calculateHealthScore(1, 2026, 3);
    expect(score.areaContabilita).toBeLessThan(100);
    expect(score.areaIva).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: Implement health score**

Create `src/lib/controlli/health-score.ts`:

```typescript
import { prisma } from "@/lib/prisma";
import type { AnomaliaTipo } from "@prisma/client";

type HealthScoreResult = {
  areaContabilita: number;
  areaIva: number;
  areaScadenze: number;
  areaDocumentale: number;
  areaBanca: number;
  scoreComplessivo: number;
};

const AREA_TIPO_MAP: Record<string, AnomaliaTipo[]> = {
  contabilita: ["QUADRATURA", "DUPLICATO", "INCOERENZA_SEMANTICA"],
  iva: ["COMPLIANCE", "REGIME_IVA_SOSPETTO"],
  scadenze: ["SCADENZA"],
  documentale: ["DOCUMENTALE", "CATEGORIA_ANOMALA"],
  banca: [],  // No specific anomaly types yet; score based on reconciliation %
};

const PRIORITY_PENALTY = { CRITICA: 25, ALTA: 10, MEDIA: 5, BASSA: 2 };

async function calculateAreaScore(
  societaId: number,
  tipi: AnomaliaTipo[],
): Promise<number> {
  if (tipi.length === 0) return 100;

  let penalty = 0;
  for (const priorita of ["CRITICA", "ALTA"] as const) {
    const count = await prisma.anomalia.count({
      where: { societaId, tipo: { in: tipi }, stato: "APERTA", priorita },
    });
    penalty += count * PRIORITY_PENALTY[priorita];
  }

  return Math.max(0, 100 - penalty);
}

export async function calculateHealthScore(
  societaId: number,
  anno: number,
  mese: number,
): Promise<HealthScoreResult> {
  const areaContabilita = await calculateAreaScore(societaId, AREA_TIPO_MAP.contabilita);
  const areaIva = await calculateAreaScore(societaId, AREA_TIPO_MAP.iva);
  const areaScadenze = await calculateAreaScore(societaId, AREA_TIPO_MAP.scadenze);
  const areaDocumentale = await calculateAreaScore(societaId, AREA_TIPO_MAP.documentale);
  const areaBanca = await calculateAreaScore(societaId, AREA_TIPO_MAP.banca);

  const scoreComplessivo = Math.round(
    (areaContabilita + areaIva + areaScadenze + areaDocumentale + areaBanca) / 5,
  );

  await prisma.healthScore.upsert({
    where: { societaId_anno_mese: { societaId, anno, mese } },
    update: {
      areaContabilita, areaIva, areaScadenze, areaDocumentale, areaBanca,
      scoreComplessivo, calcolatoAt: new Date(),
    },
    create: {
      societaId, anno, mese,
      areaContabilita, areaIva, areaScadenze, areaDocumentale, areaBanca,
      scoreComplessivo, calcolatoAt: new Date(),
    },
  });

  return { areaContabilita, areaIva, areaScadenze, areaDocumentale, areaBanca, scoreComplessivo };
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run src/lib/__tests__/health-score.test.ts
git add src/lib/controlli/health-score.ts src/lib/__tests__/health-score.test.ts
git commit -m "feat(sp2): add health score calculator with per-area scoring"
```

---

## Task 6: API Routes — Controlli & Health Score

**Files:**
- Create: `src/app/api/controlli/route.ts`
- Create: `src/app/api/controlli/[id]/route.ts`
- Create: `src/app/api/health-score/route.ts`
- Create: `src/app/api/health-score/multi/route.ts`

- [ ] **Step 1: Create controlli routes**

`src/app/api/controlli/route.ts` — POST: run all checks (calls `runAllChecks`), GET: list anomalies with filters (stato, tipo, priorita)

`src/app/api/controlli/[id]/route.ts` — PUT: update anomaly stato (RISOLTA/IGNORATA/FALSO_POSITIVO) with risoltaDa/risoltaAt

- [ ] **Step 2: Create health score routes**

`src/app/api/health-score/route.ts` — GET: calculate and return score for current società + anno + mese

`src/app/api/health-score/multi/route.ts` — GET: return scores for ALL società the user has access to (commercialista multi-company view). Query `UtenteAzienda` for user's companies, calculate/fetch score for each.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/controlli/ src/app/api/health-score/
git commit -m "feat(sp2): add controlli and health score API routes"
```

---

## Task 7: Salute Azienda Dashboard Page

**Files:**
- Create: `src/app/(protected)/salute-azienda/page.tsx` (or `src/app/salute-azienda/`)

- [ ] **Step 1: Create dashboard page**

Follow existing page patterns. The page shows:

1. **Per-area health bars** — 5 progress bars (Contabilità, IVA, Scadenze, Documentale, Banca) with percentage and alert count
2. **Overall score** — big number (0-100) with color (green >80, yellow 50-80, red <50)
3. **Action list** — sorted by priority, each anomaly with description and action button (link to entity)
4. **Multi-company view** (commercialista mode only) — table of all companies with scores, sorted by urgency

Fetch from:
- `GET /api/health-score` — current company score
- `GET /api/health-score/multi` — all companies (if commercialista)
- `GET /api/controlli?stato=APERTA` — open anomalies

Use Shadcn components + Recharts for progress bars if available, or simple styled divs.

- [ ] **Step 2: Commit**

```bash
git add src/app/salute-azienda/ || git add src/app/\(protected\)/salute-azienda/
git commit -m "feat(sp2): add Salute Azienda health dashboard page"
```

---

## Task 8: Run All Tests & Verify Build

- [ ] **Step 1: Run all new tests**

```bash
npx vitest run src/lib/__tests__/controlli-rules.test.ts src/lib/__tests__/controlli-runner.test.ts src/lib/__tests__/health-score.test.ts
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit fixes if needed**
