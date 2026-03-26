# SP12: Intelligenza Proattiva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an alert engine with configurable rules across 6 categories, a smart daily to-do generator role-based, and API endpoints — all integrating with existing models (Anomalia, ScadenzaFiscale, HealthScore, Operazione, ScadenzaPartitario, FatturaElettronica).

**Architecture:** Two independent engines (`src/lib/intelligence/alert-engine/`, `src/lib/intelligence/todo-engine/`) sharing new Prisma models (RegolaAlert, AlertGenerato, TodoGenerato). Alert engine evaluates rules in batch (cron) or on-write (trigger). To-do engine generates daily prioritized lists per user/role. Both expose internal API routes (for frontend) and public V1 API routes (via SP11 auth middleware).

**Tech Stack:** Next.js 16, Prisma 6 (MySQL), Vitest, date-fns, existing SP11 API auth middleware, existing Notifica system for email channel.

**Spec:** `docs/superpowers/specs/2026-03-26-pain-point-driven-features-design.md` (section 4)

---

## File Structure

### New files
```
src/lib/intelligence/
  types.ts                    — AlertCategory, AlertSeverity, TodoSource, TodoStato, etc.
  alert-engine/
    types.ts                  — AlertRuleEvaluator interface, EvaluationContext
    rules/
      scadenze.ts             — Deadline-based alert rules (IVA, F24, CU)
      anomalie.ts             — Accounting anomaly alert rules
      cash-flow.ts            — Cash flow prediction alerts
      compliance.ts           — Compliance alerts (fatture non inviate, LIPE)
      riconciliazione.ts      — Reconciliation alerts
    evaluator.ts              — Orchestrator: runs all rules, deduplicates, creates AlertGenerato
    anti-spam.ts              — Grouping, snooze check, digest logic
    __tests__/
      scadenze.test.ts
      anomalie.test.ts
      cash-flow.test.ts
      compliance.test.ts
      riconciliazione.test.ts
      evaluator.test.ts
      anti-spam.test.ts
  todo-engine/
    types.ts                  — TodoGenerator interface, GenerationContext
    generators/
      scadenze.ts             — To-dos from fiscal deadlines
      anomalie.ts             — To-dos from open anomalies
      bozze.ts                — To-dos from draft operations
      riconciliazione.ts      — To-dos from pending reconciliation
      fatture.ts              — To-dos from unsent invoices
    generator.ts              — Orchestrator: runs all generators, prioritizes, creates TodoGenerato
    __tests__/
      scadenze.test.ts
      generator.test.ts

src/app/api/alert/route.ts                  — Internal: list/mark alerts for current user
src/app/api/alert/[id]/route.ts             — Internal: snooze/resolve single alert
src/app/api/todo/route.ts                   — Internal: list/update todos for current user
src/app/api/todo/[id]/route.ts              — Internal: mark todo as done/skipped
src/app/api/configurazione/alert/route.ts   — Internal: alert rules CRUD (admin)
src/app/api/v1/alert/route.ts               — Public V1 API: alerts
src/app/api/v1/todo/route.ts                — Public V1 API: todos
```

### Modified files
```
prisma/schema.prisma  — Add RegolaAlert, AlertGenerato, TodoGenerato + enums
```

---

## Task 1: Prisma Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and 3 new models to schema.prisma**

Add at the end of the schema file:

```prisma
enum GravitaAlert {
  INFO
  WARNING
  CRITICAL
}

enum StatoAlert {
  NUOVO
  VISTO
  SNOOZED
  RISOLTO
}

enum CategoriaAlert {
  SCADENZE
  ANOMALIE_CONTABILI
  CASH_FLOW
  COMPLIANCE
  CONFRONTO
  RICONCILIAZIONE
}

enum StatoTodo {
  DA_FARE
  IN_CORSO
  COMPLETATA
  SALTATA
}

enum FonteTodo {
  SCADENZA
  ANOMALIA
  BOZZA
  RICONCILIAZIONE
  FATTURA
  PORTALE
  ALTRO
}

model RegolaAlert {
  id                 Int              @id @default(autoincrement())
  societaId          Int?             @map("societa_id")
  categoria          CategoriaAlert
  codice             String           @db.VarChar(50)
  descrizione        String           @db.VarChar(255)
  sogliaValore       Float?           @map("soglia_valore")
  sogliaGiorni       Int?             @map("soglia_giorni")
  gravita            GravitaAlert     @default(WARNING)
  attiva             Boolean          @default(true)
  canali             Json             @default("[\"IN_APP\"]")
  ruoliDestinatari   Json             @default("[\"ADMIN\"]") @map("ruoli_destinatari")
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")

  societa            Societa?         @relation(fields: [societaId], references: [id], onDelete: Cascade)
  alertGenerati      AlertGenerato[]

  @@unique([societaId, codice])
  @@index([categoria, attiva])
  @@map("regole_alert")
}

model AlertGenerato {
  id                    Int           @id @default(autoincrement())
  societaId             Int           @map("societa_id")
  regolaId              Int           @map("regola_id")
  utenteDestinatarioId  Int           @map("utente_destinatario_id")
  tipo                  CategoriaAlert
  messaggio             String        @db.Text
  gravita               GravitaAlert
  datiContesto          Json?         @map("dati_contesto")
  linkAzione            String?       @map("link_azione") @db.VarChar(500)
  stato                 StatoAlert    @default(NUOVO)
  snoozeFinoA           DateTime?     @map("snooze_fino_a")
  risoltoAt             DateTime?     @map("risolto_at")
  createdAt             DateTime      @default(now()) @map("created_at")

  societa               Societa       @relation(fields: [societaId], references: [id], onDelete: Cascade)
  regola                RegolaAlert   @relation(fields: [regolaId], references: [id], onDelete: Cascade)
  utente                Utente        @relation(fields: [utenteDestinatarioId], references: [id])

  @@index([societaId, stato])
  @@index([utenteDestinatarioId, stato])
  @@index([regolaId, createdAt])
  @@map("alert_generati")
}

model TodoGenerato {
  id              Int        @id @default(autoincrement())
  societaId       Int        @map("societa_id")
  utenteId        Int        @map("utente_id")
  data            DateTime   @db.Date
  titolo          String     @db.VarChar(255)
  descrizione     String?    @db.Text
  priorita        Int        @default(3)
  linkAzione      String?    @map("link_azione") @db.VarChar(500)
  fonte           FonteTodo
  stato           StatoTodo  @default(DA_FARE)
  completataAt    DateTime?  @map("completata_at")
  createdAt       DateTime   @default(now()) @map("created_at")

  societa         Societa    @relation(fields: [societaId], references: [id], onDelete: Cascade)
  utente          Utente     @relation(fields: [utenteId], references: [id])

  @@index([societaId, utenteId, data])
  @@index([stato])
  @@map("todo_generati")
}
```

- [ ] **Step 2: Add relations to existing models**

Add to `Societa` model:
```prisma
  regoleAlert         RegolaAlert[]
  alertGenerati       AlertGenerato[]
  todoGenerati        TodoGenerato[]
```

Add to `Utente` model:
```prisma
  alertRicevuti       AlertGenerato[]
  todoAssegnati       TodoGenerato[]
```

- [ ] **Step 3: Run migration**

Run: `npx prisma migrate dev --name add-sp12-intelligence-models`
Expected: Migration created and applied successfully.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(sp12): add Prisma models for alert rules, generated alerts, and todos"
```

---

## Task 2: Intelligence Types

**Files:**
- Create: `src/lib/intelligence/types.ts`

- [ ] **Step 1: Write shared types**

```typescript
// src/lib/intelligence/types.ts
export type { CategoriaAlert, GravitaAlert, StatoAlert, StatoTodo, FonteTodo } from "@prisma/client";

export interface AlertRuleResult {
  codiceRegola: string;
  messaggio: string;
  gravita: "INFO" | "WARNING" | "CRITICAL";
  categoria: "SCADENZE" | "ANOMALIE_CONTABILI" | "CASH_FLOW" | "COMPLIANCE" | "CONFRONTO" | "RICONCILIAZIONE";
  linkAzione?: string;
  datiContesto?: Record<string, unknown>;
  /** Used for deduplication — same dedupeKey = same logical alert */
  dedupeKey: string;
}

export interface EvaluationContext {
  societaId: number;
  oggi: Date;
}

export type AlertRuleEvaluator = (ctx: EvaluationContext) => Promise<AlertRuleResult[]>;

export interface TodoItem {
  titolo: string;
  descrizione?: string;
  priorita: number; // 1 (highest) - 5 (lowest)
  linkAzione?: string;
  fonte: "SCADENZA" | "ANOMALIA" | "BOZZA" | "RICONCILIAZIONE" | "FATTURA" | "PORTALE" | "ALTRO";
  /** Used for deduplication */
  dedupeKey: string;
}

export interface TodoGenerationContext {
  societaId: number;
  utenteId: number;
  oggi: Date;
  modalitaAvanzata: boolean;
  modalitaCommercialista: boolean;
}

export type TodoGenerator = (ctx: TodoGenerationContext) => Promise<TodoItem[]>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/intelligence/types.ts
git commit -m "feat(sp12): add shared intelligence types for alerts and todos"
```

---

## Task 3: Alert Engine Types and Rule Config

**Files:**
- Create: `src/lib/intelligence/alert-engine/types.ts`

- [ ] **Step 1: Write alert engine types**

```typescript
// src/lib/intelligence/alert-engine/types.ts
import type { AlertRuleResult, EvaluationContext } from "../types";

export interface AlertRuleConfig {
  codice: string;
  categoria: AlertRuleResult["categoria"];
  descrizione: string;
  defaultGravita: AlertRuleResult["gravita"];
  defaultSogliaGiorni?: number;
  defaultSogliaValore?: number;
  evaluate: (ctx: EvaluationContext, soglia: RuleSoglia) => Promise<AlertRuleResult[]>;
}

export interface RuleSoglia {
  sogliaGiorni: number | null;
  sogliaValore: number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/intelligence/alert-engine/types.ts
git commit -m "feat(sp12): add alert engine types and rule config interface"
```

---

## Task 4: Scadenze Alert Rules

**Files:**
- Create: `src/lib/intelligence/alert-engine/rules/scadenze.ts`
- Create: `src/lib/intelligence/alert-engine/__tests__/scadenze.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/intelligence/alert-engine/__tests__/scadenze.test.ts
import { describe, it, expect } from "vitest";
import { scadenzeRules } from "../rules/scadenze";

describe("scadenze alert rules", () => {
  it("exports rules for IVA, F24, and CU deadlines", () => {
    expect(scadenzeRules).toHaveLength(3);
    expect(scadenzeRules[0].codice).toBe("SCAD_IVA_TRIMESTRALE");
    expect(scadenzeRules[1].codice).toBe("SCAD_F24");
    expect(scadenzeRules[2].codice).toBe("SCAD_CU_GENERAZIONE");
  });

  it("SCAD_IVA_TRIMESTRALE evaluates with context", async () => {
    const rule = scadenzeRules[0];
    // With no prisma, evaluate returns empty (no DB)
    // We test the structure, not the DB query
    expect(rule.categoria).toBe("SCADENZE");
    expect(rule.defaultGravita).toBe("WARNING");
    expect(rule.defaultSogliaGiorni).toBe(7);
  });

  it("SCAD_F24 has correct defaults", () => {
    const rule = scadenzeRules[1];
    expect(rule.defaultSogliaGiorni).toBe(3);
    expect(rule.defaultGravita).toBe("CRITICAL");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/scadenze.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement scadenze rules**

```typescript
// src/lib/intelligence/alert-engine/rules/scadenze.ts
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays } from "date-fns";
import type { AlertRuleConfig, RuleSoglia } from "../types";
import type { EvaluationContext, AlertRuleResult } from "../../types";

async function evaluateScadenzeImminenti(
  ctx: EvaluationContext,
  soglia: RuleSoglia,
  tipiScadenza: string[],
  codice: string,
  messaggioTemplate: (s: any, giorni: number) => string
): Promise<AlertRuleResult[]> {
  const giorniSoglia = soglia.sogliaGiorni ?? 7;
  const limite = addDays(ctx.oggi, giorniSoglia);

  const scadenze = await prisma.scadenzaFiscale.findMany({
    where: {
      societaId: ctx.societaId,
      tipo: { in: tipiScadenza as any },
      stato: { in: ["NON_INIZIATA", "IN_PREPARAZIONE"] },
      scadenza: { lte: limite, gte: ctx.oggi },
    },
  });

  return scadenze.map((s) => {
    const giorniRimasti = differenceInDays(s.scadenza, ctx.oggi);
    return {
      codiceRegola: codice,
      messaggio: messaggioTemplate(s, giorniRimasti),
      gravita: giorniRimasti <= 3 ? "CRITICAL" as const : "WARNING" as const,
      categoria: "SCADENZE" as const,
      linkAzione: `/adempimenti?anno=${s.anno}&periodo=${s.periodo}`,
      datiContesto: { scadenzaId: s.id, tipo: s.tipo, giorniRimasti },
      dedupeKey: `${codice}:${s.id}`,
    };
  });
}

export const scadenzeRules: AlertRuleConfig[] = [
  {
    codice: "SCAD_IVA_TRIMESTRALE",
    categoria: "SCADENZE",
    descrizione: "IVA trimestrale in scadenza",
    defaultGravita: "WARNING",
    defaultSogliaGiorni: 7,
    evaluate: (ctx, soglia) =>
      evaluateScadenzeImminenti(
        ctx, soglia,
        ["F24_IVA", "ACCONTO_IVA", "DICHIARAZIONE_IVA"],
        "SCAD_IVA_TRIMESTRALE",
        (s, g) => `Scadenza IVA ${s.tipo} tra ${g} giorni (${s.periodo}/${s.anno})`
      ),
  },
  {
    codice: "SCAD_F24",
    categoria: "SCADENZE",
    descrizione: "F24 in scadenza",
    defaultGravita: "CRITICAL",
    defaultSogliaGiorni: 3,
    evaluate: (ctx, soglia) =>
      evaluateScadenzeImminenti(
        ctx, soglia,
        ["F24_IVA", "F24_RITENUTE", "F24_ACCONTO_IRES", "F24_ACCONTO_IRPEF"],
        "SCAD_F24",
        (s, g) => `F24 ${s.tipo} in scadenza tra ${g} giorni`
      ),
  },
  {
    codice: "SCAD_CU_GENERAZIONE",
    categoria: "SCADENZE",
    descrizione: "CU da generare",
    defaultGravita: "WARNING",
    defaultSogliaGiorni: 14,
    evaluate: (ctx, soglia) =>
      evaluateScadenzeImminenti(
        ctx, soglia,
        ["CU"],
        "SCAD_CU_GENERAZIONE",
        (s, g) => `Certificazione Unica da generare — scadenza tra ${g} giorni`
      ),
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/scadenze.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/intelligence/alert-engine/
git commit -m "feat(sp12): add scadenze alert rules (IVA, F24, CU)"
```

---

## Task 5: Anomalie Alert Rules

**Files:**
- Create: `src/lib/intelligence/alert-engine/rules/anomalie.ts`
- Create: `src/lib/intelligence/alert-engine/__tests__/anomalie.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/intelligence/alert-engine/__tests__/anomalie.test.ts
import { describe, it, expect } from "vitest";
import { anomalieRules } from "../rules/anomalie";

describe("anomalie alert rules", () => {
  it("exports rules for open anomalies", () => {
    expect(anomalieRules).toHaveLength(2);
    expect(anomalieRules[0].codice).toBe("ANOM_APERTE_ACCUMULO");
    expect(anomalieRules[1].codice).toBe("ANOM_CRITICA_NUOVA");
  });

  it("ANOM_APERTE_ACCUMULO has correct defaults", () => {
    const rule = anomalieRules[0];
    expect(rule.categoria).toBe("ANOMALIE_CONTABILI");
    expect(rule.defaultSogliaValore).toBe(5);
    expect(rule.defaultGravita).toBe("WARNING");
  });

  it("ANOM_CRITICA_NUOVA triggers on critical anomalies", () => {
    const rule = anomalieRules[1];
    expect(rule.defaultGravita).toBe("CRITICAL");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/anomalie.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement anomalie rules**

```typescript
// src/lib/intelligence/alert-engine/rules/anomalie.ts
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";
import type { AlertRuleConfig, RuleSoglia } from "../types";
import type { EvaluationContext, AlertRuleResult } from "../../types";

export const anomalieRules: AlertRuleConfig[] = [
  {
    codice: "ANOM_APERTE_ACCUMULO",
    categoria: "ANOMALIE_CONTABILI",
    descrizione: "Troppe anomalie aperte accumulate",
    defaultGravita: "WARNING",
    defaultSogliaValore: 5,
    async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
      const sogliaNum = soglia.sogliaValore ?? 5;
      const count = await prisma.anomalia.count({
        where: { societaId: ctx.societaId, stato: "APERTA" },
      });

      if (count >= sogliaNum) {
        return [{
          codiceRegola: this.codice,
          messaggio: `Ci sono ${count} anomalie contabili aperte da risolvere`,
          gravita: count >= sogliaNum * 2 ? "CRITICAL" : "WARNING",
          categoria: "ANOMALIE_CONTABILI",
          linkAzione: "/anomalie",
          datiContesto: { count, soglia: sogliaNum },
          dedupeKey: `ANOM_APERTE_ACCUMULO:${ctx.societaId}`,
        }];
      }
      return [];
    },
  },
  {
    codice: "ANOM_CRITICA_NUOVA",
    categoria: "ANOMALIE_CONTABILI",
    descrizione: "Nuova anomalia critica rilevata",
    defaultGravita: "CRITICAL",
    defaultSogliaGiorni: 1,
    async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
      const daData = subDays(ctx.oggi, soglia.sogliaGiorni ?? 1);
      const anomalie = await prisma.anomalia.findMany({
        where: {
          societaId: ctx.societaId,
          stato: "APERTA",
          priorita: "CRITICA",
          createdAt: { gte: daData },
        },
      });

      return anomalie.map((a) => ({
        codiceRegola: this.codice,
        messaggio: `Anomalia critica: ${a.titolo}`,
        gravita: "CRITICAL" as const,
        categoria: "ANOMALIE_CONTABILI" as const,
        linkAzione: `/anomalie?id=${a.id}`,
        datiContesto: { anomaliaId: a.id, tipo: a.tipo },
        dedupeKey: `ANOM_CRITICA_NUOVA:${a.id}`,
      }));
    },
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/anomalie.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/intelligence/alert-engine/rules/anomalie.ts src/lib/intelligence/alert-engine/__tests__/anomalie.test.ts
git commit -m "feat(sp12): add anomalie alert rules (accumulation + critical)"
```

---

## Task 6: Cash Flow Alert Rules

**Files:**
- Create: `src/lib/intelligence/alert-engine/rules/cash-flow.ts`
- Create: `src/lib/intelligence/alert-engine/__tests__/cash-flow.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/intelligence/alert-engine/__tests__/cash-flow.test.ts
import { describe, it, expect } from "vitest";
import { cashFlowRules } from "../rules/cash-flow";

describe("cash-flow alert rules", () => {
  it("exports rules for overdue receivables and cash projection", () => {
    expect(cashFlowRules).toHaveLength(2);
    expect(cashFlowRules[0].codice).toBe("CF_INCASSI_RITARDO");
    expect(cashFlowRules[1].codice).toBe("CF_SALDO_NEGATIVO_PREVISTO");
  });

  it("CF_INCASSI_RITARDO has correct defaults", () => {
    const rule = cashFlowRules[0];
    expect(rule.categoria).toBe("CASH_FLOW");
    expect(rule.defaultSogliaGiorni).toBe(30);
    expect(rule.defaultGravita).toBe("WARNING");
  });

  it("CF_SALDO_NEGATIVO_PREVISTO defaults", () => {
    const rule = cashFlowRules[1];
    expect(rule.defaultSogliaGiorni).toBe(15);
    expect(rule.defaultGravita).toBe("CRITICAL");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/cash-flow.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement cash-flow rules**

```typescript
// src/lib/intelligence/alert-engine/rules/cash-flow.ts
import { prisma } from "@/lib/prisma";
import { subDays, addDays } from "date-fns";
import type { AlertRuleConfig, RuleSoglia } from "../types";
import type { EvaluationContext, AlertRuleResult } from "../../types";

export const cashFlowRules: AlertRuleConfig[] = [
  {
    codice: "CF_INCASSI_RITARDO",
    categoria: "CASH_FLOW",
    descrizione: "Incassi in ritardo oltre soglia giorni",
    defaultGravita: "WARNING",
    defaultSogliaGiorni: 30,
    async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
      const giorniSoglia = soglia.sogliaGiorni ?? 30;
      const limite = subDays(ctx.oggi, giorniSoglia);

      const scaduteAperte = await prisma.scadenzaPartitario.findMany({
        where: {
          societaId: ctx.societaId,
          tipo: "CLIENTE",
          stato: { in: ["APERTA", "PARZIALE"] },
          dataScadenza: { lt: limite },
        },
        include: { anagrafica: { select: { denominazione: true } } },
      });

      if (scaduteAperte.length === 0) return [];

      const totale = scaduteAperte.reduce(
        (sum, s) => sum + (Number(s.importo) - Number(s.importoPagato)),
        0
      );

      return [{
        codiceRegola: this.codice,
        messaggio: `${scaduteAperte.length} incassi in ritardo (>${giorniSoglia}gg) per €${totale.toFixed(2)}`,
        gravita: totale > 10000 ? "CRITICAL" : "WARNING",
        categoria: "CASH_FLOW",
        linkAzione: "/scadenzario?tipo=CLIENTE&stato=APERTA",
        datiContesto: { count: scaduteAperte.length, totale, giorniSoglia },
        dedupeKey: `CF_INCASSI_RITARDO:${ctx.societaId}`,
      }];
    },
  },
  {
    codice: "CF_SALDO_NEGATIVO_PREVISTO",
    categoria: "CASH_FLOW",
    descrizione: "Saldo cassa previsto negativo entro N giorni",
    defaultGravita: "CRITICAL",
    defaultSogliaGiorni: 15,
    async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
      const giorniPrevisione = soglia.sogliaGiorni ?? 15;
      const limite = addDays(ctx.oggi, giorniPrevisione);

      // Sum upcoming payables (outgoing)
      const pagamentiPrevisti = await prisma.scadenzaPartitario.aggregate({
        where: {
          societaId: ctx.societaId,
          tipo: "FORNITORE",
          stato: { in: ["APERTA", "PARZIALE"] },
          dataScadenza: { lte: limite, gte: ctx.oggi },
        },
        _sum: { importo: true, importoPagato: true },
      });

      // Sum upcoming receivables (incoming)
      const incassiPrevisti = await prisma.scadenzaPartitario.aggregate({
        where: {
          societaId: ctx.societaId,
          tipo: "CLIENTE",
          stato: { in: ["APERTA", "PARZIALE"] },
          dataScadenza: { lte: limite, gte: ctx.oggi },
        },
        _sum: { importo: true, importoPagato: true },
      });

      const uscite = Number(pagamentiPrevisti._sum.importo ?? 0) - Number(pagamentiPrevisti._sum.importoPagato ?? 0);
      const entrate = Number(incassiPrevisti._sum.importo ?? 0) - Number(incassiPrevisti._sum.importoPagato ?? 0);
      const nettoPrevisione = entrate - uscite;

      if (nettoPrevisione < 0) {
        return [{
          codiceRegola: this.codice,
          messaggio: `Flusso di cassa previsto negativo (€${nettoPrevisione.toFixed(2)}) nei prossimi ${giorniPrevisione} giorni`,
          gravita: "CRITICAL",
          categoria: "CASH_FLOW",
          linkAzione: "/scadenzario",
          datiContesto: { nettoPrevisione, entrate, uscite, giorniPrevisione },
          dedupeKey: `CF_SALDO_NEGATIVO_PREVISTO:${ctx.societaId}`,
        }];
      }
      return [];
    },
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/cash-flow.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/intelligence/alert-engine/rules/cash-flow.ts src/lib/intelligence/alert-engine/__tests__/cash-flow.test.ts
git commit -m "feat(sp12): add cash flow alert rules (overdue receivables + forecast)"
```

---

## Task 7: Compliance and Riconciliazione Alert Rules

**Files:**
- Create: `src/lib/intelligence/alert-engine/rules/compliance.ts`
- Create: `src/lib/intelligence/alert-engine/rules/riconciliazione.ts`
- Create: `src/lib/intelligence/alert-engine/__tests__/compliance.test.ts`
- Create: `src/lib/intelligence/alert-engine/__tests__/riconciliazione.test.ts`

- [ ] **Step 1: Write compliance test**

```typescript
// src/lib/intelligence/alert-engine/__tests__/compliance.test.ts
import { describe, it, expect } from "vitest";
import { complianceRules } from "../rules/compliance";

describe("compliance alert rules", () => {
  it("exports rules for unsent invoices and LIPE", () => {
    expect(complianceRules).toHaveLength(2);
    expect(complianceRules[0].codice).toBe("COMPL_FATTURA_NON_INVIATA");
    expect(complianceRules[1].codice).toBe("COMPL_LIPE_SCADUTA");
  });

  it("COMPL_FATTURA_NON_INVIATA defaults", () => {
    const rule = complianceRules[0];
    expect(rule.categoria).toBe("COMPLIANCE");
    expect(rule.defaultSogliaGiorni).toBe(5);
    expect(rule.defaultGravita).toBe("WARNING");
  });
});
```

- [ ] **Step 2: Implement compliance rules**

```typescript
// src/lib/intelligence/alert-engine/rules/compliance.ts
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";
import type { AlertRuleConfig, RuleSoglia } from "../types";
import type { EvaluationContext, AlertRuleResult } from "../../types";

export const complianceRules: AlertRuleConfig[] = [
  {
    codice: "COMPL_FATTURA_NON_INVIATA",
    categoria: "COMPLIANCE",
    descrizione: "Fatture generate ma non inviate oltre N giorni",
    defaultGravita: "WARNING",
    defaultSogliaGiorni: 5,
    async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
      const giorni = soglia.sogliaGiorni ?? 5;
      const limite = subDays(ctx.oggi, giorni);

      const fatture = await prisma.fatturaElettronica.findMany({
        where: {
          societaId: ctx.societaId,
          stato: "GENERATA",
          dataGenerazione: { lt: limite },
        },
        select: { id: true, numero: true, annoRiferimento: true, dataGenerazione: true },
      });

      return fatture.map((f) => ({
        codiceRegola: this.codice,
        messaggio: `Fattura ${f.numero}/${f.annoRiferimento} generata ma non inviata da ${giorni}+ giorni`,
        gravita: "WARNING" as const,
        categoria: "COMPLIANCE" as const,
        linkAzione: `/fatture-elettroniche?id=${f.id}`,
        datiContesto: { fatturaId: f.id, numero: f.numero },
        dedupeKey: `COMPL_FATTURA_NON_INVIATA:${f.id}`,
      }));
    },
  },
  {
    codice: "COMPL_LIPE_SCADUTA",
    categoria: "COMPLIANCE",
    descrizione: "LIPE non completata dopo scadenza",
    defaultGravita: "CRITICAL",
    defaultSogliaGiorni: 0,
    async evaluate(ctx: EvaluationContext): Promise<AlertRuleResult[]> {
      const scadute = await prisma.scadenzaFiscale.findMany({
        where: {
          societaId: ctx.societaId,
          tipo: "LIPE",
          stato: { in: ["NON_INIZIATA", "IN_PREPARAZIONE"] },
          scadenza: { lt: ctx.oggi },
        },
      });

      return scadute.map((s) => ({
        codiceRegola: this.codice,
        messaggio: `LIPE ${s.periodo}/${s.anno} scaduta e non completata`,
        gravita: "CRITICAL" as const,
        categoria: "COMPLIANCE" as const,
        linkAzione: `/adempimenti?anno=${s.anno}&periodo=${s.periodo}`,
        datiContesto: { scadenzaId: s.id, periodo: s.periodo, anno: s.anno },
        dedupeKey: `COMPL_LIPE_SCADUTA:${s.id}`,
      }));
    },
  },
];
```

- [ ] **Step 3: Write riconciliazione test**

```typescript
// src/lib/intelligence/alert-engine/__tests__/riconciliazione.test.ts
import { describe, it, expect } from "vitest";
import { riconciliazioneRules } from "../rules/riconciliazione";

describe("riconciliazione alert rules", () => {
  it("exports rule for unreconciled movements", () => {
    expect(riconciliazioneRules).toHaveLength(1);
    expect(riconciliazioneRules[0].codice).toBe("RICONC_MOVIMENTI_PENDING");
  });

  it("has correct defaults", () => {
    const rule = riconciliazioneRules[0];
    expect(rule.categoria).toBe("RICONCILIAZIONE");
    expect(rule.defaultSogliaGiorni).toBe(7);
    expect(rule.defaultGravita).toBe("INFO");
  });
});
```

- [ ] **Step 4: Implement riconciliazione rules**

```typescript
// src/lib/intelligence/alert-engine/rules/riconciliazione.ts
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";
import type { AlertRuleConfig, RuleSoglia } from "../types";
import type { EvaluationContext, AlertRuleResult } from "../../types";

export const riconciliazioneRules: AlertRuleConfig[] = [
  {
    codice: "RICONC_MOVIMENTI_PENDING",
    categoria: "RICONCILIAZIONE",
    descrizione: "Movimenti bancari non riconciliati oltre N giorni",
    defaultGravita: "INFO",
    defaultSogliaGiorni: 7,
    async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
      const giorni = soglia.sogliaGiorni ?? 7;
      const limite = subDays(ctx.oggi, giorni);

      const count = await prisma.movimentoBancario.count({
        where: {
          contoBancario: { societaId: ctx.societaId },
          riconciliato: false,
          data: { lt: limite },
        },
      });

      if (count === 0) return [];

      return [{
        codiceRegola: this.codice,
        messaggio: `${count} movimenti bancari non riconciliati da oltre ${giorni} giorni`,
        gravita: count > 20 ? "WARNING" : "INFO",
        categoria: "RICONCILIAZIONE",
        linkAzione: "/riconciliazione-bancaria",
        datiContesto: { count, giorniSoglia: giorni },
        dedupeKey: `RICONC_MOVIMENTI_PENDING:${ctx.societaId}`,
      }];
    },
  },
];
```

- [ ] **Step 5: Run all rule tests**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/intelligence/alert-engine/rules/ src/lib/intelligence/alert-engine/__tests__/
git commit -m "feat(sp12): add compliance and riconciliazione alert rules"
```

---

## Task 8: Alert Engine Evaluator (Orchestrator)

**Files:**
- Create: `src/lib/intelligence/alert-engine/evaluator.ts`
- Create: `src/lib/intelligence/alert-engine/__tests__/evaluator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/intelligence/alert-engine/__tests__/evaluator.test.ts
import { describe, it, expect } from "vitest";
import { getAllAlertRules, deduplicateResults } from "../evaluator";
import type { AlertRuleResult } from "../../types";

describe("alert evaluator", () => {
  it("getAllAlertRules returns all registered rules", () => {
    const rules = getAllAlertRules();
    expect(rules.length).toBeGreaterThanOrEqual(8);
    const codes = rules.map((r) => r.codice);
    expect(codes).toContain("SCAD_IVA_TRIMESTRALE");
    expect(codes).toContain("ANOM_APERTE_ACCUMULO");
    expect(codes).toContain("CF_INCASSI_RITARDO");
    expect(codes).toContain("COMPL_FATTURA_NON_INVIATA");
    expect(codes).toContain("RICONC_MOVIMENTI_PENDING");
  });

  it("deduplicateResults removes duplicates by dedupeKey", () => {
    const results: AlertRuleResult[] = [
      { codiceRegola: "A", messaggio: "first", gravita: "WARNING", categoria: "SCADENZE", dedupeKey: "key1" },
      { codiceRegola: "A", messaggio: "second", gravita: "CRITICAL", categoria: "SCADENZE", dedupeKey: "key1" },
      { codiceRegola: "B", messaggio: "other", gravita: "INFO", categoria: "CASH_FLOW", dedupeKey: "key2" },
    ];
    const deduped = deduplicateResults(results);
    expect(deduped).toHaveLength(2);
    // Keeps the higher severity one
    expect(deduped.find((r) => r.dedupeKey === "key1")?.gravita).toBe("CRITICAL");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/evaluator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement evaluator**

```typescript
// src/lib/intelligence/alert-engine/evaluator.ts
import { prisma } from "@/lib/prisma";
import type { AlertRuleConfig } from "./types";
import type { AlertRuleResult, EvaluationContext } from "../types";
import { scadenzeRules } from "./rules/scadenze";
import { anomalieRules } from "./rules/anomalie";
import { cashFlowRules } from "./rules/cash-flow";
import { complianceRules } from "./rules/compliance";
import { riconciliazioneRules } from "./rules/riconciliazione";

const SEVERITY_ORDER: Record<string, number> = { INFO: 0, WARNING: 1, CRITICAL: 2 };

export function getAllAlertRules(): AlertRuleConfig[] {
  return [
    ...scadenzeRules,
    ...anomalieRules,
    ...cashFlowRules,
    ...complianceRules,
    ...riconciliazioneRules,
  ];
}

export function deduplicateResults(results: AlertRuleResult[]): AlertRuleResult[] {
  const map = new Map<string, AlertRuleResult>();
  for (const r of results) {
    const existing = map.get(r.dedupeKey);
    if (!existing || SEVERITY_ORDER[r.gravita] > SEVERITY_ORDER[existing.gravita]) {
      map.set(r.dedupeKey, r);
    }
  }
  return Array.from(map.values());
}

export async function evaluateAllRules(
  ctx: EvaluationContext
): Promise<AlertRuleResult[]> {
  const allRules = getAllAlertRules();

  // Load custom thresholds from DB
  const dbRules = await prisma.regolaAlert.findMany({
    where: {
      OR: [{ societaId: ctx.societaId }, { societaId: null }],
      attiva: true,
    },
  });

  const results: AlertRuleResult[] = [];

  for (const rule of allRules) {
    const dbRule = dbRules.find(
      (r) => r.codice === rule.codice && (r.societaId === ctx.societaId || r.societaId === null)
    );

    // If DB rule exists and is disabled, skip
    if (dbRule && !dbRule.attiva) continue;

    const soglia = {
      sogliaGiorni: dbRule?.sogliaGiorni ?? rule.defaultSogliaGiorni ?? null,
      sogliaValore: dbRule?.sogliaValore ?? rule.defaultSogliaValore ?? null,
    };

    try {
      const ruleResults = await rule.evaluate(ctx, soglia);
      results.push(...ruleResults);
    } catch (error) {
      console.error(`[AlertEngine] Errore valutazione regola ${rule.codice}:`, error);
    }
  }

  return deduplicateResults(results);
}

export async function generateAlerts(societaId: number): Promise<number> {
  const ctx: EvaluationContext = { societaId, oggi: new Date() };
  const results = await evaluateAllRules(ctx);

  // Find target users for this society
  const utentiAzienda = await prisma.utenteAzienda.findMany({
    where: { societaId, attivo: true },
    include: { utente: true },
  });

  let created = 0;

  for (const result of results) {
    // Find matching DB rule for regolaId
    let regola = await prisma.regolaAlert.findFirst({
      where: { codice: result.codiceRegola, OR: [{ societaId }, { societaId: null }] },
    });

    // Auto-create default rule if not in DB
    if (!regola) {
      const ruleConfig = getAllAlertRules().find((r) => r.codice === result.codiceRegola);
      if (!ruleConfig) continue;
      regola = await prisma.regolaAlert.create({
        data: {
          societaId: null,
          categoria: result.categoria,
          codice: result.codiceRegola,
          descrizione: ruleConfig.descrizione,
          sogliaValore: ruleConfig.defaultSogliaValore,
          sogliaGiorni: ruleConfig.defaultSogliaGiorni,
          gravita: result.gravita,
          canali: ["IN_APP"],
          ruoliDestinatari: ["ADMIN"],
        },
      });
    }

    const ruoliTarget = (regola.ruoliDestinatari as string[]) || ["ADMIN"];
    const destinatari = utentiAzienda.filter((ua) => ruoliTarget.includes(ua.ruolo));

    for (const ua of destinatari) {
      // Check for existing non-resolved alert with same dedupeKey
      const existing = await prisma.alertGenerato.findFirst({
        where: {
          societaId,
          regolaId: regola.id,
          utenteDestinatarioId: ua.utenteId,
          stato: { in: ["NUOVO", "VISTO", "SNOOZED"] },
          datiContesto: { path: "$.dedupeKey", equals: result.dedupeKey },
        },
      });

      if (existing) continue;

      await prisma.alertGenerato.create({
        data: {
          societaId,
          regolaId: regola.id,
          utenteDestinatarioId: ua.utenteId,
          tipo: result.categoria,
          messaggio: result.messaggio,
          gravita: result.gravita,
          datiContesto: { ...result.datiContesto, dedupeKey: result.dedupeKey },
          linkAzione: result.linkAzione,
        },
      });
      created++;
    }
  }

  return created;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/evaluator.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/intelligence/alert-engine/evaluator.ts src/lib/intelligence/alert-engine/__tests__/evaluator.test.ts
git commit -m "feat(sp12): add alert engine evaluator with dedup and rule orchestration"
```

---

## Task 9: Anti-Spam Logic

**Files:**
- Create: `src/lib/intelligence/alert-engine/anti-spam.ts`
- Create: `src/lib/intelligence/alert-engine/__tests__/anti-spam.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/intelligence/alert-engine/__tests__/anti-spam.test.ts
import { describe, it, expect } from "vitest";
import { isAlertSnoozed, shouldGroupAlert, filterSnoozedAlerts } from "../anti-spam";
import type { AlertRuleResult } from "../../types";

describe("anti-spam", () => {
  it("detects snoozed alert", () => {
    const now = new Date();
    const future = new Date(now.getTime() + 3600000);
    expect(isAlertSnoozed(future, now)).toBe(true);
  });

  it("detects expired snooze", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 3600000);
    expect(isAlertSnoozed(past, now)).toBe(false);
  });

  it("groups similar alerts by category and rule", () => {
    const alerts: AlertRuleResult[] = [
      { codiceRegola: "SCAD_F24", messaggio: "a", gravita: "WARNING", categoria: "SCADENZE", dedupeKey: "k1" },
      { codiceRegola: "SCAD_F24", messaggio: "b", gravita: "WARNING", categoria: "SCADENZE", dedupeKey: "k2" },
      { codiceRegola: "CF_INCASSI", messaggio: "c", gravita: "INFO", categoria: "CASH_FLOW", dedupeKey: "k3" },
    ];
    const grouped = shouldGroupAlert(alerts, 2);
    // When count >= threshold, group into summary
    expect(grouped).toHaveLength(2); // 1 grouped SCAD_F24 + 1 CF_INCASSI
    expect(grouped[0].messaggio).toContain("2");
  });

  it("filterSnoozedAlerts removes snoozed dedupeKeys", () => {
    const alerts: AlertRuleResult[] = [
      { codiceRegola: "A", messaggio: "x", gravita: "INFO", categoria: "SCADENZE", dedupeKey: "snoozed1" },
      { codiceRegola: "B", messaggio: "y", gravita: "INFO", categoria: "SCADENZE", dedupeKey: "active1" },
    ];
    const snoozedKeys = new Set(["snoozed1"]);
    const filtered = filterSnoozedAlerts(alerts, snoozedKeys);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].dedupeKey).toBe("active1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/anti-spam.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement anti-spam**

```typescript
// src/lib/intelligence/alert-engine/anti-spam.ts
import type { AlertRuleResult } from "../types";

export function isAlertSnoozed(snoozeFinoA: Date | null, now: Date): boolean {
  if (!snoozeFinoA) return false;
  return snoozeFinoA.getTime() > now.getTime();
}

export function filterSnoozedAlerts(
  alerts: AlertRuleResult[],
  snoozedDedupeKeys: Set<string>
): AlertRuleResult[] {
  return alerts.filter((a) => !snoozedDedupeKeys.has(a.dedupeKey));
}

export function shouldGroupAlert(
  alerts: AlertRuleResult[],
  groupThreshold: number = 3
): AlertRuleResult[] {
  const byRule = new Map<string, AlertRuleResult[]>();

  for (const alert of alerts) {
    const key = alert.codiceRegola;
    const group = byRule.get(key) || [];
    group.push(alert);
    byRule.set(key, group);
  }

  const result: AlertRuleResult[] = [];

  for (const [codice, group] of byRule) {
    if (group.length >= groupThreshold) {
      // Merge into a summary alert
      const highest = group.reduce((a, b) =>
        severityRank(b.gravita) > severityRank(a.gravita) ? b : a
      );
      result.push({
        ...highest,
        messaggio: `${group.length} alert "${codice}": ${highest.messaggio} (e altri ${group.length - 1})`,
        dedupeKey: `grouped:${codice}`,
      });
    } else {
      result.push(...group);
    }
  }

  return result;
}

function severityRank(gravita: string): number {
  return { INFO: 0, WARNING: 1, CRITICAL: 2 }[gravita] ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/intelligence/alert-engine/__tests__/anti-spam.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/intelligence/alert-engine/anti-spam.ts src/lib/intelligence/alert-engine/__tests__/anti-spam.test.ts
git commit -m "feat(sp12): add alert anti-spam with snooze, grouping, and filtering"
```

---

## Task 10: Todo Engine Types

**Files:**
- Create: `src/lib/intelligence/todo-engine/types.ts`

- [ ] **Step 1: Write types**

```typescript
// src/lib/intelligence/todo-engine/types.ts
import type { TodoItem, TodoGenerationContext } from "../types";

export interface TodoGeneratorConfig {
  fonte: TodoItem["fonte"];
  descrizione: string;
  /** Which modes this generator runs in. null = all modes */
  modalita: ("semplice" | "avanzata" | "commercialista")[] | null;
  generate: (ctx: TodoGenerationContext) => Promise<TodoItem[]>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/intelligence/todo-engine/types.ts
git commit -m "feat(sp12): add todo engine types"
```

---

## Task 11: Todo Generators

**Files:**
- Create: `src/lib/intelligence/todo-engine/generators/scadenze.ts`
- Create: `src/lib/intelligence/todo-engine/generators/anomalie.ts`
- Create: `src/lib/intelligence/todo-engine/generators/bozze.ts`
- Create: `src/lib/intelligence/todo-engine/generators/riconciliazione.ts`
- Create: `src/lib/intelligence/todo-engine/generators/fatture.ts`
- Create: `src/lib/intelligence/todo-engine/__tests__/scadenze.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/intelligence/todo-engine/__tests__/scadenze.test.ts
import { describe, it, expect } from "vitest";
import { scadenzeTodoGenerator } from "../generators/scadenze";

describe("scadenze todo generator", () => {
  it("has correct config", () => {
    expect(scadenzeTodoGenerator.fonte).toBe("SCADENZA");
    expect(scadenzeTodoGenerator.modalita).toBeNull(); // all modes
  });
});
```

- [ ] **Step 2: Implement scadenze generator**

```typescript
// src/lib/intelligence/todo-engine/generators/scadenze.ts
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays, format } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import type { TodoGeneratorConfig } from "../types";
import type { TodoGenerationContext, TodoItem } from "../../types";

export const scadenzeTodoGenerator: TodoGeneratorConfig = {
  fonte: "SCADENZA",
  descrizione: "To-do da scadenze fiscali imminenti",
  modalita: null, // all modes

  async generate(ctx: TodoGenerationContext): Promise<TodoItem[]> {
    const limite = addDays(ctx.oggi, 14);

    const scadenze = await prisma.scadenzaFiscale.findMany({
      where: {
        societaId: ctx.societaId,
        stato: { in: ["NON_INIZIATA", "IN_PREPARAZIONE"] },
        scadenza: { lte: limite, gte: ctx.oggi },
      },
      orderBy: { scadenza: "asc" },
    });

    return scadenze.map((s) => {
      const giorni = differenceInDays(s.scadenza, ctx.oggi);
      const dataStr = format(s.scadenza, "d MMMM", { locale: itLocale });
      return {
        titolo: `${s.tipo.replace(/_/g, " ")} — scade il ${dataStr}`,
        descrizione: giorni <= 3
          ? `Urgente: mancano solo ${giorni} giorni`
          : `Completamento: ${s.percentualeCompletamento}%`,
        priorita: giorni <= 3 ? 1 : giorni <= 7 ? 2 : 3,
        linkAzione: `/adempimenti?anno=${s.anno}&periodo=${s.periodo}`,
        fonte: "SCADENZA" as const,
        dedupeKey: `todo:scadenza:${s.id}`,
      };
    });
  },
};
```

- [ ] **Step 3: Implement anomalie generator**

```typescript
// src/lib/intelligence/todo-engine/generators/anomalie.ts
import { prisma } from "@/lib/prisma";
import type { TodoGeneratorConfig } from "../types";
import type { TodoGenerationContext, TodoItem } from "../../types";

export const anomalieTodoGenerator: TodoGeneratorConfig = {
  fonte: "ANOMALIA",
  descrizione: "To-do da anomalie contabili aperte",
  modalita: ["avanzata", "commercialista"],

  async generate(ctx: TodoGenerationContext): Promise<TodoItem[]> {
    if (!ctx.modalitaAvanzata && !ctx.modalitaCommercialista) return [];

    const anomalie = await prisma.anomalia.findMany({
      where: { societaId: ctx.societaId, stato: "APERTA" },
      orderBy: [{ priorita: "asc" }, { createdAt: "desc" }],
      take: 10,
    });

    return anomalie.map((a) => ({
      titolo: a.titolo,
      descrizione: a.descrizione,
      priorita: a.priorita === "CRITICA" ? 1 : a.priorita === "ALTA" ? 2 : 3,
      linkAzione: `/anomalie?id=${a.id}`,
      fonte: "ANOMALIA" as const,
      dedupeKey: `todo:anomalia:${a.id}`,
    }));
  },
};
```

- [ ] **Step 4: Implement bozze generator**

```typescript
// src/lib/intelligence/todo-engine/generators/bozze.ts
import { prisma } from "@/lib/prisma";
import type { TodoGeneratorConfig } from "../types";
import type { TodoGenerationContext, TodoItem } from "../../types";

export const bozzeTodoGenerator: TodoGeneratorConfig = {
  fonte: "BOZZA",
  descrizione: "To-do da operazioni in bozza",
  modalita: null,

  async generate(ctx: TodoGenerationContext): Promise<TodoItem[]> {
    const count = await prisma.operazione.count({
      where: { societaId: ctx.societaId, bozza: true, eliminato: false },
    });

    if (count === 0) return [];

    return [{
      titolo: `${count} operazion${count === 1 ? "e" : "i"} in bozza da completare`,
      priorita: 3,
      linkAzione: "/operazioni?bozza=true",
      fonte: "BOZZA",
      dedupeKey: `todo:bozze:${ctx.societaId}`,
    }];
  },
};
```

- [ ] **Step 5: Implement riconciliazione generator**

```typescript
// src/lib/intelligence/todo-engine/generators/riconciliazione.ts
import { prisma } from "@/lib/prisma";
import type { TodoGeneratorConfig } from "../types";
import type { TodoGenerationContext, TodoItem } from "../../types";

export const riconciliazioneTodoGenerator: TodoGeneratorConfig = {
  fonte: "RICONCILIAZIONE",
  descrizione: "To-do da movimenti non riconciliati",
  modalita: ["avanzata", "commercialista"],

  async generate(ctx: TodoGenerationContext): Promise<TodoItem[]> {
    if (!ctx.modalitaAvanzata && !ctx.modalitaCommercialista) return [];

    const count = await prisma.movimentoBancario.count({
      where: {
        contoBancario: { societaId: ctx.societaId },
        riconciliato: false,
      },
    });

    if (count === 0) return [];

    return [{
      titolo: `${count} moviment${count === 1 ? "o bancario" : "i bancari"} da riconciliare`,
      priorita: count > 20 ? 2 : 4,
      linkAzione: "/riconciliazione-bancaria",
      fonte: "RICONCILIAZIONE",
      dedupeKey: `todo:riconciliazione:${ctx.societaId}`,
    }];
  },
};
```

- [ ] **Step 6: Implement fatture generator**

```typescript
// src/lib/intelligence/todo-engine/generators/fatture.ts
import { prisma } from "@/lib/prisma";
import type { TodoGeneratorConfig } from "../types";
import type { TodoGenerationContext, TodoItem } from "../../types";

export const fattureTodoGenerator: TodoGeneratorConfig = {
  fonte: "FATTURA",
  descrizione: "To-do da fatture da inviare",
  modalita: null,

  async generate(ctx: TodoGenerationContext): Promise<TodoItem[]> {
    const count = await prisma.fatturaElettronica.count({
      where: { societaId: ctx.societaId, stato: "GENERATA" },
    });

    if (count === 0) return [];

    return [{
      titolo: `${count} fattur${count === 1 ? "a" : "e"} elettronic${count === 1 ? "a" : "he"} da inviare`,
      priorita: 2,
      linkAzione: "/fatture-elettroniche?stato=GENERATA",
      fonte: "FATTURA",
      dedupeKey: `todo:fatture:${ctx.societaId}`,
    }];
  },
};
```

- [ ] **Step 7: Run test**

Run: `npx vitest run src/lib/intelligence/todo-engine/__tests__/scadenze.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/intelligence/todo-engine/
git commit -m "feat(sp12): add todo generators (scadenze, anomalie, bozze, riconciliazione, fatture)"
```

---

## Task 12: Todo Engine Orchestrator

**Files:**
- Create: `src/lib/intelligence/todo-engine/generator.ts`
- Create: `src/lib/intelligence/todo-engine/__tests__/generator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/intelligence/todo-engine/__tests__/generator.test.ts
import { describe, it, expect } from "vitest";
import { getAllTodoGenerators, deduplicateTodos, prioritizeTodos } from "../generator";

describe("todo generator orchestrator", () => {
  it("getAllTodoGenerators returns all registered generators", () => {
    const generators = getAllTodoGenerators();
    expect(generators.length).toBeGreaterThanOrEqual(5);
    const fonti = generators.map((g) => g.fonte);
    expect(fonti).toContain("SCADENZA");
    expect(fonti).toContain("ANOMALIA");
    expect(fonti).toContain("BOZZA");
    expect(fonti).toContain("RICONCILIAZIONE");
    expect(fonti).toContain("FATTURA");
  });

  it("deduplicateTodos removes duplicate dedupeKeys", () => {
    const todos = [
      { titolo: "A", priorita: 1, fonte: "SCADENZA" as const, dedupeKey: "k1" },
      { titolo: "B", priorita: 2, fonte: "SCADENZA" as const, dedupeKey: "k1" },
      { titolo: "C", priorita: 3, fonte: "BOZZA" as const, dedupeKey: "k2" },
    ];
    const deduped = deduplicateTodos(todos);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].titolo).toBe("A"); // higher priority kept
  });

  it("prioritizeTodos sorts by priority asc", () => {
    const todos = [
      { titolo: "Low", priorita: 5, fonte: "BOZZA" as const, dedupeKey: "k1" },
      { titolo: "High", priorita: 1, fonte: "SCADENZA" as const, dedupeKey: "k2" },
      { titolo: "Mid", priorita: 3, fonte: "ANOMALIA" as const, dedupeKey: "k3" },
    ];
    const sorted = prioritizeTodos(todos);
    expect(sorted[0].titolo).toBe("High");
    expect(sorted[1].titolo).toBe("Mid");
    expect(sorted[2].titolo).toBe("Low");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/intelligence/todo-engine/__tests__/generator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement generator orchestrator**

```typescript
// src/lib/intelligence/todo-engine/generator.ts
import { prisma } from "@/lib/prisma";
import type { TodoGeneratorConfig } from "./types";
import type { TodoItem, TodoGenerationContext } from "../types";
import { scadenzeTodoGenerator } from "./generators/scadenze";
import { anomalieTodoGenerator } from "./generators/anomalie";
import { bozzeTodoGenerator } from "./generators/bozze";
import { riconciliazioneTodoGenerator } from "./generators/riconciliazione";
import { fattureTodoGenerator } from "./generators/fatture";

export function getAllTodoGenerators(): TodoGeneratorConfig[] {
  return [
    scadenzeTodoGenerator,
    anomalieTodoGenerator,
    bozzeTodoGenerator,
    riconciliazioneTodoGenerator,
    fattureTodoGenerator,
  ];
}

export function deduplicateTodos(todos: TodoItem[]): TodoItem[] {
  const map = new Map<string, TodoItem>();
  for (const todo of todos) {
    const existing = map.get(todo.dedupeKey);
    if (!existing || todo.priorita < existing.priorita) {
      map.set(todo.dedupeKey, todo);
    }
  }
  return Array.from(map.values());
}

export function prioritizeTodos(todos: TodoItem[]): TodoItem[] {
  return [...todos].sort((a, b) => a.priorita - b.priorita);
}

function getUserMode(utente: { modalitaAvanzata: boolean; modalitaCommercialista: boolean }): string {
  if (utente.modalitaCommercialista) return "commercialista";
  if (utente.modalitaAvanzata) return "avanzata";
  return "semplice";
}

export async function generateTodosForUser(
  societaId: number,
  utenteId: number
): Promise<TodoItem[]> {
  const utente = await prisma.utente.findUnique({ where: { id: utenteId } });
  if (!utente) return [];

  const ctx: TodoGenerationContext = {
    societaId,
    utenteId,
    oggi: new Date(),
    modalitaAvanzata: utente.modalitaAvanzata,
    modalitaCommercialista: utente.modalitaCommercialista,
  };

  const userMode = getUserMode(utente);
  const generators = getAllTodoGenerators().filter(
    (g) => g.modalita === null || g.modalita.includes(userMode as any)
  );

  const allTodos: TodoItem[] = [];

  for (const gen of generators) {
    try {
      const items = await gen.generate(ctx);
      allTodos.push(...items);
    } catch (error) {
      console.error(`[TodoEngine] Errore generatore ${gen.fonte}:`, error);
    }
  }

  return prioritizeTodos(deduplicateTodos(allTodos));
}

export async function persistTodosForUser(
  societaId: number,
  utenteId: number
): Promise<number> {
  const items = await generateTodosForUser(societaId, utenteId);
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  let created = 0;

  for (const item of items) {
    // Check if already exists for today
    const existing = await prisma.todoGenerato.findFirst({
      where: {
        societaId,
        utenteId,
        data: oggi,
        fonte: item.fonte,
        titolo: item.titolo,
      },
    });

    if (existing) continue;

    await prisma.todoGenerato.create({
      data: {
        societaId,
        utenteId,
        data: oggi,
        titolo: item.titolo,
        descrizione: item.descrizione,
        priorita: item.priorita,
        linkAzione: item.linkAzione,
        fonte: item.fonte,
      },
    });
    created++;
  }

  return created;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/intelligence/todo-engine/__tests__/generator.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/intelligence/todo-engine/generator.ts src/lib/intelligence/todo-engine/__tests__/generator.test.ts
git commit -m "feat(sp12): add todo engine orchestrator with dedup, prioritization, and persistence"
```

---

## Task 13: Internal Alert API Routes

**Files:**
- Create: `src/app/api/alert/route.ts`
- Create: `src/app/api/alert/[id]/route.ts`

- [ ] **Step 1: Implement alert list route**

```typescript
// src/app/api/alert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const stato = searchParams.get("stato");
    const categoria = searchParams.get("categoria");

    const where: any = {
      utenteDestinatarioId: user.utenteId,
      societaId: user.societaId,
    };
    if (stato) where.stato = stato;
    if (categoria) where.tipo = categoria;

    const alerts = await prisma.alertGenerato.findMany({
      where,
      orderBy: [{ gravita: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: { regola: { select: { codice: true, descrizione: true, categoria: true } } },
    });

    const countByStato = await prisma.alertGenerato.groupBy({
      by: ["stato"],
      where: { utenteDestinatarioId: user.utenteId, societaId: user.societaId },
      _count: true,
    });

    return NextResponse.json({ alerts, conteggi: countByStato });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement single alert actions route**

```typescript
// src/app/api/alert/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;
    const { id } = await params;
    const alertId = parseInt(id);

    const alert = await prisma.alertGenerato.findFirst({
      where: { id: alertId, utenteDestinatarioId: user.utenteId },
    });
    if (!alert) return NextResponse.json({ error: "Alert non trovato" }, { status: 404 });

    const body = await request.json();
    const { azione } = body; // "visto" | "snooze" | "risolvi"

    const updateData: any = {};
    switch (azione) {
      case "visto":
        updateData.stato = "VISTO";
        break;
      case "snooze": {
        const ore = body.ore || 24;
        updateData.stato = "SNOOZED";
        updateData.snoozeFinoA = new Date(Date.now() + ore * 3600000);
        break;
      }
      case "risolvi":
        updateData.stato = "RISOLTO";
        updateData.risoltoAt = new Date();
        break;
      default:
        return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
    }

    const updated = await prisma.alertGenerato.update({
      where: { id: alertId },
      data: updateData,
    });

    return NextResponse.json({ alert: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/alert/
git commit -m "feat(sp12): add internal alert API routes (list, mark, snooze, resolve)"
```

---

## Task 14: Internal Todo API Routes

**Files:**
- Create: `src/app/api/todo/route.ts`
- Create: `src/app/api/todo/[id]/route.ts`

- [ ] **Step 1: Implement todo list route**

```typescript
// src/app/api/todo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTodosForUser } from "@/lib/intelligence/todo-engine/generator";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const dataParam = searchParams.get("data");
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const data = dataParam ? new Date(dataParam) : oggi;

    // Get persisted todos
    const todos = await prisma.todoGenerato.findMany({
      where: {
        societaId: user.societaId,
        utenteId: user.utenteId,
        data,
      },
      orderBy: [{ priorita: "asc" }, { createdAt: "asc" }],
    });

    // If no todos for today, generate live
    if (todos.length === 0 && data.getTime() === oggi.getTime()) {
      const live = await generateTodosForUser(user.societaId, user.utenteId);
      return NextResponse.json({ todos: live, live: true });
    }

    return NextResponse.json({ todos, live: false });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement single todo actions route**

```typescript
// src/app/api/todo/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;
    const { id } = await params;
    const todoId = parseInt(id);

    const todo = await prisma.todoGenerato.findFirst({
      where: { id: todoId, utenteId: user.utenteId },
    });
    if (!todo) return NextResponse.json({ error: "Todo non trovato" }, { status: 404 });

    const body = await request.json();
    const { stato } = body; // "IN_CORSO" | "COMPLETATA" | "SALTATA"

    if (!["IN_CORSO", "COMPLETATA", "SALTATA"].includes(stato)) {
      return NextResponse.json({ error: "Stato non valido" }, { status: 400 });
    }

    const updated = await prisma.todoGenerato.update({
      where: { id: todoId },
      data: {
        stato,
        completataAt: stato === "COMPLETATA" ? new Date() : null,
      },
    });

    return NextResponse.json({ todo: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/todo/
git commit -m "feat(sp12): add internal todo API routes (list, update status)"
```

---

## Task 15: Alert Rules Configuration Route

**Files:**
- Create: `src/app/api/configurazione/alert/route.ts`

- [ ] **Step 1: Implement alert rules CRUD**

```typescript
// src/app/api/configurazione/alert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllAlertRules } from "@/lib/intelligence/alert-engine/evaluator";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const dbRules = await prisma.regolaAlert.findMany({
      where: { OR: [{ societaId: user.societaId }, { societaId: null }] },
      orderBy: [{ categoria: "asc" }, { codice: "asc" }],
    });

    const builtinRules = getAllAlertRules().map((r) => ({
      codice: r.codice,
      categoria: r.categoria,
      descrizione: r.descrizione,
      defaultGravita: r.defaultGravita,
      defaultSogliaGiorni: r.defaultSogliaGiorni ?? null,
      defaultSogliaValore: r.defaultSogliaValore ?? null,
    }));

    return NextResponse.json({ regole: dbRules, regoleBuiltin: builtinRules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;
    if (user.ruoloAzienda !== "ADMIN") {
      return NextResponse.json({ error: "Solo admin" }, { status: 403 });
    }

    const body = await request.json();
    const { codice, sogliaValore, sogliaGiorni, gravita, attiva, canali, ruoliDestinatari } = body;

    if (!codice) return NextResponse.json({ error: "Codice regola obbligatorio" }, { status: 400 });

    const existing = await prisma.regolaAlert.findFirst({
      where: { codice, societaId: user.societaId },
    });

    if (existing) {
      const updated = await prisma.regolaAlert.update({
        where: { id: existing.id },
        data: {
          ...(sogliaValore !== undefined && { sogliaValore }),
          ...(sogliaGiorni !== undefined && { sogliaGiorni }),
          ...(gravita !== undefined && { gravita }),
          ...(attiva !== undefined && { attiva }),
          ...(canali !== undefined && { canali }),
          ...(ruoliDestinatari !== undefined && { ruoliDestinatari }),
        },
      });
      return NextResponse.json({ regola: updated });
    }

    // Create society-specific override
    const builtin = getAllAlertRules().find((r) => r.codice === codice);
    if (!builtin) return NextResponse.json({ error: "Regola non trovata" }, { status: 404 });

    const created = await prisma.regolaAlert.create({
      data: {
        societaId: user.societaId,
        categoria: builtin.categoria as any,
        codice,
        descrizione: builtin.descrizione,
        sogliaValore: sogliaValore ?? builtin.defaultSogliaValore,
        sogliaGiorni: sogliaGiorni ?? builtin.defaultSogliaGiorni,
        gravita: gravita ?? builtin.defaultGravita,
        attiva: attiva ?? true,
        canali: canali ?? ["IN_APP"],
        ruoliDestinatari: ruoliDestinatari ?? ["ADMIN"],
      },
    });

    return NextResponse.json({ regola: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/configurazione/alert/
git commit -m "feat(sp12): add alert rules configuration route (list + customize thresholds)"
```

---

## Task 16: V1 Public API Routes (Alert + Todo)

**Files:**
- Create: `src/app/api/v1/alert/route.ts`
- Create: `src/app/api/v1/todo/route.ts`

- [ ] **Step 1: Implement V1 alert route**

```typescript
// src/app/api/v1/alert/route.ts
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
  if (!hasScope(payload.scopes, "read:alert")) {
    return NextResponse.json({ error: "Scope insufficiente: read:alert richiesto" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "20")));
  const stato = searchParams.get("stato");

  const where: any = { societaId: payload.societaId };
  if (stato) where.stato = stato;

  const [data, total] = await Promise.all([
    prisma.alertGenerato.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.alertGenerato.count({ where }),
  ]);

  const response = NextResponse.json({
    data,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });

  addCorsHeaders(response, request.headers.get("origin"), []);
  return response;
}
```

- [ ] **Step 2: Implement V1 todo route**

```typescript
// src/app/api/v1/todo/route.ts
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
  if (!hasScope(payload.scopes, "read:todo")) {
    return NextResponse.json({ error: "Scope insufficiente: read:todo richiesto" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "20")));
  const data = searchParams.get("data");

  const where: any = { societaId: payload.societaId };
  if (data) where.data = new Date(data);

  const [todos, total] = await Promise.all([
    prisma.todoGenerato.findMany({
      where,
      orderBy: [{ priorita: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.todoGenerato.count({ where }),
  ]);

  const response = NextResponse.json({
    data: todos,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });

  addCorsHeaders(response, request.headers.get("origin"), []);
  return response;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/v1/alert/ src/app/api/v1/todo/
git commit -m "feat(sp12): add V1 public API routes for alerts and todos"
```

---

## Task 17: Run Full Test Suite

- [ ] **Step 1: Run all SP12 tests**

Run: `npx vitest run src/lib/intelligence/`
Expected: All tests pass (15+ tests across all modules).

- [ ] **Step 2: Run full project tests**

Run: `npx vitest run`
Expected: All existing tests still pass + new SP12 tests pass.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit any fixes**

If any test fails, fix and commit:
```bash
git add -A
git commit -m "fix(sp12): address test/build issues"
```

---

## Summary

| Task | Component | Tests |
|------|-----------|-------|
| 1 | Prisma models (3 new + 6 enums) | Migration |
| 2 | Intelligence shared types | — |
| 3 | Alert engine types | — |
| 4 | Scadenze alert rules | 3 tests |
| 5 | Anomalie alert rules | 3 tests |
| 6 | Cash flow alert rules | 3 tests |
| 7 | Compliance + riconciliazione rules | 4 tests |
| 8 | Alert engine evaluator | 2 tests |
| 9 | Anti-spam logic | 4 tests |
| 10 | Todo engine types | — |
| 11 | Todo generators (5 sources) | 1 test |
| 12 | Todo engine orchestrator | 3 tests |
| 13 | Internal alert API routes | Build verify |
| 14 | Internal todo API routes | Build verify |
| 15 | Alert rules configuration route | Build verify |
| 16 | V1 public API routes (alert + todo) | Build verify |
| 17 | Full test suite | Regression check |

**Total: 17 tasks, ~23 tests, ~17 commits**

### Deferred to subsequent iteration
- Dashboard Smart UI (frontend pages — separate task)
- Email digest cron job (requires email infrastructure)
- Confronto YoY alert category (requires SP13 BI engine)
- Alert notification via existing Notifica system (integration enhancement)
