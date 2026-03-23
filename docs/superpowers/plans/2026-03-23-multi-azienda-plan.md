# Multi-Azienda e RLS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to access multiple companies with per-company roles, company switching, a multi-company dashboard with notes/deadlines/alerts, and an activity log for tracking accountant actions.

**Architecture:** A bridge table `UtenteAzienda` links users to N companies with roles. The JWT session's `societaId` is updated on switch — all 80+ existing API routes continue reading `session.societaId` unchanged. New tables for notes, deadlines, alerts, and invitations. Auth system refactored to read identity from `Utente` (not `Socio`) and role from `UtenteAzienda`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma (MySQL), NextAuth JWT, Tailwind CSS, Shadcn UI, Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-multi-azienda-design.md`

---

## Task 1: Schema — New Enums, Tables, and Field Modifications

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new enums**

```prisma
enum RuoloAzienda {
  ADMIN
  STANDARD
  COMMERCIALISTA
  @@map("ruolo_azienda")
}

enum TipoScadenza {
  FISCALE
  CONTABILE
  GENERICA
  @@map("tipo_scadenza")
}

enum PrioritaScadenza {
  ALTA
  MEDIA
  BASSA
  @@map("priorita_scadenza")
}

enum TipoAlert {
  SCADENZA_IMMINENTE
  SCRITTURA_PROVVISORIA
  IVA_DA_LIQUIDARE
  BILANCIO_NON_QUADRA
  GENERICO
  @@map("tipo_alert")
}

enum LivelloAlert {
  INFO
  WARNING
  ERRORE
  @@map("livello_alert")
}
```

- [ ] **Step 2: Add UtenteAzienda model**

```prisma
model UtenteAzienda {
  id              Int           @id @default(autoincrement())
  utenteId        Int           @map("utente_id")
  societaId       Int           @map("societa_id")
  ruolo           RuoloAzienda
  attivo          Boolean       @default(true)
  ultimoAccesso   DateTime?     @map("ultimo_accesso")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  utente          Utente        @relation(fields: [utenteId], references: [id])
  societa         Societa       @relation(fields: [societaId], references: [id])
  note            NotaAzienda[]

  @@unique([utenteId, societaId])
  @@index([utenteId])
  @@index([societaId])
  @@map("utenti_azienda")
}
```

- [ ] **Step 3: Add NotaAzienda, ScadenzaAzienda, AlertAzienda, InvitoAzienda models**

(Full Prisma model definitions for each — follow spec sections 2.2-2.5b. Use `@@map` for snake_case table names, `@map` for column names. Follow existing codebase conventions.)

- [ ] **Step 4: Add fields to Utente model**

```prisma
  nome            String?       @db.VarChar(100)
  cognome         String?       @db.VarChar(100)
  isSuperAdmin    Boolean       @default(false) @map("is_super_admin")
  aziende         UtenteAzienda[]
```

- [ ] **Step 5: Add utenteId to Socio model**

```prisma
  utenteId        Int?          @map("utente_id")
  utenteCollegato Utente?       @relation("SocioUtente", fields: [utenteId], references: [id])
```

Add back-reference on Utente:
```prisma
  sociCollegati   Socio[]       @relation("SocioUtente")
```

- [ ] **Step 6: Modify Socio email constraint**

Change `email String @unique` to `email String`. Add `@@unique([societaId, email])` to the model-level constraints.

**IMPORTANT:** This removes the global unique index. A data migration step will ensure no duplicates exist before this runs.

- [ ] **Step 7: Add societaId to LogAttivita**

```prisma
  societaId       Int?          @map("societa_id")
  societa         Societa?      @relation(fields: [societaId], references: [id])
```
Add `@@index([societaId, createdAt])`.

- [ ] **Step 8: Add back-references to Societa**

```prisma
  utentiAzienda   UtenteAzienda[]
  scadenze        ScadenzaAzienda[]
  alert           AlertAzienda[]
  inviti          InvitoAzienda[]
  logAttivita     LogAttivita[]
```

- [ ] **Step 9: Run migration**

```bash
npx prisma migrate dev --name add_multi_azienda
```

- [ ] **Step 10: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add UtenteAzienda bridge table, notes, deadlines, alerts, invitations"
```

---

## Task 2: Data Migration Script — Populate UtenteAzienda and Utente Fields

**Files:**
- Create: `prisma/seed-multi-azienda.ts`

- [ ] **Step 1: Create migration script**

```typescript
// For each existing Utente with a linked Socio that has a societaId:
// 1. Copy nome/cognome from Socio to Utente
// 2. Set Socio.utenteId = Utente.id
// 3. Create UtenteAzienda record with ruolo from Socio.ruolo
// 4. Populate LogAttivita.societaId from linked records
// 5. If Socio.ruolo === 'SUPER_ADMIN', set Utente.isSuperAdmin = true
```

- [ ] **Step 2: Add npm script and run**

```bash
npm run seed:multi-azienda
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(migration): populate UtenteAzienda from existing Socio-Utente links"
```

---

## Task 3: Auth System — Refactor authorize/JWT/session

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/types/index.ts`
- Create: `src/lib/auth-utils.ts`

- [ ] **Step 1: Update SessionUser type**

In `src/types/index.ts`, update:

```typescript
export type SessionUser = {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: string;              // From UtenteAzienda.ruolo (COMMERCIALISTA mapped to ADMIN)
  ruoloAzienda: string | null; // Original role (ADMIN|STANDARD|COMMERCIALISTA)
  isSuperAdmin: boolean;
  socioId: number | null;     // null for commercialista
  societaId: number | null;
  quotaPercentuale: number;
  emailVerificata: boolean;
  modalitaAvanzata: boolean;
  modalitaCommercialista: boolean;
  numeroAziende: number;
};
```

- [ ] **Step 2: Create auth-utils.ts**

```typescript
// src/lib/auth-utils.ts
import prisma from "./prisma";

export async function requireCompanyAccess(utenteId: number, societaId: number) {
  return prisma.utenteAzienda.findUnique({
    where: { utenteId_societaId: { utenteId, societaId } },
  });
}

export async function getUtenteAziendeCount(utenteId: number): Promise<number> {
  return prisma.utenteAzienda.count({
    where: { utenteId, attivo: true },
  });
}

export async function getDefaultAzienda(utenteId: number) {
  return prisma.utenteAzienda.findFirst({
    where: { utenteId, attivo: true },
    orderBy: { ultimoAccesso: 'desc' },
    include: { societa: { select: { id: true, ragioneSociale: true } } },
  });
}

export function mapRuoloForSession(ruoloAzienda: string): string {
  // COMMERCIALISTA gets ADMIN-level access for existing route checks
  if (ruoloAzienda === 'COMMERCIALISTA') return 'ADMIN';
  return ruoloAzienda;
}
```

- [ ] **Step 3: Refactor auth.ts authorize callback**

The authorize function must:
1. Find Utente by email (as today)
2. Read `nome`/`cognome` from `Utente` (not Socio) — fallback to Socio if Utente fields are null (migration transition)
3. Count UtenteAzienda records
4. If 1 azienda → auto-select, populate societaId/ruolo
5. If 0 or >1 → societaId = null (middleware will redirect)
6. Find Socio for selected azienda if exists

- [ ] **Step 4: Refactor JWT callback**

Populate token with new fields: `isSuperAdmin`, `ruoloAzienda`, `numeroAziende`. Map `ruolo` from `UtenteAzienda.ruolo` via `mapRuoloForSession()`.

Handle the `trigger === "update"` case for switch-societa.

- [ ] **Step 5: Refactor session callback**

Add `ruoloAzienda`, `isSuperAdmin`, `numeroAziende` to session.user.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(auth): refactor session to use UtenteAzienda for role, Utente for identity"
```

---

## Task 4: Switch-Societa API

**Files:**
- Create: `src/app/api/auth/switch-societa/route.ts`

- [ ] **Step 1: Implement POST endpoint**

```typescript
// POST /api/auth/switch-societa
// Body: { societaId: number }
// 1. Auth check
// 2. requireCompanyAccess(user.id, societaId) — 403 if not found or not attivo
// 3. Find Socio for this utente in this societa (may be null for commercialista)
// 4. Update UtenteAzienda.ultimoAccesso
// 5. Update session via NextAuth update() with new societaId, socioId, ruolo
// 6. Return success
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(api): add POST /api/auth/switch-societa for company switching"
```

---

## Task 5: Middleware Update

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update redirect logic**

```typescript
// Current: if societaId == null → redirect /crea-societa
// New:
// if societaId == null && isSuperAdmin → allow
// if societaId == null && numeroAziende > 1 → redirect /aziende
// if societaId == null && numeroAziende === 0 → redirect /crea-societa
// if societaId == null && numeroAziende === 1 → should have been auto-selected in auth
```

Add `/aziende` to `noSocietaRequiredPaths`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(middleware): redirect multi-company users to /aziende when no company selected"
```

---

## Task 6: Refactor Company Creation

**Files:**
- Modify: `src/app/api/societa/route.ts`

- [ ] **Step 1: Remove "already associated" check**

Remove lines 17-22 that block creation if `user.societaId !== null`. Any user can create a new company.

- [ ] **Step 2: Add UtenteAzienda creation in the transaction**

After creating Societa and updating Socio:
```typescript
await tx.utenteAzienda.create({
  data: {
    utenteId: user.id,
    societaId: nuovaSocieta.id,
    ruolo: 'ADMIN',
  },
});
```

- [ ] **Step 3: Auto-switch to new company**

Return the new societaId so the client can call `update({ societaId })` to switch.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): allow multi-company creation, add UtenteAzienda on company create"
```

---

## Task 7: Refactor Invitation System

**Files:**
- Modify: `src/app/api/soci/invita/route.ts`
- Create: `src/app/api/azienda/invita-commercialista/route.ts`

- [ ] **Step 1: Update soci/invita to create UtenteAzienda**

When inviting a socio:
1. Find or create Socio record for this company
2. If the invited user already has an account (Utente exists), create UtenteAzienda
3. Remove the "already associated to another company" check — a user CAN be in multiple companies
4. Set Socio.utenteId if Utente exists

- [ ] **Step 2: Create invita-commercialista endpoint**

```typescript
// POST /api/azienda/invita-commercialista
// Body: { email: string }
// Only ADMIN can invoke
// If Utente exists: create UtenteAzienda with ruolo COMMERCIALISTA (no Socio created)
// If not exists: create InvitoAzienda with token, send invitation email
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api): refactor invitations for multi-company, add commercialista invite"
```

---

## Task 8: Aziende List API

**Files:**
- Create: `src/app/api/aziende/route.ts`

- [ ] **Step 1: Implement GET endpoint**

Returns the list of companies for the current user, with KPI, alert count, and upcoming deadlines.

```typescript
// GET /api/aziende
// Returns: { aziende: AziendaCard[] }
// Each card includes: societaId, ragioneSociale, tipoAttivita, partitaIva,
//   ruolo, ultimoAccesso, kpi (fatturato/costi/margine YTD),
//   alertNonLetti (count), prossimaScadenza, noteCount
```

Query UtenteAzienda for the user, include Societa, aggregate KPI from Operazione.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(api): add GET /api/aziende with KPI and alerts"
```

---

## Task 9: Scadenze CRUD API

**Files:**
- Create: `src/app/api/scadenze/route.ts`
- Create: `src/app/api/scadenze/[id]/route.ts`

- [ ] **Step 1: GET /api/scadenze** — list deadlines for current company, filterable
- [ ] **Step 2: POST /api/scadenze** — create deadline
- [ ] **Step 3: PUT /api/scadenze/[id]** — update (complete/uncomplete)
- [ ] **Step 4: DELETE /api/scadenze/[id]** — remove
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(api): add CRUD for scadenze azienda"
```

---

## Task 10: Note and Alert APIs

**Files:**
- Create: `src/app/api/note-azienda/route.ts`
- Create: `src/app/api/note-azienda/[id]/route.ts`
- Create: `src/app/api/alert/route.ts`
- Create: `src/app/api/alert/[id]/letto/route.ts`

- [ ] **Step 1: Note CRUD** — GET/POST for current UtenteAzienda, PUT/DELETE for [id]
- [ ] **Step 2: Alert GET** — list alerts for current company, unread first
- [ ] **Step 3: Alert mark-as-read** — PUT /api/alert/[id]/letto
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): add note and alert APIs"
```

---

## Task 11: Accessi e Attivita API

**Files:**
- Create: `src/app/api/azienda/accessi/route.ts`
- Create: `src/app/api/azienda/accessi/[id]/route.ts`
- Create: `src/app/api/azienda/log/route.ts`

- [ ] **Step 1: GET /api/azienda/accessi** — list UtenteAzienda for current company (ADMIN only)
- [ ] **Step 2: PUT /api/azienda/accessi/[id]** — update role or deactivate
- [ ] **Step 3: DELETE /api/azienda/accessi/[id]** — remove access
- [ ] **Step 4: GET /api/azienda/log** — filtered LogAttivita with user info, period, action type
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(api): add access management and activity log APIs"
```

---

## Task 12: UI — CompanySwitcher in Sidebar

**Files:**
- Create: `src/components/layout/company-switcher.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Create CompanySwitcher component**

A dropdown in the sidebar header that:
- Shows current company name + role badge
- If `numeroAziende > 1`: dropdown with list fetched from GET /api/aziende
- Click → POST /api/auth/switch-societa → page reload
- If `numeroAziende === 1`: just show company name (no dropdown)
- Link to "/aziende" for full dashboard

- [ ] **Step 2: Integrate into sidebar header**

Replace the static "PrimaNota" logo area with the CompanySwitcher (showing company name below the logo).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ui): add CompanySwitcher dropdown in sidebar"
```

---

## Task 13: UI — Dashboard "Le mie aziende"

**Files:**
- Create: `src/app/aziende/page.tsx`
- Create: `src/app/aziende/aziende-content.tsx`
- Create: `src/components/aziende/azienda-card.tsx`
- Create: `src/components/aziende/scadenza-item.tsx`
- Create: `src/components/aziende/nota-item.tsx`

- [ ] **Step 1: Create server page with auth check**

Redirect to `/dashboard` if user has only 1 company. Show the dashboard for multi-company users.

- [ ] **Step 2: Create AziendaCard component**

Card with: company header (name, type, P.IVA, role badge), KPI section, alert section, scadenze list (with checkboxes), note list (with add/edit/delete).

- [ ] **Step 3: Create aziende-content client component**

Fetches from GET /api/aziende, renders grid of AziendaCard. "Crea nuova azienda" button at the top.

- [ ] **Step 4: Create ScadenzaItem and NotaItem**

Scadenza: description, date, type badge, priority color, checkbox to complete.
Nota: text, color indicator, edit/delete buttons.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ui): add 'Le mie aziende' dashboard with cards, KPI, deadlines, notes"
```

---

## Task 14: UI — Accessi e Attivita Page

**Files:**
- Create: `src/app/configurazione/accessi/page.tsx`
- Create: `src/app/configurazione/accessi/accessi-content.tsx`
- Modify: `src/components/layout/app-sidebar.tsx` (add link)

- [ ] **Step 1: Create page (ADMIN only)**

Two sections:
1. **Utenti con accesso**: table with name, email, role, last access, status. Actions: change role, deactivate, remove.
2. **Log attivita**: filterable table (user, period, action type). Highlight commercialista actions.

- [ ] **Step 2: Add "Invita commercialista" dialog**

Button that opens a dialog → input email → POST /api/azienda/invita-commercialista.

- [ ] **Step 3: Add sidebar link**

Under "Configurazione" section, add "Accessi" link (ADMIN only).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): add Accessi e Attivita page with access management and activity log"
```

---

## Task 15: Update Onboarding Flow

**Files:**
- Modify: `src/app/crea-societa/page.tsx`

- [ ] **Step 1: Adapt for multi-company context**

If the user already has companies (is creating an additional one), show a simplified flow. Remove any "you already have a company" blocks. After creation, call `update({ societaId: newId })` and redirect to dashboard.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(ui): adapt company creation for multi-company users"
```

---

## Task 16: Integration Testing

**Files:**
- Create: `src/lib/__tests__/auth-utils.test.ts`

- [ ] **Step 1: Test mapRuoloForSession**

```typescript
it("maps COMMERCIALISTA to ADMIN", () => {
  expect(mapRuoloForSession("COMMERCIALISTA")).toBe("ADMIN");
});
it("keeps ADMIN as ADMIN", () => {
  expect(mapRuoloForSession("ADMIN")).toBe("ADMIN");
});
it("keeps STANDARD as STANDARD", () => {
  expect(mapRuoloForSession("STANDARD")).toBe("STANDARD");
});
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Ensure all 179 existing tests still pass + new tests pass.

- [ ] **Step 3: Commit**

```bash
git commit -m "test: add auth-utils tests and verify full suite passes"
```

---

## Summary — Commit Sequence

| Task | Description | ~Files |
|------|-------------|--------|
| 1 | Schema — new tables, enums, field modifications | 1 |
| 2 | Data migration — populate UtenteAzienda from existing data | 1 |
| 3 | Auth system — refactor authorize/JWT/session | 3 |
| 4 | Switch-societa API | 1 |
| 5 | Middleware update | 1 |
| 6 | Company creation refactor | 1 |
| 7 | Invitation system refactor + commercialista invite | 2 |
| 8 | Aziende list API (with KPI) | 1 |
| 9 | Scadenze CRUD API | 2 |
| 10 | Note + Alert APIs | 4 |
| 11 | Accessi e Attivita API | 3 |
| 12 | UI: CompanySwitcher in sidebar | 2 |
| 13 | UI: Dashboard "Le mie aziende" | 5 |
| 14 | UI: Accessi e Attivita page | 3 |
| 15 | Onboarding flow update | 1 |
| 16 | Integration testing | 1 |
