# Registri IVA Completi + Liquidazioni + LIPE — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance existing IVA registers with per-aliquota totals, annual summary, and PDF export. Enhance liquidation with automatic calculation from registers, credit carry-forward, and acconto. Add LIPE XML generation in IVP18 format.

**Architecture:** Enhances existing pages (`/bilancio/registri-iva`) and APIs (`/api/registri-iva`, `/api/liquidazioni-iva`). Adds LIPE generator module (`src/lib/lipe/`) for XML generation. Adds PDF export endpoint for print-ready registers. New liquidation UI page with period timeline.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma (MySQL), Vitest, Tailwind CSS, Shadcn UI, @react-pdf/renderer, xmlbuilder2

**Spec:** `docs/superpowers/specs/2026-03-24-registri-iva-lipe-design.md`
**Normative reference:** `docs/normativa/registri-iva-lipe-riferimenti.md`

---

## Task 1: Prisma Schema — Extend LiquidazioneIva + New Tables

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new fields to LiquidazioneIva**

Add to the existing `LiquidazioneIva` model:
```prisma
totaleOperazioniAttive   Decimal  @default(0) @map("totale_operazioni_attive") @db.Decimal(12, 2)
totaleOperazioniPassive  Decimal  @default(0) @map("totale_operazioni_passive") @db.Decimal(12, 2)
debitoPeriodoPrecedente  Decimal  @default(0) @map("debito_periodo_precedente") @db.Decimal(12, 2)
creditoAnnoPrecedente    Decimal  @default(0) @map("credito_anno_precedente") @db.Decimal(12, 2)
versamentiAutoUE         Decimal  @default(0) @map("versamenti_auto_ue") @db.Decimal(12, 2)
creditiImposta           Decimal  @default(0) @map("crediti_imposta") @db.Decimal(12, 2)
interessiDovuti          Decimal  @default(0) @map("interessi_dovuti") @db.Decimal(12, 2)
metodoAcconto            Int?     @map("metodo_acconto")
stampaDefinitiva         Boolean  @default(false) @map("stampa_definitiva")
dataStampaDefinitiva     DateTime? @map("data_stampa_definitiva")
```

- [ ] **Step 2: Add StatoLipe enum**

```prisma
enum StatoLipe {
  BOZZA
  GENERATA
  INVIATA
  @@map("stato_lipe")
}
```

- [ ] **Step 3: Add LipeInvio model**

```prisma
model LipeInvio {
  id               Int       @id @default(autoincrement())
  societaId        Int       @map("societa_id")
  anno             Int
  trimestre        Int
  xmlContent       String    @db.LongText @map("xml_content")
  nomeFile         String    @db.VarChar(50) @map("nome_file")
  progressivoFile  String    @db.VarChar(5) @map("progressivo_file")
  stato            StatoLipe @default(GENERATA)
  dataGenerazione  DateTime  @default(now()) @map("data_generazione")
  dataInvio        DateTime? @map("data_invio")
  scadenzaInvio    DateTime  @map("scadenza_invio") @db.Date
  createdAt        DateTime  @default(now()) @map("created_at")

  societa Societa @relation(fields: [societaId], references: [id])

  @@unique([societaId, anno, trimestre])
  @@map("lipe_invii")
}
```

Add `lipeInvii LipeInvio[]` relation to `Societa`.

- [ ] **Step 4: Run prisma migrate dev**

```bash
npx prisma migrate dev --name add-lipe-and-liquidazione-fields
```

**Verify:** `npx prisma generate` succeeds, new fields visible in Prisma client.

---

## Task 2: Liquidation Calculation Engine

**Files:**
- Create: `src/lib/liquidazione/calcola.ts`
- Create: `src/lib/liquidazione/types.ts`
- Create: `src/lib/liquidazione/__tests__/calcola.test.ts`

- [ ] **Step 1: Define types**

```typescript
// types.ts
export interface CalcoloLiquidazioneInput {
  societaId: number;
  tipo: "MENSILE" | "TRIMESTRALE";
  periodo: number; // 1-12 for mensile, 1-4 for trimestrale
  anno: number;
}

export interface CalcoloLiquidazioneResult {
  totaleOperazioniAttive: number;  // VP2
  totaleOperazioniPassive: number; // VP3
  ivaEsigibile: number;           // VP4
  ivaDetraibile: number;          // VP5
  saldo: number;                   // VP6 (positive=debito, negative=credito)
  debitoPeriodoPrecedente: number; // VP7
  creditoPeriodoPrecedente: number;// VP8
  creditoAnnoPrecedente: number;   // VP9
  interessiDovuti: number;         // VP12
  importoFinale: number;           // VP14 (positive=versare, negative=credito)
  codiceTributo: string;
}
```

- [ ] **Step 2: Implement calculation logic**

`calcola.ts` function `calcolaLiquidazione(input)`:
1. Query vendite register for the period → sum imponibile (VP2), sum IVA (VP4)
2. Query acquisti register for the period → sum imponibile (VP3), sum IVA detraibile (VP5)
3. Include corrispettivi (scorporo IVA from gross amounts)
4. VP6 = VP4 - VP5
5. Get previous period's liquidation → VP7 (debito < 25.82 riportato), VP8 (credito)
6. Get credito anno precedente from first period → VP9
7. If trimestrale and periodo != 4: VP12 = max(0, VP6) * 0.01
8. VP14 = VP6 + VP7 - VP8 - VP9 + VP12
9. Determine codiceTributo from tipo + periodo
10. If VP14 debito < 25.82: mark as riportato (VP7 for next period)

- [ ] **Step 3: Write tests**

Test cases:
- Mensile con debito > 25.82
- Mensile con credito (riporto)
- Trimestrale con maggiorazione 1%
- Debito < 25.82 riportato al periodo successivo
- Riporto credito tra periodi
- IV trimestre senza maggiorazione

**Verify:** `npx vitest run src/lib/liquidazione/`

---

## Task 3: Acconto IVA Calculation

**Files:**
- Create: `src/lib/liquidazione/acconto.ts`
- Create: `src/lib/liquidazione/__tests__/acconto.test.ts`

- [ ] **Step 1: Implement acconto calculation**

Function `calcolaAcconto(input)`:
- Metodo storico (default): 88% of IVA versata for dicembre/IV trim anno precedente
- Metodo previsionale: 88% of IVA prevista (user-provided estimate)
- Metodo analitico: 100% of liquidazione al 20/12

- [ ] **Step 2: Write tests**

Test cases:
- Metodo storico con liquidazione anno precedente a debito
- Anno precedente a credito → acconto non dovuto
- Importo < 103.29 → acconto non dovuto
- Metodo analitico

**Verify:** `npx vitest run src/lib/liquidazione/__tests__/acconto.test.ts`

---

## Task 4: API — Calcolo Liquidazione

**Files:**
- Create: `src/app/api/liquidazioni-iva/calcola/route.ts`

- [ ] **Step 1: POST endpoint**

```
POST /api/liquidazioni-iva/calcola
Body: { tipo: "MENSILE"|"TRIMESTRALE", periodo: number, anno: number }
```

- Calls `calcolaLiquidazione()` from Task 2
- Upserts `LiquidazioneIva` record (using @@unique constraint on societaId+tipo+periodo+anno)
- Returns the full calculated liquidation data

- [ ] **Step 2: Handle carry-forward**

After saving, check if previous period had debito < 25.82 and set it as debitoPeriodoPrecedente.

**Verify:** Manual API test with curl/Postman; check DB record created correctly.

---

## Task 5: API — Acconto IVA

**Files:**
- Create: `src/app/api/liquidazioni-iva/acconto/route.ts`

- [ ] **Step 1: POST endpoint**

```
POST /api/liquidazioni-iva/acconto
Body: { anno: number, metodo?: 1|2|3, importoPrevisionale?: number }
```

- Calls `calcolaAcconto()` from Task 3
- Updates the dicembre/IV trimestre liquidation record with `accontoVersato`
- Returns acconto amount and whether it's dovuto

**Verify:** Test with anno that has previous year data.

---

## Task 6: Enhance Registri IVA API — Totali per Aliquota

**Files:**
- Modify: `src/app/api/registri-iva/route.ts`

- [ ] **Step 1: Add totali per aliquota to response**

After fetching operazioni, compute grouped totals:
```typescript
const totaliPerAliquota = Map<string, { aliquota: number|null, natura: string|null, imponibile: number, iva: number, count: number }>
```

Group by `aliquotaIva` + `naturaOperazioneIva`, sum imponibile and IVA.

- [ ] **Step 2: Return in response**

```json
{
  "data": [...],
  "totaliPerAliquota": [
    { "aliquota": 22, "natura": null, "totaleImponibile": 120000, "totaleIva": 26400, "count": 45 },
    { "aliquota": null, "natura": "N2.2", "totaleImponibile": 5000, "totaleIva": 0, "count": 3 }
  ],
  "totaleGenerale": { "imponibile": 155000, "iva": 29400, "count": 60 }
}
```

**Verify:** API returns correct totals; existing UI still works (new fields are additive).

---

## Task 7: Enhance Registri IVA UI — Totali per Aliquota

**Files:**
- Modify: `src/app/bilancio/registri-iva/registri-iva-content.tsx`

- [ ] **Step 1: Parse new API response fields**

Update `fetchData` to extract `totaliPerAliquota` from response.

- [ ] **Step 2: Add riepilogo per aliquota section**

Below the table, add a collapsible section "Riepilogo per aliquota" with a summary table. Only visible in modalita avanzata/commercialista.

- [ ] **Step 3: Add riepilogo annuale**

When `mese === "ALL"`, show an additional collapsible "Riepilogo annuale" that groups totals by aliquota for the entire year.

**Verify:** Visual check — totals match the individual rows in the register.

---

## Task 8: Liquidazioni IVA — UI Page

**Files:**
- Create: `src/app/bilancio/liquidazioni-iva/page.tsx`
- Create: `src/app/bilancio/liquidazioni-iva/liquidazioni-iva-content.tsx`

- [ ] **Step 1: Create page layout**

Page at `/bilancio/liquidazioni-iva` with:
- Year selector
- Grid/timeline of periods (12 months or 4 quarters depending on tipo)
- Each period shows: stato (badge), saldo, scadenza versamento

- [ ] **Step 2: Period detail panel**

Clicking a period opens a detail panel/dialog showing all VP fields:
- VP2-VP14 with labels and values
- Stato versamento badge
- Button "Ricalcola" → calls POST /api/liquidazioni-iva/calcola
- Button "Segna versato" → updates statoVersamento

- [ ] **Step 3: Acconto section**

For dicembre (mensile) or IV trimestre: show acconto section with:
- Metodo selector (storico/previsionale/analitico)
- Importo calcolato
- Button "Calcola acconto"

- [ ] **Step 4: Add navigation link**

Add "Liquidazioni IVA" link to sidebar navigation under Bilancio.

**Verify:** Full flow: navigate to page, select year, ricalcola a period, view details.

---

## Task 9: LIPE Types and Builder

**Files:**
- Create: `src/lib/lipe/types.ts`
- Create: `src/lib/lipe/builder.ts`
- Create: `src/lib/lipe/__tests__/builder.test.ts`

- [ ] **Step 1: Define LIPE TypeScript types**

As specified in design doc section 5.1 — `LipeFornitura`, `LipeIntestazione`, `LipeComunicazione`, `LipeFrontespizio`, `LipeModulo`.

- [ ] **Step 2: Implement builder**

Function `buildLipeData(societaId, anno, trimestre)`:
1. Fetch societa data (P.IVA, CF, ragione sociale)
2. Fetch liquidazioni for the trimestre (1 or 3 records depending on mensile/trimestrale)
3. Map liquidazione fields to LipeModulo VP fields
4. Build frontespizio from societa data
5. Return LipeFornitura

- [ ] **Step 3: Write tests**

Test with mock data: mensile (3 moduli per trimestre), trimestrale (1 modulo), fields correctly mapped.

**Verify:** `npx vitest run src/lib/lipe/__tests__/builder.test.ts`

---

## Task 10: LIPE XML Generator

**Files:**
- Create: `src/lib/lipe/generator.ts`
- Create: `src/lib/lipe/__tests__/generator.test.ts`

- [ ] **Step 1: Install xmlbuilder2**

```bash
npm install xmlbuilder2
```

- [ ] **Step 2: Implement XML generator**

Function `generateLipeXml(data: LipeFornitura): string`:
1. Create XML document with namespace `urn:www.agenziaentrate.gov.it:specificheTecniche:schemario:messaggi:v1.0`
2. Build `<iv:Fornitura>` → `<iv:Intestazione>` → `<iv:Comunicazione>` → `<iv:Frontespizio>` + `<iv:DatiContabili>` → `<iv:Modulo>`
3. Map VP fields to XML elements: TotaleOperazioniAttive, TotaleOperazioniPassive, IvaEsigibile, IvaDetratta, etc.
4. IvaDovuta vs IvaCredito: mutually exclusive based on sign of VP6
5. ImportoDaVersare vs ImportoACredito: mutually exclusive based on sign of VP14
6. Format decimals: 2 decimal places, dot separator
7. Return XML string

- [ ] **Step 3: Implement file naming**

Function `generateLipeFileName(codiceFiscale: string, progressivo: number): string`
→ `IT{codiceFiscale}_LI_{progressivo padded to 5}.xml`

- [ ] **Step 4: Write tests**

Test XML output matches expected structure; test element presence/absence for debito vs credito; test file naming.

**Verify:** `npx vitest run src/lib/lipe/__tests__/generator.test.ts`; validate generated XML is well-formed.

---

## Task 11: LIPE API Endpoints

**Files:**
- Create: `src/app/api/lipe/route.ts` (GET list)
- Create: `src/app/api/lipe/genera/route.ts` (POST generate)
- Create: `src/app/api/lipe/[id]/route.ts` (GET single + download)

- [ ] **Step 1: POST /api/lipe/genera**

Body: `{ anno, trimestre }`
1. Call `buildLipeData()` to construct data from liquidazioni
2. Call `generateLipeXml()` to produce XML
3. Determine progressivo from existing LipeInvio records for this societa
4. Calculate scadenzaInvio based on trimestre
5. Upsert LipeInvio record
6. Return record with XML content

- [ ] **Step 2: GET /api/lipe**

Query params: `anno`
Return list of LipeInvio records for the societa+anno.

- [ ] **Step 3: GET /api/lipe/[id]**

Return single record. If query param `download=true`, return XML as file attachment.

**Verify:** Generate LIPE for a quarter; verify XML is valid; download the file.

---

## Task 12: LIPE UI Section

**Files:**
- Modify: `src/app/bilancio/liquidazioni-iva/liquidazioni-iva-content.tsx`

- [ ] **Step 1: Add LIPE tab/section**

In the liquidazioni page (from Task 8), add a "LIPE" tab visible only in modalita commercialista.

- [ ] **Step 2: LIPE trimester grid**

Show 4 trimestri with:
- Stato badge (non generata / generata / inviata)
- Scadenza invio
- Preview dei dati VP aggregati per trimestre
- Button "Genera LIPE" → calls POST /api/lipe/genera
- Button "Scarica XML" → downloads file
- Button "Segna inviata" → updates stato

**Verify:** Full flow from liquidazioni → genera LIPE → download XML → segna inviata.

---

## Task 13: PDF Export — Registri IVA

**Files:**
- Create: `src/lib/pdf/registro-iva-pdf.tsx` (React PDF component)
- Create: `src/app/api/registri-iva/pdf/route.ts`

- [ ] **Step 1: Install @react-pdf/renderer**

```bash
npm install @react-pdf/renderer
```

- [ ] **Step 2: Create PDF component**

React PDF document component `RegistroIvaPdf` with:
- Page header: ragione sociale, P.IVA, tipo registro, anno, periodo, sezionale
- Table rows: protocollo, data, soggetto, tipo doc, imponibile, aliquota, IVA, natura
- Footer: totali per aliquota
- Page numbering

- [ ] **Step 3: Create API endpoint**

`GET /api/registri-iva/pdf?registroIva=VENDITE&anno=2026&mese=3&sezionale=FV`

1. Fetch operazioni (reuse logic from existing route)
2. Fetch societa data
3. Render PDF component to buffer
4. Return with `Content-Type: application/pdf` and `Content-Disposition: attachment`

- [ ] **Step 4: Add download button to UI**

Add "Esporta PDF" button to `registri-iva-content.tsx` (visible in avanzata/commercialista).

**Verify:** Download PDF, check layout, verify totals match UI.

---

## Task 14: Stampa Definitiva (solo commercialista)

**Files:**
- Modify: `src/app/api/registri-iva/pdf/route.ts`
- Modify: `src/app/bilancio/registri-iva/registri-iva-content.tsx`

- [ ] **Step 1: Add stampa definitiva flag**

In PDF endpoint, accept `stampaDefinitiva=true` query param. When set:
1. Generate PDF with "STAMPA DEFINITIVA" watermark/header
2. Update LiquidazioneIva.stampaDefinitiva = true and dataStampaDefinitiva = now()
3. Assign progressive page numbers that continue from previous definitive print

- [ ] **Step 2: UI indicator**

Show a badge "Stampato" next to periods that have stampa definitiva. Prevent re-stampa unless explicitly forced.

**Verify:** Stampa definitiva marks the period; subsequent prints show continued page numbering.

---

## Task 15: Integration Tests + Lint

**Files:**
- Create: `src/lib/lipe/__tests__/integration.test.ts`
- Create: `src/lib/liquidazione/__tests__/integration.test.ts`

- [ ] **Step 1: Liquidazione integration test**

Full flow: create mock operazioni → calcolaLiquidazione → verify VP fields → verify carry-forward to next period.

- [ ] **Step 2: LIPE integration test**

Full flow: liquidazioni for 3 months → buildLipeData → generateLipeXml → parse XML and verify VP elements.

- [ ] **Step 3: Lint and type-check**

```bash
npx tsc --noEmit
npx next lint
```

Fix any errors.

**Verify:** All tests pass. No lint errors. No type errors.

---

## Dependency Graph

```
Task 1 (Schema)
  ├── Task 2 (Calc engine) → Task 4 (API calcola) → Task 8 (UI liquidazioni)
  ├── Task 3 (Acconto) → Task 5 (API acconto) → Task 8 (UI liquidazioni)
  ├── Task 6 (API totali) → Task 7 (UI totali)
  ├── Task 9 (LIPE builder) → Task 10 (LIPE XML) → Task 11 (LIPE API) → Task 12 (LIPE UI)
  ├── Task 13 (PDF export) → Task 14 (Stampa definitiva)
  └── Task 15 (Integration tests) — after all other tasks
```

Tasks 2+3, 6, 9 can run in parallel after Task 1.
Tasks 7, 8, 12, 13 are UI tasks that can run in parallel once their API dependencies are done.
