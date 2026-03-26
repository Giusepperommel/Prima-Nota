# Fase 1: Infrastruttura Base — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build scheduled cron jobs for batch alert/todo/report generation, email notifications for critical events, and PDF report rendering — enabling all subsequent frontend phases.

**Architecture:** Three cron API routes under `src/app/api/cron/` protected by `CRON_SECRET` header, calling existing SP12/SP13 engines. Email integration leverages existing `NotificationEngine` + Resend. PDF rendering uses existing `@react-pdf/renderer` patterns from `src/components/report/`.

**Tech Stack:** Next.js 16, Vercel Cron, existing Resend email (`src/lib/notifiche/channels/email.ts`), existing `@react-pdf/renderer`, existing Prisma models.

**Spec:** `docs/superpowers/specs/2026-03-26-frontend-infrastruttura-roadmap.md` (Fase 1)

---

## File Structure

### New files
```
src/app/api/cron/
  alerts/route.ts              — Batch alert generation for all active companies
  todos/route.ts               — Batch todo generation for all active users
  reports/route.ts             — Scheduled report generation

src/lib/cron/
  auth.ts                      — CRON_SECRET verification helper
  __tests__/
    auth.test.ts

src/lib/email/
  alert-email.ts               — Format and send alert notification emails
  portale-email.ts             — Format and send portal message notification emails
  __tests__/
    alert-email.test.ts

src/lib/bi/report/
  pdf-renderer.ts              — Convert report data to PDF using @react-pdf/renderer

src/app/api/bi/report/[id]/pdf/route.ts  — Download generated report as PDF

vercel.json                    — Cron schedule configuration
```

---

## Task 1: Cron Auth Helper

**Files:**
- Create: `src/lib/cron/auth.ts`
- Create: `src/lib/cron/__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/cron/__tests__/auth.test.ts
import { describe, it, expect, vi } from "vitest";
import { verifyCronSecret } from "../auth";

describe("cron auth", () => {
  it("returns true for valid secret", () => {
    vi.stubEnv("CRON_SECRET", "test-secret-123");
    expect(verifyCronSecret("test-secret-123")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false for invalid secret", () => {
    vi.stubEnv("CRON_SECRET", "test-secret-123");
    expect(verifyCronSecret("wrong-secret")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns false when CRON_SECRET is not set", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(verifyCronSecret("anything")).toBe(false);
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/cron/__tests__/auth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement cron auth**

```typescript
// src/lib/cron/auth.ts
import { NextRequest, NextResponse } from "next/server";

export function verifyCronSecret(secret: string): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return secret === expected;
}

export function authenticateCron(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.replace("Bearer ", "") || "";

  if (!verifyCronSecret(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // authenticated
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/cron/__tests__/auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cron/
git commit -m "feat(infra): add cron auth helper with secret verification"
```

---

## Task 2: Cron Alert Job

**Files:**
- Create: `src/app/api/cron/alerts/route.ts`

- [ ] **Step 1: Implement alert cron route**

```typescript
// src/app/api/cron/alerts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateCron } from "@/lib/cron/auth";
import { generateAlerts } from "@/lib/intelligence/alert-engine/evaluator";

export async function POST(request: NextRequest) {
  const authError = authenticateCron(request);
  if (authError) return authError;

  try {
    const societa = await prisma.societa.findMany({
      select: { id: true, ragioneSociale: true },
    });

    const results: { societaId: number; nome: string; alertCreati: number; errore?: string }[] = [];

    for (const s of societa) {
      try {
        const count = await generateAlerts(s.id);
        results.push({ societaId: s.id, nome: s.ragioneSociale, alertCreati: count });
      } catch (error: any) {
        results.push({ societaId: s.id, nome: s.ragioneSociale, alertCreati: 0, errore: error.message });
      }
    }

    const totale = results.reduce((sum, r) => sum + r.alertCreati, 0);
    console.log(`[Cron:Alerts] Generati ${totale} alert per ${societa.length} società`);

    return NextResponse.json({ success: true, totaleAlert: totale, dettagli: results });
  } catch (error: any) {
    console.error("[Cron:Alerts] Errore:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/alerts/
git commit -m "feat(infra): add cron alert batch job for all companies"
```

---

## Task 3: Cron Todo Job

**Files:**
- Create: `src/app/api/cron/todos/route.ts`

- [ ] **Step 1: Implement todo cron route**

```typescript
// src/app/api/cron/todos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateCron } from "@/lib/cron/auth";
import { persistTodosForUser } from "@/lib/intelligence/todo-engine/generator";

export async function POST(request: NextRequest) {
  const authError = authenticateCron(request);
  if (authError) return authError;

  try {
    // Get all active users with their company
    const utentiAzienda = await prisma.utenteAzienda.findMany({
      where: { attivo: true },
      select: { utenteId: true, societaId: true },
    });

    let totalCreated = 0;
    let errors = 0;

    for (const ua of utentiAzienda) {
      try {
        await persistTodosForUser(ua.societaId, ua.utenteId);
        totalCreated++;
      } catch (error) {
        errors++;
        console.error(`[Cron:Todos] Errore per utente ${ua.utenteId}:`, error);
      }
    }

    console.log(`[Cron:Todos] Processati ${totalCreated} utenti, ${errors} errori`);

    return NextResponse.json({ success: true, utentiProcessati: totalCreated, errori: errors });
  } catch (error: any) {
    console.error("[Cron:Todos] Errore:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/todos/
git commit -m "feat(infra): add cron todo batch job for all active users"
```

---

## Task 4: Cron Scheduled Reports Job

**Files:**
- Create: `src/app/api/cron/reports/route.ts`

- [ ] **Step 1: Implement report cron route**

```typescript
// src/app/api/cron/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateCron } from "@/lib/cron/auth";
import { generateAndPersistReport } from "@/lib/bi/report/generator";

function shouldGenerateToday(schedulazione: string | null): boolean {
  if (!schedulazione) return false;
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
  const dayOfMonth = now.getDate();

  switch (schedulazione) {
    case "SETTIMANALE":
      return dayOfWeek === 1; // Monday
    case "MENSILE":
      return dayOfMonth === 1; // First of month
    case "TRIMESTRALE":
      return dayOfMonth === 1 && [0, 3, 6, 9].includes(now.getMonth()); // Jan, Apr, Jul, Oct
    default:
      return false;
  }
}

export async function POST(request: NextRequest) {
  const authError = authenticateCron(request);
  if (authError) return authError;

  try {
    const templates = await prisma.reportTemplate.findMany({
      where: { attivo: true, schedulazione: { not: null } },
      include: { societa: { select: { id: true } } },
    });

    const now = new Date();
    const anno = now.getFullYear();
    const mese = now.getMonth() + 1;
    let generated = 0;

    for (const template of templates) {
      if (!shouldGenerateToday(template.schedulazione)) continue;
      if (!template.societa) continue;

      const periodoTipo = template.schedulazione === "TRIMESTRALE" ? "TRIMESTRE" :
                          template.schedulazione === "MENSILE" ? "MESE" : "MESE";
      const periodo = periodoTipo === "TRIMESTRE" ? Math.ceil(mese / 3) : mese;

      try {
        await generateAndPersistReport(template.societa.id, template.tipo, anno, periodo, periodoTipo);
        generated++;
      } catch (error) {
        console.error(`[Cron:Reports] Errore template ${template.id}:`, error);
      }
    }

    console.log(`[Cron:Reports] Generati ${generated} report`);

    return NextResponse.json({ success: true, reportGenerati: generated });
  } catch (error: any) {
    console.error("[Cron:Reports] Errore:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/reports/
git commit -m "feat(infra): add cron scheduled report generation job"
```

---

## Task 5: Vercel Cron Configuration

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/alerts",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/todos",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/reports",
      "schedule": "0 7 * * *"
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat(infra): add Vercel cron schedule config (alerts 2am, todos 6am, reports 7am)"
```

---

## Task 6: Alert Email Notifications

**Files:**
- Create: `src/lib/email/alert-email.ts`
- Create: `src/lib/email/__tests__/alert-email.test.ts`

- [ ] **Step 1: Write the failing test**

First read `src/lib/notifiche/channels/email.ts` to understand existing email pattern. Then write test:

```typescript
// src/lib/email/__tests__/alert-email.test.ts
import { describe, it, expect } from "vitest";
import { formatAlertEmailHtml, formatAlertEmailSubject } from "../alert-email";

describe("alert-email", () => {
  it("formats email subject with severity", () => {
    expect(formatAlertEmailSubject("CRITICAL", "Test alert")).toBe("[CRITICO] Test alert");
    expect(formatAlertEmailSubject("WARNING", "Test alert")).toBe("[AVVISO] Test alert");
    expect(formatAlertEmailSubject("INFO", "Test info")).toBe("[INFO] Test info");
  });

  it("formats email HTML body", () => {
    const html = formatAlertEmailHtml({
      messaggio: "Scadenza IVA tra 3 giorni",
      gravita: "CRITICAL",
      categoria: "SCADENZE",
      linkAzione: "/adempimenti",
      societaNome: "Acme Srl",
    });
    expect(html).toContain("Scadenza IVA tra 3 giorni");
    expect(html).toContain("Acme Srl");
    expect(html).toContain("CRITICO");
  });

  it("handles missing optional fields", () => {
    const html = formatAlertEmailHtml({
      messaggio: "Test",
      gravita: "INFO",
      categoria: "COMPLIANCE",
      societaNome: "Test Srl",
    });
    expect(html).toContain("Test");
    expect(html).not.toContain("undefined");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/email/__tests__/alert-email.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement alert email**

```typescript
// src/lib/email/alert-email.ts
const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "CRITICO",
  WARNING: "AVVISO",
  INFO: "INFO",
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  WARNING: "#f59e0b",
  INFO: "#3b82f6",
};

export function formatAlertEmailSubject(gravita: string, messaggio: string): string {
  const label = SEVERITY_LABELS[gravita] || gravita;
  return `[${label}] ${messaggio}`;
}

interface AlertEmailData {
  messaggio: string;
  gravita: string;
  categoria: string;
  linkAzione?: string;
  societaNome: string;
}

export function formatAlertEmailHtml(data: AlertEmailData): string {
  const label = SEVERITY_LABELS[data.gravita] || data.gravita;
  const color = SEVERITY_COLORS[data.gravita] || "#6b7280";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${color}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">${label} — ${data.categoria}</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #111827; margin: 0 0 16px;">${data.messaggio}</p>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">Società: <strong>${data.societaNome}</strong></p>
        ${data.linkAzione ? `<a href="${baseUrl}${data.linkAzione}" style="display: inline-block; background: ${color}; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Vai all'azione</a>` : ""}
      </div>
    </div>
  `.trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/email/__tests__/alert-email.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/
git commit -m "feat(infra): add alert email formatter with severity-based styling"
```

---

## Task 7: Portal Message Email Notifications

**Files:**
- Create: `src/lib/email/portale-email.ts`

- [ ] **Step 1: Implement portal email**

```typescript
// src/lib/email/portale-email.ts
export function formatPortaleMessageSubject(clienteNome: string, oggetto: string): string {
  return `Nuovo messaggio da ${clienteNome}: ${oggetto}`;
}

interface PortaleMessageEmailData {
  clienteNome: string;
  oggetto: string;
  testo: string;
  societaNome: string;
}

export function formatPortaleMessageHtml(data: PortaleMessageEmailData): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">Nuovo messaggio dal portale</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 8px;">Da: <strong>${data.clienteNome}</strong> — ${data.societaNome}</p>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px;">Oggetto: <strong>${data.oggetto}</strong></p>
        <div style="background: #f9fafb; padding: 16px; border-radius: 6px; margin: 0 0 16px;">
          <p style="font-size: 15px; color: #111827; margin: 0; white-space: pre-wrap;">${data.testo.slice(0, 500)}${data.testo.length > 500 ? "..." : ""}</p>
        </div>
        <a href="${baseUrl}/portale/inbox" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">Apri Inbox</a>
      </div>
    </div>
  `.trim();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email/portale-email.ts
git commit -m "feat(infra): add portal message email formatter"
```

---

## Task 8: PDF Report Renderer

**Files:**
- Create: `src/lib/bi/report/pdf-renderer.ts`

- [ ] **Step 1: Read existing PDF patterns**

Read `src/components/report/rendiconto-pdf.tsx` or `src/components/report/riepilogo-iva-pdf.tsx` to understand the existing @react-pdf/renderer usage pattern, then implement:

```typescript
// src/lib/bi/report/pdf-renderer.ts
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import React from "react";
import type { GeneratedReportData } from "./generator";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  header: { marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 12, color: "#6b7280", marginBottom: 16 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#f3f4f6" },
  label: { flex: 1, fontSize: 10 },
  value: { width: 100, textAlign: "right", fontSize: 10, fontWeight: "bold" },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#9ca3af" },
});

function KpiSection({ titolo, dati }: { titolo: string; dati: any[] }) {
  if (!Array.isArray(dati) || dati.length === 0) return null;
  return React.createElement(View, { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, titolo),
    ...dati.map((kpi: any, i: number) =>
      React.createElement(View, { key: i, style: styles.row },
        React.createElement(Text, { style: styles.label }, kpi.nome || kpi.codice || String(kpi.titolo || "")),
        React.createElement(Text, { style: styles.value },
          kpi.valore != null ? `${Number(kpi.valore).toLocaleString("it-IT")} ${kpi.unita || ""}`.trim() : "—"
        )
      )
    )
  );
}

function TextSection({ titolo, dati }: { titolo: string; dati: any }) {
  return React.createElement(View, { style: styles.section },
    React.createElement(Text, { style: styles.sectionTitle }, titolo),
    React.createElement(Text, { style: { fontSize: 10, lineHeight: 1.5 } }, dati?.narrativaAI || dati?.testo || "")
  );
}

function ReportDocument({ data, societaNome }: { data: GeneratedReportData; societaNome: string }) {
  return React.createElement(Document, {},
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.title }, societaNome),
        React.createElement(Text, { style: styles.subtitle }, `Periodo: ${data.periodo} — Generato: ${new Date(data.generatoAt).toLocaleDateString("it-IT")}`)
      ),
      ...data.sezioni.map((sezione, i) => {
        if (sezione.tipo === "text") {
          return React.createElement(TextSection, { key: i, titolo: sezione.titolo, dati: sezione.dati });
        }
        return React.createElement(KpiSection, { key: i, titolo: sezione.titolo, dati: Array.isArray(sezione.dati) ? sezione.dati : [] });
      }),
      React.createElement(Text, { style: styles.footer }, `Prima Nota — Report generato automaticamente il ${new Date().toLocaleDateString("it-IT")}`)
    )
  );
}

export async function renderReportToPdf(data: GeneratedReportData, societaNome: string): Promise<Buffer> {
  const doc = React.createElement(ReportDocument, { data, societaNome });
  const buffer = await renderToBuffer(doc as any);
  return Buffer.from(buffer);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/bi/report/pdf-renderer.ts
git commit -m "feat(infra): add PDF report renderer with @react-pdf/renderer"
```

---

## Task 9: PDF Download API Route

**Files:**
- Create: `src/app/api/bi/report/[id]/pdf/route.ts`

- [ ] **Step 1: Implement PDF download route**

```typescript
// src/app/api/bi/report/[id]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderReportToPdf } from "@/lib/bi/report/pdf-renderer";

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
      include: {
        template: { select: { nome: true } },
      },
    });

    if (!report) return NextResponse.json({ error: "Report non trovato" }, { status: 404 });

    const societa = await prisma.societa.findUnique({
      where: { id: user.societaId },
      select: { ragioneSociale: true },
    });

    const pdfBuffer = await renderReportToPdf(
      report.dati as any,
      societa?.ragioneSociale || "Società"
    );

    const filename = `${report.template.nome.replace(/\s+/g, "_")}_${report.periodo}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/bi/report/[id]/pdf/
git commit -m "feat(infra): add PDF report download endpoint"
```

---

## Task 10: Full Test Suite + Build

- [ ] **Step 1: Run all new tests**

Run: `npx vitest run src/lib/cron/ src/lib/email/`
Expected: All tests pass (6 tests).

- [ ] **Step 2: Run full project tests**

Run: `npx vitest run`
Expected: All existing tests still pass + new tests pass.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit any fixes**

If any test/build fails, fix and commit:
```bash
git add -A
git commit -m "fix(infra): address test/build issues"
```

---

## Summary

| Task | Component | Tests |
|------|-----------|-------|
| 1 | Cron auth helper | 3 tests |
| 2 | Cron alert batch job | Build verify |
| 3 | Cron todo batch job | Build verify |
| 4 | Cron scheduled reports | Build verify |
| 5 | Vercel cron config | — |
| 6 | Alert email formatter | 3 tests |
| 7 | Portal message email | — |
| 8 | PDF report renderer | — |
| 9 | PDF download API route | Build verify |
| 10 | Full test suite | Regression check |

**Total: 10 tasks, ~6 tests, ~10 commits**
