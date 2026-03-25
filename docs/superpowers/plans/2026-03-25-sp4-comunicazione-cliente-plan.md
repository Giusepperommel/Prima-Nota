# Sub-project 4: Comunicazione Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client portal with separate authentication, document requests, AI-generated narrative reports, quick questions with auto-apply, and full commercialista control over visibility.

**Architecture:** New route group `/portale/` with JWT-based auth (separate from NextAuth). New models for client access, document requests, reports. AI narrative generation via Claude. Commercialista controls visibility via `ConfigurazionePortale`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 6 (MySQL), Vitest, bcryptjs, jose (JWT), @anthropic-ai/sdk, Resend, Tailwind CSS, Shadcn UI

**Spec:** `docs/superpowers/specs/2026-03-25-automazioni-commercialista-design.md` (Section: Sub-project 4)

---

## Task 1: Schema — All SP4 Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add all SP4 models and enums**

Add enums: `RuoloCliente`, `RichiestaDocumentoTipo`, `RichiestaDocumentoStato`, `ReportClienteTipo`, `ReportClienteStato`, `DocumentoCondivisoTipo`

Add models: `ConfigurazionePortale`, `AccessoCliente`, `RichiestaDocumento`, `DomandaCliente`, `ReportCliente`, `DocumentoCondiviso`

Add `clienteDestinatarioId Int? @map("cliente_destinatario_id")` to the existing `Notifica` model + relation to `AccessoCliente` + index.

Add relations to Societa: `configurazionePortale`, `accessiCliente`, `richiesteDocumento`, `reportCliente`, `documentiCondivisi`

Read the spec (Sub-project 4, Section 4.6) for exact model definitions. Follow codebase conventions: Int IDs, @map snake_case, @@map table_name, @db annotations, @@index.

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name sp4-comunicazione-cliente
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(sp4): add portal models (AccessoCliente, RichiestaDocumento, DomandaCliente, ReportCliente, etc.)"
```

---

## Task 2: Portal Authentication (JWT)

**Files:**
- Create: `src/lib/portale/auth.ts`
- Create: `src/lib/portale/types.ts`
- Test: `src/lib/__tests__/portale-auth.test.ts`

- [ ] **Step 1: Create types**

Create `src/lib/portale/types.ts`:

```typescript
export type PortaleTokenPayload = {
  accessoClienteId: number;
  societaId: number;
  ruolo: string;
};

export type PortaleLoginInput = {
  email: string;
  password: string;
  societaId: number;
};
```

- [ ] **Step 2: Write tests (TDD)**

Create `src/lib/__tests__/portale-auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPortaleToken, verifyPortaleToken } from "../portale/auth";

describe("Portal JWT auth", () => {
  it("creates and verifies a valid token", async () => {
    const token = await createPortaleToken({ accessoClienteId: 1, societaId: 1, ruolo: "TITOLARE" });
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");

    const payload = await verifyPortaleToken(token);
    expect(payload.accessoClienteId).toBe(1);
    expect(payload.societaId).toBe(1);
    expect(payload.ruolo).toBe("TITOLARE");
  });

  it("throws on invalid token", async () => {
    await expect(verifyPortaleToken("invalid")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Implement JWT auth**

Create `src/lib/portale/auth.ts`:

```typescript
import { SignJWT, jwtVerify } from "jose";
import type { PortaleTokenPayload } from "./types";

const SECRET = new TextEncoder().encode(process.env.PORTALE_JWT_SECRET ?? "portale-secret-change-me");

export async function createPortaleToken(payload: PortaleTokenPayload): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifyPortaleToken(token: string): Promise<PortaleTokenPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return {
    accessoClienteId: payload.accessoClienteId as number,
    societaId: payload.societaId as number,
    ruolo: payload.ruolo as string,
  };
}
```

Note: `jose` is already available (NextAuth uses it). If not, install it.

- [ ] **Step 4: Run tests, commit**

```bash
npx vitest run src/lib/__tests__/portale-auth.test.ts
git add src/lib/portale/ src/lib/__tests__/portale-auth.test.ts
git commit -m "feat(sp4): add portal JWT authentication"
```

---

## Task 3: Report Narrativi AI

**Files:**
- Create: `src/lib/portale/report-generator.ts`
- Test: `src/lib/__tests__/portale-report.test.ts`

- [ ] **Step 1: Write tests (TDD)**

Create `src/lib/__tests__/portale-report.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildReportPrompt, parseReportResponse } from "../portale/report-generator";

describe("buildReportPrompt", () => {
  it("builds IVA report prompt with data", () => {
    const prompt = buildReportPrompt("IVA_TRIMESTRALE", {
      societaNome: "Rossi SRL",
      periodo: "Q1 2026",
      ivaCredito: 2340,
      ivaDebito: 1500,
      totaleOperazioniAttive: 50000,
      totaleOperazioniPassive: 30000,
    });
    expect(prompt).toContain("Rossi SRL");
    expect(prompt).toContain("2340");
    expect(prompt).toContain("IVA");
  });

  it("builds andamento report with comparison data", () => {
    const prompt = buildReportPrompt("ANDAMENTO", {
      societaNome: "Bianchi SRL",
      periodo: "Marzo 2026",
      ricavi: 80000,
      costi: 60000,
      ricaviAnnoPrecedente: 70000,
      costiAnnoPrecedente: 55000,
    });
    expect(prompt).toContain("Bianchi SRL");
    expect(prompt).toContain("80000");
  });
});

describe("parseReportResponse", () => {
  it("returns markdown content", () => {
    const result = parseReportResponse("## Situazione IVA\n\nIl credito IVA è di €2.340.");
    expect(result).toContain("Situazione IVA");
  });

  it("strips any non-content prefix", () => {
    const result = parseReportResponse("Ecco il report:\n\n## Situazione\nTesto");
    expect(result).toContain("Situazione");
  });
});
```

- [ ] **Step 2: Implement report generator**

Create `src/lib/portale/report-generator.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { ReportClienteTipo } from "@prisma/client";

const client = new Anthropic();

const SYSTEM_PROMPT = `Sei un assistente di studio commercialista. Scrivi report per i clienti in italiano, chiaro e professionale.
Il report deve essere in formato Markdown, comprensibile da un imprenditore non esperto di contabilità.
Usa un tono cortese e rassicurante. Includi numeri e percentuali. Non usare gergo tecnico senza spiegarlo.
Mantieni il report conciso (300-500 parole).`;

export function buildReportPrompt(
  tipo: ReportClienteTipo | string,
  data: Record<string, unknown>,
): string {
  const parts: string[] = [];
  const nome = data.societaNome ?? "l'azienda";
  const periodo = data.periodo ?? "";

  switch (tipo) {
    case "IVA_TRIMESTRALE":
      parts.push(`Scrivi un report sulla situazione IVA di ${nome} per il periodo ${periodo}.`);
      parts.push(`Dati:`);
      if (data.ivaCredito !== undefined) parts.push(`- IVA a credito: €${data.ivaCredito}`);
      if (data.ivaDebito !== undefined) parts.push(`- IVA a debito: €${data.ivaDebito}`);
      if (data.totaleOperazioniAttive !== undefined) parts.push(`- Totale vendite: €${data.totaleOperazioniAttive}`);
      if (data.totaleOperazioniPassive !== undefined) parts.push(`- Totale acquisti: €${data.totaleOperazioniPassive}`);
      break;

    case "ANDAMENTO":
      parts.push(`Scrivi un report sull'andamento economico di ${nome} per ${periodo}.`);
      parts.push(`Dati:`);
      if (data.ricavi !== undefined) parts.push(`- Ricavi: €${data.ricavi}`);
      if (data.costi !== undefined) parts.push(`- Costi: €${data.costi}`);
      if (data.ricaviAnnoPrecedente !== undefined) parts.push(`- Ricavi anno precedente: €${data.ricaviAnnoPrecedente}`);
      if (data.costiAnnoPrecedente !== undefined) parts.push(`- Costi anno precedente: €${data.costiAnnoPrecedente}`);
      break;

    case "PRE_SCADENZA":
      parts.push(`Scrivi un promemoria pre-scadenza per ${nome}.`);
      parts.push(`Scadenza: ${data.scadenza ?? "N/D"}`);
      parts.push(`Importo: €${data.importo ?? 0}`);
      parts.push(`Tipo: ${data.tipoScadenza ?? "F24"}`);
      break;

    case "ANNUALE":
      parts.push(`Scrivi un riepilogo annuale per ${nome} — anno ${periodo}.`);
      if (data.utile !== undefined) parts.push(`- Utile/Perdita: €${data.utile}`);
      if (data.ricaviTotali !== undefined) parts.push(`- Ricavi totali: €${data.ricaviTotali}`);
      if (data.costiTotali !== undefined) parts.push(`- Costi totali: €${data.costiTotali}`);
      break;
  }

  return parts.join("\n");
}

export function parseReportResponse(text: string): string {
  // Return as-is — Claude already generates markdown
  return text.trim();
}

export async function generateReport(
  tipo: ReportClienteTipo | string,
  data: Record<string, unknown>,
): Promise<{ contenuto: string; tokensUsati: number }> {
  const prompt = buildReportPrompt(tipo, data);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const contenuto = textBlock && textBlock.type === "text" ? parseReportResponse(textBlock.text) : "";
  const tokensUsati = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  return { contenuto, tokensUsati };
}
```

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run src/lib/__tests__/portale-report.test.ts
git add src/lib/portale/report-generator.ts src/lib/__tests__/portale-report.test.ts
git commit -m "feat(sp4): add AI narrative report generator for client portal"
```

---

## Task 4: Portal API Routes

**Files:**
- Create: `src/app/api/portale/auth/login/route.ts`
- Create: `src/app/api/portale/auth/reset-password/route.ts`
- Create: `src/app/api/portale/dashboard/route.ts`
- Create: `src/app/api/portale/documenti/route.ts`
- Create: `src/app/api/portale/richieste/route.ts`
- Create: `src/app/api/portale/richieste/[id]/rispondi/route.ts`

- [ ] **Step 1: Implement portal auth routes**

`login/route.ts` — POST: email + password + societaId → verify with bcrypt → create JWT → return token. Rate limit: check X-Forwarded-For header (simple in-memory counter).

`reset-password/route.ts` — POST: email → generate token → send via Resend → store. (Simplified for now.)

- [ ] **Step 2: Implement portal data routes**

All portal routes verify JWT from Authorization header via `verifyPortaleToken`.

`dashboard/route.ts` — GET: returns client dashboard data (pending requests, situazione IVA if enabled, recent documents). Checks `ConfigurazionePortale` for visibility.

`documenti/route.ts` — GET: list shared documents for this client.

`richieste/route.ts` — GET: list pending document requests for this client.

`richieste/[id]/rispondi/route.ts` — POST: submit response to a request/question. If DomandaCliente has options, apply action automatically if possible.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/portale/
git commit -m "feat(sp4): add portal API routes (auth, dashboard, documents, requests)"
```

---

## Task 5: Commercialista Management Routes

**Files:**
- Create: `src/app/api/portale-config/route.ts`
- Create: `src/app/api/portale-config/clienti/route.ts`
- Create: `src/app/api/portale-config/richieste/route.ts`
- Create: `src/app/api/portale-config/report/route.ts`

- [ ] **Step 1: Implement management routes**

These routes use standard NextAuth auth (commercialista side, not portal JWT).

`portale-config/route.ts` — GET/PUT: read/update `ConfigurazionePortale` for current società.

`portale-config/clienti/route.ts` — GET/POST: list/create `AccessoCliente` entries. POST creates new client with hashed password.

`portale-config/richieste/route.ts` — GET/POST: list/create `RichiestaDocumento` with `DomandaCliente` items.

`portale-config/report/route.ts` — POST: generate report via `generateReport`, create `ReportCliente` record. PUT: approve report (set contenutoApprovato, stato=APPROVATO). POST with action "invia": mark as INVIATO.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/portale-config/
git commit -m "feat(sp4): add commercialista portal management routes"
```

---

## Task 6: Portal Client Page

**Files:**
- Create: `src/app/portale/page.tsx`
- Create: `src/app/portale/login/page.tsx`

- [ ] **Step 1: Create portal login page**

Simple login form (email + password). Calls `/api/portale/auth/login`. Stores JWT in localStorage. Redirects to `/portale` on success.

- [ ] **Step 2: Create portal dashboard page**

Authenticated client view with sections:
1. **Da fare** — pending requests with response buttons
2. **Situazione** — IVA summary, next deadline (if enabled by commercialista)
3. **Documenti** — list of shared documents with download links
4. **Messaggi** — reports sent by commercialista

All data fetched from `/api/portale/dashboard`, `/api/portale/documenti`, `/api/portale/richieste`.

- [ ] **Step 3: Commit**

```bash
git add src/app/portale/
git commit -m "feat(sp4): add client portal pages (login + dashboard)"
```

---

## Task 7: Run All Tests & Verify Build

- [ ] **Step 1: Run all new tests**

```bash
npx vitest run src/lib/__tests__/portale-auth.test.ts src/lib/__tests__/portale-report.test.ts
```

- [ ] **Step 2: Full test suite + TypeScript**

```bash
npx vitest run && npx tsc --noEmit
```

- [ ] **Step 3: Commit fixes if needed**
