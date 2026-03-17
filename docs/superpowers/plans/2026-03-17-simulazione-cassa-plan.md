# Simulazione Cassa Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new financial operation types (PAGAMENTO_IMPOSTE, DISTRIBUZIONE_DIVIDENDI, COMPENSO_AMMINISTRATORE) and a "Simulazione Cassa" section in the dashboard showing monthly cash flow with KPI cards and a line chart.

**Architecture:** Prisma schema extended with new enum values + nullable categoriaId. Existing POST/PUT API routes extended with conditional validation paths. New `/api/dashboard/cassa` endpoint for cash flow calculation. Dashboard gets a new self-contained section component wired to the new endpoint. Frontend form and list updated to handle new types.

**Tech Stack:** Next.js 14 App Router, Prisma (MySQL), Recharts (LineChart), shadcn/ui, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-17-simulazione-cassa-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add 3 enum values, sottotipoOperazione String?, categoriaId Int? in Operazione |
| `src/app/api/report/rendiconto/route.ts` | Modify | Null-guard in dettaglioPerCategoria loop |
| `src/app/api/operazioni/[id]/route.ts` | Modify | GET: null-guard categoria serialization; PUT: new types validation + conditional categoriaId |
| `src/app/api/operazioni/route.ts` | Modify | POST: tipiValidi + isTipoFinanziario + conditional categoriaId + sottotipoOperazione |
| `src/app/api/dashboard/cassa/route.ts` | Create | Cash flow simulation endpoint (ADMIN + STANDARD paths) |
| `src/app/operazioni/operazioni-list.tsx` | Modify | TIPO_OPERAZIONE_LABELS + new badge colors + null-safe op.categoria |
| `src/app/operazioni/operazione-form.tsx` | Modify | New types in RadioGroup, sottotipo field, conditional show/hide, payload changes |
| `src/app/dashboard/dashboard-content.tsx` | Modify | TIPO_LABELS + SimulazioneCassa section component |

---

## Chunk 1: DB + Backend Routes

### Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update TipoOperazione enum in schema.prisma**

Find and replace the `TipoOperazione` enum (currently at line 240–246):

```prisma
enum TipoOperazione {
  FATTURA_ATTIVA
  COSTO
  CESPITE
  PAGAMENTO_IMPOSTE
  DISTRIBUZIONE_DIVIDENDI
  COMPENSO_AMMINISTRATORE

  @@map("tipo_operazione")
}
```

- [ ] **Step 2: Add sottotipoOperazione field and make categoriaId nullable in Operazione model**

In the `Operazione` model, make these two changes:

Change line `categoriaId  Int  @map("categoria_id")` to:
```prisma
categoriaId          Int?     @map("categoria_id")
sottotipoOperazione  String?  @map("sottotipo_operazione") @db.VarChar(50)
```

And update the relation line from:
```prisma
categoria    CategoriaSpesa           @relation(fields: [categoriaId], references: [id])
```
to:
```prisma
categoria    CategoriaSpesa?          @relation(fields: [categoriaId], references: [id])
```

- [ ] **Step 3: Run migration**

```bash
cd "/Users/giuseppeantonacci/Desktop/Prima Nota"
npx prisma migrate dev --name add-tipi-finanziari
```

Expected: migration file created, schema.prisma regenerated with new Prisma client types.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: any errors about `categoria` being possibly null are surfaced — these will be fixed in subsequent tasks. Note them for reference.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: extend TipoOperazione enum and add sottotipoOperazione, nullable categoriaId"
```

---

### Task 2: Fix rendiconto route — null-guard for new types

**Files:**
- Modify: `src/app/api/report/rendiconto/route.ts:167-189`

The `dettaglioPerCategoria` loop at line 167 iterates all operations and immediately accesses `op.categoria.nome` at line 169. New financial types have `categoria = null` — this crashes.

- [ ] **Step 1: Add null-guard at start of dettaglioPerCategoria loop**

Find this exact code block (lines 167–170):
```typescript
    for (const op of operazioni) {
      const catId = op.categoriaId;
      const catNome = op.categoria.nome;
```

Replace with:
```typescript
    for (const op of operazioni) {
      if (!op.categoria) continue; // nuovi tipi finanziari: nessuna categoria
      const catId = op.categoriaId;
      const catNome = op.categoria.nome;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep rendiconto
```

Expected: no errors for rendiconto/route.ts.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/report/rendiconto/route.ts
git commit -m "fix: null-guard categoria in rendiconto dettaglioPerCategoria loop"
```

---

### Task 3: Fix GET /api/operazioni/[id] — null-guard categoria serialization

**Files:**
- Modify: `src/app/api/operazioni/[id]/route.ts:98-103`

The GET serializer at lines 98–103 unconditionally spreads `operazione.categoria` and reads `.percentualeDeducibilita` from it — crashes when `categoria` is null.

- [ ] **Step 1: Replace unconditional categoria spread**

Find:
```typescript
      categoria: {
        ...operazione.categoria,
        percentualeDeducibilita: Number(
          operazione.categoria.percentualeDeducibilita
        ),
      },
```

Replace with:
```typescript
      categoria: operazione.categoria
        ? {
            ...operazione.categoria,
            percentualeDeducibilita: Number(
              operazione.categoria.percentualeDeducibilita
            ),
          }
        : null,
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "operazioni/\[id\]"
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/operazioni/[id]/route.ts"
git commit -m "fix: null-guard categoria serialization in GET /api/operazioni/[id]"
```

---

### Task 4: Update POST /api/operazioni — support new financial types

**Files:**
- Modify: `src/app/api/operazioni/route.ts`

This task adds full support for the 3 new types in the POST handler: extended whitelist, conditional category check, percDeduc bypass, nullable categoriaId in DB write, sottotipoOperazione validation and save.

- [ ] **Step 1: Extend tipiValidi whitelist**

Find:
```typescript
    const tipiValidi = ["FATTURA_ATTIVA", "COSTO", "CESPITE"];
```

Replace with:
```typescript
    const TIPI_FINANZIARI = ["PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"];
    const tipiValidi = ["FATTURA_ATTIVA", "COSTO", "CESPITE", ...TIPI_FINANZIARI];
    const isTipoFinanziario = TIPI_FINANZIARI.includes(tipoOperazione);
```

- [ ] **Step 2: Add sottotipoOperazione to destructured body fields**

Find the body destructure block. It currently ends around:
```typescript
      aliquotaAmmortamento,
    } = body;
```

Add `sottotipoOperazione` to the destructure — add it before `aliquotaAmmortamento`:
```typescript
      sottotipoOperazione,
      aliquotaAmmortamento,
    } = body;
```

- [ ] **Step 3: Make categoriaId guard conditional**

Find:
```typescript
    if (!tipoOperazione || !dataOperazione || !descrizione || !categoriaId) {
      return NextResponse.json(
        { error: "Tipo operazione, data, descrizione e categoria sono obbligatori" },
        { status: 400 }
      );
    }
```

Replace with:
```typescript
    if (!tipoOperazione || !dataOperazione || !descrizione || (!isTipoFinanziario && !categoriaId)) {
      return NextResponse.json(
        { error: "Tipo operazione, data, descrizione e categoria sono obbligatori" },
        { status: 400 }
      );
    }
```

- [ ] **Step 4: Add sottotipoOperazione validation (insert after the tipiValidi check)**

After the block `if (!tipiValidi.includes(tipoOperazione)) { return 400; }`, add:

```typescript
    // Validate sottotipoOperazione for new financial types
    const SOTTOTIPI_IMPOSTE = ["IVA", "IRES_ACCONTO", "IRES_SALDO", "IRAP_ACCONTO", "IRAP_SALDO", "INPS"];
    if (tipoOperazione === "PAGAMENTO_IMPOSTE") {
      if (!sottotipoOperazione || !SOTTOTIPI_IMPOSTE.includes(sottotipoOperazione)) {
        return NextResponse.json(
          { error: "Specificare il tipo di imposta (IVA, IRES_ACCONTO, ecc.)" },
          { status: 400 }
        );
      }
    } else if (isTipoFinanziario && sottotipoOperazione != null) {
      return NextResponse.json(
        { error: "sottotipoOperazione non applicabile per questo tipo" },
        { status: 400 }
      );
    }
```

- [ ] **Step 5: Make categoriaSpesa.findFirst conditional**

Find:
```typescript
    // Validate categoria
    const categoria = await prisma.categoriaSpesa.findFirst({
      where: { id: parseInt(String(categoriaId), 10), societaId, attiva: true },
    });
    if (!categoria) {
      return NextResponse.json(
        { error: "Categoria non trovata o non attiva" },
        { status: 400 }
      );
    }
```

Replace with:
```typescript
    // Validate categoria (skip for new financial types)
    const categoria = !isTipoFinanziario
      ? await prisma.categoriaSpesa.findFirst({
          where: { id: parseInt(String(categoriaId), 10), societaId, attiva: true },
        })
      : null;
    if (!isTipoFinanziario && !categoria) {
      return NextResponse.json(
        { error: "Categoria non trovata o non attiva" },
        { status: 400 }
      );
    }
```

- [ ] **Step 6: Bypass percDeduc/impDeduc for new types**

Find:
```typescript
    const percDeduc = deducibilitaCustom
      ? parseFloat(String(percentualeDeducibilita))
      : Number(categoria.percentualeDeducibilita);

    const impDeduc = deducibilitaCustom
      ? parseFloat(String(importoDeducibile))
      : Math.round(
          ((importo * Number(categoria.percentualeDeducibilita)) / 100) * 100
        ) / 100;
```

Replace with:
```typescript
    const percDeduc = isTipoFinanziario
      ? 0
      : deducibilitaCustom
        ? parseFloat(String(percentualeDeducibilita))
        : Number(categoria!.percentualeDeducibilita);

    const impDeduc = isTipoFinanziario
      ? 0
      : deducibilitaCustom
        ? parseFloat(String(importoDeducibile))
        : Math.round(
            ((importo * Number(categoria!.percentualeDeducibilita)) / 100) * 100
          ) / 100;
```

- [ ] **Step 7: Update categoriaId in prisma.operazione.create**

Find inside the `prisma.$transaction` the create call. Find the line:
```typescript
          categoriaId: parseInt(String(categoriaId), 10),
```

Replace with:
```typescript
          categoriaId: isTipoFinanziario ? null : parseInt(String(categoriaId), 10),
          sottotipoOperazione: tipoOperazione === "PAGAMENTO_IMPOSTE" ? sottotipoOperazione : null,
```

- [ ] **Step 8: Update logAttivita categoriaId**

Find in the `valoriDopo` object:
```typescript
      categoriaId: parseInt(String(categoriaId), 10),
```
(in the logAttivita section after the transaction)

Replace with:
```typescript
      categoriaId: isTipoFinanziario ? null : parseInt(String(categoriaId), 10),
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "operazioni/route"
```

- [ ] **Step 10: Commit**

```bash
git add src/app/api/operazioni/route.ts
git commit -m "feat: POST /api/operazioni — support PAGAMENTO_IMPOSTE, DISTRIBUZIONE_DIVIDENDI, COMPENSO_AMMINISTRATORE"
```

---

### Task 5: Update PUT /api/operazioni/[id] — support new financial types

**Files:**
- Modify: `src/app/api/operazioni/[id]/route.ts` (PUT handler, lines 125–497)

The PUT handler has the same pattern as POST. Apply identical changes.

- [ ] **Step 1: Add TIPI_FINANZIARI constant, isTipoFinanziario flag, sottotipoOperazione destructure**

Inside the PUT handler, after `const body = await request.json();` and the body destructure, add:

```typescript
    const TIPI_FINANZIARI = ["PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"];
    const isTipoFinanziario = TIPI_FINANZIARI.includes(tipoOperazione);
```

Also add `sottotipoOperazione` to the destructure block (alongside `aliquotaAmmortamento`).

- [ ] **Step 2: Extend tipiValidi**

Find in PUT:
```typescript
    const tipiValidi = ["FATTURA_ATTIVA", "COSTO", "CESPITE"];
```
Replace with:
```typescript
    const tipiValidi = ["FATTURA_ATTIVA", "COSTO", "CESPITE", "PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"];
```

- [ ] **Step 3: Make categoriaId guard conditional**

Find in PUT:
```typescript
    if (!tipoOperazione || !dataOperazione || !descrizione || !categoriaId) {
```
Replace with:
```typescript
    if (!tipoOperazione || !dataOperazione || !descrizione || (!isTipoFinanziario && !categoriaId)) {
```

- [ ] **Step 4: Add sottotipoOperazione validation (same as POST)**

After the tipiValidi check in PUT, add:
```typescript
    const SOTTOTIPI_IMPOSTE = ["IVA", "IRES_ACCONTO", "IRES_SALDO", "IRAP_ACCONTO", "IRAP_SALDO", "INPS"];
    if (tipoOperazione === "PAGAMENTO_IMPOSTE") {
      if (!sottotipoOperazione || !SOTTOTIPI_IMPOSTE.includes(sottotipoOperazione)) {
        return NextResponse.json(
          { error: "Specificare il tipo di imposta (IVA, IRES_ACCONTO, ecc.)" },
          { status: 400 }
        );
      }
    } else if (isTipoFinanziario && sottotipoOperazione != null) {
      return NextResponse.json(
        { error: "sottotipoOperazione non applicabile per questo tipo" },
        { status: 400 }
      );
    }
```

- [ ] **Step 5: Make categoriaSpesa.findFirst conditional**

Find in PUT:
```typescript
    // Validate categoria
    const categoria = await prisma.categoriaSpesa.findFirst({
      where: { id: parseInt(String(categoriaId), 10), societaId, attiva: true },
    });
    if (!categoria) {
```
Replace with:
```typescript
    // Validate categoria (skip for new financial types)
    const categoria = !isTipoFinanziario
      ? await prisma.categoriaSpesa.findFirst({
          where: { id: parseInt(String(categoriaId), 10), societaId, attiva: true },
        })
      : null;
    if (!isTipoFinanziario && !categoria) {
```

- [ ] **Step 6: Bypass percDeduc/impDeduc for new types (PUT)**

Find the `percDeduc`/`impDeduc` block in PUT and apply the same ternary bypass as POST (Task 4 Step 6).

- [ ] **Step 7: Update categoriaId in tx.operazione.update**

Find in PUT transaction:
```typescript
          categoriaId: parseInt(String(categoriaId), 10),
```
Replace with:
```typescript
          categoriaId: isTipoFinanziario ? null : parseInt(String(categoriaId), 10),
          sottotipoOperazione: tipoOperazione === "PAGAMENTO_IMPOSTE" ? sottotipoOperazione : null,
```

- [ ] **Step 8: Update valoriDopo/logAttivita categoriaId in PUT**

Find in valoriDopo (after the transaction):
```typescript
      categoriaId: parseInt(String(categoriaId), 10),
```
Replace with:
```typescript
      categoriaId: isTipoFinanziario ? null : parseInt(String(categoriaId), 10),
```

Also update `valoriPrima` (the snapshot before update):
```typescript
      categoriaId: existing.categoriaId,
```
This already handles null correctly since `existing.categoriaId` is now `Int?` — no change needed.

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "operazioni"
```

Expected: no new errors.

- [ ] **Step 10: Commit**

```bash
git add "src/app/api/operazioni/[id]/route.ts"
git commit -m "feat: PUT /api/operazioni/[id] — support new financial operation types"
```

---

### Task 6: Create /api/dashboard/cassa endpoint

**Files:**
- Create: `src/app/api/dashboard/cassa/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// src/app/api/dashboard/cassa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MESI_LABEL = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const TIPI_USCITA = ["COSTO", "CESPITE", "PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"];

type MensileItem = {
  mese: number;
  meseLabel: string;
  entrate: number;
  uscite: number;
  usciteDettaglio: {
    costiOperativi: number;
    cespiti: number;
    imposte: number;
    dividendi: number;
    compensiAmm: number;
  };
  saldoProgressivo: number;
};

function buildMensile(): MensileItem[] {
  return Array.from({ length: 12 }, (_, i) => ({
    mese: i + 1,
    meseLabel: MESI_LABEL[i],
    entrate: 0,
    uscite: 0,
    usciteDettaglio: { costiOperativi: 0, cespiti: 0, imposte: 0, dividendi: 0, compensiAmm: 0 },
    saldoProgressivo: 0,
  }));
}

function accumulaMovimento(mensile: MensileItem[], tipoOperazione: string, importo: number, mese: number) {
  const idx = mese - 1;
  if (idx < 0 || idx > 11) return;
  if (tipoOperazione === "FATTURA_ATTIVA") {
    mensile[idx].entrate += importo;
  } else if (TIPI_USCITA.includes(tipoOperazione)) {
    mensile[idx].uscite += importo;
    const d = mensile[idx].usciteDettaglio;
    if (tipoOperazione === "COSTO") d.costiOperativi += importo;
    else if (tipoOperazione === "CESPITE") d.cespiti += importo;
    else if (tipoOperazione === "PAGAMENTO_IMPOSTE") d.imposte += importo;
    else if (tipoOperazione === "DISTRIBUZIONE_DIVIDENDI") d.dividendi += importo;
    else if (tipoOperazione === "COMPENSO_AMMINISTRATORE") d.compensiAmm += importo;
  }
}

function finalizzaMensile(mensile: MensileItem[], saldoIniziale: number) {
  let saldo = saldoIniziale;
  for (const m of mensile) {
    m.entrate = Math.round(m.entrate * 100) / 100;
    m.uscite = Math.round(m.uscite * 100) / 100;
    m.usciteDettaglio.costiOperativi = Math.round(m.usciteDettaglio.costiOperativi * 100) / 100;
    m.usciteDettaglio.cespiti = Math.round(m.usciteDettaglio.cespiti * 100) / 100;
    m.usciteDettaglio.imposte = Math.round(m.usciteDettaglio.imposte * 100) / 100;
    m.usciteDettaglio.dividendi = Math.round(m.usciteDettaglio.dividendi * 100) / 100;
    m.usciteDettaglio.compensiAmm = Math.round(m.usciteDettaglio.compensiAmm * 100) / 100;
    saldo = Math.round((saldo + m.entrate - m.uscite) * 100) / 100;
    m.saldoProgressivo = saldo;
  }
  return saldo; // saldoFinale
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const ruolo = user.ruolo as string;
    const socioId = user.socioId as number | undefined;

    const { searchParams } = new URL(request.url);
    const annoParam = searchParams.get("anno");
    if (!annoParam) {
      return NextResponse.json({ error: "Il parametro 'anno' è obbligatorio" }, { status: 400 });
    }
    const anno = parseInt(annoParam, 10);

    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: { capitaleSociale: true },
    });
    const capitaleSociale = Number(societa?.capitaleSociale ?? 0);

    const dataInizioAnno = new Date(`${anno}-01-01`);
    const dataFineAnno = new Date(`${anno}-12-31`);

    if (ruolo === "ADMIN") {
      // ─── ADMIN path ────────────────────────────────────────────────────
      // Saldo iniziale: capitaleSociale + net cash flow anni precedenti
      const opsPrecedenti = await prisma.operazione.findMany({
        where: {
          societaId,
          eliminato: false,
          bozza: false,
          dataOperazione: { lt: dataInizioAnno },
        },
        select: { tipoOperazione: true, importoTotale: true },
      });

      let cashFlowPrecedenti = 0;
      for (const op of opsPrecedenti) {
        const v = Number(op.importoTotale);
        if (op.tipoOperazione === "FATTURA_ATTIVA") cashFlowPrecedenti += v;
        else if (TIPI_USCITA.includes(op.tipoOperazione)) cashFlowPrecedenti -= v;
      }
      const saldoIniziale = Math.round((capitaleSociale + cashFlowPrecedenti) * 100) / 100;

      // Monthly data for selected year
      const ops = await prisma.operazione.findMany({
        where: {
          societaId,
          eliminato: false,
          bozza: false,
          dataOperazione: { gte: dataInizioAnno, lte: dataFineAnno },
        },
        select: { tipoOperazione: true, importoTotale: true, dataOperazione: true },
      });

      const mensile = buildMensile();
      for (const op of ops) {
        const mese = new Date(op.dataOperazione).getMonth() + 1;
        accumulaMovimento(mensile, op.tipoOperazione, Number(op.importoTotale), mese);
      }
      const saldoFinale = finalizzaMensile(mensile, saldoIniziale);

      const totali = {
        entrate: Math.round(mensile.reduce((s, m) => s + m.entrate, 0) * 100) / 100,
        uscite: Math.round(mensile.reduce((s, m) => s + m.uscite, 0) * 100) / 100,
        saldoFinale,
      };

      return NextResponse.json({ anno, saldoIniziale, mensile, totali });

    } else {
      // ─── STANDARD path ─────────────────────────────────────────────────
      // Saldo iniziale: capitaleSociale × quota% + net ripartizioni anni precedenti
      const socio = await prisma.socio.findFirst({
        where: { id: socioId, societaId },
        select: { quotaPercentuale: true },
      });
      const quotaPercentuale = Number(socio?.quotaPercentuale ?? 0);

      const ripPrecedenti = await prisma.ripartizioneOperazione.findMany({
        where: {
          socioId,
          operazione: {
            societaId,
            eliminato: false,
            bozza: false,
            dataOperazione: { lt: dataInizioAnno },
          },
        },
        select: {
          importoCalcolato: true,
          operazione: { select: { tipoOperazione: true } },
        },
      });

      let cashFlowPrecedenti = 0;
      for (const rip of ripPrecedenti) {
        const v = Number(rip.importoCalcolato);
        if (rip.operazione.tipoOperazione === "FATTURA_ATTIVA") cashFlowPrecedenti += v;
        else if (TIPI_USCITA.includes(rip.operazione.tipoOperazione)) cashFlowPrecedenti -= v;
      }
      const saldoIniziale = Math.round(
        (capitaleSociale * (quotaPercentuale / 100) + cashFlowPrecedenti) * 100
      ) / 100;

      // Monthly ripartizioni for selected year
      const rips = await prisma.ripartizioneOperazione.findMany({
        where: {
          socioId,
          operazione: {
            societaId,
            eliminato: false,
            bozza: false,
            dataOperazione: { gte: dataInizioAnno, lte: dataFineAnno },
          },
        },
        select: {
          importoCalcolato: true,
          operazione: { select: { tipoOperazione: true, dataOperazione: true } },
        },
      });

      const mensile = buildMensile();
      for (const rip of rips) {
        const mese = new Date(rip.operazione.dataOperazione).getMonth() + 1;
        accumulaMovimento(mensile, rip.operazione.tipoOperazione, Number(rip.importoCalcolato), mese);
      }
      const saldoFinale = finalizzaMensile(mensile, saldoIniziale);

      const totali = {
        entrate: Math.round(mensile.reduce((s, m) => s + m.entrate, 0) * 100) / 100,
        uscite: Math.round(mensile.reduce((s, m) => s + m.uscite, 0) * 100) / 100,
        saldoFinale,
      };

      return NextResponse.json({ anno, saldoIniziale, mensile, totali });
    }
  } catch (error) {
    console.error("Errore simulazione cassa:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/cassa"
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start the dev server if not running: `npm run dev`

Test ADMIN:
```
curl -s "http://localhost:3000/api/dashboard/cassa?anno=2026" \
  -H "Cookie: <your-session-cookie>" | jq .
```

Expected: JSON with `anno`, `saldoIniziale`, `mensile` (12 items), `totali`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dashboard/cassa/route.ts
git commit -m "feat: add /api/dashboard/cassa endpoint for cash flow simulation"
```

---

## Chunk 2: Frontend

### Task 7: Update operazioni-list — labels, badges, null-safe categoria

**Files:**
- Modify: `src/app/operazioni/operazioni-list.tsx`

- [ ] **Step 1: Extend TIPO_OPERAZIONE_LABELS**

Find:
```typescript
const TIPO_OPERAZIONE_LABELS: Record<string, string> = {
  FATTURA_ATTIVA: "Fattura Attiva",
  COSTO: "Costo",
  CESPITE: "Cespite",
};
```

Replace with:
```typescript
const TIPO_OPERAZIONE_LABELS: Record<string, string> = {
  FATTURA_ATTIVA: "Fattura Attiva",
  COSTO: "Costo",
  CESPITE: "Cespite",
  PAGAMENTO_IMPOSTE: "Pag. Imposte",
  DISTRIBUZIONE_DIVIDENDI: "Dividendi",
  COMPENSO_AMMINISTRATORE: "Comp. Amm.",
};
```

- [ ] **Step 2: Add new badge colors to TipoBadge colorMap**

Find:
```typescript
  const colorMap: Record<string, string> = {
    FATTURA_ATTIVA: "bg-green-500/15 text-green-400 border-green-500/25",
    COSTO: "bg-red-500/15 text-red-400 border-red-500/25",
    CESPITE: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  };
```

Replace with:
```typescript
  const colorMap: Record<string, string> = {
    FATTURA_ATTIVA: "bg-green-500/15 text-green-400 border-green-500/25",
    COSTO: "bg-red-500/15 text-red-400 border-red-500/25",
    CESPITE: "bg-violet-500/15 text-violet-400 border-violet-500/25",
    PAGAMENTO_IMPOSTE: "bg-orange-100 text-orange-800 border-orange-200",
    DISTRIBUZIONE_DIVIDENDI: "bg-purple-100 text-purple-800 border-purple-200",
    COMPENSO_AMMINISTRATORE: "bg-sky-100 text-sky-800 border-sky-200",
  };
```

- [ ] **Step 3: Fix Operazione type — make categoria and categoriaId nullable**

Find the `Operazione` type fields:
```typescript
  categoriaId: number;
```
and:
```typescript
  categoria: { id: number; nome: string };
```

Replace with:
```typescript
  categoriaId: number | null;
```
and:
```typescript
  categoria: { id: number; nome: string } | null;
```

- [ ] **Step 4: Fix null-unsafe categoria access in table row**

Find:
```typescript
                  <TableCell className="text-sm">{op.categoria.nome}</TableCell>
```

Replace with:
```typescript
                  <TableCell className="text-sm">{op.categoria?.nome ?? "—"}</TableCell>
```

- [ ] **Step 5: Add new type filter options to the tipo dropdown**

Find the filter `<SelectContent>` that lists tipo operazione filter items. It currently has `SelectItem` entries for FATTURA_ATTIVA, COSTO, CESPITE. Add three more items:

```tsx
<SelectItem value="PAGAMENTO_IMPOSTE">Pag. Imposte</SelectItem>
<SelectItem value="DISTRIBUZIONE_DIVIDENDI">Dividendi</SelectItem>
<SelectItem value="COMPENSO_AMMINISTRATORE">Comp. Amm.</SelectItem>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "operazioni-list"
```

- [ ] **Step 7: Commit**

```bash
git add src/app/operazioni/operazioni-list.tsx
git commit -m "feat: operazioni-list — new type labels, badge colors, null-safe categoria"
```

---

### Task 8: Update operazione-form — new types, sottotipo field, conditional logic

**Files:**
- Modify: `src/app/operazioni/operazione-form.tsx`

- [ ] **Step 1: Add TIPI_FINANZIARI constant (module-level)**

After the imports and before the type definitions, add:

```typescript
const TIPI_FINANZIARI = ["PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"] as const;
const SOTTOTIPI_IMPOSTE = [
  { value: "IVA", label: "Liquidazione IVA" },
  { value: "IRES_ACCONTO", label: "Acconto IRES" },
  { value: "IRES_SALDO", label: "Saldo IRES" },
  { value: "IRAP_ACCONTO", label: "Acconto IRAP" },
  { value: "IRAP_SALDO", label: "Saldo IRAP" },
  { value: "INPS", label: "Contributi INPS" },
];
```

- [ ] **Step 2: Update OperazioneData prop type (lines ~121 and ~135)**

The `OperazioneData` type (the type of the `operazione` prop, defined around line 121) has two fields that need updating:

Find `categoriaId: number;` in `OperazioneData` and change to:
```typescript
  categoriaId: number | null;
```

Find `categoriaId: number;` in the `Categoria` type for the operazione prop (if present) — but more importantly, add `sottotipoOperazione` to `OperazioneData`:
```typescript
  sottotipoOperazione?: string | null;
```

Also update the `categoriaId` useState initialization (line ~208) from:
```typescript
  const [categoriaId, setCategoriaId] = useState(
    operazione ? String(operazione.categoriaId) : ""
  );
```
to:
```typescript
  const [categoriaId, setCategoriaId] = useState(
    operazione?.categoriaId != null ? String(operazione.categoriaId) : ""
  );
```

- [ ] **Step 3: Add sottotipoOperazione state**

After the `isRicorrente` state declaration (line ~285), add:

```typescript
  const [sottotipoOperazione, setSottotipoOperazione] = useState(
    operazione?.sottotipoOperazione ?? ""
  );
```

- [ ] **Step 3b: Add useEffect to reset isRicorrente and sottotipoOperazione on type change**

After the `isTipoFinanziario` derived constant (added in Step 4 below), add:

```typescript
  useEffect(() => {
    if (isTipoFinanziario) {
      setIsRicorrente(false);
    }
    if (tipoOperazione !== "PAGAMENTO_IMPOSTE") {
      setSottotipoOperazione("");
    }
  }, [tipoOperazione, isTipoFinanziario]);
```

- [ ] **Step 4: Add isTipoFinanziario derived constant**

After the `isAcquisto` line (~311), add:

```typescript
  const isTipoFinanziario = (TIPI_FINANZIARI as readonly string[]).includes(tipoOperazione);
```

(The `useEffect` from Step 3b that depends on `isTipoFinanziario` goes immediately after this line.)

- [ ] **Step 4: Make client-side categoriaId validation conditional**

Find (line ~723):
```typescript
    if (!categoriaId) {
      toast.error("Selezionare una categoria");
      return;
    }
```

Replace with:
```typescript
    if (!isTipoFinanziario && !categoriaId) {
      toast.error("Selezionare una categoria");
      return;
    }
    if (tipoOperazione === "PAGAMENTO_IMPOSTE" && !sottotipoOperazione) {
      toast.error("Selezionare il tipo di imposta");
      return;
    }
```

- [ ] **Step 5: Update payload for new types**

Find in handleSave (line ~781):
```typescript
        categoriaId: parseInt(categoriaId, 10),
        importoDeducibile: parseFloat(importoDeducibile) || 0,
        percentualeDeducibilita: parseFloat(percentualeDeducibilita) || 0,
        deducibilitaCustom,
```

Replace with:
```typescript
        ...(isTipoFinanziario
          ? { categoriaId: null, importoDeducibile: 0, percentualeDeducibilita: 0, deducibilitaCustom: false }
          : { categoriaId: parseInt(categoriaId, 10), importoDeducibile: parseFloat(importoDeducibile) || 0, percentualeDeducibilita: parseFloat(percentualeDeducibilita) || 0, deducibilitaCustom }),
        sottotipoOperazione: tipoOperazione === "PAGAMENTO_IMPOSTE" ? sottotipoOperazione : null,
```

- [ ] **Step 6: Extend the tipo operazione RadioGroup with new types**

Find the RadioGroup map that renders the 3 types (lines ~1046–1061):

```typescript
              {[
                { value: "FATTURA_ATTIVA", label: "Fattura Attiva" },
                { value: "COSTO", label: "Costo" },
                { value: "CESPITE", label: "Cespite" },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`tipo-${opt.value}`} />
                  <Label
                    htmlFor={`tipo-${opt.value}`}
                    className="cursor-pointer font-normal"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
```

Replace with:
```typescript
              {[
                { value: "FATTURA_ATTIVA", label: "Fattura Attiva" },
                { value: "COSTO", label: "Costo" },
                { value: "CESPITE", label: "Cespite" },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`tipo-${opt.value}`} />
                  <Label htmlFor={`tipo-${opt.value}`} className="cursor-pointer font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
              <div className="col-span-2 sm:col-span-4 pt-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Movimenti Finanziari</p>
              </div>
              {[
                { value: "PAGAMENTO_IMPOSTE", label: "Pag. Imposte" },
                { value: "DISTRIBUZIONE_DIVIDENDI", label: "Dividendi" },
                { value: "COMPENSO_AMMINISTRATORE", label: "Comp. Amm." },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`tipo-${opt.value}`} />
                  <Label htmlFor={`tipo-${opt.value}`} className="cursor-pointer font-normal">
                    {opt.label}
                  </Label>
                </div>
              ))}
```

- [ ] **Step 7: Add sottotipoOperazione select field (after the tipo operazione RadioGroup section)**

Find the closing div of the tipo operazione section (just before `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">`):

After the `</div>` closing the RadioGroup div, add:

```typescript
          {tipoOperazione === "PAGAMENTO_IMPOSTE" && (
            <div className="space-y-2">
              <Label>Tipo Imposta *</Label>
              <Select value={sottotipoOperazione} onValueChange={setSottotipoOperazione} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo imposta..." />
                </SelectTrigger>
                <SelectContent>
                  {SOTTOTIPI_IMPOSTE.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
```

- [ ] **Step 8: Hide categoria section for financial types**

In the form JSX, locate the section that renders the CategoriaSpesa select (search for the `<Label>` with text "Categoria" or similar). Find the outermost JSX element of that entire section (typically a `<div className="space-y-2">` or `<div className="col-span-..."`). Wrap it — along with all its children — inside a conditional:

```tsx
{!isTipoFinanziario && (
  <div ...existing categoria section outer element...>
    ...existing children...
  </div>
)}
```

Do NOT copy a JSX comment placeholder; replace the outer element and its children directly in the wrapping conditional.

- [ ] **Step 9: Hide isRicorrente toggle for financial types**

Find where `isRicorrente` toggle is rendered (line ~1973):
```typescript
                checked={isRicorrente}
```

The enclosing element (the div or label for "Operazione ricorrente") should be wrapped with `{!isTipoFinanziario && (...)}`.

- [ ] **Step 10: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "operazione-form"
```

- [ ] **Step 11: Manual test — create PAGAMENTO_IMPOSTE**

1. Start dev server: `npm run dev`
2. Navigate to Operazioni → Nuova Operazione
3. Select "Pag. Imposte" — verify the "Tipo Imposta" dropdown appears, categoria hidden, isRicorrente toggle hidden
4. Fill: data, descrizione, importo, select tipo imposta = "IVA", ripartizione = COMUNE
5. Submit — verify success toast and operation appears in list with orange badge

- [ ] **Step 12: Commit**

```bash
git add src/app/operazioni/operazione-form.tsx
git commit -m "feat: operazione-form — new financial types, sottotipo field, conditional layout"
```

---

### Task 9: Add Simulazione Cassa to dashboard

**Files:**
- Modify: `src/app/dashboard/dashboard-content.tsx`

- [ ] **Step 1: Update TIPO_LABELS with new types**

Find:
```typescript
const TIPO_LABELS: Record<string, string> = {
  FATTURA_ATTIVA: "Fattura Attiva",
  COSTO: "Costo",
  CESPITE: "Cespite",
};
```

Replace with:
```typescript
const TIPO_LABELS: Record<string, string> = {
  FATTURA_ATTIVA: "Fattura Attiva",
  COSTO: "Costo",
  CESPITE: "Cespite",
  PAGAMENTO_IMPOSTE: "Pag. Imposte",
  DISTRIBUZIONE_DIVIDENDI: "Dividendi",
  COMPENSO_AMMINISTRATORE: "Comp. Amm.",
};
```

- [ ] **Step 2: Add CassaData type and imports**

At the top of the file, after existing type definitions, add:

```typescript
type CassaMensile = {
  mese: number;
  meseLabel: string;
  entrate: number;
  uscite: number;
  usciteDettaglio: {
    costiOperativi: number;
    cespiti: number;
    imposte: number;
    dividendi: number;
    compensiAmm: number;
  };
  saldoProgressivo: number;
};

type CassaData = {
  anno: number;
  saldoIniziale: number;
  mensile: CassaMensile[];
  totali: {
    entrate: number;
    uscite: number;
    saldoFinale: number;
  };
};
```

The file currently imports: `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer` from recharts. Add the following three to the existing import statement:

```typescript
  AreaChart,
  Area,
  ReferenceLine,
```

Note: `defs`, `linearGradient`, and `stop` are native SVG elements — do NOT import them from recharts. They are used directly as JSX in the chart without imports.

- [ ] **Step 3: Add cassa state variables**

In the component body, after existing state declarations, add:

```typescript
  const [cassaAnno, setCassaAnno] = useState(new Date().getFullYear());
  const [cassaData, setCassaData] = useState<CassaData | null>(null);
  const [loadingCassa, setLoadingCassa] = useState(false);
```

- [ ] **Step 4: Add fetchCassa function**

After existing fetch functions, add:

```typescript
  const fetchCassa = useCallback(async (anno: number) => {
    setLoadingCassa(true);
    try {
      const res = await fetch(`/api/dashboard/cassa?anno=${anno}`);
      if (res.ok) {
        const data = await res.json();
        setCassaData(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingCassa(false);
    }
  }, []);

  useEffect(() => {
    fetchCassa(cassaAnno);
  }, [cassaAnno, fetchCassa]);
```

- [ ] **Step 5: Add SimulazioneCassa section JSX**

Find the comment `{/* ── Ultime Operazioni */}` in the JSX (line ~706). Insert the Simulazione Cassa section BEFORE it:

```tsx
      {/* ── Simulazione Cassa ────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Simulazione Cassa</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="cassa-anno" className="text-sm">Anno</Label>
            <Input
              id="cassa-anno"
              type="number"
              value={cassaAnno}
              onChange={(e) => setCassaAnno(parseInt(e.target.value, 10) || new Date().getFullYear())}
              className="w-24 h-8 text-sm"
              min={2000}
              max={2100}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loadingCassa ? (
            <Skeleton className="h-64 w-full" />
          ) : !cassaData || (cassaData.totali.entrate === 0 && cassaData.totali.uscite === 0 && cassaData.saldoIniziale === 0) ? (
            <p className="text-sm text-muted-foreground">Nessun movimento registrato per questo anno.</p>
          ) : (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Saldo Iniziale Anno</p>
                    <p className="text-lg font-semibold mt-1">{formatCurrency(cassaData.saldoIniziale)}</p>
                  </CardContent>
                </Card>
                <Card className="border-green-500/30">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Entrate Lorde</p>
                    <p className="text-lg font-semibold mt-1 text-green-400">{formatCurrency(cassaData.totali.entrate)}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-500/30">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Uscite Lorde</p>
                    <p className="text-lg font-semibold mt-1 text-red-400">{formatCurrency(cassaData.totali.uscite)}</p>
                  </CardContent>
                </Card>
                <Card className={cassaData.totali.saldoFinale >= 0 ? "border-green-500/30" : "border-red-500/30"}>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Saldo Finale Anno</p>
                    <p className={`text-lg font-semibold mt-1 ${cassaData.totali.saldoFinale >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(cassaData.totali.saldoFinale)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Line chart — saldo progressivo */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cassaData.mensile} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="cassaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="meseLabel" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatCurrency(value), name === "saldoProgressivo" ? "Saldo" : name]}
                      labelFormatter={(label) => `${label} ${cassaAnno}`}
                    />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                    <Area
                      type="monotone"
                      dataKey="saldoProgressivo"
                      name="saldoProgressivo"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#cassaGradient)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Breakdown uscite */}
              <div>
                <p className="text-sm font-medium mb-2">Dettaglio Uscite</p>
                <Table>
                  <TableBody>
                    {[
                      { label: "Costi operativi", value: cassaData.mensile.reduce((s, m) => s + m.usciteDettaglio.costiOperativi, 0) },
                      { label: "Cespiti", value: cassaData.mensile.reduce((s, m) => s + m.usciteDettaglio.cespiti, 0) },
                      { label: "Imposte pagate", value: cassaData.mensile.reduce((s, m) => s + m.usciteDettaglio.imposte, 0) },
                      { label: "Dividendi distribuiti", value: cassaData.mensile.reduce((s, m) => s + m.usciteDettaglio.dividendi, 0) },
                      { label: "Compensi amministratore", value: cassaData.mensile.reduce((s, m) => s + m.usciteDettaglio.compensiAmm, 0) },
                    ].filter((r) => r.value > 0).map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="text-sm text-muted-foreground">{row.label}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-red-400">{formatCurrency(row.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard-content"
```

Expected: no errors.

- [ ] **Step 7: Manual test dashboard**

1. Navigate to `/dashboard`
2. Scroll to "Simulazione Cassa" section (should appear before "Ultime Operazioni")
3. Verify 4 KPI cards render
4. Verify chart shows saldo line
5. Change the anno selector — verify data refreshes
6. Verify empty state message shows for years with no data

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/dashboard-content.tsx
git commit -m "feat: dashboard — add Simulazione Cassa section with KPI cards and cash flow chart"
```

---

### Task 10: Build verification

- [ ] **Step 1: Run production build**

```bash
npm run build
```

Expected: build completes with no errors. Any TypeScript or Next.js errors must be fixed before proceeding.

- [ ] **Step 2: End-to-end manual test**

Test the full flow:
1. Create a `PAGAMENTO_IMPOSTE` operation: tipo imposta = IVA, €500, ripartizione COMUNE
2. Verify it appears in the operations list with orange badge
3. Create a `DISTRIBUZIONE_DIVIDENDI` operation: €1000, ripartizione SINGOLO to one partner
4. Create a `COMPENSO_AMMINISTRATORE` operation: €2000, ripartizione COMUNE
5. Navigate to Dashboard → Simulazione Cassa
6. Verify the uscite breakdown shows these new operations
7. Navigate to Report → Rendiconto — verify the new operations do NOT appear in fatturato/costi
8. Navigate to Report → Riepilogo IVA — verify no anomalies

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: build verification — simulazione cassa feature complete"
```
