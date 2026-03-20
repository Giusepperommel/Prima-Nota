# Modalità Avanzata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a switchable advanced mode that enriches operations with accounting data needed for Italian bilancio (balance sheet) generation.

**Architecture:** Extension model — all new fields are nullable on existing models, six new autonomous entities linked back. Three UI levels (Base/Avanzata/Commercialista) controlled by boolean flags on `Utente`, threaded through NextAuth JWT. The advanced mode adds a "Dati Contabili" tab to the operation form and a "Bilancio" section in the sidebar.

**Tech Stack:** Next.js 16 (App Router), Prisma 6 (MySQL), NextAuth v5 (JWT strategy), shadcn/ui, Vitest, TypeScript, Tailwind CSS, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-19-modalita-avanzata-design.md`

**Existing patterns to follow:**
- API routes: `auth()` → extract `session.user as any` → `societaId` scoping → Prisma query → serialize Decimals → `NextResponse.json()`
- Auth helper: `getSessionUser()` from `src/lib/session.ts` (redirects if not authenticated)
- Soft delete: `eliminato: true` flag (not used for new models — only `Operazione` uses this)
- Audit logging: `logAttivita()` from `src/lib/log-helper.ts`
- All `Decimal` fields must be converted to `Number()` before JSON serialization
- `@map("snake_case")` on all fields, `@@map("table_name")` on all models
- Route params in Next.js 16: `context.params: Promise<{ id: string }>`

---

## Task 1: Prisma Schema — All Changes in One Migration

**Files:**
- Modify: `prisma/schema.prisma`

**IMPORTANT:** All schema changes (enums, new fields on existing models, new models) must be done together in a single task because `Operazione` references new models (`Anagrafica`, `PianoDeiConti`, `RateoRisconto`). Prisma will not validate if those models don't exist yet.

- [ ] **Step 1: Add new enums to schema**

Add all enums defined in spec §3.2–3.8 to `prisma/schema.prisma`, after existing enums. **Note:** Prisma enums do not support `@@map` — only models and fields use `@map`/`@@map`. Enum values are stored as strings.

```prisma
enum StatoPagamentoFattura {
  NON_PAGATO
  PAGATO
  PARZIALMENTE_PAGATO
}

enum NaturaIva {
  N1
  N2_1
  N2_2
  N3_1
  N3_2
  N3_3
  N3_4
  N3_5
  N3_6
  N4
  N5
  N6_1
  N6_2
  N6_3
  N6_4
  N6_5
  N6_6
  N6_7
  N6_8
  N6_9
  N7
}

enum TipoDocumentoSdi {
  TD01
  TD02
  TD03
  TD04
  TD05
  TD06
  TD07
  TD08
  TD09
  TD16
  TD17
  TD18
  TD19
  TD20
  TD21
  TD22
  TD23
  TD24
  TD25
  TD26
  TD27
  TD28
  TD29
}

enum RegistroIva {
  VENDITE
  ACQUISTI
  CORRISPETTIVI
}

enum TipoSoggetto {
  AZIENDA
  PERSONA_FISICA
  PROFESSIONISTA
}

enum TipoAnagrafica {
  FORNITORE
  CLIENTE
  ENTRAMBI
}

enum TipoRitenuta {
  LAVORO_AUTONOMO
  PROVVIGIONI
  OCCASIONALE
  DIRITTI_AUTORE
}

enum StatoVersamento {
  DA_VERSARE
  VERSATO
  SCADUTO
}

enum TipoConto {
  PATRIMONIALE_ATTIVO
  PATRIMONIALE_PASSIVO
  ECONOMICO_COSTO
  ECONOMICO_RICAVO
  ORDINE
}

enum NaturaSaldo {
  DARE
  AVERE
}

enum TipoRateoRisconto {
  RATEO_ATTIVO
  RATEO_PASSIVO
  RISCONTO_ATTIVO
  RISCONTO_PASSIVO
}

enum StatoChiusura {
  IN_CORSO
  CHIUSO
  APPROVATO
}

enum TipoLiquidazione {
  MENSILE
  TRIMESTRALE
}
```

- [ ] **Step 2: Add fields to `Utente` model**

Add at the end of the `Utente` model (before closing `}`):

```prisma
  modalitaAvanzata       Boolean  @default(false) @map("modalita_avanzata")
  modalitaCommercialista Boolean  @default(false) @map("modalita_commercialista")
```

- [ ] **Step 3: Add all 6 new models**

Add the following models as defined in the spec. Create them **before** adding FK fields to `Operazione`, because `Operazione` needs these models to exist.

**3a: `Anagrafica`** (spec §3.3)
- Named relations `"FornitoreOperazioni"` and `"ClienteOperazioni"` for the two `Operazione[]` arrays
- `@@unique([societaId, partitaIva])`
- `@@map("anagrafiche")`

**3b: `PianoDeiConti`** (spec §3.4)
- `@@unique([societaId, codice])`
- `@@map("piano_dei_conti")`
- `operazioni Operazione[]` back-relation

**3c: `Ritenuta`** (spec §3.5)
- `operazioneId Int @unique` (one-to-one with Operazione)
- `societa Societa @relation(...)` — don't forget this
- `@@map("ritenute")`

**3d: `RateoRisconto`** (spec §3.6)
- `societa Societa @relation(...)` — don't forget this
- `operazioni Operazione[]` back-relation (many-to-one)
- `@@map("ratei_risconti")`

**3e: `ChiusuraEsercizio`** (spec §3.7)
- `@@unique([societaId, anno])`
- `rateiRisconti RateoRisconto[]` and `liquidazioniIva LiquidazioneIva[]`
- `@@map("chiusure_esercizio")`

**3f: `LiquidazioneIva`** (spec §3.8)
- `@@unique([societaId, tipo, periodo, anno])`
- Reuses `StatoVersamento` enum from Ritenuta
- `@@map("liquidazioni_iva")`

- [ ] **Step 4: Add advanced fields to `Operazione` model**

Now that the new models exist, add FK fields at the end of the `Operazione` model (before closing `}`). See spec §3.2 for the complete field list. Key fields:
- `fornitoreId`, `clienteId` → FK to `Anagrafica` (named relations `"FornitoreOperazioni"`, `"ClienteOperazioni"`)
- `dataCompetenzaInizio`, `dataCompetenzaFine`
- `statoPagamentoFattura`, `dataPagamento`, `importoPagato`
- `codiceContoId` → FK to `PianoDeiConti`
- `naturaOperazioneIva`, `tipoDocumentoSdi`, `protocolloIva`, `registroIva`, `dataRegistrazione`, `splitPayment`
- `soggettoARitenuta`, `importoRitenuta`, `importoNettoRitenuta`
- `bolloVirtuale`, `importoBollo`
- `rateoRiscontoId` → FK to `RateoRisconto`
- `@@unique([societaId, protocolloIva])`

**IMPORTANT:** Do NOT add `ritenuta Ritenuta?` — it is auto-inferred by Prisma from `Ritenuta.operazioneId @unique`.

- [ ] **Step 5: Add back-relations to `Societa` model**

Add to the existing `Societa` model (spec §3.9):

```prisma
  anagrafiche       Anagrafica[]
  pianoDeiConti     PianoDeiConti[]
  ritenute          Ritenuta[]
  rateiRisconti     RateoRisconto[]
  chiusureEsercizio ChiusuraEsercizio[]
  liquidazioniIva   LiquidazioneIva[]
```

- [ ] **Step 6: Validate and generate migration**

Run: `cd /Users/giuseppeantonacci/Desktop/Prima\ Nota && npx prisma validate`
Expected: "The schema is valid."

Run: `npx prisma migrate dev --name add-modalita-avanzata`
Expected: Migration created and applied successfully.

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add modalità avanzata — new enums, models, and fields for bilancio"
```

---

## Task 2: Auth & Session Enrichment + Preferences API

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/auth.ts`
- Create: `src/app/api/utente/preferenze/route.ts`

- [ ] **Step 1: Extend `SessionUser` type**

In `src/types/index.ts`, add two fields to `SessionUser`:

```typescript
export type SessionUser = {
  // ... existing fields ...
  modalitaAvanzata: boolean;
  modalitaCommercialista: boolean;
};
```

- [ ] **Step 2: Extend `authorize` return object in auth.ts**

In `src/lib/auth.ts`, the `authorize` function returns a user object from the `utente` DB record. Add the two new fields to its return value (line ~37):

```typescript
return {
  id: String(utente.id),
  email: utente.email,
  // ... existing fields ...
  modalitaAvanzata: utente.modalitaAvanzata,
  modalitaCommercialista: utente.modalitaCommercialista,
};
```

- [ ] **Step 3: Map authorize fields to JWT token**

In the `jwt` callback (line ~52), inside the `if (user)` block, add:

```typescript
token.modalitaAvanzata = (user as any).modalitaAvanzata;
token.modalitaCommercialista = (user as any).modalitaCommercialista;
```

Also extend the `trigger === "update"` branch to support updating these fields (needed for `router.refresh()` after toggle):

```typescript
if (trigger === "update" && session) {
  // ... existing fields ...
  if (session.modalitaAvanzata !== undefined) token.modalitaAvanzata = session.modalitaAvanzata;
  if (session.modalitaCommercialista !== undefined) token.modalitaCommercialista = session.modalitaCommercialista;
}
```

- [ ] **Step 4: Map JWT to session in session callback**

In the `session` callback (line ~70), add:

```typescript
(session.user as any).modalitaAvanzata = token.modalitaAvanzata;
(session.user as any).modalitaCommercialista = token.modalitaCommercialista;
```

- [ ] **Step 5: Create preferences API route**

Create `src/app/api/utente/preferenze/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const user = session.user as any;
  const body = await request.json();

  const updateData: Record<string, boolean> = {};

  if (typeof body.modalitaAvanzata === "boolean") {
    updateData.modalitaAvanzata = body.modalitaAvanzata;
  }
  if (typeof body.modalitaCommercialista === "boolean") {
    updateData.modalitaCommercialista = body.modalitaCommercialista;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  await prisma.utente.update({
    where: { id: user.id },
    data: updateData,
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Verify app compiles**

Run: `cd /Users/giuseppeantonacci/Desktop/Prima\ Nota && npx next build --no-lint 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts src/lib/auth.ts src/app/api/utente/preferenze/
git commit -m "feat(auth): enrich session with modalitaAvanzata/Commercialista + preferences API"
```

---

## Task 3: Sidebar Toggle & Bilancio Menu

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`

**IMPORTANT:** The current `AppSidebar` component receives props `{ ruolo, nome, cognome }` and does NOT use `useSession()`. However, it is wrapped in `<SessionProvider>` via `AuthenticatedLayout`. For the toggle, we need reactive state from the session. Add `useSession()` from `next-auth/react` to read `modalitaAvanzata` and call `update()` to refresh the token after toggling.

- [ ] **Step 1: Add useSession and toggle state to sidebar**

In `app-sidebar.tsx`:
1. Import `{ useSession } from "next-auth/react"` and `{ Switch } from "@/components/ui/switch"`
2. Inside the component, add: `const { data: session, update } = useSession();`
3. Read `modalitaAvanzata` from `(session?.user as any)?.modalitaAvanzata ?? false`
4. Add `handleToggleAvanzata` function:

```tsx
const handleToggleAvanzata = async (checked: boolean) => {
  await fetch("/api/utente/preferenze", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modalitaAvanzata: checked }),
  });
  await update({ modalitaAvanzata: checked });
};
```

In the `SidebarFooter`, above the user name/logout block, add the toggle:

```tsx
<div className="flex items-center justify-between px-2 py-1">
  <span className="text-xs text-muted-foreground">Avanzata</span>
  <Switch
    checked={modalitaAvanzata}
    onCheckedChange={handleToggleAvanzata}
    className="scale-75"
  />
</div>
{modalitaAvanzata && (
  <div className="px-2 pb-1">
    <span className="text-xs text-green-500 font-medium">● AVANZATA</span>
  </div>
)}
```

- [ ] **Step 2: Add Bilancio collapsible menu group**

First, ensure the `Collapsible` component exists. If not, generate it:
```bash
npx shadcn@latest add collapsible
```

Import `{ Collapsible, CollapsibleContent, CollapsibleTrigger }` from `@/components/ui/collapsible`.

Add icons to the existing lucide-react import: `BookOpen, Users, ListTree, Scissors, CalendarCheck, ChevronDown`.

Add a collapsible group that renders only when `modalitaAvanzata === true`:

```tsx
{modalitaAvanzata && (
  <SidebarGroup>
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroupLabel asChild>
        <CollapsibleTrigger className="flex w-full items-center">
          <BookOpen className="mr-2 h-4 w-4" />
          Bilancio
          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
        </CollapsibleTrigger>
      </SidebarGroupLabel>
      <CollapsibleContent>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/bilancio"}>
                <Link href="/bilancio"><BarChart3 className="mr-2 h-4 w-4" />Bilancio</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/bilancio/anagrafiche"}>
                <Link href="/bilancio/anagrafiche"><Users className="mr-2 h-4 w-4" />Anagrafiche</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/bilancio/piano-dei-conti"}>
                <Link href="/bilancio/piano-dei-conti"><ListTree className="mr-2 h-4 w-4" />Piano dei Conti</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/bilancio/registri-iva"}>
                <Link href="/bilancio/registri-iva"><FileText className="mr-2 h-4 w-4" />Registri IVA</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/bilancio/ritenute"}>
                <Link href="/bilancio/ritenute"><Scissors className="mr-2 h-4 w-4" />Ritenute</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/bilancio/chiusura-esercizio"}>
                <Link href="/bilancio/chiusura-esercizio"><CalendarCheck className="mr-2 h-4 w-4" />Chiusura Esercizio</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </CollapsibleContent>
    </Collapsible>
  </SidebarGroup>
)}
```

- [ ] **Step 3: Verify the sidebar renders correctly**

Run: `cd /Users/giuseppeantonacci/Desktop/Prima\ Nota && npm run dev`
Manual check: toggle appears in sidebar footer, clicking it shows/hides Bilancio menu group.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "feat(ui): add advanced mode toggle and Bilancio menu in sidebar"
```

---

## Task 4: Settings Page

**Files:**
- Create: `src/app/impostazioni/account/page.tsx`
- Modify: `src/middleware.ts` (add `/impostazioni` to protected paths if needed)

- [ ] **Step 1: Add impostazioni link to sidebar**

In `app-sidebar.tsx`, add a settings icon button (gear icon) in the footer area near the user info, linking to `/impostazioni/account`.

- [ ] **Step 2: Create settings page**

Create `src/app/impostazioni/account/page.tsx` as a `"use client"` page:

Sections:
1. **Dati personali** — name, email (read-only, from session)
2. **Cambio password** — current password + new password + confirm, calls a new `PATCH /api/utente/password` route (validate current password with bcrypt, hash new one, update)
3. **Modalità Avanzata** — `Switch` toggle (synced with sidebar toggle via same API)
4. **Modalità Commercialista** — `Switch` with `AlertDialog` confirmation before activation

Both toggles call `PATCH /api/utente/preferenze` and then `router.refresh()`.

The AlertDialog for Commercialista mode should list what gets unlocked:
- Modifica piano dei conti
- Registrazioni manuali
- Export dati contabili

- [ ] **Step 3: Verify page works**

Run: `npm run dev`
Navigate to `/impostazioni/account`. Both toggles should work and persist after page refresh.

- [ ] **Step 4: Commit**

```bash
git add src/app/impostazioni/ src/components/layout/app-sidebar.tsx src/middleware.ts
git commit -m "feat(ui): add account settings page with Commercialista mode toggle"
```

---

## Task 5: Anagrafiche API

**Files:**
- Create: `src/app/api/anagrafiche/route.ts`
- Create: `src/app/api/anagrafiche/[id]/route.ts`

- [ ] **Step 1: Write GET + POST route**

Create `src/app/api/anagrafiche/route.ts`:

**GET** — List anagrafiche filtered by `societaId`, optional query params: `tipo` (FORNITORE/CLIENTE/ENTRAMBI), `search` (full-text on denominazione + partitaIva).

**POST** — Create anagrafica. Required: `denominazione`, `tipoSoggetto`, `tipo`. Optional: all other fields. Validate P.IVA format if provided (11 digits, Italian checksum). Set `societaId` from session.

Follow existing pattern from `src/app/api/operazioni/route.ts` for auth and serialization.

- [ ] **Step 2: Write GET + PATCH + DELETE route by ID**

Create `src/app/api/anagrafiche/[id]/route.ts`:

**GET** — Detail by ID. Verify `societaId` ownership.

**PATCH** — Update fields. Partial update.

**DELETE** — Check if anagrafica has linked operations (`operazioniFornitore` or `operazioniCliente`). If yes, return 409 with error message. If no, delete.

- [ ] **Step 3: Verify API works**

Run dev server, test with curl:
```bash
curl -s http://localhost:3000/api/anagrafiche -H "Cookie: ..." | jq .
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/anagrafiche/
git commit -m "feat(api): add Anagrafiche CRUD endpoints"
```

---

## Task 6: Piano dei Conti — Data + API

**Files:**
- Create: `src/lib/piano-dei-conti-default.ts`
- Create: `src/app/api/piano-dei-conti/route.ts`
- Create: `src/app/api/piano-dei-conti/inizializza/route.ts`
- Create: `src/app/api/piano-dei-conti/[id]/route.ts`

- [ ] **Step 1: Create chart of accounts data file**

Create `src/lib/piano-dei-conti-default.ts` containing the full ~75-row table from spec §6.1 as a typed array:

```typescript
import { TipoConto, NaturaSaldo } from "@prisma/client";

export type ContoDefault = {
  codice: string;
  descrizione: string;
  tipo: TipoConto;
  voceSp: string | null;
  voceCe: string | null;
  naturaSaldo: NaturaSaldo;
};

export const PIANO_DEI_CONTI_DEFAULT: ContoDefault[] = [
  { codice: "100.001", descrizione: "Cassa contanti", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.IV.3", voceCe: null, naturaSaldo: "DARE" },
  { codice: "100.010", descrizione: "Banca c/c principale", tipo: "PATRIMONIALE_ATTIVO", voceSp: "C.IV.1", voceCe: null, naturaSaldo: "DARE" },
  // ... all 75 rows from spec §6.1
];
```

- [ ] **Step 2: Create seed/initialization API**

Create `src/app/api/piano-dei-conti/inizializza/route.ts`:

**POST** — Seeds the chart of accounts for `user.societaId`. Uses `prisma.pianoDeiConti.createMany()` with the default data. Returns 409 if conti already exist for this società.

```typescript
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  const user = session.user as any;

  const existing = await prisma.pianoDeiConti.count({ where: { societaId: user.societaId } });
  if (existing > 0) {
    return NextResponse.json({ error: "Piano dei conti già inizializzato" }, { status: 409 });
  }

  const data = PIANO_DEI_CONTI_DEFAULT.map(c => ({
    ...c,
    societaId: user.societaId,
    attivo: true,
    preConfigurato: true,
    modificabile: false,
  }));

  await prisma.pianoDeiConti.createMany({ data });

  return NextResponse.json({ success: true, count: data.length });
}
```

- [ ] **Step 3: Create list API**

Create `src/app/api/piano-dei-conti/route.ts`:

**GET** — List all conti for `societaId`, ordered by `codice`. Optional `search` param for filtering by codice or descrizione.

**POST** — Create a new conto. Only allowed if `user.modalitaCommercialista === true`. Validate codice format (`MMM.SSS`). Validate unique `[societaId, codice]`.

- [ ] **Step 4: Create detail API**

Create `src/app/api/piano-dei-conti/[id]/route.ts`:

**GET** — Detail by ID with `societaId` check.

**PATCH** — Update. Only allowed if `user.modalitaCommercialista === true` OR conto is not `preConfigurato`. Fields: `descrizione`, `voceSp`, `voceCe`, `attivo`.

**DELETE** — Only allowed if `user.modalitaCommercialista === true`. Block deletion if conto has linked operations (check `operazioni` relation). Return 409 with error.

- [ ] **Step 5: Commit**

```bash
git add src/lib/piano-dei-conti-default.ts src/app/api/piano-dei-conti/
git commit -m "feat(api): add Piano dei Conti data, seed, and CRUD endpoints"
```

---

## Task 7: Category-to-Conto Mapping Utility

**Files:**
- Create: `src/lib/mapping-categoria-conto.ts`

- [ ] **Step 1: Create mapping utility**

Create `src/lib/mapping-categoria-conto.ts` implementing the mapping table from spec §6.2:

```typescript
const MAPPING_RULES: { pattern: string; codice: string }[] = [
  { pattern: "consulen", codice: "310.001" },
  { pattern: "utenz", codice: "310.010" },
  { pattern: "energia", codice: "310.010" },
  { pattern: "luce", codice: "310.010" },
  { pattern: "telefon", codice: "310.014" },
  { pattern: "mobile", codice: "310.014" },
  { pattern: "internet", codice: "310.015" },
  { pattern: "connett", codice: "310.015" },
  { pattern: "assicuraz", codice: "310.020" },
  { pattern: "banca", codice: "310.030" },
  { pattern: "commissioni bancarie", codice: "310.030" },
  { pattern: "pubblicit", codice: "310.040" },
  { pattern: "promozione", codice: "310.040" },
  { pattern: "trasferta", codice: "310.050" },
  { pattern: "rimborso spese", codice: "310.050" },
  { pattern: "affitto", codice: "320.001" },
  { pattern: "locazione", codice: "320.001" },
  { pattern: "noleggio auto", codice: "320.002" },
  { pattern: "leasing", codice: "320.005" },
  { pattern: "compenso amministrat", codice: "330.040" },
  { pattern: "ires", codice: "390.001" },
  { pattern: "irap", codice: "390.002" },
  { pattern: "fattura attiva", codice: "400.001" },
  { pattern: "ricavo", codice: "400.001" },
];

export function suggerisciConto(nomeCategoria: string): string | null {
  const nome = nomeCategoria.toLowerCase();
  const match = MAPPING_RULES.find(r => nome.includes(r.pattern));
  return match?.codice ?? null;
}
```

- [ ] **Step 2: Write test**

Create `src/lib/__tests__/mapping-categoria-conto.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { suggerisciConto } from "../mapping-categoria-conto";

describe("suggerisciConto", () => {
  it("maps 'Consulenze professionali' to 310.001", () => {
    expect(suggerisciConto("Consulenze professionali")).toBe("310.001");
  });
  it("maps 'Energia elettrica' to 310.010", () => {
    expect(suggerisciConto("Energia elettrica")).toBe("310.010");
  });
  it("returns null for unknown category", () => {
    expect(suggerisciConto("Categoria sconosciuta")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test**

Run: `cd /Users/giuseppeantonacci/Desktop/Prima\ Nota && npx vitest run src/lib/__tests__/mapping-categoria-conto.test.ts`
Expected: All 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mapping-categoria-conto.ts src/lib/__tests__/mapping-categoria-conto.test.ts
git commit -m "feat: add category-to-conto mapping utility with tests"
```

---

## Task 8: Ritenuta Business Logic

**Files:**
- Create: `src/lib/calcoli-ritenuta.ts`
- Create: `src/lib/__tests__/calcoli-ritenuta.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/calcoli-ritenuta.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calcolaRitenuta, getScadenzaVersamento } from "../calcoli-ritenuta";

describe("calcolaRitenuta", () => {
  it("lavoro autonomo: 20% su 100%", () => {
    const r = calcolaRitenuta({ tipo: "LAVORO_AUTONOMO", importoLordo: 1000 });
    expect(r.aliquota).toBe(20);
    expect(r.percentualeImponibile).toBe(100);
    expect(r.baseImponibile).toBe(1000);
    expect(r.importoRitenuta).toBe(200);
    expect(r.importoNetto).toBe(800);
    expect(r.codiceTributo).toBe("1040");
  });

  it("provvigioni senza struttura: 23% su 50%", () => {
    const r = calcolaRitenuta({ tipo: "PROVVIGIONI", importoLordo: 1000, conStruttura: false });
    expect(r.aliquota).toBe(23);
    expect(r.percentualeImponibile).toBe(50);
    expect(r.baseImponibile).toBe(500);
    expect(r.importoRitenuta).toBe(115);
    expect(r.importoNetto).toBe(885);
    expect(r.codiceTributo).toBe("1038");
  });

  it("provvigioni con struttura: 23% su 20%", () => {
    const r = calcolaRitenuta({ tipo: "PROVVIGIONI", importoLordo: 1000, conStruttura: true });
    expect(r.percentualeImponibile).toBe(20);
    expect(r.baseImponibile).toBe(200);
    expect(r.importoRitenuta).toBe(46);
  });

  it("occasionale: 20% su 100%", () => {
    const r = calcolaRitenuta({ tipo: "OCCASIONALE", importoLordo: 5000 });
    expect(r.importoRitenuta).toBe(1000);
    expect(r.codiceTributo).toBe("1040");
  });

  it("includes rivalsa INPS 4%", () => {
    const r = calcolaRitenuta({ tipo: "LAVORO_AUTONOMO", importoLordo: 1000, rivalsaInps: 40 });
    expect(r.baseImponibile).toBe(1040);
    expect(r.importoRitenuta).toBe(208);
  });
});

describe("getScadenzaVersamento", () => {
  it("March payment → April 16", () => {
    expect(getScadenzaVersamento(3, 2026)).toEqual(new Date(2026, 3, 16));
  });
  it("December payment → January 16 next year", () => {
    expect(getScadenzaVersamento(12, 2026)).toEqual(new Date(2027, 0, 16));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/calcoli-ritenuta.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement calcolaRitenuta**

Create `src/lib/calcoli-ritenuta.ts`:

```typescript
import { TipoRitenuta } from "@prisma/client";

type InputCalcoloRitenuta = {
  tipo: TipoRitenuta;
  importoLordo: number;
  conStruttura?: boolean;
  rivalsaInps?: number;
  cassaPrevidenza?: number;
};

type RisultatoRitenuta = {
  aliquota: number;
  percentualeImponibile: number;
  baseImponibile: number;
  importoRitenuta: number;
  importoNetto: number;
  codiceTributo: string;
};

const CONFIG: Record<string, { aliquota: number; percentualeImponibile: number; codiceTributo: string }> = {
  LAVORO_AUTONOMO: { aliquota: 20, percentualeImponibile: 100, codiceTributo: "1040" },
  OCCASIONALE: { aliquota: 20, percentualeImponibile: 100, codiceTributo: "1040" },
  PROVVIGIONI: { aliquota: 23, percentualeImponibile: 50, codiceTributo: "1038" },
  DIRITTI_AUTORE: { aliquota: 20, percentualeImponibile: 75, codiceTributo: "1040" },
};

export function calcolaRitenuta(input: InputCalcoloRitenuta): RisultatoRitenuta {
  const config = { ...CONFIG[input.tipo] };

  if (input.tipo === "PROVVIGIONI" && input.conStruttura) {
    config.percentualeImponibile = 20;
  }

  const lordo = input.importoLordo + (input.rivalsaInps ?? 0) + (input.cassaPrevidenza ?? 0);
  // Round to 2 decimal places: multiply by percentage, then round
  const baseImponibile = Math.round((lordo * config.percentualeImponibile / 100) * 100) / 100;
  const importoRitenuta = Math.round((baseImponibile * config.aliquota / 100) * 100) / 100;
  const importoNetto = input.importoLordo - importoRitenuta;

  return {
    aliquota: config.aliquota,
    percentualeImponibile: config.percentualeImponibile,
    baseImponibile,
    importoRitenuta,
    importoNetto,
    codiceTributo: config.codiceTributo,
  };
}

export function getScadenzaVersamento(meseCompetenza: number, annoCompetenza: number): Date {
  const mese = meseCompetenza; // 1-indexed
  const anno = mese === 12 ? annoCompetenza + 1 : annoCompetenza;
  const meseSucc = mese === 12 ? 0 : mese; // 0-indexed for Date constructor
  return new Date(anno, meseSucc, 16);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/calcoli-ritenuta.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calcoli-ritenuta.ts src/lib/__tests__/calcoli-ritenuta.test.ts
git commit -m "feat: add ritenuta d'acconto calculation utilities with tests"
```

---

## Task 9: Dati Contabili API + Ritenuta API

**Files:**
- Create: `src/app/api/operazioni/[id]/dati-contabili/route.ts`
- Create: `src/app/api/ritenute/route.ts`
- Create: `src/app/api/ritenute/[id]/versa/route.ts`

- [ ] **Step 1: Create dati-contabili PATCH route**

Create `src/app/api/operazioni/[id]/dati-contabili/route.ts`:

Accepts partial update of all advanced fields from spec §4.4. Body example in spec §4.4.
Key logic:
1. Auth via `auth()`, extract `user.societaId`
2. Verify operazione exists and belongs to `user.societaId`
3. If `soggettoARitenuta === true` and ritenuta data provided, upsert `Ritenuta` record (create or update)
4. If `soggettoARitenuta === false`, delete existing `Ritenuta` if any
5. Update operazione fields
6. Log activity via `logAttivita()`

Use Prisma transaction for operazione update + ritenuta upsert.

- [ ] **Step 2: Create ritenute list route**

Create `src/app/api/ritenute/route.ts`:

**GET** — List ritenute for `societaId`. Optional filters: `stato` (DA_VERSARE/VERSATO/SCADUTO), `anno`. Include operazione and anagrafica relations. Serialize all Decimals.

- [ ] **Step 3: Create "segna come versata" route**

Create `src/app/api/ritenute/[id]/versa/route.ts`:

**PATCH** — Accepts `{ dataVersamento: string, importoVersato: number }`. Updates `statoVersamento` to `VERSATO`, sets `dataVersamento` and `importoVersato`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/operazioni/[id]/dati-contabili/ src/app/api/ritenute/
git commit -m "feat(api): add dati-contabili PATCH route and ritenute endpoints"
```

---

## Task 10: Registri IVA API

**Files:**
- Create: `src/app/api/registri-iva/route.ts`

- [ ] **Step 1: Create registri-iva route**

**GET** — Query operazioni with IVA data for `societaId`, filtered by `registroIva` (VENDITE/ACQUISTI/CORRISPETTIVI), `anno`, `periodo` (month or quarter). Include `fornitore`/`cliente` relation for denominazione.

Return columns needed for Art. 23/24/25 DPR 633/72: protocolloIva, dataRegistrazione, denominazione fornitore/cliente, descrizione, imponibile, aliquota IVA, importo IVA, natura, tipoDocumentoSdi.

Serialize all Decimal fields to Number.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/registri-iva/
git commit -m "feat(api): add Registri IVA query endpoint"
```

---

## Task 11: Chiusura Esercizio API

**Files:**
- Create: `src/app/api/chiusura-esercizio/route.ts`
- Create: `src/app/api/chiusura-esercizio/[anno]/route.ts`
- Create: `src/app/api/chiusura-esercizio/[anno]/saldi/route.ts`
- Create: `src/app/api/chiusura-esercizio/[anno]/calcola-ratei/route.ts`

- [ ] **Step 1: Create POST + GET routes**

**POST** `/api/chiusura-esercizio` — Create ChiusuraEsercizio for `societaId` and given `anno`. Verify no existing record for same `[societaId, anno]`. Pre-fill `dataApertura` (Jan 1) and `dataChiusura` (Dec 31). Pre-fill `capitaleSociale` from `Societa.capitaleSociale`.

**GET** `/api/chiusura-esercizio/[anno]` — Get ChiusuraEsercizio for year. Include `rateiRisconti` and `liquidazioniIva`. Serialize Decimals.

- [ ] **Step 2: Create saldi PATCH route**

**PATCH** `/api/chiusura-esercizio/[anno]/saldi` — Update saldi apertura/chiusura fields. Accepts partial body with any of the Decimal saldi fields. Verify ownership via `societaId`.

- [ ] **Step 3: Create calcola-ratei route**

**POST** `/api/chiusura-esercizio/[anno]/calcola-ratei`:
1. Find operazioni with `dataCompetenzaFine > dataChiusura` (cross-year competence)
2. For each, calculate rateo/risconto using formula from spec §3.6:
   - `Risconto = (Importo / GiorniTotaliContratto) × GiorniCompetenzaFutura`
   - `Rateo = (Importo / GiorniTotaliContratto) × GiorniMaturatiNonPagati`
3. Determine tipo (RISCONTO_ATTIVO for prepaid costs, RATEO_PASSIVO for accrued costs, etc.)
4. Return proposed list — DO NOT auto-save. Client reviews and confirms.
5. Accept `{ conferma: true, rateiRisconti: [...] }` to actually create records via `prisma.rateoRisconto.createMany()`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chiusura-esercizio/
git commit -m "feat(api): add Chiusura Esercizio CRUD and ratei/risconti calculation"
```

---

## Task 12: Liquidazione IVA + Bilancio Provvisorio APIs

**Files:**
- Create: `src/app/api/liquidazioni-iva/route.ts`
- Create: `src/app/api/bilancio/[anno]/route.ts`

- [ ] **Step 1: Create liquidazioni-iva route**

**GET** `/api/liquidazioni-iva` — List for `societaId`, filtered by `anno`. Computes `scadenzaVersamento` at runtime from `tipo + periodo + anno`. Serialize Decimals.

- [ ] **Step 2: Create bilancio provvisorio route**

**GET** `/api/bilancio/[anno]` — Aggregate all operazioni with `codiceContoId` for the given anno. Group by `voceCe` for Conto Economico and `voceSp` for Stato Patrimoniale.

Return structure:
```json
{
  "anno": 2026,
  "operazioniTotali": 63,
  "operazioniConDatiContabili": 47,
  "contoEconomico": {
    "A": { "label": "Valore della produzione", "voci": [], "totale": 48000 },
    "B": { "label": "Costi della produzione", "voci": [], "totale": -31200 },
    "differenzaAB": 16800,
    "C": { "label": "Proventi e oneri finanziari", "voci": [], "totale": -500 },
    "risultatoAnteImposte": 16300,
    "imposte": { "ires": 3900, "irap": 560 },
    "risultatoNetto": 11840
  },
  "statoPatrimoniale": {
    "attivo": { "immobilizzazioni": [], "attivoCircolante": [], "rateiRisconti": [], "totale": 48000 },
    "passivo": { "patrimonioNetto": [], "debiti": [], "rateiRisconti": [], "totale": 48000 }
  }
}
```

Logic: query `PianoDeiConti` joined with `Operazione` grouped by `voceCe`/`voceSp`, summing `importoTotale`. Handle bifacial accounts (e.g. `130.001 Erario c/IVA`) by assigning to credit or debit voce SP based on sign of calculated saldo. Include ammortamento from existing `QuotaAmmortamento` table. Include ratei/risconti from `RateoRisconto`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/liquidazioni-iva/ src/app/api/bilancio/
git commit -m "feat(api): add Liquidazione IVA and Bilancio Provvisorio aggregation APIs"
```

---

## Task 13: Anagrafiche Page

**Files:**
- Create: `src/app/bilancio/anagrafiche/page.tsx`
- Create: `src/app/bilancio/layout.tsx`

- [ ] **Step 1: Create bilancio layout**

Create `src/app/bilancio/layout.tsx` — simple layout that passes children through. No special logic needed (auth is handled by middleware).

- [ ] **Step 2: Create anagrafiche page**

Create `src/app/bilancio/anagrafiche/page.tsx` as `"use client"`:

- Data table with columns: Denominazione, P.IVA, Tipo (badge), Regime (badge "Forfettario" if true), Soggetto a ritenuta (checkmark)
- Badge `OCR` with distinct color if `autoCreataOcr = true`
- Search input (debounced, queries by `search` param)
- Filter by tipo (FORNITORE/CLIENTE/ENTRAMBI)
- "Nuova Anagrafica" button → opens dialog/sheet with form
- Row click → opens edit dialog
- Delete button with confirmation (blocked with toast error if 409)

Use existing shadcn components: `Table`, `Input`, `Button`, `Dialog`, `Select`, `Badge`.

Fetch from `GET /api/anagrafiche`.

- [ ] **Step 3: Create anagrafica form dialog component**

Create form fields matching `Anagrafica` model:
- Denominazione (required)
- P.IVA (optional, validate 11 digits if provided)
- Codice Fiscale (optional)
- Tipo Soggetto (select: AZIENDA/PERSONA_FISICA/PROFESSIONISTA)
- Tipo (select: FORNITORE/CLIENTE/ENTRAMBI)
- Indirizzo, CAP, Città, Provincia, Nazione
- SDI: Codice Destinatario, PEC
- Regime Fiscale (text, RF01-RF20)
- Soggetto a Ritenuta (switch)
- Regime Forfettario (switch)
- Tipo Ritenuta (select, visible only if soggetto a ritenuta)

- [ ] **Step 4: Verify page works**

Run dev server, navigate to `/bilancio/anagrafiche`. Create, edit, delete an anagrafica.

- [ ] **Step 5: Commit**

```bash
git add src/app/bilancio/
git commit -m "feat(ui): add Anagrafiche CRUD page"
```

---

## Task 14: Piano dei Conti Page

**Files:**
- Create: `src/app/bilancio/piano-dei-conti/page.tsx`

- [ ] **Step 1: Create piano dei conti page**

Create `src/app/bilancio/piano-dei-conti/page.tsx` as `"use client"`:

**Wizard (first access):** If `GET /api/piano-dei-conti` returns empty array, show initialization wizard:
- Step 1: Confirm activity type (SRL di servizi — pre-selected)
- Step 2: Preview table of ~75 accounts to be created
- Step 3: "Inizializza piano dei conti" button → calls `POST /api/piano-dei-conti/inizializza`

**Tree view (after initialization):**
- Group accounts by tipo (PATRIMONIALE_ATTIVO, PATRIMONIALE_PASSIVO, ECONOMICO_COSTO, ECONOMICO_RICAVO)
- Within each group, show accounts sorted by codice
- Columns: Codice, Descrizione, Voce SP, Voce CE, Natura Saldo
- Search/filter by codice or descrizione

**Commercialista mode additions** (check `session.user.modalitaCommercialista`):
- "Aggiungi conto" button → form dialog
- Inline edit on each row (descrizione, voceSp, voceCe)
- Delete button per row (blocked if conto has operations)

- [ ] **Step 2: Verify wizard and tree view work**

Run dev server, navigate to `/bilancio/piano-dei-conti`. Wizard should appear first time, initialize, then show tree view.

- [ ] **Step 3: Commit**

```bash
git add src/app/bilancio/piano-dei-conti/
git commit -m "feat(ui): add Piano dei Conti page with initialization wizard"
```

---

## Task 15: Dati Contabili Tab in Operation Form

**Files:**
- Modify: `src/app/operazioni/operazione-form.tsx`
- Create: `src/components/operazioni/dati-contabili-tab.tsx`

This is the most complex UI task. The existing form is ~93KB. We add a separate tab component to keep it manageable.

- [ ] **Step 1: Create DatiContabiliTab component**

Create `src/components/operazioni/dati-contabili-tab.tsx` as a standalone `"use client"` component:

Props:
```typescript
type DatiContabiliTabProps = {
  operazioneId: number;
  societaId: number;
  tipoOperazione: string;
  importoTotale: number;
  importoIva: number;
  categoriaName?: string;
  hasPianoPagamento: boolean;
  initialData?: DatiContabili; // pre-loaded values
  onSave: (data: DatiContabili) => void;
};
```

Internal state for all fields from spec §4.4. Sections:
1. **Anagrafica** — Select with search (fetches from `/api/anagrafiche`), "Crea nuovo" button opens inline dialog
2. **Competenza** — Two date pickers (dal / al)
3. **Stato pagamento** — RadioGroup (hidden if `hasPianoPagamento`)
4. **Piano dei Conti** — Select with search (fetches from `/api/piano-dei-conti`), auto-suggested from category mapping
5. **IVA avanzata** — Natura IVA (visible if importoIva=0), Tipo documento SDI, Registro IVA, Split Payment
6. **Ritenuta d'acconto** — Switch "Soggetto a ritenuta" → expands: tipo ritenuta, read-only calculated fields, rivalsa INPS, cassa previdenza. Disabled with tooltip if fornitore is forfettario.
7. **Bollo virtuale** — Switch + importo (€2 default)

On save, calls `PATCH /api/operazioni/[id]/dati-contabili`.

- [ ] **Step 2: Integrate tab into operazione-form.tsx**

In `operazione-form.tsx`:
1. Import `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs`
2. Read `modalitaAvanzata` from session
3. If `modalitaAvanzata === true`, wrap existing form content in `<TabsContent value="generale">` and add `<TabsContent value="dati-contabili">` with `<DatiContabiliTab />`
4. If `modalitaAvanzata === false`, render form as-is (no tabs wrapper)

**IMPORTANT:** The tab should only be visible in edit mode (when `operazioneId` exists), not during creation. During creation, the operation is saved first in base mode, then dati contabili can be added.

- [ ] **Step 3: Load existing dati contabili when editing**

When editing an operation with `modalitaAvanzata`, fetch the advanced fields. These are already part of the `Operazione` model, so they come back from the existing `GET /api/operazioni/[id]` route. Extend that route's `include` to also fetch `fornitore`, `cliente`, `codiceConto`, and `ritenuta` relations.

Modify `src/app/api/operazioni/[id]/route.ts` GET handler to include:
```typescript
include: {
  // ... existing includes ...
  fornitore: true,
  cliente: true,
  codiceConto: true,
  ritenuta: true,
}
```

- [ ] **Step 4: Verify tab works**

Run dev server:
1. Enable advanced mode via sidebar toggle
2. Navigate to an existing operation
3. "Dati Contabili" tab should appear
4. Fill in some fields, save
5. Reload — data persists

- [ ] **Step 5: Commit**

```bash
git add src/components/operazioni/dati-contabili-tab.tsx src/app/operazioni/operazione-form.tsx src/app/api/operazioni/[id]/route.ts
git commit -m "feat(ui): add Dati Contabili tab to operation form"
```

---

## Task 16: Ritenute Page

**Files:**
- Create: `src/app/bilancio/ritenute/page.tsx`

- [ ] **Step 1: Create ritenute page**

Create `src/app/bilancio/ritenute/page.tsx` as `"use client"`:

- Alert banner at top if any ritenute with `statoVersamento = DA_VERSARE` and scadenza within 7 days (calculated at runtime from `meseCompetenza` + `annoCompetenza`)
- Filter tabs: Tutte / Da Versare / Versate / Scadute
- Data table: Percipiente (anagrafica.denominazione), Data operazione, Lordo, Ritenuta, Netto, Scadenza F24 (computed), Stato (badge)
- "Segna come versato" button per row → opens dialog with date picker and importo → calls `PATCH /api/ritenute/[id]/versa`
- Monthly summary section at bottom: grouped by `codiceTributo` with totals

Fetch from `GET /api/ritenute`.

- [ ] **Step 2: Commit**

```bash
git add src/app/bilancio/ritenute/
git commit -m "feat(ui): add Ritenute scadenziario page"
```

---

## Task 17: Registri IVA Page

**Files:**
- Create: `src/app/bilancio/registri-iva/page.tsx`

- [ ] **Step 1: Create registri IVA page**

Create `src/app/bilancio/registri-iva/page.tsx` as `"use client"`:

- Three tabs: Registro Acquisti / Registro Vendite / Corrispettivi
- Filters: anno (select), periodo (month or quarter select)
- Data table per tab with columns from Art. 23/24/25 DPR 633/72:
  - Protocollo IVA, Data registrazione, Fornitore/Cliente, Descrizione, Imponibile, Aliquota IVA, IVA, Natura
- Footer row with totals
- Liquidazione IVA section: saldo periodo, credito precedente, importo da versare, codice tributo, scadenza
- Export PDF button (placeholder for now — uses existing `@react-pdf/renderer`)

Fetch from `GET /api/registri-iva`.

- [ ] **Step 2: Commit**

```bash
git add src/app/bilancio/registri-iva/
git commit -m "feat(ui): add Registri IVA page"
```

---

## Task 18: Chiusura Esercizio Page

**Files:**
- Create: `src/app/bilancio/chiusura-esercizio/page.tsx`

- [ ] **Step 1: Create chiusura esercizio page**

Create `src/app/bilancio/chiusura-esercizio/page.tsx` as `"use client"`:

Multi-step wizard (using internal state, not separate pages):

**Step 1 — Saldi di apertura:**
- Input fields: saldo banca iniziale, saldo cassa iniziale, capitale sociale (pre-filled from Societa), riserva legale, riserva straordinaria, utili/perdite portati a nuovo
- Save via `PATCH /api/chiusura-esercizio/[anno]/saldi`

**Step 2 — Operazioni incomplete:**
- List of operazioni without `codiceContoId`, with direct link to each operation's edit page
- Count badge: "X operazioni senza dati contabili"

**Step 3 — Ratei e risconti:**
- "Calcola" button → calls `POST /api/chiusura-esercizio/[anno]/calcola-ratei`
- Shows proposed list: tipo, descrizione, importo, formula preview
- Checkboxes to approve/reject each
- "Conferma" button saves approved ones

**Step 4 — Saldo banca finale:**
- Input: saldo banca finale (from bank statement Dec 31)
- Save via same PATCH endpoint

**Step 5 — Genera bilancio:**
- Summary of completed steps
- "Visualizza Bilancio Provvisorio" button → navigates to `/bilancio?tab=provvisorio`

- [ ] **Step 2: Commit**

```bash
git add src/app/bilancio/chiusura-esercizio/
git commit -m "feat(ui): add Chiusura Esercizio multi-step wizard"
```

---

## Task 19: Bilancio Hub Page

**Files:**
- Create: `src/app/bilancio/page.tsx`

- [ ] **Step 1: Create bilancio hub page**

Create `src/app/bilancio/page.tsx` as `"use client"`:

Two tabs using shadcn `Tabs`:

**Tab "Avanzamento"** (default):
- Progress bar: % of operazioni with `codiceContoId` not null
- 5-phase checklist (from spec §4.5):
  1. Anagrafiche — count fornitori + clienti, link to `/bilancio/anagrafiche`
  2. Piano dei Conti — "Inizializzato" / "Non inizializzato", link
  3. Imputazione operazioni — "X / Y con dati contabili", link to operazioni
  4. Ritenute — "N da versare, M versate", link
  5. Chiusura Esercizio — status, link

Each phase has status badge (completed/in-progress/pending) with green/yellow/gray styling.

Fetch stats from multiple APIs in parallel: `/api/anagrafiche`, `/api/piano-dei-conti`, `/api/operazioni?countOnly=true`, `/api/ritenute`, `/api/chiusura-esercizio/[currentYear]`.

**Tab "Bilancio Provvisorio"**:
- Year selector
- Fetch from `GET /api/bilancio/[anno]`
- Two-column layout:
  - Left: **Conto Economico** — hierarchical display by voce CE (A, B, differenza A-B, C, risultato ante imposte, imposte, utile/perdita)
  - Right: **Stato Patrimoniale** — hierarchical display by voce SP (Attivo: B, C, D / Passivo: A, D, E)
- Warning banner if `operazioniConDatiContabili < operazioniTotali`
- Each line expandable to show detail accounts

- [ ] **Step 2: Commit**

```bash
git add src/app/bilancio/page.tsx
git commit -m "feat(ui): add Bilancio Hub page with Avanzamento and Bilancio Provvisorio tabs"
```

---

## Task 20: OCR/XML Integration

**Files:**
- Modify: `src/app/api/ocr/route.ts` (or wherever the XML parser lives)
- Modify: `src/lib/ocr/types.ts`

- [ ] **Step 1: Explore existing OCR implementation**

Read `src/app/api/ocr/` directory to understand current XML parsing approach. Read `src/lib/ocr/types.ts` for existing types.

- [ ] **Step 2: Extend OCR types**

Add new fields to the OCR result type:
```typescript
// Advanced mode fields extracted from XML
tipoDocumentoSdi?: string;
naturaIva?: string;
splitPayment?: boolean;
cedentePrestatore?: {
  denominazione?: string;
  partitaIva?: string;
  codiceFiscale?: string;
  regimeFiscale?: string;
};
ritenuta?: {
  tipoRitenuta?: string;
  aliquota?: number;
  importoRitenuta?: number;
};
cassaPrevidenziale?: {
  importo?: number;
};
dataPagamento?: string;
```

- [ ] **Step 3: Extend XML parser**

Add XPath extractions from spec §7:
- `//CedentePrestatore/DatiAnagrafici/*` → cedentePrestatore
- `//DatiGenerali/DatiGeneraliDocumento/TipoDocumento` → tipoDocumentoSdi
- `//DatiRiepilogo/Natura` → naturaIva (map `N6` → appropriate sub-value)
- `//DatiRiepilogo/EsigibilitaIVA = "S"` → splitPayment
- `//DatiGenerali/DatiRitenuta/*` → ritenuta (map RT01/RT02 to internal types)
- `//DatiGenerali/DatiCassaPrevidenziale/ImportoContributoCassa` → cassaPrevidenziale
- `//DatiPagamento/DettaglioPagamento/DataScadenzaPagamento` → dataPagamento

- [ ] **Step 4: Auto-create/link Anagrafica on XML import**

When XML is parsed and `modalitaAvanzata` is true:
1. Extract `cedentePrestatore.partitaIva`
2. Search `Anagrafica` by `[societaId, partitaIva]`
3. If found → link `fornitoreId` to existing
4. If not found → create new `Anagrafica` with `autoCreataOcr = true`
5. If `regimeFiscale` is RF19 or RF20 → set `regimeForfettario = true`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ocr/ src/lib/ocr/
git commit -m "feat(ocr): extract advanced accounting fields from XML invoices"
```

---

## Task 21: Extend Operation List Route for Advanced Fields

**Files:**
- Modify: `src/app/api/operazioni/route.ts`

- [ ] **Step 1: Include advanced relations in GET response**

In the GET handler of `src/app/api/operazioni/route.ts`, extend the `include` to add:

```typescript
include: {
  // ... existing includes ...
  fornitore: { select: { id: true, denominazione: true } },
  cliente: { select: { id: true, denominazione: true } },
  codiceConto: { select: { id: true, codice: true, descrizione: true } },
}
```

Also serialize the new Decimal fields (`importoRitenuta`, `importoNettoRitenuta`, `importoPagato`, `importoBollo`) in the serialization map.

- [ ] **Step 2: Add countOnly query param**

Add support for `?countOnly=true` that returns just `{ total, conDatiContabili }` (used by Bilancio Hub avanzamento tab):

Add this check early in the GET handler, right after building the `where` clause (which uses the variable name `where` in the existing code):

```typescript
if (searchParams.get("countOnly") === "true") {
  const [total, conDatiContabili] = await Promise.all([
    prisma.operazione.count({ where }),
    prisma.operazione.count({ where: { ...where, codiceContoId: { not: null } } }),
  ]);
  return NextResponse.json({ total, conDatiContabili });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/operazioni/route.ts
git commit -m "feat(api): include advanced fields in operazioni list and add countOnly mode"
```

---

## Task 22: Final Integration & Verification

- [ ] **Step 1: Build check**

Run: `cd /Users/giuseppeantonacci/Desktop/Prima\ Nota && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (existing + new).

- [ ] **Step 3: Manual end-to-end verification**

Verify the following flows:
1. Toggle advanced mode ON in sidebar → Bilancio menu appears
2. Navigate to Piano dei Conti → wizard initializes ~75 accounts
3. Navigate to Anagrafiche → create a fornitore
4. Edit an existing operation → "Dati Contabili" tab appears → fill in fornitore, competenza, conto, IVA fields → save
5. Navigate to Ritenute → created ritenuta appears → mark as versata
6. Navigate to Chiusura Esercizio → complete wizard steps
7. Navigate to Bilancio Hub → Avanzamento shows progress → Bilancio Provvisorio shows aggregated data
8. Toggle advanced mode OFF → Bilancio menu disappears, form shows no tab
9. Toggle back ON → data still present

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Modalità Avanzata (Fase 1) implementation"
```

---

*Plan based on spec at `docs/superpowers/specs/2026-03-19-modalita-avanzata-design.md`*
*Total: 22 tasks, ~85 steps*
