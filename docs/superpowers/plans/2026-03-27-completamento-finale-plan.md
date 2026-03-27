# Completamento Finale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining gaps: wire email notifications (Resend), generate OpenAPI/Swagger docs for V1 API, connect OCR to portal invoice uploads, enhance PDF report layouts, add webhook delivery history UI, implement remaining vendor parsers (Zucchetti, Passcom, Fatture in Cloud), add YoY comparison alerts, and add FULLTEXT index for portal message search.

**Architecture:** Mostly wiring existing code together — email sends use existing Resend + NotificationEngine, OpenAPI spec is generated from route definitions, OCR wires existing `/api/ocr` to portal upload flow, PDF enhances existing renderer, parsers follow existing TeamSystem pattern, YoY alert follows existing alert rule pattern.

**Tech Stack:** Next.js 16, Prisma 6, Vitest, existing Resend (`resend` package), existing `@react-pdf/renderer`, existing `fast-xml-parser`.

---

## File Structure

### New files
```
src/lib/email/
  send-email.ts                  — Central email sender using Resend
  __tests__/
    send-email.test.ts

src/lib/api/
  openapi-schema.ts              — OpenAPI 3.0 spec generator for V1 routes
  __tests__/
    openapi-schema.test.ts

src/app/api/v1/docs/route.ts    — Serve OpenAPI JSON spec

src/lib/import/parsers/
  zucchetti.ts                   — Zucchetti CSV parser
  passcom.ts                     — Passcom CSV parser
  fatture-in-cloud.ts            — Fatture in Cloud CSV parser
  __tests__/
    zucchetti.test.ts

src/lib/intelligence/alert-engine/rules/
  confronto.ts                   — YoY comparison alert rules
  __tests__/
    confronto.test.ts

src/components/api-config/
  delivery-detail.tsx            — Expanded delivery detail view

src/app/(app)/configurazione/api/webhook/
  page.tsx                       — Webhook delivery history page
  delivery-content.tsx
```

### Modified files
```
src/app/api/cron/alerts/route.ts          — Wire email sending after alert generation
src/lib/intelligence/alert-engine/evaluator.ts — Register confronto rules
src/lib/import/import-engine.ts           — Register new parsers
src/lib/portale/operations/operation-handler.ts — Wire OCR on fattura upload
src/lib/bi/report/pdf-renderer.ts         — Enhanced layout
prisma/schema.prisma                      — FULLTEXT index on messaggi_portale.testo
```

---

## Task 1: Central Email Sender (Resend)

**Files:**
- Create: `src/lib/email/send-email.ts`
- Create: `src/lib/email/__tests__/send-email.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/email/__tests__/send-email.test.ts
import { describe, it, expect } from "vitest";
import { buildEmailPayload } from "../send-email";

describe("send-email", () => {
  it("builds email payload with required fields", () => {
    const payload = buildEmailPayload({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });
    expect(payload.to).toBe("test@example.com");
    expect(payload.subject).toBe("Test");
    expect(payload.html).toContain("Hello");
    expect(payload.from).toBeTruthy();
  });

  it("uses default from address", () => {
    const payload = buildEmailPayload({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
    });
    expect(payload.from).toContain("@");
  });

  it("allows custom from address", () => {
    const payload = buildEmailPayload({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      from: "custom@example.com",
    });
    expect(payload.from).toBe("custom@example.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/email/__tests__/send-email.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement email sender**

First read `src/lib/notifiche/channels/email.ts` to see existing Resend usage pattern.

```typescript
// src/lib/email/send-email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_FROM = process.env.EMAIL_FROM || "Prima Nota <noreply@primanota.app>";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export function buildEmailPayload(input: EmailPayload & { from?: string }): { to: string; from: string; subject: string; html: string } {
  return {
    to: input.to,
    from: input.from || DEFAULT_FROM,
    subject: input.subject,
    html: input.html,
  };
}

export async function sendEmail(input: EmailPayload): Promise<EmailResult> {
  const payload = buildEmailPayload(input);

  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set, skipping email send");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const result = await resend.emails.send(payload);
    if (result.error) {
      console.error("[Email] Send error:", result.error);
      return { success: false, error: result.error.message };
    }
    return { success: true, messageId: result.data?.id };
  } catch (error: any) {
    console.error("[Email] Exception:", error);
    return { success: false, error: error.message };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/email/__tests__/send-email.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/send-email.ts src/lib/email/__tests__/send-email.test.ts
git commit -m "feat(final): add central email sender with Resend integration"
```

---

## Task 2: Wire Email to Alert Cron + Portal Notifications

**Files:**
- Modify: `src/app/api/cron/alerts/route.ts`

- [ ] **Step 1: Read existing cron alerts route and alert email formatter**

Read `src/app/api/cron/alerts/route.ts`, `src/lib/email/alert-email.ts`, and `src/lib/email/send-email.ts`.

- [ ] **Step 2: Wire email sending after alert generation**

After `generateAlerts()` completes for each society, query newly created CRITICAL alerts and send email notifications to recipients who have email channel enabled.

Add after the alert generation loop:

```typescript
import { sendEmail } from "@/lib/email/send-email";
import { formatAlertEmailSubject, formatAlertEmailHtml } from "@/lib/email/alert-email";

// After generating alerts, send emails for CRITICAL ones
const criticalAlerts = await prisma.alertGenerato.findMany({
  where: {
    societaId: s.id,
    gravita: "CRITICAL",
    stato: "NUOVO",
    createdAt: { gte: new Date(Date.now() - 3600000) }, // last hour
  },
  include: {
    utente: { select: { email: true } },
    regola: { select: { canali: true } },
  },
});

for (const alert of criticalAlerts) {
  const canali = (alert.regola.canali as string[]) || [];
  if (canali.includes("EMAIL") && alert.utente.email) {
    await sendEmail({
      to: alert.utente.email,
      subject: formatAlertEmailSubject(alert.gravita, alert.messaggio),
      html: formatAlertEmailHtml({
        messaggio: alert.messaggio,
        gravita: alert.gravita,
        categoria: alert.tipo,
        linkAzione: alert.linkAzione || undefined,
        societaNome: s.ragioneSociale,
      }),
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/alerts/route.ts
git commit -m "feat(final): wire email notifications for critical alerts in cron job"
```

---

## Task 3: OpenAPI Schema Generator

**Files:**
- Create: `src/lib/api/openapi-schema.ts`
- Create: `src/lib/api/__tests__/openapi-schema.test.ts`
- Create: `src/app/api/v1/docs/route.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/api/__tests__/openapi-schema.test.ts
import { describe, it, expect } from "vitest";
import { generateOpenApiSpec } from "../openapi-schema";

describe("openapi-schema", () => {
  it("generates valid OpenAPI 3.0 structure", () => {
    const spec = generateOpenApiSpec();
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBeTruthy();
    expect(spec.info.version).toBeTruthy();
    expect(spec.paths).toBeDefined();
  });

  it("includes all v1 endpoints", () => {
    const spec = generateOpenApiSpec();
    const paths = Object.keys(spec.paths);
    expect(paths).toContain("/api/v1/operazioni");
    expect(paths).toContain("/api/v1/alert");
    expect(paths).toContain("/api/v1/todo");
    expect(paths).toContain("/api/v1/kpi");
    expect(paths).toContain("/api/v1/report");
  });

  it("includes security scheme for API key", () => {
    const spec = generateOpenApiSpec();
    expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
    expect(spec.components.securitySchemes.BearerAuth.type).toBe("http");
    expect(spec.components.securitySchemes.BearerAuth.scheme).toBe("bearer");
  });
});
```

- [ ] **Step 2: Implement OpenAPI generator**

```typescript
// src/lib/api/openapi-schema.ts

interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  paths: Record<string, any>;
  components: { securitySchemes: Record<string, any>; schemas: Record<string, any> };
  security: any[];
}

export function generateOpenApiSpec(): OpenApiSpec {
  return {
    openapi: "3.0.3",
    info: {
      title: "Prima Nota API",
      version: "1.0.0",
      description: "API pubblica per Prima Nota — gestione contabile, alert, KPI, report. Autenticazione via API key Bearer token.",
    },
    servers: [
      { url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000", description: "Server principale" },
    ],
    paths: {
      "/api/v1/operazioni": {
        get: {
          summary: "Lista operazioni",
          description: "Restituisce le operazioni della società con paginazione e filtri data.",
          tags: ["Operazioni"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "perPage", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "da", in: "query", schema: { type: "string", format: "date" }, description: "Data inizio (YYYY-MM-DD)" },
            { name: "a", in: "query", schema: { type: "string", format: "date" }, description: "Data fine (YYYY-MM-DD)" },
          ],
          responses: {
            "200": { description: "Lista operazioni con paginazione", content: { "application/json": { schema: { $ref: "#/components/schemas/PaginatedResponse" } } } },
            "401": { description: "API key mancante o non valida" },
            "403": { description: "Scope insufficiente" },
            "429": { description: "Rate limit superato" },
          },
        },
      },
      "/api/v1/alert": {
        get: {
          summary: "Lista alert",
          description: "Restituisce gli alert generati per la società. Scope richiesto: read:alert",
          tags: ["Intelligence"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "perPage", in: "query", schema: { type: "integer", default: 20 } },
            { name: "stato", in: "query", schema: { type: "string", enum: ["NUOVO", "VISTO", "SNOOZED", "RISOLTO"] } },
          ],
          responses: { "200": { description: "Lista alert con paginazione" } },
        },
      },
      "/api/v1/todo": {
        get: {
          summary: "Lista todo",
          description: "Restituisce i todo generati per la società. Scope richiesto: read:todo",
          tags: ["Intelligence"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "perPage", in: "query", schema: { type: "integer", default: 20 } },
            { name: "data", in: "query", schema: { type: "string", format: "date" } },
          ],
          responses: { "200": { description: "Lista todo con paginazione" } },
        },
      },
      "/api/v1/kpi": {
        get: {
          summary: "KPI aziendali",
          description: "Calcola e restituisce tutti i KPI per il periodo specificato. Scope richiesto: read:kpi",
          tags: ["Business Intelligence"],
          parameters: [
            { name: "anno", in: "query", schema: { type: "integer" }, required: true },
            { name: "periodo", in: "query", schema: { type: "integer" }, required: true },
            { name: "periodoTipo", in: "query", schema: { type: "string", enum: ["MESE", "TRIMESTRE", "ANNO"] }, required: true },
          ],
          responses: { "200": { description: "Array di KPI con valore, variazione, trend" } },
        },
      },
      "/api/v1/report": {
        get: {
          summary: "Lista report generati",
          description: "Restituisce i report BI generati per la società. Scope richiesto: read:report",
          tags: ["Business Intelligence"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "perPage", in: "query", schema: { type: "integer", default: 10 } },
          ],
          responses: { "200": { description: "Lista report con paginazione" } },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "API key generata da /api/configurazione/api. Formato: pk_xxxxx",
        },
      },
      schemas: {
        PaginatedResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: { type: "object" } },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer" },
                perPage: { type: "integer" },
                total: { type: "integer" },
                totalPages: { type: "integer" },
              },
            },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  };
}
```

- [ ] **Step 3: Create docs route**

```typescript
// src/app/api/v1/docs/route.ts
import { NextResponse } from "next/server";
import { generateOpenApiSpec } from "@/lib/api/openapi-schema";

export async function GET() {
  const spec = generateOpenApiSpec();
  return NextResponse.json(spec, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run src/lib/api/__tests__/openapi-schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/openapi-schema.ts src/lib/api/__tests__/openapi-schema.test.ts src/app/api/v1/docs/
git commit -m "feat(final): add OpenAPI 3.0 spec generator with /api/v1/docs endpoint"
```

---

## Task 4: Remaining Vendor Parsers (Zucchetti, Passcom, Fatture in Cloud)

**Files:**
- Create: `src/lib/import/parsers/zucchetti.ts`
- Create: `src/lib/import/parsers/passcom.ts`
- Create: `src/lib/import/parsers/fatture-in-cloud.ts`
- Create: `src/lib/import/__tests__/parsers/zucchetti.test.ts`
- Modify: `src/lib/import/import-engine.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/import/__tests__/parsers/zucchetti.test.ts
import { describe, it, expect } from "vitest";
import { parseZucchettiCsv } from "../../parsers/zucchetti";

describe("parseZucchettiCsv", () => {
  it("parses pipe-separated CSV", () => {
    const csv = "Codice|Descrizione|Tipo\n001|Cassa|Attivo\n002|Banca|Passivo";
    const result = parseZucchettiCsv(csv);
    expect(result).toHaveLength(2);
    expect(result[0].data.Codice).toBe("001");
    expect(result[0].data.Descrizione).toBe("Cassa");
  });

  it("handles empty file", () => {
    expect(parseZucchettiCsv("Codice|Descrizione")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement parsers**

Read existing `src/lib/import/parsers/teamsystem.ts` for pattern reference, then create all 3 parsers.

Zucchetti uses pipe `|` separator. Passcom uses semicolon `;` (same as TeamSystem but with different encoding). Fatture in Cloud uses comma `,` separator.

```typescript
// src/lib/import/parsers/zucchetti.ts
import type { ParsedRow } from "../import-types";

export function parseZucchettiCsv(csvContent: string): ParsedRow[] {
  const lines = csvContent.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split("|").map((h) => h.trim());
  return lines.slice(1).map((line, i) => {
    const values = line.split("|").map((v) => v.trim());
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => { data[h] = values[idx] || ""; });
    return { rowNumber: i + 1, data };
  });
}
```

```typescript
// src/lib/import/parsers/passcom.ts
import type { ParsedRow } from "../import-types";
import { parseTeamSystemCsv } from "./teamsystem";

// Passcom uses the same semicolon-separated CSV format as TeamSystem
export function parsePasscomCsv(csvContent: string): ParsedRow[] {
  return parseTeamSystemCsv(csvContent);
}
```

```typescript
// src/lib/import/parsers/fatture-in-cloud.ts
import type { ParsedRow } from "../import-types";

export function parseFattureInCloudCsv(csvContent: string): ParsedRow[] {
  const lines = csvContent.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0], ",");
  return lines.slice(1).map((line, i) => {
    const values = parseCsvLine(line, ",");
    const data: Record<string, string> = {};
    headers.forEach((h, idx) => { data[h] = values[idx] || ""; });
    return { rowNumber: i + 1, data };
  });
}

function parseCsvLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
```

- [ ] **Step 3: Register parsers in import engine**

Read `src/lib/import/import-engine.ts` and replace the stub parsers with the real ones:

Replace `zucchetti: parseTeamSystemCsv` with `zucchetti: parseZucchettiCsv` (import from `./parsers/zucchetti`)
Replace `passcom: parseTeamSystemCsv` with `passcom: parsePasscomCsv` (import from `./parsers/passcom`)
Replace `"fatture-in-cloud": parseTeamSystemCsv` with `"fatture-in-cloud": parseFattureInCloudCsv` (import from `./parsers/fatture-in-cloud`)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/import/`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import/
git commit -m "feat(final): add Zucchetti, Passcom, Fatture in Cloud parsers and wire to engine"
```

---

## Task 5: YoY Confronto Alert Rules

**Files:**
- Create: `src/lib/intelligence/alert-engine/rules/confronto.ts`
- Create: `src/lib/intelligence/alert-engine/__tests__/confronto.test.ts`
- Modify: `src/lib/intelligence/alert-engine/evaluator.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/intelligence/alert-engine/__tests__/confronto.test.ts
import { describe, it, expect } from "vitest";
import { confrontoRules } from "../rules/confronto";

describe("confronto alert rules", () => {
  it("exports 2 rules for YoY comparison", () => {
    expect(confrontoRules).toHaveLength(2);
    expect(confrontoRules[0].codice).toBe("CONF_RICAVI_CALO");
    expect(confrontoRules[1].codice).toBe("CONF_COSTI_ANOMALI");
  });

  it("has correct defaults", () => {
    expect(confrontoRules[0].categoria).toBe("CONFRONTO");
    expect(confrontoRules[0].defaultSogliaValore).toBe(20);
    expect(confrontoRules[0].defaultGravita).toBe("WARNING");
  });
});
```

- [ ] **Step 2: Implement confronto rules**

```typescript
// src/lib/intelligence/alert-engine/rules/confronto.ts
import { prisma } from "@/lib/prisma";
import { subYears } from "date-fns";
import type { AlertRuleConfig, RuleSoglia } from "../types";
import type { EvaluationContext, AlertRuleResult } from "../../types";

async function sumRevenue(societaId: number, year: number): Promise<number> {
  const result = await prisma.operazione.aggregate({
    where: {
      societaId,
      tipoOperazione: "FATTURA_ATTIVA",
      dataOperazione: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      eliminato: false, bozza: false,
    },
    _sum: { importoTotale: true },
  });
  return Number(result._sum.importoTotale ?? 0);
}

async function sumCosts(societaId: number, year: number): Promise<number> {
  const result = await prisma.operazione.aggregate({
    where: {
      societaId,
      tipoOperazione: "COSTO",
      dataOperazione: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      eliminato: false, bozza: false,
    },
    _sum: { importoTotale: true },
  });
  return Number(result._sum.importoTotale ?? 0);
}

export const confrontoRules: AlertRuleConfig[] = [
  {
    codice: "CONF_RICAVI_CALO",
    categoria: "CONFRONTO",
    descrizione: "Calo ricavi YoY oltre soglia percentuale",
    defaultGravita: "WARNING",
    defaultSogliaValore: 20,
    async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
      const anno = ctx.oggi.getFullYear();
      const ricaviCorrente = await sumRevenue(ctx.societaId, anno);
      const ricaviPrec = await sumRevenue(ctx.societaId, anno - 1);

      if (ricaviPrec === 0) return [];
      const variazione = ((ricaviCorrente - ricaviPrec) / ricaviPrec) * 100;
      const sogliaPerc = -(soglia.sogliaValore ?? 20);

      if (variazione < sogliaPerc) {
        return [{
          codiceRegola: this.codice,
          messaggio: `Ricavi in calo del ${Math.abs(variazione).toFixed(1)}% rispetto all'anno precedente`,
          gravita: variazione < sogliaPerc * 2 ? "CRITICAL" : "WARNING",
          categoria: "CONFRONTO",
          linkAzione: "/bi?periodoTipo=ANNO",
          datiContesto: { ricaviCorrente, ricaviPrec, variazione },
          dedupeKey: `CONF_RICAVI_CALO:${ctx.societaId}:${anno}`,
        }];
      }
      return [];
    },
  },
  {
    codice: "CONF_COSTI_ANOMALI",
    categoria: "CONFRONTO",
    descrizione: "Aumento costi YoY oltre soglia percentuale",
    defaultGravita: "WARNING",
    defaultSogliaValore: 30,
    async evaluate(ctx: EvaluationContext, soglia: RuleSoglia): Promise<AlertRuleResult[]> {
      const anno = ctx.oggi.getFullYear();
      const costiCorrente = await sumCosts(ctx.societaId, anno);
      const costiPrec = await sumCosts(ctx.societaId, anno - 1);

      if (costiPrec === 0) return [];
      const variazione = ((costiCorrente - costiPrec) / costiPrec) * 100;
      const sogliaPerc = soglia.sogliaValore ?? 30;

      if (variazione > sogliaPerc) {
        return [{
          codiceRegola: this.codice,
          messaggio: `Costi in aumento del ${variazione.toFixed(1)}% rispetto all'anno precedente`,
          gravita: variazione > sogliaPerc * 1.5 ? "CRITICAL" : "WARNING",
          categoria: "CONFRONTO",
          linkAzione: "/bi?periodoTipo=ANNO",
          datiContesto: { costiCorrente, costiPrec, variazione },
          dedupeKey: `CONF_COSTI_ANOMALI:${ctx.societaId}:${anno}`,
        }];
      }
      return [];
    },
  },
];
```

- [ ] **Step 3: Register in evaluator**

Read `src/lib/intelligence/alert-engine/evaluator.ts`. Add import and registration:

```typescript
import { confrontoRules } from "./rules/confronto";

// In getAllAlertRules(), add:
...confrontoRules,
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/intelligence/alert-engine/`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/intelligence/alert-engine/
git commit -m "feat(final): add YoY confronto alert rules (revenue drop + cost spike)"
```

---

## Task 6: OCR Wiring for Portal Invoice Upload

**Files:**
- Modify: `src/lib/portale/operations/operation-handler.ts`

- [ ] **Step 1: Read existing files**

Read `src/lib/portale/operations/operation-handler.ts` and check for existing OCR endpoint (search for `/api/ocr` in the codebase).

- [ ] **Step 2: Add OCR data extraction to fattura operations**

In `createPortalOperation`, after creating the operation for type FATTURA, optionally call OCR if a file URL is provided. Store extracted data in the `dati` JSON field.

```typescript
// Add to createPortalOperation, after prisma.operazionePortale.create for FATTURA type:
if (input.tipo === "FATTURA" && input.dati && (input.dati as any).fileUrl) {
  try {
    // Try OCR extraction (non-blocking — if it fails, the operation is still created)
    const ocrRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ocr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl: (input.dati as any).fileUrl }),
    });
    if (ocrRes.ok) {
      const ocrData = await ocrRes.json();
      await prisma.operazionePortale.update({
        where: { id: op.id },
        data: { dati: { ...(input.dati as any), ocrEstratto: ocrData } },
      });
    }
  } catch {
    // OCR is optional — log and continue
    console.warn(`[PortalOp] OCR extraction failed for operation ${op.id}`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/portale/operations/operation-handler.ts
git commit -m "feat(final): wire OCR extraction to portal invoice upload"
```

---

## Task 7: Enhanced PDF Report Renderer

**Files:**
- Modify: `src/lib/bi/report/pdf-renderer.ts`

- [ ] **Step 1: Read existing renderer**

Read `src/lib/bi/report/pdf-renderer.ts` and existing PDF examples in `src/components/report/`.

- [ ] **Step 2: Enhance with comparison tables and better styling**

Add a ComparisonSection renderer for comparison data (table with delta highlighting) and improve header with date formatting. Add page numbers in footer.

The existing renderer already handles kpi_summary, text, and basic sections. Add support for `comparison` sections with a proper table layout, and `alert_summary` with severity colors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/bi/report/pdf-renderer.ts
git commit -m "feat(final): enhance PDF report renderer with comparison tables and styling"
```

---

## Task 8: FULLTEXT Index for Portal Message Search

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add FULLTEXT index**

Add to the `MessaggioPortale` model:

```prisma
@@index([testo], type: Fulltext)
```

Note: MySQL FULLTEXT requires `@db.Text` on the field, which is already the case for `testo`.

- [ ] **Step 2: Run migration**

Run: `npx prisma migrate dev --name add-fulltext-index-messaggi-portale`

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(final): add FULLTEXT index on portal messages for search"
```

---

## Task 9: Webhook Delivery History Page

**Files:**
- Create: `src/app/(app)/configurazione/api/webhook/page.tsx`
- Create: `src/app/(app)/configurazione/api/webhook/delivery-content.tsx`

- [ ] **Step 1: Read existing patterns**

Read `src/app/(app)/configurazione/api/page.tsx` and `src/components/api-config/delivery-history.tsx` for patterns.

- [ ] **Step 2: Create delivery detail page**

Server page + client content showing full delivery history for all webhooks with expandable payload, response body, retry button.

```tsx
// src/app/(app)/configurazione/api/webhook/page.tsx
import { getSessionUser } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { DeliveryContent } from "./delivery-content";

export default async function WebhookDeliveryPage() {
  const user = await getSessionUser();
  return (
    <AuthenticatedLayout pageTitle="Storico Webhook" user={user}>
      <DeliveryContent />
    </AuthenticatedLayout>
  );
}
```

```tsx
// src/app/(app)/configurazione/api/webhook/delivery-content.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface WebhookOption { id: number; url: string; attivo: boolean }
interface Delivery { id: number; evento: string; statoHttp: number | null; stato: string; tentativo: number; payload: any; risposta: string | null; createdAt: string }

export function DeliveryContent() {
  const [webhooks, setWebhooks] = useState<WebhookOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/configurazione/api/webhook");
      if (res.ok) { const data = await res.json(); setWebhooks(data.endpoints || []); }
    } catch (err) { console.error(err); }
  }, []);

  const fetchDeliveries = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/configurazione/api/webhook?endpointId=${id}`);
      if (res.ok) { const data = await res.json(); setDeliveries(data.deliveries || []); }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);
  useEffect(() => { if (selectedId) fetchDeliveries(selectedId); }, [selectedId, fetchDeliveries]);

  return (
    <div className="space-y-4">
      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger><SelectValue placeholder="Seleziona webhook endpoint..." /></SelectTrigger>
        <SelectContent>
          {webhooks.map((wh) => (
            <SelectItem key={wh.id} value={String(wh.id)}>
              {wh.url} {!wh.attivo && "(disattivo)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
      ) : deliveries.length === 0 ? (
        selectedId ? <p className="text-sm text-muted-foreground text-center py-8">Nessuna consegna</p> : null
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Storico Consegne</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {deliveries.map((d) => (
                <Collapsible key={d.id}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 text-left">
                      <div className="flex items-center gap-3">
                        <Badge variant={d.stato === "CONSEGNATO" ? "default" : "destructive"} className="text-[10px]">{d.stato}</Badge>
                        <span className="text-sm font-mono">{d.evento}</span>
                        <span className="text-xs text-muted-foreground">HTTP {d.statoHttp || "—"}</span>
                        <span className="text-xs text-muted-foreground">Tentativo {d.tentativo}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString("it-IT")}</span>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mx-3 mb-2 rounded border bg-muted/30 p-3 space-y-2">
                      <div>
                        <p className="text-xs font-medium mb-1">Payload</p>
                        <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-32">{JSON.stringify(d.payload, null, 2)}</pre>
                      </div>
                      {d.risposta && (
                        <div>
                          <p className="text-xs font-medium mb-1">Risposta</p>
                          <pre className="text-xs bg-background rounded p-2 overflow-x-auto max-h-32">{d.risposta}</pre>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/configurazione/api/webhook/
git commit -m "feat(final): add webhook delivery history page with payload inspection"
```

---

## Task 10: Full Test Suite + Build Verification

- [ ] **Step 1: Run all new tests**

Run: `npx vitest run src/lib/email/__tests__/send-email.test.ts src/lib/api/__tests__/openapi-schema.test.ts src/lib/import/__tests__/parsers/zucchetti.test.ts src/lib/intelligence/alert-engine/__tests__/confronto.test.ts`
Expected: All pass.

- [ ] **Step 2: Run full project tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: TypeScript compiles successfully.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(final): address test/build issues"
```

---

## Summary

| Task | Component | Tests |
|------|-----------|-------|
| 1 | Central email sender (Resend) | 3 tests |
| 2 | Wire email to alert cron | — |
| 3 | OpenAPI spec generator + /api/v1/docs | 3 tests |
| 4 | Zucchetti + Passcom + Fatture in Cloud parsers | 2 tests |
| 5 | YoY confronto alert rules | 2 tests |
| 6 | OCR wiring to portal invoice upload | — |
| 7 | Enhanced PDF report renderer | — |
| 8 | FULLTEXT index on portal messages | Migration |
| 9 | Webhook delivery history page | — |
| 10 | Full test suite + build verification | Regression |

**Total: 10 tasks, ~10 tests, ~10 commits**
