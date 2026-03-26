# SP13: Reportistica e Business Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a KPI engine with cached calculations across 5 categories, comparative analysis (period vs period, budget vs actual), a report generator with predefined templates and PDF output, and API endpoints for BI data.

**Architecture:** Three modules (`src/lib/bi/kpi/`, `src/lib/bi/comparativa/`, `src/lib/bi/report/`) sharing new Prisma models (KpiDefinizione, KpiValore, Budget, BudgetRiga, ReportTemplate, ReportGeneratoBI). KPI engine calculates from existing Operazione/MovimentoContabile/LiquidazioneIva/ScadenzaPartitario data. Report builder aggregates KPIs into predefined report formats with PDF export.

**Tech Stack:** Next.js 16, Prisma 6 (MySQL), Vitest, date-fns, existing @react-pdf/renderer for PDF, existing recharts for charts, existing Operazione/PianoDeiConti/LiquidazioneIva models.

**Spec:** `docs/superpowers/specs/2026-03-26-pain-point-driven-features-design.md` (section 5)

---

## File Structure

### New files
```
src/lib/bi/
  types.ts                     — KpiCategory, PeriodoTipo, shared types
  utils.ts                     — importo calculation helper (from existing pattern)
  kpi/
    types.ts                   — KpiCalculator interface, KpiResult
    economici.ts               — Ricavi, Costi, Margine lordo, EBITDA, Utile netto
    finanziari.ts              — DSO, DPO, Cash burn rate
    fiscali.ts                 — Debito IVA, Credito IVA, Carico fiscale
    operativi.ts               — N. fatture, Tasso insoluti
    engine.ts                  — Orchestrator: calculate all KPIs, cache to KpiValore
    __tests__/
      utils.test.ts
      economici.test.ts
      finanziari.test.ts
      engine.test.ts
  comparativa/
    types.ts                   — ComparisonResult, ComparisonPeriod
    periodo.ts                 — Period vs period comparison
    budget.ts                  — Budget vs actual comparison
    __tests__/
      periodo.test.ts
      budget.test.ts
  report/
    types.ts                   — ReportSection, PredefinedReport
    templates.ts               — Predefined report template definitions
    generator.ts               — Report data aggregation + generation
    __tests__/
      templates.test.ts

src/app/api/bi/kpi/route.ts                    — Internal: KPI data for current period
src/app/api/bi/report/route.ts                 — Internal: generate/list reports
src/app/api/bi/report/[id]/route.ts            — Internal: get specific report
src/app/api/bi/budget/route.ts                 — Internal: budget CRUD
src/app/api/bi/budget/[id]/route.ts            — Internal: budget detail + righe
src/app/api/bi/comparativa/route.ts            — Internal: comparative analysis
src/app/api/v1/kpi/route.ts                    — Public V1 API: KPIs
src/app/api/v1/report/route.ts                 — Public V1 API: reports
```

### Modified files
```
prisma/schema.prisma  — Add KpiDefinizione, KpiValore, Budget, BudgetRiga, ReportTemplate, ReportGeneratoBI
```

---

## Task 1: Prisma Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and 6 new models to schema.prisma**

Add at the end of the schema file:

```prisma
enum CategoriaKpi {
  ECONOMICO
  FINANZIARIO
  FISCALE
  OPERATIVO
  CRESCITA
}

enum PeriodoTipo {
  MESE
  TRIMESTRE
  ANNO
}

enum StatoBudget {
  BOZZA
  APPROVATO
}

enum StatoReport {
  PENDING
  GENERATO
  ERRORE
}

model KpiDefinizione {
  id                 Int            @id @default(autoincrement())
  societaId          Int?           @map("societa_id")
  codice             String         @db.VarChar(50)
  nome               String         @db.VarChar(100)
  categoria          CategoriaKpi
  formula            Json
  contiRiferimento   Json?          @map("conti_riferimento")
  sogliaSemaforo     Json?          @map("soglia_semaforo")
  attivo             Boolean        @default(true)
  ordine             Int            @default(0)
  createdAt          DateTime       @default(now()) @map("created_at")

  societa            Societa?       @relation(fields: [societaId], references: [id], onDelete: Cascade)
  valori             KpiValore[]

  @@unique([societaId, codice])
  @@index([categoria, attivo])
  @@map("kpi_definizioni")
}

model KpiValore {
  id              Int          @id @default(autoincrement())
  societaId       Int          @map("societa_id")
  kpiId           Int          @map("kpi_id")
  periodo         String       @db.VarChar(10)
  periodoTipo     PeriodoTipo  @map("periodo_tipo")
  valore          Float
  valorePrec      Float?       @map("valore_prec")
  variazione      Float?
  trend           String?      @db.VarChar(10)
  calcolatoAt     DateTime     @default(now()) @map("calcolato_at")

  societa         Societa      @relation(fields: [societaId], references: [id], onDelete: Cascade)
  kpi             KpiDefinizione @relation(fields: [kpiId], references: [id], onDelete: Cascade)

  @@unique([societaId, kpiId, periodo, periodoTipo])
  @@index([societaId, periodoTipo])
  @@map("kpi_valori")
}

model Budget {
  id              Int          @id @default(autoincrement())
  societaId       Int          @map("societa_id")
  anno            Int
  nome            String       @db.VarChar(100)
  stato           StatoBudget  @default(BOZZA)
  approvatoDa     Int?         @map("approvato_da")
  approvatoAt     DateTime?    @map("approvato_at")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  societa         Societa      @relation(fields: [societaId], references: [id], onDelete: Cascade)
  righe           BudgetRiga[]

  @@unique([societaId, anno, nome])
  @@map("budget")
}

model BudgetRiga {
  id              Int          @id @default(autoincrement())
  budgetId        Int          @map("budget_id")
  contoId         Int          @map("conto_id")
  mese            Int
  importo         Decimal      @db.Decimal(12, 2)

  budget          Budget       @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  conto           PianoDeiConti @relation(fields: [contoId], references: [id])

  @@unique([budgetId, contoId, mese])
  @@map("budget_righe")
}

model ReportTemplate {
  id              Int          @id @default(autoincrement())
  societaId       Int?         @map("societa_id")
  nome            String       @db.VarChar(100)
  tipo            String       @db.VarChar(50)
  sezioni         Json
  formato         String       @default("PDF") @db.VarChar(10)
  schedulazione   String?      @db.VarChar(50)
  destinatari     Json?
  attivo          Boolean      @default(true)
  createdAt       DateTime     @default(now()) @map("created_at")

  societa         Societa?     @relation(fields: [societaId], references: [id], onDelete: Cascade)
  reportGenerati  ReportGeneratoBI[]

  @@map("report_templates")
}

model ReportGeneratoBI {
  id              Int          @id @default(autoincrement())
  societaId       Int          @map("societa_id")
  templateId      Int          @map("template_id")
  periodo         String       @db.VarChar(20)
  dati            Json
  narrativaAI     String?      @map("narrativa_ai") @db.Text
  fileUrl         String?      @map("file_url") @db.Text
  stato           StatoReport  @default(PENDING)
  generatoAt      DateTime     @default(now()) @map("generato_at")

  societa         Societa      @relation(fields: [societaId], references: [id], onDelete: Cascade)
  template        ReportTemplate @relation(fields: [templateId], references: [id])

  @@index([societaId, generatoAt])
  @@map("report_generati_bi")
}
```

- [ ] **Step 2: Add relations to existing models**

Add to `Societa` model:
```prisma
  kpiDefinizioni      KpiDefinizione[]
  kpiValori           KpiValore[]
  budget              Budget[]
  reportTemplates     ReportTemplate[]
  reportGeneratiBI    ReportGeneratoBI[]
```

Add to `PianoDeiConti` model:
```prisma
  budgetRighe         BudgetRiga[]
```

- [ ] **Step 3: Run migration**

Run: `npx prisma migrate dev --name add-sp13-bi-models`
Expected: Migration created and applied successfully.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(sp13): add Prisma models for KPI, budget, and report BI"
```

---

## Task 2: BI Shared Types and Utils

**Files:**
- Create: `src/lib/bi/types.ts`
- Create: `src/lib/bi/utils.ts`
- Create: `src/lib/bi/kpi/__tests__/utils.test.ts`

- [ ] **Step 1: Write shared types**

```typescript
// src/lib/bi/types.ts
export type { CategoriaKpi, PeriodoTipo, StatoBudget, StatoReport } from "@prisma/client";

export interface PeriodRange {
  da: Date;
  a: Date;
  label: string;
}

export interface KpiResult {
  codice: string;
  nome: string;
  categoria: string;
  valore: number;
  valorePrec: number | null;
  variazione: number | null;
  trend: "up" | "down" | "stable" | null;
  unita: string; // "€", "%", "giorni", "n"
}

export interface ComparisonRow {
  label: string;
  valoreCorrente: number;
  valorePrecedente: number;
  delta: number;
  deltaPerc: number | null;
}
```

- [ ] **Step 2: Write the failing test for utils**

```typescript
// src/lib/bi/kpi/__tests__/utils.test.ts
import { describe, it, expect } from "vitest";
import { calcolaImportoNetto, calcolaVariazione, determinaTrend, buildPeriodRange } from "../../utils";

describe("bi utils", () => {
  describe("calcolaImportoNetto", () => {
    it("uses importoImponibile when available", () => {
      expect(calcolaImportoNetto({ importoImponibile: 100, importoTotale: 122, aliquotaIva: 22 })).toBe(100);
    });

    it("computes from importoTotale and aliquotaIva", () => {
      expect(calcolaImportoNetto({ importoImponibile: null, importoTotale: 122, aliquotaIva: 22 })).toBe(100);
    });

    it("falls back to importoTotale", () => {
      expect(calcolaImportoNetto({ importoImponibile: null, importoTotale: 100, aliquotaIva: null })).toBe(100);
    });
  });

  describe("calcolaVariazione", () => {
    it("calculates percentage change", () => {
      expect(calcolaVariazione(120, 100)).toBeCloseTo(20);
    });

    it("returns null when previous is zero", () => {
      expect(calcolaVariazione(100, 0)).toBeNull();
    });
  });

  describe("determinaTrend", () => {
    it("returns up for positive variation", () => {
      expect(determinaTrend(10)).toBe("up");
    });

    it("returns down for negative variation", () => {
      expect(determinaTrend(-10)).toBe("down");
    });

    it("returns stable for small variation", () => {
      expect(determinaTrend(0.5)).toBe("stable");
    });
  });

  describe("buildPeriodRange", () => {
    it("builds monthly range", () => {
      const range = buildPeriodRange(2026, 3, "MESE");
      expect(range.da.getMonth()).toBe(2); // March = index 2
      expect(range.a.getMonth()).toBe(2);
      expect(range.label).toBe("2026-03");
    });

    it("builds yearly range", () => {
      const range = buildPeriodRange(2026, 1, "ANNO");
      expect(range.da.getMonth()).toBe(0);
      expect(range.a.getMonth()).toBe(11);
      expect(range.label).toBe("2026");
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/bi/kpi/__tests__/utils.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement utils**

```typescript
// src/lib/bi/utils.ts
import { startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from "date-fns";
import type { PeriodRange } from "./types";

interface OperazioneImporti {
  importoImponibile: number | null;
  importoTotale: number;
  aliquotaIva: number | null;
}

export function calcolaImportoNetto(op: OperazioneImporti): number {
  if (op.importoImponibile != null) return Number(op.importoImponibile);
  if (op.aliquotaIva != null && Number(op.aliquotaIva) > 0) {
    return Number(op.importoTotale) / (1 + Number(op.aliquotaIva) / 100);
  }
  return Number(op.importoTotale);
}

export function calcolaVariazione(corrente: number, precedente: number): number | null {
  if (precedente === 0) return null;
  return ((corrente - precedente) / Math.abs(precedente)) * 100;
}

export function determinaTrend(variazione: number | null): "up" | "down" | "stable" | null {
  if (variazione === null) return null;
  if (variazione > 1) return "up";
  if (variazione < -1) return "down";
  return "stable";
}

export function buildPeriodRange(anno: number, periodo: number, tipo: string): PeriodRange {
  switch (tipo) {
    case "MESE": {
      const date = new Date(anno, periodo - 1, 1);
      return { da: startOfMonth(date), a: endOfMonth(date), label: `${anno}-${String(periodo).padStart(2, "0")}` };
    }
    case "TRIMESTRE": {
      const date = new Date(anno, (periodo - 1) * 3, 1);
      return { da: startOfQuarter(date), a: endOfQuarter(date), label: `${anno}-Q${periodo}` };
    }
    case "ANNO":
    default: {
      const date = new Date(anno, 0, 1);
      return { da: startOfYear(date), a: endOfYear(date), label: `${anno}` };
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/bi/kpi/__tests__/utils.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/bi/
git commit -m "feat(sp13): add BI shared types and calculation utilities"
```

---

## Task 3: KPI Types and Calculator Interface

**Files:**
- Create: `src/lib/bi/kpi/types.ts`

- [ ] **Step 1: Write KPI types**

```typescript
// src/lib/bi/kpi/types.ts
import type { KpiResult, PeriodRange } from "../types";

export interface KpiCalculator {
  codice: string;
  nome: string;
  categoria: string;
  unita: string;
  calculate: (societaId: number, periodo: PeriodRange, periodoPrec: PeriodRange | null) => Promise<KpiResult>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bi/kpi/types.ts
git commit -m "feat(sp13): add KPI calculator interface"
```

---

## Task 4: KPI Economici (Revenue, Costs, Margin, EBITDA, Net Income)

**Files:**
- Create: `src/lib/bi/kpi/economici.ts`
- Create: `src/lib/bi/kpi/__tests__/economici.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/bi/kpi/__tests__/economici.test.ts
import { describe, it, expect } from "vitest";
import { kpiEconomici } from "../economici";

describe("kpi economici", () => {
  it("exports 5 KPI calculators", () => {
    expect(kpiEconomici).toHaveLength(5);
  });

  it("has correct codes", () => {
    const codes = kpiEconomici.map((k) => k.codice);
    expect(codes).toEqual(["RICAVI", "COSTI", "MARGINE_LORDO", "EBITDA", "UTILE_NETTO"]);
  });

  it("all have ECONOMICO category and EUR unit", () => {
    for (const kpi of kpiEconomici) {
      expect(kpi.categoria).toBe("ECONOMICO");
      expect(kpi.unita).toBe("€");
    }
  });

  it("all calculators are functions", () => {
    for (const kpi of kpiEconomici) {
      expect(typeof kpi.calculate).toBe("function");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bi/kpi/__tests__/economici.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement economici KPIs**

```typescript
// src/lib/bi/kpi/economici.ts
import { prisma } from "@/lib/prisma";
import type { KpiCalculator } from "./types";
import type { KpiResult, PeriodRange } from "../types";
import { calcolaImportoNetto, calcolaVariazione, determinaTrend } from "../utils";

async function sumOperazioniByTipo(
  societaId: number,
  periodo: PeriodRange,
  tipoOperazione: string
): Promise<number> {
  const operazioni = await prisma.operazione.findMany({
    where: {
      societaId,
      tipoOperazione: tipoOperazione as any,
      dataOperazione: { gte: periodo.da, lte: periodo.a },
      eliminato: false,
      bozza: false,
    },
    select: { importoImponibile: true, importoTotale: true, aliquotaIva: true },
  });

  return operazioni.reduce(
    (sum, op) => sum + calcolaImportoNetto({
      importoImponibile: op.importoImponibile ? Number(op.importoImponibile) : null,
      importoTotale: Number(op.importoTotale),
      aliquotaIva: op.aliquotaIva ? Number(op.aliquotaIva) : null,
    }),
    0
  );
}

function makeKpiResult(
  codice: string,
  nome: string,
  valore: number,
  valorePrec: number | null,
  unita: string
): KpiResult {
  const variazione = valorePrec != null ? calcolaVariazione(valore, valorePrec) : null;
  return {
    codice,
    nome,
    categoria: "ECONOMICO",
    valore: Math.round(valore * 100) / 100,
    valorePrec: valorePrec != null ? Math.round(valorePrec * 100) / 100 : null,
    variazione: variazione != null ? Math.round(variazione * 100) / 100 : null,
    trend: determinaTrend(variazione),
    unita,
  };
}

export const kpiEconomici: KpiCalculator[] = [
  {
    codice: "RICAVI",
    nome: "Ricavi",
    categoria: "ECONOMICO",
    unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await sumOperazioniByTipo(societaId, periodo, "FATTURA_ATTIVA");
      const valorePrec = periodoPrec ? await sumOperazioniByTipo(societaId, periodoPrec, "FATTURA_ATTIVA") : null;
      return makeKpiResult("RICAVI", "Ricavi", valore, valorePrec, "€");
    },
  },
  {
    codice: "COSTI",
    nome: "Costi",
    categoria: "ECONOMICO",
    unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await sumOperazioniByTipo(societaId, periodo, "COSTO");
      const valorePrec = periodoPrec ? await sumOperazioniByTipo(societaId, periodoPrec, "COSTO") : null;
      return makeKpiResult("COSTI", "Costi", valore, valorePrec, "€");
    },
  },
  {
    codice: "MARGINE_LORDO",
    nome: "Margine Lordo",
    categoria: "ECONOMICO",
    unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const ricavi = await sumOperazioniByTipo(societaId, periodo, "FATTURA_ATTIVA");
      const costi = await sumOperazioniByTipo(societaId, periodo, "COSTO");
      const valore = ricavi - costi;
      let valorePrec: number | null = null;
      if (periodoPrec) {
        const ricaviPrec = await sumOperazioniByTipo(societaId, periodoPrec, "FATTURA_ATTIVA");
        const costiPrec = await sumOperazioniByTipo(societaId, periodoPrec, "COSTO");
        valorePrec = ricaviPrec - costiPrec;
      }
      return makeKpiResult("MARGINE_LORDO", "Margine Lordo", valore, valorePrec, "€");
    },
  },
  {
    codice: "EBITDA",
    nome: "EBITDA",
    categoria: "ECONOMICO",
    unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      // EBITDA = Ricavi - Costi operativi (escl. ammortamenti e imposte)
      const ricavi = await sumOperazioniByTipo(societaId, periodo, "FATTURA_ATTIVA");
      const costiOp = await sumOperazioniByTipo(societaId, periodo, "COSTO");
      const valore = ricavi - costiOp;
      let valorePrec: number | null = null;
      if (periodoPrec) {
        const rP = await sumOperazioniByTipo(societaId, periodoPrec, "FATTURA_ATTIVA");
        const cP = await sumOperazioniByTipo(societaId, periodoPrec, "COSTO");
        valorePrec = rP - cP;
      }
      return makeKpiResult("EBITDA", "EBITDA", valore, valorePrec, "€");
    },
  },
  {
    codice: "UTILE_NETTO",
    nome: "Utile Netto",
    categoria: "ECONOMICO",
    unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const ricavi = await sumOperazioniByTipo(societaId, periodo, "FATTURA_ATTIVA");
      const costi = await sumOperazioniByTipo(societaId, periodo, "COSTO");
      const imposte = await sumOperazioniByTipo(societaId, periodo, "PAGAMENTO_IMPOSTE");
      const valore = ricavi - costi - imposte;
      let valorePrec: number | null = null;
      if (periodoPrec) {
        const rP = await sumOperazioniByTipo(societaId, periodoPrec, "FATTURA_ATTIVA");
        const cP = await sumOperazioniByTipo(societaId, periodoPrec, "COSTO");
        const iP = await sumOperazioniByTipo(societaId, periodoPrec, "PAGAMENTO_IMPOSTE");
        valorePrec = rP - cP - iP;
      }
      return makeKpiResult("UTILE_NETTO", "Utile Netto", valore, valorePrec, "€");
    },
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bi/kpi/__tests__/economici.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bi/kpi/economici.ts src/lib/bi/kpi/__tests__/economici.test.ts
git commit -m "feat(sp13): add KPI economici (ricavi, costi, margine, EBITDA, utile)"
```

---

## Task 5: KPI Finanziari (DSO, DPO, Cash Burn Rate)

**Files:**
- Create: `src/lib/bi/kpi/finanziari.ts`
- Create: `src/lib/bi/kpi/__tests__/finanziari.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/bi/kpi/__tests__/finanziari.test.ts
import { describe, it, expect } from "vitest";
import { kpiFinanziari } from "../finanziari";

describe("kpi finanziari", () => {
  it("exports 3 KPI calculators", () => {
    expect(kpiFinanziari).toHaveLength(3);
  });

  it("has correct codes", () => {
    const codes = kpiFinanziari.map((k) => k.codice);
    expect(codes).toEqual(["DSO", "DPO", "CASH_BURN_RATE"]);
  });

  it("DSO and DPO use giorni unit", () => {
    expect(kpiFinanziari[0].unita).toBe("giorni");
    expect(kpiFinanziari[1].unita).toBe("giorni");
  });

  it("CASH_BURN_RATE uses EUR unit", () => {
    expect(kpiFinanziari[2].unita).toBe("€/mese");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bi/kpi/__tests__/finanziari.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement finanziari KPIs**

```typescript
// src/lib/bi/kpi/finanziari.ts
import { prisma } from "@/lib/prisma";
import { differenceInDays } from "date-fns";
import type { KpiCalculator } from "./types";
import type { KpiResult, PeriodRange } from "../types";
import { calcolaVariazione, determinaTrend } from "../utils";

function makeResult(codice: string, nome: string, valore: number, valorePrec: number | null, unita: string): KpiResult {
  const variazione = valorePrec != null ? calcolaVariazione(valore, valorePrec) : null;
  return {
    codice, nome, categoria: "FINANZIARIO",
    valore: Math.round(valore * 100) / 100,
    valorePrec: valorePrec != null ? Math.round(valorePrec * 100) / 100 : null,
    variazione: variazione != null ? Math.round(variazione * 100) / 100 : null,
    trend: determinaTrend(variazione), unita,
  };
}

async function calcDSO(societaId: number, periodo: PeriodRange): Promise<number> {
  const chiuse = await prisma.scadenzaPartitario.findMany({
    where: {
      societaId, tipo: "CLIENTE", stato: "CHIUSA",
      dataScadenza: { gte: periodo.da, lte: periodo.a },
    },
    include: { operazione: { select: { dataOperazione: true } } },
  });

  if (chiuse.length === 0) return 0;
  const totalDays = chiuse.reduce((sum, s) => {
    if (!s.operazione?.dataOperazione) return sum;
    return sum + Math.max(0, differenceInDays(s.dataScadenza, s.operazione.dataOperazione));
  }, 0);
  return totalDays / chiuse.length;
}

async function calcDPO(societaId: number, periodo: PeriodRange): Promise<number> {
  const chiuse = await prisma.scadenzaPartitario.findMany({
    where: {
      societaId, tipo: "FORNITORE", stato: "CHIUSA",
      dataScadenza: { gte: periodo.da, lte: periodo.a },
    },
    include: { operazione: { select: { dataOperazione: true } } },
  });

  if (chiuse.length === 0) return 0;
  const totalDays = chiuse.reduce((sum, s) => {
    if (!s.operazione?.dataOperazione) return sum;
    return sum + Math.max(0, differenceInDays(s.dataScadenza, s.operazione.dataOperazione));
  }, 0);
  return totalDays / chiuse.length;
}

async function calcCashBurn(societaId: number, periodo: PeriodRange): Promise<number> {
  const costi = await prisma.operazione.aggregate({
    where: {
      societaId, tipoOperazione: "COSTO",
      dataOperazione: { gte: periodo.da, lte: periodo.a },
      eliminato: false, bozza: false,
    },
    _sum: { importoTotale: true },
  });
  const months = Math.max(1, differenceInDays(periodo.a, periodo.da) / 30);
  return Number(costi._sum.importoTotale ?? 0) / months;
}

export const kpiFinanziari: KpiCalculator[] = [
  {
    codice: "DSO", nome: "Days Sales Outstanding", categoria: "FINANZIARIO", unita: "giorni",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await calcDSO(societaId, periodo);
      const valorePrec = periodoPrec ? await calcDSO(societaId, periodoPrec) : null;
      return makeResult("DSO", "Days Sales Outstanding", valore, valorePrec, "giorni");
    },
  },
  {
    codice: "DPO", nome: "Days Payable Outstanding", categoria: "FINANZIARIO", unita: "giorni",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await calcDPO(societaId, periodo);
      const valorePrec = periodoPrec ? await calcDPO(societaId, periodoPrec) : null;
      return makeResult("DPO", "Days Payable Outstanding", valore, valorePrec, "giorni");
    },
  },
  {
    codice: "CASH_BURN_RATE", nome: "Cash Burn Rate", categoria: "FINANZIARIO", unita: "€/mese",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await calcCashBurn(societaId, periodo);
      const valorePrec = periodoPrec ? await calcCashBurn(societaId, periodoPrec) : null;
      return makeResult("CASH_BURN_RATE", "Cash Burn Rate", valore, valorePrec, "€/mese");
    },
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bi/kpi/__tests__/finanziari.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bi/kpi/finanziari.ts src/lib/bi/kpi/__tests__/finanziari.test.ts
git commit -m "feat(sp13): add KPI finanziari (DSO, DPO, cash burn rate)"
```

---

## Task 6: KPI Fiscali and Operativi

**Files:**
- Create: `src/lib/bi/kpi/fiscali.ts`
- Create: `src/lib/bi/kpi/operativi.ts`

- [ ] **Step 1: Implement fiscali KPIs**

```typescript
// src/lib/bi/kpi/fiscali.ts
import { prisma } from "@/lib/prisma";
import type { KpiCalculator } from "./types";
import type { KpiResult, PeriodRange } from "../types";
import { calcolaVariazione, determinaTrend } from "../utils";

function makeResult(codice: string, nome: string, valore: number, valorePrec: number | null, unita: string): KpiResult {
  const variazione = valorePrec != null ? calcolaVariazione(valore, valorePrec) : null;
  return {
    codice, nome, categoria: "FISCALE",
    valore: Math.round(valore * 100) / 100,
    valorePrec: valorePrec != null ? Math.round(valorePrec * 100) / 100 : null,
    variazione: variazione != null ? Math.round(variazione * 100) / 100 : null,
    trend: determinaTrend(variazione), unita,
  };
}

async function getIvaSaldo(societaId: number, anno: number): Promise<{ debito: number; credito: number }> {
  const liquidazioni = await prisma.liquidazioneIva.findMany({
    where: { societaId, anno },
    select: { saldo: true },
  });
  let debito = 0;
  let credito = 0;
  for (const l of liquidazioni) {
    const saldo = Number(l.saldo);
    if (saldo > 0) debito += saldo;
    else credito += Math.abs(saldo);
  }
  return { debito, credito };
}

export const kpiFiscali: KpiCalculator[] = [
  {
    codice: "DEBITO_IVA", nome: "Debito IVA Cumulato", categoria: "FISCALE", unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const anno = periodo.da.getFullYear();
      const { debito } = await getIvaSaldo(societaId, anno);
      const annoPrec = periodoPrec ? periodoPrec.da.getFullYear() : null;
      const valorePrec = annoPrec ? (await getIvaSaldo(societaId, annoPrec)).debito : null;
      return makeResult("DEBITO_IVA", "Debito IVA Cumulato", debito, valorePrec, "€");
    },
  },
  {
    codice: "CREDITO_IVA", nome: "Credito IVA", categoria: "FISCALE", unita: "€",
    async calculate(societaId, periodo, periodoPrec) {
      const anno = periodo.da.getFullYear();
      const { credito } = await getIvaSaldo(societaId, anno);
      const annoPrec = periodoPrec ? periodoPrec.da.getFullYear() : null;
      const valorePrec = annoPrec ? (await getIvaSaldo(societaId, annoPrec)).credito : null;
      return makeResult("CREDITO_IVA", "Credito IVA", credito, valorePrec, "€");
    },
  },
];
```

- [ ] **Step 2: Implement operativi KPIs**

```typescript
// src/lib/bi/kpi/operativi.ts
import { prisma } from "@/lib/prisma";
import type { KpiCalculator } from "./types";
import type { KpiResult, PeriodRange } from "../types";
import { calcolaVariazione, determinaTrend } from "../utils";

function makeResult(codice: string, nome: string, valore: number, valorePrec: number | null, unita: string, cat: string = "OPERATIVO"): KpiResult {
  const variazione = valorePrec != null ? calcolaVariazione(valore, valorePrec) : null;
  return {
    codice, nome, categoria: cat,
    valore: Math.round(valore * 100) / 100,
    valorePrec: valorePrec != null ? Math.round(valorePrec * 100) / 100 : null,
    variazione: variazione != null ? Math.round(variazione * 100) / 100 : null,
    trend: determinaTrend(variazione), unita,
  };
}

async function countFatture(societaId: number, periodo: PeriodRange): Promise<number> {
  return prisma.fatturaElettronica.count({
    where: {
      societaId,
      dataDocumento: { gte: periodo.da, lte: periodo.a },
    },
  });
}

async function calcTassoInsoluti(societaId: number, periodo: PeriodRange): Promise<number> {
  const totale = await prisma.scadenzaPartitario.count({
    where: {
      societaId, tipo: "CLIENTE",
      dataScadenza: { gte: periodo.da, lte: periodo.a },
    },
  });
  if (totale === 0) return 0;

  const insoluti = await prisma.scadenzaPartitario.count({
    where: {
      societaId, tipo: "CLIENTE",
      stato: { in: ["APERTA", "PARZIALE"] },
      dataScadenza: { gte: periodo.da, lte: periodo.a },
    },
  });

  return (insoluti / totale) * 100;
}

export const kpiOperativi: KpiCalculator[] = [
  {
    codice: "NUM_FATTURE", nome: "Numero Fatture", categoria: "OPERATIVO", unita: "n",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await countFatture(societaId, periodo);
      const valorePrec = periodoPrec ? await countFatture(societaId, periodoPrec) : null;
      return makeResult("NUM_FATTURE", "Numero Fatture", valore, valorePrec, "n");
    },
  },
  {
    codice: "TASSO_INSOLUTI", nome: "Tasso Insoluti", categoria: "OPERATIVO", unita: "%",
    async calculate(societaId, periodo, periodoPrec) {
      const valore = await calcTassoInsoluti(societaId, periodo);
      const valorePrec = periodoPrec ? await calcTassoInsoluti(societaId, periodoPrec) : null;
      return makeResult("TASSO_INSOLUTI", "Tasso Insoluti", valore, valorePrec, "%");
    },
  },
];
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/bi/kpi/fiscali.ts src/lib/bi/kpi/operativi.ts
git commit -m "feat(sp13): add KPI fiscali (IVA debito/credito) and operativi (fatture, insoluti)"
```

---

## Task 7: KPI Engine Orchestrator

**Files:**
- Create: `src/lib/bi/kpi/engine.ts`
- Create: `src/lib/bi/kpi/__tests__/engine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/bi/kpi/__tests__/engine.test.ts
import { describe, it, expect } from "vitest";
import { getAllKpiCalculators } from "../engine";

describe("kpi engine", () => {
  it("returns all registered KPI calculators", () => {
    const all = getAllKpiCalculators();
    expect(all.length).toBeGreaterThanOrEqual(12);
  });

  it("has unique codes", () => {
    const all = getAllKpiCalculators();
    const codes = all.map((k) => k.codice);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("covers all categories", () => {
    const all = getAllKpiCalculators();
    const categories = new Set(all.map((k) => k.categoria));
    expect(categories).toContain("ECONOMICO");
    expect(categories).toContain("FINANZIARIO");
    expect(categories).toContain("FISCALE");
    expect(categories).toContain("OPERATIVO");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bi/kpi/__tests__/engine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement engine**

```typescript
// src/lib/bi/kpi/engine.ts
import { prisma } from "@/lib/prisma";
import type { KpiCalculator } from "./types";
import type { KpiResult, PeriodRange } from "../types";
import { buildPeriodRange } from "../utils";
import { kpiEconomici } from "./economici";
import { kpiFinanziari } from "./finanziari";
import { kpiFiscali } from "./fiscali";
import { kpiOperativi } from "./operativi";

export function getAllKpiCalculators(): KpiCalculator[] {
  return [...kpiEconomici, ...kpiFinanziari, ...kpiFiscali, ...kpiOperativi];
}

function getPreviousPeriod(anno: number, periodo: number, tipo: string): PeriodRange {
  switch (tipo) {
    case "MESE": {
      const prevMese = periodo === 1 ? 12 : periodo - 1;
      const prevAnno = periodo === 1 ? anno - 1 : anno;
      return buildPeriodRange(prevAnno, prevMese, "MESE");
    }
    case "TRIMESTRE": {
      const prevQ = periodo === 1 ? 4 : periodo - 1;
      const prevAnno = periodo === 1 ? anno - 1 : anno;
      return buildPeriodRange(prevAnno, prevQ, "TRIMESTRE");
    }
    case "ANNO":
    default:
      return buildPeriodRange(anno - 1, 1, "ANNO");
  }
}

export async function calculateAllKpis(
  societaId: number,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<KpiResult[]> {
  const range = buildPeriodRange(anno, periodo, periodoTipo);
  const prevRange = getPreviousPeriod(anno, periodo, periodoTipo);
  const calculators = getAllKpiCalculators();

  const results: KpiResult[] = [];
  for (const calc of calculators) {
    try {
      const result = await calc.calculate(societaId, range, prevRange);
      results.push(result);
    } catch (error) {
      console.error(`[KpiEngine] Errore calcolo ${calc.codice}:`, error);
    }
  }

  return results;
}

export async function calculateAndCacheKpis(
  societaId: number,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<KpiResult[]> {
  const results = await calculateAllKpis(societaId, anno, periodo, periodoTipo);
  const periodLabel = buildPeriodRange(anno, periodo, periodoTipo).label;

  for (const result of results) {
    // Find or create KpiDefinizione
    let kpiDef = await prisma.kpiDefinizione.findFirst({
      where: { codice: result.codice, OR: [{ societaId }, { societaId: null }] },
    });

    if (!kpiDef) {
      kpiDef = await prisma.kpiDefinizione.create({
        data: {
          codice: result.codice,
          nome: result.nome,
          categoria: mapCategoria(result.categoria),
          formula: {},
          attivo: true,
        },
      });
    }

    await prisma.kpiValore.upsert({
      where: {
        societaId_kpiId_periodo_periodoTipo: {
          societaId,
          kpiId: kpiDef.id,
          periodo: periodLabel,
          periodoTipo: periodoTipo as any,
        },
      },
      update: {
        valore: result.valore,
        valorePrec: result.valorePrec,
        variazione: result.variazione,
        trend: result.trend,
        calcolatoAt: new Date(),
      },
      create: {
        societaId,
        kpiId: kpiDef.id,
        periodo: periodLabel,
        periodoTipo: periodoTipo as any,
        valore: result.valore,
        valorePrec: result.valorePrec,
        variazione: result.variazione,
        trend: result.trend,
      },
    });
  }

  return results;
}

function mapCategoria(cat: string): any {
  const map: Record<string, string> = {
    ECONOMICO: "ECONOMICO",
    FINANZIARIO: "FINANZIARIO",
    FISCALE: "FISCALE",
    OPERATIVO: "OPERATIVO",
    CRESCITA: "CRESCITA",
  };
  return map[cat] || "ECONOMICO";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bi/kpi/__tests__/engine.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bi/kpi/engine.ts src/lib/bi/kpi/__tests__/engine.test.ts
git commit -m "feat(sp13): add KPI engine orchestrator with caching"
```

---

## Task 8: Comparative Analysis — Period vs Period

**Files:**
- Create: `src/lib/bi/comparativa/types.ts`
- Create: `src/lib/bi/comparativa/periodo.ts`
- Create: `src/lib/bi/comparativa/__tests__/periodo.test.ts`

- [ ] **Step 1: Write types**

```typescript
// src/lib/bi/comparativa/types.ts
import type { ComparisonRow, PeriodRange } from "../types";

export interface ComparisonResult {
  titolo: string;
  periodoCorrente: string;
  periodoPrecedente: string;
  righe: ComparisonRow[];
  sommario: {
    deltaRicavi: number;
    deltaCosti: number;
    deltaMargine: number;
  };
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/bi/comparativa/__tests__/periodo.test.ts
import { describe, it, expect } from "vitest";
import { buildComparisonRow } from "../periodo";

describe("periodo comparison", () => {
  it("builds comparison row with delta", () => {
    const row = buildComparisonRow("Ricavi", 1200, 1000);
    expect(row.label).toBe("Ricavi");
    expect(row.valoreCorrente).toBe(1200);
    expect(row.valorePrecedente).toBe(1000);
    expect(row.delta).toBe(200);
    expect(row.deltaPerc).toBeCloseTo(20);
  });

  it("handles zero previous value", () => {
    const row = buildComparisonRow("Ricavi", 100, 0);
    expect(row.delta).toBe(100);
    expect(row.deltaPerc).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/bi/comparativa/__tests__/periodo.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement period comparison**

```typescript
// src/lib/bi/comparativa/periodo.ts
import type { ComparisonRow } from "../types";
import type { ComparisonResult } from "./types";
import { calculateAllKpis } from "../kpi/engine";
import { buildPeriodRange } from "../utils";

export function buildComparisonRow(label: string, corrente: number, precedente: number): ComparisonRow {
  const delta = corrente - precedente;
  const deltaPerc = precedente !== 0 ? ((delta / Math.abs(precedente)) * 100) : null;
  return {
    label,
    valoreCorrente: Math.round(corrente * 100) / 100,
    valorePrecedente: Math.round(precedente * 100) / 100,
    delta: Math.round(delta * 100) / 100,
    deltaPerc: deltaPerc != null ? Math.round(deltaPerc * 100) / 100 : null,
  };
}

export async function comparePeriods(
  societaId: number,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<ComparisonResult> {
  const corrente = await calculateAllKpis(societaId, anno, periodo, periodoTipo);
  const range = buildPeriodRange(anno, periodo, periodoTipo);

  // Build previous period params
  let annoPrec = anno;
  let periodoPrec = periodo;
  if (periodoTipo === "MESE") {
    periodoPrec = periodo === 1 ? 12 : periodo - 1;
    annoPrec = periodo === 1 ? anno - 1 : anno;
  } else if (periodoTipo === "TRIMESTRE") {
    periodoPrec = periodo === 1 ? 4 : periodo - 1;
    annoPrec = periodo === 1 ? anno - 1 : anno;
  } else {
    annoPrec = anno - 1;
  }

  const precedente = await calculateAllKpis(societaId, annoPrec, periodoPrec, periodoTipo);
  const rangePrec = buildPeriodRange(annoPrec, periodoPrec, periodoTipo);

  const righe: ComparisonRow[] = corrente.map((kpi) => {
    const prev = precedente.find((p) => p.codice === kpi.codice);
    return buildComparisonRow(kpi.nome, kpi.valore, prev?.valore ?? 0);
  });

  const ricaviRow = righe.find((r) => r.label === "Ricavi");
  const costiRow = righe.find((r) => r.label === "Costi");
  const margineRow = righe.find((r) => r.label === "Margine Lordo");

  return {
    titolo: `Confronto ${range.label} vs ${rangePrec.label}`,
    periodoCorrente: range.label,
    periodoPrecedente: rangePrec.label,
    righe,
    sommario: {
      deltaRicavi: ricaviRow?.delta ?? 0,
      deltaCosti: costiRow?.delta ?? 0,
      deltaMargine: margineRow?.delta ?? 0,
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/bi/comparativa/__tests__/periodo.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/bi/comparativa/
git commit -m "feat(sp13): add period vs period comparative analysis"
```

---

## Task 9: Budget vs Actual Comparison

**Files:**
- Create: `src/lib/bi/comparativa/budget.ts`
- Create: `src/lib/bi/comparativa/__tests__/budget.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/bi/comparativa/__tests__/budget.test.ts
import { describe, it, expect } from "vitest";
import { buildBudgetComparisonRow } from "../budget";

describe("budget comparison", () => {
  it("builds budget vs actual row", () => {
    const row = buildBudgetComparisonRow("Ricavi", 1200, 1000);
    expect(row.label).toBe("Ricavi");
    expect(row.valoreCorrente).toBe(1200); // actual
    expect(row.valorePrecedente).toBe(1000); // budget
    expect(row.delta).toBe(200);
    expect(row.deltaPerc).toBeCloseTo(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/bi/comparativa/__tests__/budget.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement budget comparison**

```typescript
// src/lib/bi/comparativa/budget.ts
import { prisma } from "@/lib/prisma";
import type { ComparisonRow } from "../types";
import { buildComparisonRow } from "./periodo";

export const buildBudgetComparisonRow = buildComparisonRow;

export async function compareBudgetVsActual(
  societaId: number,
  budgetId: number,
  mese: number
): Promise<{ righe: ComparisonRow[]; totaleScostamento: number }> {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, societaId },
    include: {
      righe: {
        where: { mese },
        include: { conto: { select: { id: true, descrizione: true, tipo: true } } },
      },
    },
  });

  if (!budget) return { righe: [], totaleScostamento: 0 };

  const anno = budget.anno;
  const righe: ComparisonRow[] = [];
  let totaleScostamento = 0;

  for (const riga of budget.righe) {
    // Get actual from MovimentoContabile for this account and month
    const movimenti = await prisma.movimentoContabile.aggregate({
      where: {
        societaId,
        contoId: riga.contoId,
        scrittura: {
          dataRegistrazione: {
            gte: new Date(anno, mese - 1, 1),
            lt: new Date(anno, mese, 1),
          },
          stato: "DEFINITIVA",
        },
      },
      _sum: { importoDare: true, importoAvere: true },
    });

    const dare = Number(movimenti._sum.importoDare ?? 0);
    const avere = Number(movimenti._sum.importoAvere ?? 0);
    const actual = riga.conto.tipo === "ECONOMICO_COSTO" ? dare - avere : avere - dare;
    const budgetVal = Number(riga.importo);

    const row = buildBudgetComparisonRow(riga.conto.descrizione, actual, budgetVal);
    righe.push(row);
    totaleScostamento += row.delta;
  }

  return { righe, totaleScostamento };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/bi/comparativa/__tests__/budget.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bi/comparativa/budget.ts src/lib/bi/comparativa/__tests__/budget.test.ts
git commit -m "feat(sp13): add budget vs actual comparison"
```

---

## Task 10: Report Templates

**Files:**
- Create: `src/lib/bi/report/types.ts`
- Create: `src/lib/bi/report/templates.ts`
- Create: `src/lib/bi/report/__tests__/templates.test.ts`

- [ ] **Step 1: Write types**

```typescript
// src/lib/bi/report/types.ts
export interface ReportSectionDef {
  tipo: "kpi_summary" | "kpi_table" | "comparison" | "health_score" | "alert_summary" | "text";
  titolo: string;
  config?: Record<string, unknown>;
}

export interface PredefinedReport {
  tipo: string;
  nome: string;
  descrizione: string;
  sezioni: ReportSectionDef[];
  destinatariDefault: string[];
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// src/lib/bi/report/__tests__/templates.test.ts
import { describe, it, expect } from "vitest";
import { PREDEFINED_REPORTS, getReportTemplate } from "../templates";

describe("report templates", () => {
  it("has 6 predefined reports", () => {
    expect(PREDEFINED_REPORTS).toHaveLength(6);
  });

  it("all have required fields", () => {
    for (const r of PREDEFINED_REPORTS) {
      expect(r.tipo).toBeTruthy();
      expect(r.nome).toBeTruthy();
      expect(r.sezioni.length).toBeGreaterThan(0);
    }
  });

  it("getReportTemplate returns template by tipo", () => {
    const t = getReportTemplate("CRUSCOTTO_MENSILE");
    expect(t).toBeDefined();
    expect(t!.nome).toContain("Cruscotto");
  });

  it("getReportTemplate returns undefined for unknown", () => {
    expect(getReportTemplate("UNKNOWN")).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/bi/report/__tests__/templates.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement templates**

```typescript
// src/lib/bi/report/templates.ts
import type { PredefinedReport } from "./types";

export const PREDEFINED_REPORTS: PredefinedReport[] = [
  {
    tipo: "CRUSCOTTO_MENSILE",
    nome: "Cruscotto Mensile",
    descrizione: "KPI principali + trend + alert attivi",
    destinatariDefault: ["ADMIN", "STANDARD"],
    sezioni: [
      { tipo: "health_score", titolo: "Salute Azienda" },
      { tipo: "kpi_summary", titolo: "KPI Economici", config: { categoria: "ECONOMICO" } },
      { tipo: "kpi_summary", titolo: "KPI Finanziari", config: { categoria: "FINANZIARIO" } },
      { tipo: "comparison", titolo: "Confronto vs Mese Precedente", config: { periodoTipo: "MESE" } },
      { tipo: "alert_summary", titolo: "Alert Attivi" },
    ],
  },
  {
    tipo: "REPORT_IVA_TRIMESTRALE",
    nome: "Report IVA Trimestrale",
    descrizione: "Riepilogo IVA + liquidazione + previsione",
    destinatariDefault: ["ADMIN", "COMMERCIALISTA"],
    sezioni: [
      { tipo: "kpi_summary", titolo: "KPI Fiscali", config: { categoria: "FISCALE" } },
      { tipo: "kpi_table", titolo: "Dettaglio IVA", config: { codici: ["DEBITO_IVA", "CREDITO_IVA"] } },
      { tipo: "comparison", titolo: "Confronto vs Trimestre Precedente", config: { periodoTipo: "TRIMESTRE" } },
    ],
  },
  {
    tipo: "ANALISI_COSTI",
    nome: "Analisi Costi",
    descrizione: "Breakdown costi per categoria + confronto periodo",
    destinatariDefault: ["ADMIN"],
    sezioni: [
      { tipo: "kpi_summary", titolo: "Riepilogo Costi", config: { codici: ["COSTI", "EBITDA", "CASH_BURN_RATE"] } },
      { tipo: "comparison", titolo: "Confronto vs Periodo Precedente", config: { periodoTipo: "MESE" } },
    ],
  },
  {
    tipo: "SITUAZIONE_CLIENTI_FORNITORI",
    nome: "Situazione Clienti/Fornitori",
    descrizione: "Aging, insoluti, scaduto, previsione",
    destinatariDefault: ["ADMIN", "COMMERCIALISTA"],
    sezioni: [
      { tipo: "kpi_summary", titolo: "KPI Operativi", config: { categoria: "OPERATIVO" } },
      { tipo: "kpi_table", titolo: "DSO e DPO", config: { codici: ["DSO", "DPO", "TASSO_INSOLUTI"] } },
    ],
  },
  {
    tipo: "REPORT_ANNUALE",
    nome: "Report Annuale",
    descrizione: "CE + SP + KPI + trend + confronto YoY",
    destinatariDefault: ["ADMIN"],
    sezioni: [
      { tipo: "health_score", titolo: "Salute Azienda" },
      { tipo: "kpi_summary", titolo: "Tutti i KPI", config: {} },
      { tipo: "comparison", titolo: "Confronto Anno Precedente", config: { periodoTipo: "ANNO" } },
      { tipo: "text", titolo: "Narrativa AI", config: { aiGenerated: true } },
    ],
  },
  {
    tipo: "MULTI_CLIENTE",
    nome: "Dashboard Multi-Cliente",
    descrizione: "Dashboard aggregata con semafori per commercialista",
    destinatariDefault: ["COMMERCIALISTA"],
    sezioni: [
      { tipo: "health_score", titolo: "Panoramica Clienti" },
      { tipo: "alert_summary", titolo: "Alert Critici" },
    ],
  },
];

export function getReportTemplate(tipo: string): PredefinedReport | undefined {
  return PREDEFINED_REPORTS.find((r) => r.tipo === tipo);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/bi/report/__tests__/templates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/bi/report/
git commit -m "feat(sp13): add 6 predefined report templates"
```

---

## Task 11: Report Generator

**Files:**
- Create: `src/lib/bi/report/generator.ts`

- [ ] **Step 1: Implement report generator**

```typescript
// src/lib/bi/report/generator.ts
import { prisma } from "@/lib/prisma";
import { calculateAllKpis } from "../kpi/engine";
import { comparePeriods } from "../comparativa/periodo";
import { getReportTemplate } from "./templates";
import type { ReportSectionDef } from "./types";

export interface GeneratedReportData {
  sezioni: { titolo: string; tipo: string; dati: unknown }[];
  periodo: string;
  generatoAt: string;
}

async function resolveSection(
  section: ReportSectionDef,
  societaId: number,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<{ titolo: string; tipo: string; dati: unknown }> {
  switch (section.tipo) {
    case "kpi_summary": {
      const kpis = await calculateAllKpis(societaId, anno, periodo, periodoTipo);
      const categoria = (section.config?.categoria as string) || null;
      const codici = (section.config?.codici as string[]) || null;
      let filtered = kpis;
      if (categoria) filtered = filtered.filter((k) => k.categoria === categoria);
      if (codici) filtered = filtered.filter((k) => codici.includes(k.codice));
      return { titolo: section.titolo, tipo: section.tipo, dati: filtered };
    }
    case "kpi_table": {
      const kpis = await calculateAllKpis(societaId, anno, periodo, periodoTipo);
      const codici = (section.config?.codici as string[]) || [];
      return { titolo: section.titolo, tipo: section.tipo, dati: kpis.filter((k) => codici.includes(k.codice)) };
    }
    case "comparison": {
      const pt = (section.config?.periodoTipo as string) || periodoTipo;
      const result = await comparePeriods(societaId, anno, periodo, pt);
      return { titolo: section.titolo, tipo: section.tipo, dati: result };
    }
    case "health_score": {
      const hs = await prisma.healthScore.findFirst({
        where: { societaId, anno, mese: periodo },
        orderBy: { calcolatoAt: "desc" },
      });
      return { titolo: section.titolo, tipo: section.tipo, dati: hs };
    }
    case "alert_summary": {
      const alerts = await prisma.alertGenerato.findMany({
        where: { societaId, stato: { in: ["NUOVO", "VISTO"] } },
        orderBy: { gravita: "desc" },
        take: 10,
      });
      return { titolo: section.titolo, tipo: section.tipo, dati: alerts };
    }
    case "text":
    default:
      return { titolo: section.titolo, tipo: section.tipo, dati: null };
  }
}

export async function generateReport(
  societaId: number,
  reportTipo: string,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<GeneratedReportData> {
  const template = getReportTemplate(reportTipo);
  if (!template) throw new Error(`Template report non trovato: ${reportTipo}`);

  const sezioni = [];
  for (const section of template.sezioni) {
    const resolved = await resolveSection(section, societaId, anno, periodo, periodoTipo);
    sezioni.push(resolved);
  }

  return {
    sezioni,
    periodo: `${anno}-${String(periodo).padStart(2, "0")}`,
    generatoAt: new Date().toISOString(),
  };
}

export async function generateAndPersistReport(
  societaId: number,
  reportTipo: string,
  anno: number,
  periodo: number,
  periodoTipo: string
): Promise<number> {
  const template = getReportTemplate(reportTipo);
  if (!template) throw new Error(`Template report non trovato: ${reportTipo}`);

  // Find or create DB template
  let dbTemplate = await prisma.reportTemplate.findFirst({
    where: { tipo: reportTipo, OR: [{ societaId }, { societaId: null }] },
  });

  if (!dbTemplate) {
    dbTemplate = await prisma.reportTemplate.create({
      data: {
        nome: template.nome,
        tipo: template.tipo,
        sezioni: template.sezioni as any,
        destinatari: template.destinatariDefault,
      },
    });
  }

  const data = await generateReport(societaId, reportTipo, anno, periodo, periodoTipo);

  const report = await prisma.reportGeneratoBI.create({
    data: {
      societaId,
      templateId: dbTemplate.id,
      periodo: data.periodo,
      dati: data as any,
      stato: "GENERATO",
    },
  });

  return report.id;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bi/report/generator.ts
git commit -m "feat(sp13): add report generator with section resolution and persistence"
```

---

## Task 12: Internal BI API Routes

**Files:**
- Create: `src/app/api/bi/kpi/route.ts`
- Create: `src/app/api/bi/report/route.ts`
- Create: `src/app/api/bi/report/[id]/route.ts`
- Create: `src/app/api/bi/budget/route.ts`
- Create: `src/app/api/bi/budget/[id]/route.ts`
- Create: `src/app/api/bi/comparativa/route.ts`

- [ ] **Step 1: Implement KPI route**

```typescript
// src/app/api/bi/kpi/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateAndCacheKpis } from "@/lib/bi/kpi/engine";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));
    const periodo = parseInt(searchParams.get("periodo") || String(new Date().getMonth() + 1));
    const periodoTipo = searchParams.get("periodoTipo") || "MESE";

    const kpis = await calculateAndCacheKpis(user.societaId, anno, periodo, periodoTipo);
    return NextResponse.json({ kpis, anno, periodo, periodoTipo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement report routes**

```typescript
// src/app/api/bi/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAndPersistReport } from "@/lib/bi/report/generator";
import { PREDEFINED_REPORTS } from "@/lib/bi/report/templates";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const reports = await prisma.reportGeneratoBI.findMany({
      where: { societaId: user.societaId },
      orderBy: { generatoAt: "desc" },
      take: 20,
      include: { template: { select: { nome: true, tipo: true } } },
    });

    return NextResponse.json({ reports, templateDisponibili: PREDEFINED_REPORTS.map((t) => ({ tipo: t.tipo, nome: t.nome, descrizione: t.descrizione })) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { tipo, anno, periodo, periodoTipo } = await request.json();
    if (!tipo) return NextResponse.json({ error: "Tipo report obbligatorio" }, { status: 400 });

    const reportId = await generateAndPersistReport(
      user.societaId,
      tipo,
      anno || new Date().getFullYear(),
      periodo || new Date().getMonth() + 1,
      periodoTipo || "MESE"
    );

    return NextResponse.json({ id: reportId }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

```typescript
// src/app/api/bi/report/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;
    const { id } = await params;

    const report = await prisma.reportGeneratoBI.findFirst({
      where: { id: parseInt(id), societaId: user.societaId },
      include: { template: true },
    });

    if (!report) return NextResponse.json({ error: "Report non trovato" }, { status: 404 });
    return NextResponse.json({ report });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Implement budget routes**

```typescript
// src/app/api/bi/budget/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const budgets = await prisma.budget.findMany({
      where: { societaId: user.societaId },
      orderBy: { anno: "desc" },
    });

    return NextResponse.json({ budgets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { anno, nome, righe } = await request.json();
    if (!anno || !nome) return NextResponse.json({ error: "Anno e nome obbligatori" }, { status: 400 });

    const budget = await prisma.budget.create({
      data: {
        societaId: user.societaId,
        anno,
        nome,
        righe: righe ? { create: righe.map((r: any) => ({ contoId: r.contoId, mese: r.mese, importo: r.importo })) } : undefined,
      },
      include: { righe: true },
    });

    return NextResponse.json({ budget }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

```typescript
// src/app/api/bi/budget/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compareBudgetVsActual } from "@/lib/bi/comparativa/budget";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const mese = parseInt(searchParams.get("mese") || String(new Date().getMonth() + 1));

    const budget = await prisma.budget.findFirst({
      where: { id: parseInt(id), societaId: user.societaId },
      include: { righe: { include: { conto: { select: { descrizione: true } } } } },
    });

    if (!budget) return NextResponse.json({ error: "Budget non trovato" }, { status: 404 });

    const comparison = await compareBudgetVsActual(user.societaId, budget.id, mese);

    return NextResponse.json({ budget, comparison });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Implement comparativa route**

```typescript
// src/app/api/bi/comparativa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { comparePeriods } from "@/lib/bi/comparativa/periodo";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));
    const periodo = parseInt(searchParams.get("periodo") || String(new Date().getMonth() + 1));
    const periodoTipo = searchParams.get("periodoTipo") || "MESE";

    const result = await comparePeriods(user.societaId, anno, periodo, periodoTipo);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bi/
git commit -m "feat(sp13): add internal BI API routes (KPI, report, budget, comparativa)"
```

---

## Task 13: V1 Public API Routes

**Files:**
- Create: `src/app/api/v1/kpi/route.ts`
- Create: `src/app/api/v1/report/route.ts`

- [ ] **Step 1: Implement V1 KPI route**

```typescript
// src/app/api/v1/kpi/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, hasScope } from "@/lib/api/auth-middleware";
import { addCorsHeaders, handleCorsPreflightIfNeeded } from "@/lib/api/cors";
import { calculateAllKpis } from "@/lib/bi/kpi/engine";

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return handleCorsPreflightIfNeeded("OPTIONS", origin, []) || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if ("error" in authResult) return (authResult as any).error;
  if (!("payload" in authResult)) return NextResponse.json({ error: "Auth failed" }, { status: 401 });

  const { payload } = authResult as any;
  if (!hasScope(payload.scopes, "read:kpi")) {
    return NextResponse.json({ error: "Scope insufficiente: read:kpi richiesto" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));
  const periodo = parseInt(searchParams.get("periodo") || String(new Date().getMonth() + 1));
  const periodoTipo = searchParams.get("periodoTipo") || "MESE";

  const kpis = await calculateAllKpis(payload.societaId, anno, periodo, periodoTipo);

  const response = NextResponse.json({ data: kpis, anno, periodo, periodoTipo });
  addCorsHeaders(response, request.headers.get("origin"), []);
  return response;
}
```

- [ ] **Step 2: Implement V1 report route**

```typescript
// src/app/api/v1/report/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api/auth-middleware";
import { addCorsHeaders, handleCorsPreflightIfNeeded } from "@/lib/api/cors";

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return handleCorsPreflightIfNeeded("OPTIONS", origin, []) || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if ("error" in authResult) return (authResult as any).error;
  if (!("payload" in authResult)) return NextResponse.json({ error: "Auth failed" }, { status: 401 });

  const { payload } = authResult as any;
  if (!hasScope(payload.scopes, "read:report")) {
    return NextResponse.json({ error: "Scope insufficiente: read:report richiesto" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") || "10")));

  const [data, total] = await Promise.all([
    prisma.reportGeneratoBI.findMany({
      where: { societaId: payload.societaId },
      orderBy: { generatoAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { template: { select: { nome: true, tipo: true } } },
    }),
    prisma.reportGeneratoBI.count({ where: { societaId: payload.societaId } }),
  ]);

  const response = NextResponse.json({
    data,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });
  addCorsHeaders(response, request.headers.get("origin"), []);
  return response;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/kpi/ src/app/api/v1/report/
git commit -m "feat(sp13): add V1 public API routes for KPI and reports"
```

---

## Task 14: Full Test Suite + Build

- [ ] **Step 1: Run all SP13 tests**

Run: `npx vitest run src/lib/bi/`
Expected: All tests pass.

- [ ] **Step 2: Run full project tests**

Run: `npx vitest run`
Expected: All existing tests still pass + new SP13 tests pass.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit any fixes**

If any test fails, fix and commit:
```bash
git add -A
git commit -m "fix(sp13): address test/build issues"
```

---

## Summary

| Task | Component | Tests |
|------|-----------|-------|
| 1 | Prisma models (6 new + 4 enums) | Migration |
| 2 | BI shared types + utils | 8 tests |
| 3 | KPI calculator interface | — |
| 4 | KPI Economici (5 calculators) | 4 tests |
| 5 | KPI Finanziari (DSO, DPO, cash burn) | 4 tests |
| 6 | KPI Fiscali + Operativi | — |
| 7 | KPI Engine orchestrator + cache | 3 tests |
| 8 | Comparative: period vs period | 2 tests |
| 9 | Comparative: budget vs actual | 1 test |
| 10 | Report templates (6 predefined) | 4 tests |
| 11 | Report generator | — |
| 12 | Internal BI API routes | Build verify |
| 13 | V1 public API routes | Build verify |
| 14 | Full test suite | Regression check |

**Total: 14 tasks, ~26 tests, ~14 commits**

### Deferred to subsequent iteration
- Custom report builder (drag-and-drop section composition)
- PDF report rendering (requires @react-pdf/renderer layout components)
- AI narrative integration (Claude Haiku — existing `report-generator.ts` provides the pattern)
- Recharts frontend components (separate frontend task)
- Benchmark settoriale (requires external ISTAT data)
- Waterfall and heatmap chart types
