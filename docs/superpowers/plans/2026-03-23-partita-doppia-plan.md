# Partita Doppia e Libro Giornale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add double-entry bookkeeping to Prima Nota — every operation generates journal entries (scritture contabili) with debit/credit movements linked to the chart of accounts.

**Architecture:** A generation engine (`src/lib/contabilita/`) sits between the existing operation logic and the database. Each operation type has a dedicated generator that produces debit/credit movements. A ContoResolver maps operations to chart-of-accounts codes. Three new views (Libro Giornale, Libro Mastro, Bilancio di Verifica) expose the data. Everything runs inside the existing Prisma transaction.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma (MySQL), Vitest, Tailwind CSS, Shadcn UI

**Spec:** `docs/superpowers/specs/2026-03-21-partita-doppia-design.md`
**Normative reference:** `docs/normativa/partita-doppia-riferimenti.md`

---

## Task 1: Prisma Schema — New Tables and Enums

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new enums to schema.prisma**

At the end of the enum section (after existing enums), add:

```prisma
enum TipoScrittura {
  AUTO
  MANUALE
  RETTIFICA
  STORNO
  CHIUSURA
  APERTURA

  @@map("tipo_scrittura")
}

enum StatoScrittura {
  DEFINITIVA
  PROVVISORIA

  @@map("stato_scrittura")
}
```

- [ ] **Step 2: Add ScritturaContabile model**

```prisma
model ScritturaContabile {
  id                  Int              @id @default(autoincrement()) @map("scrittura_id")
  societaId           Int              @map("societa_id")
  operazioneId        Int?             @map("operazione_id")
  dataRegistrazione   DateTime         @db.Date @map("data_registrazione")
  dataCompetenza      DateTime         @db.Date @map("data_competenza")
  numeroProtocollo    Int              @map("numero_protocollo")
  anno                Int
  descrizione         String           @db.VarChar(500)
  causale             String           @db.VarChar(10)
  tipoScrittura       TipoScrittura    @map("tipo_scrittura")
  stato               StatoScrittura
  eliminato           Boolean          @default(false)
  protocolloIva       Int?             @map("protocollo_iva")
  registroIvaSezionale String?         @db.VarChar(10) @map("registro_iva_sezionale")
  totaleDare          Decimal          @db.Decimal(12, 2) @map("totale_dare")
  totaleAvere         Decimal          @db.Decimal(12, 2) @map("totale_avere")
  createdByUserId     Int?             @map("created_by_user_id")
  createdAt           DateTime         @default(now()) @map("created_at")
  updatedAt           DateTime         @updatedAt @map("updated_at")

  societa             Societa          @relation(fields: [societaId], references: [id])
  operazione          Operazione?      @relation(fields: [operazioneId], references: [id])
  createdByUser       Utente?          @relation("ScrittureCreateByUser", fields: [createdByUserId], references: [id])
  movimenti           MovimentoContabile[]

  @@unique([societaId, anno, numeroProtocollo])
  @@index([societaId, dataRegistrazione])
  @@index([operazioneId])
  @@index([societaId, anno, causale])
  @@map("scritture_contabili")
}
```

- [ ] **Step 3: Add MovimentoContabile model**

```prisma
model MovimentoContabile {
  id            Int              @id @default(autoincrement()) @map("movimento_id")
  scritturaId   Int              @map("scrittura_id")
  societaId     Int              @map("societa_id")
  contoId       Int              @map("conto_id")
  importoDare   Decimal          @default(0) @db.Decimal(12, 2) @map("importo_dare")
  importoAvere  Decimal          @default(0) @db.Decimal(12, 2) @map("importo_avere")
  descrizione   String?          @db.VarChar(255)
  ordine        Int
  createdAt     DateTime         @default(now()) @map("created_at")
  updatedAt     DateTime         @updatedAt @map("updated_at")

  scrittura     ScritturaContabile @relation(fields: [scritturaId], references: [id], onDelete: Cascade)
  societa       Societa            @relation(fields: [societaId], references: [id])
  conto         PianoDeiConti      @relation(fields: [contoId], references: [id])

  @@index([scritturaId])
  @@index([contoId])
  @@index([societaId, contoId])
  @@map("movimenti_contabili")
}
```

- [ ] **Step 4: Add CausaleContabile model**

```prisma
model CausaleContabile {
  codice          String    @id @db.VarChar(10)
  descrizione     String    @db.VarChar(100)
  tipoOperazione  String?   @db.VarChar(50) @map("tipo_operazione")
  registroIva     RegistroIva?  @map("registro_iva")
  attivo          Boolean   @default(true)

  @@map("causali_contabili")
}
```

- [ ] **Step 5: Add contoDefaultId to CategoriaSpesa**

In the `CategoriaSpesa` model, add:

```prisma
  contoDefaultId    Int?            @map("conto_default_id")
  contoDefault      PianoDeiConti?  @relation("ContoDefaultCategoria", fields: [contoDefaultId], references: [id])
```

- [ ] **Step 6: Add back-references to existing models**

On `Societa`, add:
```prisma
  scrittureContabili  ScritturaContabile[]
  movimentiContabili  MovimentoContabile[]
```

On `Operazione`, add:
```prisma
  scrittureContabili  ScritturaContabile[]
```

On `PianoDeiConti`, add:
```prisma
  movimentiContabili  MovimentoContabile[]
  categorieSpesaDefault CategoriaSpesa[] @relation("ContoDefaultCategoria")
```

On `Utente`, add:
```prisma
  scrittureCreate     ScritturaContabile[] @relation("ScrittureCreateByUser")
```

- [ ] **Step 7: Run migration**

Run: `npx prisma migrate dev --name add_partita_doppia`
Expected: Migration created and applied successfully.

- [ ] **Step 8: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add ScritturaContabile, MovimentoContabile, CausaleContabile tables"
```

---

## Task 2: Piano dei Conti — New Accounts and Renames

**Files:**
- Modify: `src/lib/piano-dei-conti-default.ts`

- [ ] **Step 1: Rename 130.001 description**

In `piano-dei-conti-default.ts`, change:
```typescript
{ codice: "130.001", descrizione: "Erario c/IVA",
```
to:
```typescript
{ codice: "130.001", descrizione: "Erario c/IVA a credito",
```

- [ ] **Step 2: Add new accounts to PIANO_DEI_CONTI_DEFAULT array**

Add these entries in the correct position (ordered by codice):

```typescript
  // After 170.011 (Apparati telefonici), before 170.106 (F.do amm.to mobili):
  { codice: "170.004", descrizione: "Impianti generici", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.2", voceCe: null, naturaSaldo: "DARE" },
  { codice: "170.005", descrizione: "Attrezzature", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.3", voceCe: null, naturaSaldo: "DARE" },

  // After 170.111, new fondo entries:
  { codice: "170.101", descrizione: "F.do amm.to impianti", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.2", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "170.102", descrizione: "F.do amm.to attrezzature", tipo: "PATRIMONIALE_ATTIVO", voceSp: "B.II.3", voceCe: null, naturaSaldo: "AVERE" },

  // After 220.004 (Erario c/ritenute da versare):
  { codice: "220.005", descrizione: "INPS c/contributi da versare", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.13", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "220.006", descrizione: "Erario c/IVA (liquidazione)", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.12", voceCe: null, naturaSaldo: "AVERE" },
  { codice: "220.010", descrizione: "IVA c/reverse charge", tipo: "PATRIMONIALE_PASSIVO", voceSp: "D.12", voceCe: null, naturaSaldo: "AVERE" },

  // After 250.001 (Fondo imposte differite):
  { codice: "250.002", descrizione: "Fondo TFM", tipo: "PATRIMONIALE_PASSIVO", voceSp: "B.1", voceCe: null, naturaSaldo: "AVERE" },

  // After 340.018 (Amm.to apparati telefonici):
  { codice: "340.011", descrizione: "Amm.to impianti", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.10.b", naturaSaldo: "DARE" },
  { codice: "340.012", descrizione: "Amm.to attrezzature", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.10.b", naturaSaldo: "DARE" },

  // After 370.008 (Oneri diversi di gestione):
  { codice: "370.009", descrizione: "Sanzioni tributarie", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.14", naturaSaldo: "DARE" },
  { codice: "370.010", descrizione: "Minusvalenze da alienazione", tipo: "ECONOMICO_COSTO", voceSp: null, voceCe: "B.14", naturaSaldo: "DARE" },

  // After 420.004 (Contributi in conto esercizio):
  { codice: "420.010", descrizione: "Rimborso bolli a clienti", tipo: "ECONOMICO_RICAVO", voceSp: null, voceCe: "A.5", naturaSaldo: "AVERE" },

  // New section at the end: Conti d'ordine/transitori
  { codice: "900.001", descrizione: "Conto Economico (transitorio chiusura)", tipo: "ORDINE", voceSp: null, voceCe: null, naturaSaldo: "DARE" },
  { codice: "900.002", descrizione: "Stato Patrimoniale (transitorio chiusura)", tipo: "ORDINE", voceSp: null, voceCe: null, naturaSaldo: "DARE" },
```

Note: If the `TipoConto` enum does not include `ORDINE`, add it to the Prisma enum first.

- [ ] **Step 3: Commit**

```bash
git add src/lib/piano-dei-conti-default.ts prisma/schema.prisma
git commit -m "feat(pdc): add new accounts for partita doppia and rename IVA credito"
```

---

## Task 3: Causali Contabili — Seed Data

**Files:**
- Create: `src/lib/contabilita/causali.ts`

- [ ] **Step 1: Create causali.ts with constants and seed data**

```typescript
// src/lib/contabilita/causali.ts

export const CONTI_STRUTTURALI = {
  CREDITI_CLIENTI:        '110.001',
  FATTURE_DA_EMETTERE:    '110.010',
  IVA_CREDITO:            '130.001',
  ERARIO_RITENUTE_SUBITE: '130.002',
  ERARIO_ACCONTI_IRES:    '130.003',
  ERARIO_ACCONTI_IRAP:    '130.004',
  BANCA_CC:               '100.010',
  CASSA:                  '100.001',

  DEBITI_FORNITORI:       '200.001',
  FATTURE_DA_RICEVERE:    '200.010',
  IVA_DEBITO:             '220.001',
  DEBITI_IRES:            '220.002',
  DEBITI_IRAP:            '220.003',
  ERARIO_RITENUTE:        '220.004',
  INPS_CONTRIBUTI:        '220.005',
  ERARIO_IVA:             '220.006',
  IVA_REVERSE_CHARGE:     '220.010',
  SOCI_DIVIDENDI:         '230.002',
  DEBITI_AMMINISTRATORI:  '230.003',
  FONDO_TFM:              '250.002',

  RISERVA_LEGALE:         '270.004',
  RISERVA_STRAORDINARIA:  '270.006',
  UTILI_A_NUOVO:          '270.009',
  UTILE_ESERCIZIO:        '270.010',

  IMPOSTE_IRES:           '390.001',
  IMPOSTE_IRAP:           '390.002',
  SANZIONI_TRIBUTARIE:    '370.009',
  MINUSVALENZE:           '370.010',

  PLUSVALENZE:             '420.001',
  RIMBORSO_BOLLI:         '420.010',

  CONTO_ECONOMICO:        '900.001',
  STATO_PATRIMONIALE:     '900.002',
} as const;

export type ContoStrutturale = keyof typeof CONTI_STRUTTURALI;

export interface CausaleContabileData {
  codice: string;
  descrizione: string;
  tipoOperazione: string | null;
  registroIva: 'VENDITE' | 'ACQUISTI' | 'CORRISPETTIVI' | null;
}

export const CAUSALI_DEFAULT: CausaleContabileData[] = [
  { codice: 'FV',   descrizione: 'Fattura di vendita',               tipoOperazione: 'FATTURA_ATTIVA', registroIva: 'VENDITE' },
  { codice: 'FVS',  descrizione: 'Fattura vendita split payment',    tipoOperazione: 'FATTURA_ATTIVA', registroIva: 'VENDITE' },
  { codice: 'NCV',  descrizione: 'Nota di credito emessa',           tipoOperazione: 'FATTURA_ATTIVA', registroIva: 'VENDITE' },
  { codice: 'NDV',  descrizione: 'Nota di debito emessa',            tipoOperazione: 'FATTURA_ATTIVA', registroIva: 'VENDITE' },
  { codice: 'FA',   descrizione: 'Fattura di acquisto',              tipoOperazione: 'COSTO',          registroIva: 'ACQUISTI' },
  { codice: 'NCA',  descrizione: 'Nota di credito ricevuta',         tipoOperazione: 'COSTO',          registroIva: 'ACQUISTI' },
  { codice: 'NDA',  descrizione: 'Nota di debito ricevuta',          tipoOperazione: 'COSTO',          registroIva: 'ACQUISTI' },
  { codice: 'FAUE', descrizione: 'Fattura acquisto intra-UE',        tipoOperazione: 'COSTO',          registroIva: 'ACQUISTI' },
  { codice: 'FARE', descrizione: 'Fattura acquisto reverse charge',   tipoOperazione: 'COSTO',          registroIva: 'ACQUISTI' },
  { codice: 'PG',   descrizione: 'Pagamento fornitore',              tipoOperazione: null,             registroIva: null },
  { codice: 'IN',   descrizione: 'Incasso da cliente',               tipoOperazione: null,             registroIva: null },
  { codice: 'AM',   descrizione: 'Ammortamento',                     tipoOperazione: 'CESPITE',        registroIva: null },
  { codice: 'LQ',   descrizione: 'Liquidazione IVA',                 tipoOperazione: null,             registroIva: null },
  { codice: 'F24',  descrizione: 'Pagamento tributi F24',            tipoOperazione: 'PAGAMENTO_IMPOSTE', registroIva: null },
  { codice: 'DIV',  descrizione: 'Distribuzione dividendi',          tipoOperazione: 'DISTRIBUZIONE_DIVIDENDI', registroIva: null },
  { codice: 'CA',   descrizione: 'Compenso amministratore',          tipoOperazione: 'COMPENSO_AMMINISTRATORE', registroIva: null },
  { codice: 'SC',   descrizione: 'Scrittura di chiusura',            tipoOperazione: null,             registroIva: null },
  { codice: 'SA',   descrizione: 'Scrittura di apertura',            tipoOperazione: null,             registroIva: null },
  { codice: 'SAS',  descrizione: 'Scrittura di assestamento',        tipoOperazione: null,             registroIva: null },
  { codice: 'ST',   descrizione: 'Storno',                           tipoOperazione: null,             registroIva: null },
  { codice: 'OG',   descrizione: 'Operazione generica',              tipoOperazione: null,             registroIva: null },
];

/** Maps immobilizzazione type to asset account and amm/fondo accounts */
export const MAPPING_CESPITI = {
  SOFTWARE:    { asset: '160.010', amm: '340.001', fondo: '160.106' },
  MOBILI:      { asset: '170.006', amm: '340.013', fondo: '170.106' },
  ELABORATORI: { asset: '170.008', amm: '340.015', fondo: '170.108' },
  AUTOVETTURE: { asset: '170.010', amm: '340.017', fondo: '170.110' },
  TELEFONI:    { asset: '170.011', amm: '340.018', fondo: '170.111' },
  IMPIANTI:    { asset: '170.004', amm: '340.011', fondo: '170.101' },
  ATTREZZATURE:{ asset: '170.005', amm: '340.012', fondo: '170.102' },
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/contabilita/causali.ts
git commit -m "feat(contabilita): add causali constants, CONTI_STRUTTURALI mapping, and seed data"
```

---

## Task 4: Validation Module

**Files:**
- Create: `src/lib/contabilita/validazione-scrittura.ts`
- Create: `src/lib/contabilita/__tests__/validazione-scrittura.test.ts`

- [ ] **Step 1: Write failing tests for validation**

```typescript
// src/lib/contabilita/__tests__/validazione-scrittura.test.ts
import { describe, it, expect } from "vitest";
import { validaScrittura, type MovimentoGenerato } from "../validazione-scrittura";

describe("validaScrittura", () => {
  it("accepts a balanced entry", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: 1000, importoAvere: 0, ordine: 1 },
      { contoId: 2, importoDare: 0, importoAvere: 1000, ordine: 2 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(true);
    expect(result.errori).toHaveLength(0);
  });

  it("rejects an unbalanced entry", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: 1000, importoAvere: 0, ordine: 1 },
      { contoId: 2, importoDare: 0, importoAvere: 999, ordine: 2 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(false);
    expect(result.errori[0]).toContain("quadratura");
  });

  it("rejects negative amounts", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: -100, importoAvere: 0, ordine: 1 },
      { contoId: 2, importoDare: 0, importoAvere: -100, ordine: 2 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(false);
    expect(result.errori[0]).toContain("negativ");
  });

  it("rejects row with both dare and avere > 0", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: 500, importoAvere: 500, ordine: 1 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(false);
    expect(result.errori[0]).toContain("mutualmente esclusiv");
  });

  it("rejects empty movimenti", () => {
    const result = validaScrittura([]);
    expect(result.valida).toBe(false);
  });

  it("handles rounding (tolerance 0.01)", () => {
    const movimenti: MovimentoGenerato[] = [
      { contoId: 1, importoDare: 100.005, importoAvere: 0, ordine: 1 },
      { contoId: 2, importoDare: 0, importoAvere: 100.01, ordine: 2 },
    ];
    const result = validaScrittura(movimenti);
    expect(result.valida).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/contabilita/__tests__/validazione-scrittura.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement validazione-scrittura.ts**

```typescript
// src/lib/contabilita/validazione-scrittura.ts

export interface MovimentoGenerato {
  contoId: number;
  importoDare: number;
  importoAvere: number;
  descrizione?: string;
  ordine: number;
}

export interface RisultatoValidazione {
  valida: boolean;
  errori: string[];
  totaleDare: number;
  totaleAvere: number;
}

const TOLERANCE = 0.02; // 2 centesimi di tolleranza per arrotondamenti

export function validaScrittura(movimenti: MovimentoGenerato[]): RisultatoValidazione {
  const errori: string[] = [];

  if (movimenti.length === 0) {
    return { valida: false, errori: ["La scrittura deve avere almeno un movimento"], totaleDare: 0, totaleAvere: 0 };
  }

  for (let i = 0; i < movimenti.length; i++) {
    const m = movimenti[i];

    if (m.importoDare < 0 || m.importoAvere < 0) {
      errori.push(`Riga ${i + 1}: importi negativi non ammessi`);
    }

    if (m.importoDare > 0 && m.importoAvere > 0) {
      errori.push(`Riga ${i + 1}: dare e avere sono mutualmente esclusivi`);
    }
  }

  const totaleDare = movimenti.reduce((sum, m) => sum + m.importoDare, 0);
  const totaleAvere = movimenti.reduce((sum, m) => sum + m.importoAvere, 0);

  if (Math.abs(totaleDare - totaleAvere) > TOLERANCE) {
    errori.push(
      `Errore di quadratura: Dare ${totaleDare.toFixed(2)} != Avere ${totaleAvere.toFixed(2)} (differenza: ${Math.abs(totaleDare - totaleAvere).toFixed(2)})`
    );
  }

  return {
    valida: errori.length === 0,
    errori,
    totaleDare: Math.round(totaleDare * 100) / 100,
    totaleAvere: Math.round(totaleAvere * 100) / 100,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/contabilita/__tests__/validazione-scrittura.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/contabilita/validazione-scrittura.ts src/lib/contabilita/__tests__/validazione-scrittura.test.ts
git commit -m "feat(contabilita): add scrittura validation with balance check"
```

---

## Task 5: ContoResolver

**Files:**
- Create: `src/lib/contabilita/conto-resolver.ts`
- Create: `src/lib/contabilita/__tests__/conto-resolver.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/contabilita/__tests__/conto-resolver.test.ts
import { describe, it, expect } from "vitest";
import { ContoResolver } from "../conto-resolver";
import { CONTI_STRUTTURALI } from "../causali";

describe("ContoResolver", () => {
  // Mock PdC lookup: codice -> id
  const mockPdcMap = new Map<string, number>([
    ['100.010', 1], ['110.001', 2], ['130.001', 3],
    ['200.001', 4], ['220.001', 5], ['220.004', 6],
    ['310.001', 7], ['400.001', 8],
  ]);

  const resolver = new ContoResolver(mockPdcMap);

  it("resolves structural account by key", () => {
    const result = resolver.resolveStrutturale('BANCA_CC');
    expect(result.contoId).toBe(1);
    expect(result.warning).toBeNull();
  });

  it("resolves category default account", () => {
    const result = resolver.resolveCategoria(7); // contoDefaultId = 7
    expect(result.contoId).toBe(7);
    expect(result.warning).toBeNull();
  });

  it("resolves explicit account (commercialista override)", () => {
    const result = resolver.resolveEsplicito(8);
    expect(result.contoId).toBe(8);
    expect(result.warning).toBeNull();
  });

  it("returns warning when structural account not found in PdC", () => {
    const sparseMap = new Map<string, number>();
    const sparseResolver = new ContoResolver(sparseMap);
    const result = sparseResolver.resolveStrutturale('BANCA_CC');
    expect(result.contoId).toBeNull();
    expect(result.warning).toContain('100.010');
  });

  it("returns warning when category has no contoDefaultId", () => {
    const result = resolver.resolveCategoria(null);
    expect(result.contoId).toBeNull();
    expect(result.warning).toContain("conto di default");
  });

  it("resolves with priority: explicit > category > structural", () => {
    const result = resolver.resolve({
      esplicito: 8,
      categoriaContoId: 7,
      strutturale: 'BANCA_CC',
    });
    expect(result.contoId).toBe(8); // explicit wins
  });

  it("falls back to category when no explicit", () => {
    const result = resolver.resolve({
      esplicito: null,
      categoriaContoId: 7,
      strutturale: 'BANCA_CC',
    });
    expect(result.contoId).toBe(7); // category wins
  });

  it("falls back to structural when no explicit and no category", () => {
    const result = resolver.resolve({
      esplicito: null,
      categoriaContoId: null,
      strutturale: 'BANCA_CC',
    });
    expect(result.contoId).toBe(1); // structural fallback
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/contabilita/__tests__/conto-resolver.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement conto-resolver.ts**

```typescript
// src/lib/contabilita/conto-resolver.ts
import { CONTI_STRUTTURALI, type ContoStrutturale } from "./causali";

export interface ResolveResult {
  contoId: number | null;
  warning: string | null;
}

export interface ResolveOptions {
  esplicito: number | null;
  categoriaContoId: number | null;
  strutturale: ContoStrutturale;
}

export class ContoResolver {
  /** Map of PdC codice -> database id */
  private pdcMap: Map<string, number>;

  constructor(pdcMap: Map<string, number>) {
    this.pdcMap = pdcMap;
  }

  resolveEsplicito(contoId: number | null): ResolveResult {
    if (contoId === null) {
      return { contoId: null, warning: "Nessun conto esplicito fornito" };
    }
    return { contoId, warning: null };
  }

  resolveCategoria(contoDefaultId: number | null): ResolveResult {
    if (contoDefaultId === null || contoDefaultId === undefined) {
      return { contoId: null, warning: "La categoria non ha un conto di default associato" };
    }
    return { contoId: contoDefaultId, warning: null };
  }

  resolveStrutturale(key: ContoStrutturale): ResolveResult {
    const codice = CONTI_STRUTTURALI[key];
    const id = this.pdcMap.get(codice);
    if (id === undefined) {
      return {
        contoId: null,
        warning: `Conto strutturale ${key} (${codice}) non trovato nel Piano dei Conti`,
      };
    }
    return { contoId: id, warning: null };
  }

  resolve(options: ResolveOptions): ResolveResult {
    // Priority 1: explicit
    if (options.esplicito !== null && options.esplicito !== undefined) {
      return this.resolveEsplicito(options.esplicito);
    }
    // Priority 2: category default
    if (options.categoriaContoId !== null && options.categoriaContoId !== undefined) {
      return this.resolveCategoria(options.categoriaContoId);
    }
    // Priority 3: structural
    return this.resolveStrutturale(options.strutturale);
  }

  /** Shortcut: resolve structural account, throw-safe */
  getStrutturale(key: ContoStrutturale): number | null {
    return this.resolveStrutturale(key).contoId;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/contabilita/__tests__/conto-resolver.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/contabilita/conto-resolver.ts src/lib/contabilita/__tests__/conto-resolver.test.ts
git commit -m "feat(contabilita): add ContoResolver with priority chain"
```

---

## Task 6: Generator — Fattura Passiva (FA)

This is the most common operation type. We implement it first as the reference pattern for all other generators.

**Files:**
- Create: `src/lib/contabilita/generatori/fattura-passiva.ts`
- Create: `src/lib/contabilita/__tests__/generatori/fattura-passiva.test.ts`
- Create: `src/lib/contabilita/types.ts` (shared types for all generators)

- [ ] **Step 1: Create shared types**

```typescript
// src/lib/contabilita/types.ts
import type { MovimentoGenerato } from "./validazione-scrittura";

export interface OperazioneContabile {
  tipoOperazione: string;
  dataOperazione: Date;
  descrizione: string;
  importoTotale: number;
  importoImponibile?: number;
  importoIva?: number;
  aliquotaIva?: number;
  ivaDetraibile?: number;
  ivaIndetraibile?: number;
  importoRitenuta?: number;
  importoNettoRitenuta?: number;
  statoPagamentoFattura?: string;
  splitPayment?: boolean;
  doppiaRegistrazione?: boolean;
  bolloVirtuale?: boolean;
  importoBollo?: number;
  numeroDocumento?: string;
}

export interface GeneratoreInput {
  operazione: OperazioneContabile;
  societaId: number;
  categoriaContoId: number | null;
  anagraficaDenominazione?: string;
  contoEsplicito?: number | null;
}

export interface ScritturaGenerata {
  descrizione: string;
  causale: string;
  movimenti: MovimentoGenerato[];
  totaleDare: number;
  totaleAvere: number;
  warnings: string[];
}

/** Returns one scrittura, or an array for doppia registrazione (reverse charge) */
export type Generatore = (input: GeneratoreInput, resolver: import("./conto-resolver").ContoResolver) => ScritturaGenerata | ScritturaGenerata[];
```

- [ ] **Step 2: Write failing tests for fattura passiva**

```typescript
// src/lib/contabilita/__tests__/generatori/fattura-passiva.test.ts
import { describe, it, expect } from "vitest";
import { generaFatturaPassiva } from "../../generatori/fattura-passiva";
import { ContoResolver } from "../../conto-resolver";

const mockPdcMap = new Map<string, number>([
  ['100.010', 1], ['110.001', 2], ['130.001', 3],
  ['200.001', 4], ['220.001', 5], ['220.004', 6],
]);

const resolver = new ContoResolver(mockPdcMap);

describe("generaFatturaPassiva", () => {
  it("FA — acquisto con IVA 100% detraibile", () => {
    const result = generaFatturaPassiva({
      operazione: {
        tipoOperazione: 'COSTO',
        dataOperazione: new Date('2025-03-15'),
        descrizione: 'Consulenza IT',
        importoTotale: 6100,
        importoImponibile: 5000,
        importoIva: 1100,
        ivaDetraibile: 1100,
        ivaIndetraibile: 0,
      },
      societaId: 1,
      categoriaContoId: 100, // mocked categoria conto
    }, resolver);

    expect(result.causale).toBe('FA');
    expect(result.movimenti).toHaveLength(3);

    // Dare: costo = imponibile
    const costoDare = result.movimenti.find(m => m.contoId === 100 && m.importoDare > 0);
    expect(costoDare?.importoDare).toBe(5000);

    // Dare: IVA credito
    const ivaDare = result.movimenti.find(m => m.contoId === 3 && m.importoDare > 0);
    expect(ivaDare?.importoDare).toBe(1100);

    // Avere: debiti fornitori
    const fornitoriAvere = result.movimenti.find(m => m.contoId === 4 && m.importoAvere > 0);
    expect(fornitoriAvere?.importoAvere).toBe(6100);

    // Quadratura
    expect(result.totaleDare).toBe(6100);
    expect(result.totaleAvere).toBe(6100);
  });

  it("FA — acquisto con IVA parzialmente detraibile (40%)", () => {
    const result = generaFatturaPassiva({
      operazione: {
        tipoOperazione: 'COSTO',
        dataOperazione: new Date('2025-03-15'),
        descrizione: 'Canone leasing auto',
        importoTotale: 1220,
        importoImponibile: 1000,
        importoIva: 220,
        ivaDetraibile: 88,
        ivaIndetraibile: 132,
      },
      societaId: 1,
      categoriaContoId: 100,
    }, resolver);

    expect(result.movimenti).toHaveLength(3);

    // Dare: costo = imponibile + IVA indetraibile
    const costoDare = result.movimenti.find(m => m.contoId === 100 && m.importoDare > 0);
    expect(costoDare?.importoDare).toBe(1132); // 1000 + 132

    // Dare: IVA credito = solo detraibile
    const ivaDare = result.movimenti.find(m => m.contoId === 3 && m.importoDare > 0);
    expect(ivaDare?.importoDare).toBe(88);

    // Avere: debiti = totale fattura
    const fornitoriAvere = result.movimenti.find(m => m.contoId === 4 && m.importoAvere > 0);
    expect(fornitoriAvere?.importoAvere).toBe(1220);
  });

  it("FA — acquisto con ritenuta d'acconto", () => {
    const result = generaFatturaPassiva({
      operazione: {
        tipoOperazione: 'COSTO',
        dataOperazione: new Date('2025-03-15'),
        descrizione: 'Consulenza legale',
        importoTotale: 3806.40,
        importoImponibile: 3120, // compenso + cassa
        importoIva: 686.40,
        ivaDetraibile: 686.40,
        ivaIndetraibile: 0,
        importoRitenuta: 600,
        importoNettoRitenuta: 3206.40,
      },
      societaId: 1,
      categoriaContoId: 100,
    }, resolver);

    expect(result.movimenti).toHaveLength(4);

    // Dare: costo
    const costoDare = result.movimenti.find(m => m.contoId === 100);
    expect(costoDare?.importoDare).toBe(3120);

    // Dare: IVA
    const ivaDare = result.movimenti.find(m => m.contoId === 3);
    expect(ivaDare?.importoDare).toBe(686.40);

    // Avere: debiti fornitori (netto ritenuta)
    const fornitoriAvere = result.movimenti.find(m => m.contoId === 4);
    expect(fornitoriAvere?.importoAvere).toBe(3206.40);

    // Avere: ritenute
    const ritenute = result.movimenti.find(m => m.contoId === 6);
    expect(ritenute?.importoAvere).toBe(600);

    // Quadratura: 3120 + 686.40 = 3806.40 = 3206.40 + 600
    expect(result.totaleDare).toBeCloseTo(3806.40, 2);
    expect(result.totaleAvere).toBeCloseTo(3806.40, 2);
  });

  it("warns when categoria conto is missing", () => {
    const result = generaFatturaPassiva({
      operazione: {
        tipoOperazione: 'COSTO',
        dataOperazione: new Date('2025-03-15'),
        descrizione: 'Test',
        importoTotale: 100,
        importoImponibile: 100,
        importoIva: 0,
        ivaDetraibile: 0,
        ivaIndetraibile: 0,
      },
      societaId: 1,
      categoriaContoId: null,
    }, resolver);

    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/contabilita/__tests__/generatori/fattura-passiva.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement fattura-passiva.ts**

```typescript
// src/lib/contabilita/generatori/fattura-passiva.ts
import type { GeneratoreInput, ScritturaGenerata } from "../types";
import type { ContoResolver } from "../conto-resolver";
import type { MovimentoGenerato } from "../validazione-scrittura";

export function generaFatturaPassiva(
  input: GeneratoreInput,
  resolver: ContoResolver
): ScritturaGenerata {
  const { operazione, categoriaContoId, contoEsplicito, anagraficaDenominazione } = input;
  const warnings: string[] = [];
  const movimenti: MovimentoGenerato[] = [];
  let ordine = 1;

  // Resolve costo account
  const costoResult = resolver.resolve({
    esplicito: contoEsplicito ?? null,
    categoriaContoId,
    strutturale: 'DEBITI_FORNITORI', // fallback nonsensical on purpose — will warn
  });

  if (costoResult.contoId === null) {
    warnings.push(costoResult.warning ?? "Conto costo non risolvibile");
  }

  const costoContoId = costoResult.contoId;

  // Dare 1: Costo (imponibile + IVA indetraibile)
  const importoCosto = (operazione.importoImponibile ?? 0) + (operazione.ivaIndetraibile ?? 0);
  if (importoCosto > 0 && costoContoId !== null) {
    movimenti.push({
      contoId: costoContoId,
      importoDare: importoCosto,
      importoAvere: 0,
      descrizione: operazione.descrizione,
      ordine: ordine++,
    });
  }

  // Dare 2: IVA a credito (solo detraibile)
  const ivaDetraibile = operazione.ivaDetraibile ?? 0;
  if (ivaDetraibile > 0) {
    const ivaContoId = resolver.getStrutturale('IVA_CREDITO');
    if (ivaContoId !== null) {
      movimenti.push({
        contoId: ivaContoId,
        importoDare: ivaDetraibile,
        importoAvere: 0,
        descrizione: `IVA ${operazione.aliquotaIva ?? ''}%`,
        ordine: ordine++,
      });
    } else {
      warnings.push("Conto IVA_CREDITO non trovato");
    }
  }

  // Avere: Debiti v/fornitori
  // Con ritenuta: il fornitore riceve il totale fattura meno la ritenuta trattenuta
  const hasRitenuta = (operazione.importoRitenuta ?? 0) > 0;
  const importoFornitori = hasRitenuta
    ? operazione.importoTotale - (operazione.importoRitenuta ?? 0)
    : operazione.importoTotale;

  const fornitoriContoId = resolver.getStrutturale('DEBITI_FORNITORI');
  if (fornitoriContoId !== null) {
    movimenti.push({
      contoId: fornitoriContoId,
      importoDare: 0,
      importoAvere: importoFornitori,
      descrizione: anagraficaDenominazione ?? 'Fornitore',
      ordine: ordine++,
    });
  } else {
    warnings.push("Conto DEBITI_FORNITORI non trovato");
  }

  // Avere: Erario c/ritenute (se presente)
  if (hasRitenuta) {
    const ritenuteContoId = resolver.getStrutturale('ERARIO_RITENUTE');
    if (ritenuteContoId !== null) {
      movimenti.push({
        contoId: ritenuteContoId,
        importoDare: 0,
        importoAvere: operazione.importoRitenuta!,
        descrizione: 'Ritenuta d\'acconto',
        ordine: ordine++,
      });
    } else {
      warnings.push("Conto ERARIO_RITENUTE non trovato");
    }
  }

  const totaleDare = movimenti.reduce((s, m) => s + m.importoDare, 0);
  const totaleAvere = movimenti.reduce((s, m) => s + m.importoAvere, 0);

  return {
    descrizione: `${operazione.numeroDocumento ? `Fatt. ${operazione.numeroDocumento} — ` : ''}${operazione.descrizione}`,
    causale: 'FA',
    movimenti,
    totaleDare: Math.round(totaleDare * 100) / 100,
    totaleAvere: Math.round(totaleAvere * 100) / 100,
    warnings,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/contabilita/__tests__/generatori/fattura-passiva.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/contabilita/types.ts src/lib/contabilita/generatori/fattura-passiva.ts src/lib/contabilita/__tests__/generatori/fattura-passiva.test.ts
git commit -m "feat(contabilita): add fattura passiva generator with TDD"
```

---

## Task 7: Generator — Fattura Attiva (FV)

**Files:**
- Create: `src/lib/contabilita/generatori/fattura-attiva.ts`
- Create: `src/lib/contabilita/__tests__/generatori/fattura-attiva.test.ts`

Follow the same TDD pattern as Task 6. Key cases to test:
- FV with IVA 22%
- FV esente IVA with bollo
- FVS split payment (credito = solo imponibile)
- NCV nota credito (dare/avere invertiti)
- Incasso immediato (genera seconda scrittura di pagamento)
- Warning when categoria conto missing

The implementation follows the spec Section 4.1. Use `resolver.getStrutturale('RIMBORSO_BOLLI')` for the bollo account.

- [ ] **Step 1: Write failing tests (all FV variants)**
- [ ] **Step 2: Run tests, verify fail**
- [ ] **Step 3: Implement fattura-attiva.ts**
- [ ] **Step 4: Run tests, verify pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(contabilita): add fattura attiva generator (FV, NCV, FVS)"
```

---

## Task 8: Generator — Reverse Charge

**Files:**
- Create: `src/lib/contabilita/generatori/reverse-charge.ts`
- Create: `src/lib/contabilita/__tests__/generatori/reverse-charge.test.ts`

Key: this generator returns **two** ScritturaGenerata (doppia registrazione). Test cases:
- Acquisto intra-UE services (TD17)
- Acquisto intra-UE goods (TD18)
- Reverse charge interno (TD16)
- San Marino without IVA (TD19)
- Verify IVA_REVERSE_CHARGE transitorio closes to zero across both entries
- Debito fornitore = solo imponibile (no IVA)

- [ ] **Step 1-5: TDD cycle**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(contabilita): add reverse charge generator with double registration"
```

---

## Task 9: Generator — Compenso Amministratore

**Files:**
- Create: `src/lib/contabilita/generatori/compenso-amministratore.ts`
- Create: `src/lib/contabilita/__tests__/generatori/compenso-amministratore.test.ts`

Test cases per spec Section 4.6:
- Compenso with ritenuta 20% only
- Compenso with ritenuta + INPS gestione separata (35.03%)
- Verify DEBITI_AMMINISTRATORI, ERARIO_RITENUTE, INPS_CONTRIBUTI accounts

- [ ] **Step 1-5: TDD cycle**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(contabilita): add compenso amministratore generator"
```

---

## Task 10: Generators — Remaining Types

**Files:**
- Create: `src/lib/contabilita/generatori/cespite-acquisto.ts` + test
- Create: `src/lib/contabilita/generatori/ammortamento.ts` + test
- Create: `src/lib/contabilita/generatori/pagamento-imposte.ts` + test
- Create: `src/lib/contabilita/generatori/dividendi.ts` + test
- Create: `src/lib/contabilita/generatori/liquidazione-iva.ts` + test
- Create: `src/lib/contabilita/generatori/pagamento.ts` + test
- Create: `src/lib/contabilita/generatori/operazione-generica.ts` + test
- Create: `src/lib/contabilita/generatori/index.ts` (registry)

Each generator follows the same TDD pattern. Implement one at a time, test, commit.

- [ ] **Step 1: cespite-acquisto — TDD + commit**

Test: asset account resolved by type (MAPPING_CESPITI), IVA detraibile/indetraibile split.

- [ ] **Step 2: ammortamento — TDD + commit**

Test: correct amm/fondo accounts from MAPPING_CESPITI, quota amount.

- [ ] **Step 3: pagamento-imposte — TDD + commit**

Test: IRES acconto, IRES saldo (stanziamento), F24 versamento ritenute, compensazione crediti.

- [ ] **Step 4: dividendi — TDD + commit**

Test: destinazione utile (riserva legale 5%, dividendi, utili a nuovo), pagamento con ritenuta 26%.

- [ ] **Step 5: liquidazione-iva — TDD + commit**

Test: IVA a debito (vendite > acquisti), IVA a credito (acquisti > vendite).

- [ ] **Step 6: pagamento — TDD + commit**

Test: PG (pagamento fornitore), IN (incasso cliente). Simple: Dare debiti/Avere banca and vice versa.

- [ ] **Step 7: operazione-generica — TDD + commit**

Test: passthrough of explicit movements (Commercialista mode).

- [ ] **Step 8: Create generator registry (index.ts)**

```typescript
// src/lib/contabilita/generatori/index.ts
import { generaFatturaPassiva } from "./fattura-passiva";
import { generaFatturaAttiva } from "./fattura-attiva";
import { generaReverseCharge } from "./reverse-charge";
import { generaCompensoAmministratore } from "./compenso-amministratore";
import { generaCespiteAcquisto } from "./cespite-acquisto";
import { generaAmmortamento } from "./ammortamento";
import { generaPagamentoImposte } from "./pagamento-imposte";
import { generaDividendi } from "./dividendi";
import { generaLiquidazioneIva } from "./liquidazione-iva";
import { generaPagamento } from "./pagamento";
import { generaOperazioneGenerica } from "./operazione-generica";
import type { Generatore } from "../types";

export const GENERATORI: Record<string, Generatore> = {
  // Ciclo passivo — NCA/NDA invert dare/avere inside the generator
  FA: generaFatturaPassiva,
  NCA: generaFatturaPassiva,  // inverts dare/avere for nota credito
  NDA: generaFatturaPassiva,
  // Ciclo attivo — NCV/NDV invert dare/avere inside the generator
  FV: generaFatturaAttiva,
  FVS: generaFatturaAttiva,
  NCV: generaFatturaAttiva,   // inverts dare/avere for nota credito
  NDV: generaFatturaAttiva,
  // Reverse charge (doppia registrazione — returns ScritturaGenerata[])
  FAUE: generaReverseCharge,
  FARE: generaReverseCharge,
  // Cespiti — routed here when tipoOperazione === 'CESPITE'
  FA_CESPITE: generaCespiteAcquisto,
  // Others
  CA: generaCompensoAmministratore,
  AM: generaAmmortamento,
  F24: generaPagamentoImposte,
  DIV: generaDividendi,
  LQ: generaLiquidazioneIva,
  PG: generaPagamento,
  IN: generaPagamento,
  // Chiusura esercizio
  SC: generaChiusuraEsercizio,
  SA: generaChiusuraEsercizio,
  SAS: generaChiusuraEsercizio,
  ST: generaChiusuraEsercizio,
  // Generica (Commercialista)
  OG: generaOperazioneGenerica,
};
```

- [ ] **Step 9: Commit registry**

```bash
git commit -m "feat(contabilita): add all generators and registry"
```

---

## Task 11: Motore Scritture — Orchestrator

**Files:**
- Create: `src/lib/contabilita/motore-scritture.ts`
- Create: `src/lib/contabilita/__tests__/motore-scritture.test.ts`

- [ ] **Step 1: Write failing test**

Test that the motore:
1. Determines the correct causale from operation type
2. Calls the right generator
3. Validates the result
4. Returns the scrittura or warnings

- [ ] **Step 2: Implement motore-scritture.ts**

The orchestrator:
1. Accepts the operation data + a Prisma transaction reference
2. Loads the PdC map for the societa (cached per request)
3. Creates a ContoResolver
4. Determines causale from tipoOperazione + context (IVA result, etc.)
5. Calls the appropriate generator from GENERATORI registry
6. Validates via `validaScrittura()`
7. Returns `ScritturaGenerata` with status DEFINITIVA or PROVVISORIA

- [ ] **Step 3: Run tests, verify pass**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(contabilita): add motore-scritture orchestrator"
```

---

## Task 12: API Integration — POST /api/operazioni

**Files:**
- Modify: `src/app/api/operazioni/route.ts`

- [ ] **Step 1: Import motore and add scrittura generation inside the transaction**

After the existing creates (operazione, ripartizioni, cespiti, IVA), add:

```typescript
// Inside the $transaction callback, after all existing creates:
const scritturaResult = await generaScritturaPerOperazione(tx, {
  operazione: op,
  societaId,
  categoria,
  anagrafica,
  ivaResult,
  userId: session.user.utenteId,
});
```

- [ ] **Step 2: Implement `generaScritturaPerOperazione` helper**

This function:
1. Loads PdC for the society
2. Creates ContoResolver
3. Calls motoreScrittureContabili
4. Acquires next protocollo with `SELECT ... FOR UPDATE`
5. Creates ScritturaContabile + MovimentiContabili in the transaction

- [ ] **Step 3: Test manually — create an operation and verify scrittura exists in DB**

Run the app, create a COSTO operation, check the database:
```sql
SELECT * FROM scritture_contabili ORDER BY scrittura_id DESC LIMIT 1;
SELECT * FROM movimenti_contabili WHERE scrittura_id = <id>;
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): integrate scrittura generation into POST /api/operazioni"
```

---

## Task 13: API — PUT and DELETE Integration

**Files:**
- Modify: `src/app/api/operazioni/[id]/route.ts`

- [ ] **Step 1: On PUT — regenerate the scrittura**

Delete existing MovimentiContabili + ScritturaContabile for this operazione, then regenerate.

- [ ] **Step 2: On DELETE — soft-delete the scrittura**

When the operazione is soft-deleted, also set `eliminato = true` on the linked ScritturaContabile.

- [ ] **Step 3: Test manually**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): regenerate scrittura on PUT, soft-delete on DELETE"
```

---

## Task 14: API — Libro Giornale

**Files:**
- Create: `src/app/api/libro-giornale/route.ts`

- [ ] **Step 1: Implement GET endpoint**

Query parameters: `anno`, `mese?`, `causale?`, `stato?`, `page`, `pageSize`

Returns paginated list of ScrittureContabili with included MovimentiContabili and PianoDeiConti descriptions. Include totals dare/avere for the page and running totals.

- [ ] **Step 2: Test with curl/browser**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api): add GET /api/libro-giornale endpoint"
```

---

## Task 15: API — Libro Mastro

**Files:**
- Create: `src/app/api/libro-mastro/route.ts`

- [ ] **Step 1: Implement GET endpoint**

Query parameters: `contoId`, `anno`, `dal?`, `al?`

Returns all MovimentiContabili for the given conto, ordered by dataRegistrazione, with progressive saldo calculated. Include the scrittura description and numero protocollo.

- [ ] **Step 2: Test**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api): add GET /api/libro-mastro endpoint"
```

---

## Task 16: API — Bilancio di Verifica

**Files:**
- Create: `src/app/api/bilancio-verifica/route.ts`

- [ ] **Step 1: Implement GET endpoint**

Query parameters: `anno`, `allaData?`

Aggregates MovimentiContabili per conto (SUM dare, SUM avere, saldo), grouped by tipo conto. Verify global balance (total dare = total avere).

- [ ] **Step 2: Test**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api): add GET /api/bilancio-verifica endpoint"
```

---

## Task 17: API — Scritture Contabili (Commercialista)

**Files:**
- Create: `src/app/api/scritture-contabili/route.ts`
- Create: `src/app/api/scritture-contabili/[id]/route.ts`

- [ ] **Step 1: POST — create manual scrittura**

Only available in modalita_commercialista. Accepts movimenti array, validates quadratura, saves.

- [ ] **Step 2: PUT — edit PROVVISORIA or MANUALE scrittura**
- [ ] **Step 3: DELETE — delete MANUALE scrittura**
- [ ] **Step 4: Test**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(api): add CRUD for manual scritture contabili (Commercialista)"
```

---

## Task 18: UI — Libro Giornale Page

**Files:**
- Create: `src/app/bilancio/libro-giornale/page.tsx`
- Modify: `src/components/layout/sidebar.tsx` (add navigation link)

- [ ] **Step 1: Create page component**

Server component that fetches from `/api/libro-giornale`. Displays:
- Filter bar: anno, mese, causale, stato
- Table with: n. articolo, data, causale, descrizione, then sub-rows per movimento (codice conto, descrizione, dare, avere)
- Page totals dare/avere
- Registration counter for bollo calculation

Visibility: hidden in Semplice, read-only in Avanzata, full in Commercialista.

- [ ] **Step 2: Add sidebar link**

Under "Bilancio" section, add "Libro Giornale" link. Conditionally show based on modalita.

- [ ] **Step 3: Test visually**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): add Libro Giornale page"
```

---

## Task 19: UI — Libro Mastro Page

**Files:**
- Create: `src/app/bilancio/libro-mastro/page.tsx`

- [ ] **Step 1: Create page with account selector and movement table**

Combobox to search/select conto by codice or descrizione. Period filter. Table showing date, n. articolo, descrizione, dare, avere, saldo progressivo. Click on n. articolo links to libro giornale.

- [ ] **Step 2: Add sidebar link**
- [ ] **Step 3: Test visually**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): add Libro Mastro page"
```

---

## Task 20: UI — Bilancio di Verifica Page

**Files:**
- Create: `src/app/bilancio/bilancio-verifica/page.tsx`

- [ ] **Step 1: Create page with account summary table**

Table: codice, descrizione, totale dare, totale avere, saldo, indicator D/A. Grouped by tipo conto. Grand total row with balance check indicator. Filter by anno, option to hide zero-balance accounts.

- [ ] **Step 2: Add sidebar link**
- [ ] **Step 3: Test visually**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ui): add Bilancio di Verifica page"
```

---

## Task 21: UI — Scrittura Contabile Panel on Operazione

**Files:**
- Modify: `src/app/operazioni/[id]/page.tsx` (or detail component)

- [ ] **Step 1: Add collapsible panel showing the generated scrittura**

In Avanzata mode: read-only panel showing the dare/avere movements.
In Commercialista mode: editable table with account selector and re-validation.
In Semplice mode: hidden.

- [ ] **Step 2: Test across modes**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ui): add scrittura contabile panel to operation detail"
```

---

## Task 22: Seed CausaleContabile and CategoriaSpesa.contoDefaultId

> **IMPORTANT:** This task MUST run before Task 23 (migration script), because the migration depends on causali and conto mappings being populated.

**Files:**
- Modify: `prisma/seed.ts` (or create separate seed file)

- [ ] **Step 1: Seed CausaleContabile table with CAUSALI_DEFAULT data**
- [ ] **Step 2: Create mapping function to populate contoDefaultId on existing CategoriaSpesa records**

Map each default category to its PdC account. For example:
- "Consulenze professionali" → codice 310.001
- "Affitti passivi" → codice 320.001
- etc.

Read the existing categories and Piano dei Conti from DB, match by description pattern, update.

Note: The existing `src/lib/mapping-categoria-conto.ts` file provides a `suggerisciConto()` function. This file is superseded by the new `contoDefaultId` approach but should NOT be deleted — it may still be used elsewhere. The new `contoDefaultId` field is the authoritative source for the motore scritture.

- [ ] **Step 3: Run seed**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(seed): populate causali contabili and categoria-conto mapping"
```

---

## Task 23: Migration Script — Existing Operations

**Files:**
- Create: `prisma/seed-scritture.ts`

- [ ] **Step 1: Create migration script**

Script that:
1. Fetches all existing Operazioni (not deleted) ordered by date
2. For each, calls the motore to generate the scrittura
3. Saves with tipoScrittura = AUTO, stato = DEFINITIVA (or PROVVISORIA if warnings)
4. Prints summary: N generated, N provvisorie, total quadratura check

- [ ] **Step 2: Add npm script**

In package.json:
```json
"seed:scritture": "npx tsx prisma/seed-scritture.ts"
```

- [ ] **Step 3: Run on dev database and verify**

Run: `npm run seed:scritture`
Verify: Check bilancio di verifica page quadra.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(migration): add seed script for retroactive scritture generation"
```

---

## Task 24: Generator — Chiusura Esercizio

**Files:**
- Create: `src/lib/contabilita/generatori/chiusura-esercizio.ts`
- Create: `src/lib/contabilita/__tests__/generatori/chiusura-esercizio.test.ts`

This is the most complex generator — it produces multiple scritture for the year-end closing sequence:

1. Scritture di assestamento (ratei, risconti, fatture da emettere/ricevere)
2. Chiusura conti economici di costo → CONTO_ECONOMICO
3. Chiusura conti economici di ricavo → CONTO_ECONOMICO
4. Determinazione utile/perdita → UTILE_ESERCIZIO
5. Chiusura conti patrimoniali → STATO_PATRIMONIALE
6. Riapertura conti patrimoniali (1 gennaio anno successivo)
7. Storno ratei/risconti

Add `SC`, `SA`, `SAS`, `ST` causali to the GENERATORI registry.

- [ ] **Step 1-5: TDD cycle**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(contabilita): add chiusura esercizio generator"
```

---

## Task 25: API — Rigenera Scrittura Endpoint

**Files:**
- Create: `src/app/api/scritture-contabili/rigenera/[operazioneId]/route.ts`

- [ ] **Step 1: Implement POST endpoint**

Deletes existing scrittura for the given operazione and regenerates it using the motore. Returns the new scrittura.

- [ ] **Step 2: Test**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api): add POST /api/scritture-contabili/rigenera/[operazioneId]"
```

---

## Task 26: UI — Form Scrittura Manuale (Commercialista)

**Files:**
- Create: `src/components/contabilita/form-scrittura-manuale.tsx`

- [ ] **Step 1: Create form component**

Accessible from Libro Giornale page. Features:
- Data registrazione e competenza
- Descrizione/causale selectors
- Dynamic table of dare/avere rows with PdC account combobox
- Real-time balance validation (totale dare vs avere)
- Add/remove row buttons
- Saves via POST /api/scritture-contabili

Only visible in modalita_commercialista.

- [ ] **Step 2: Test visually**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(ui): add manual scrittura form for Commercialista mode"
```

---

## Task 27: Final Integration Test

**Files:**
- Create: `src/lib/contabilita/__tests__/integration.test.ts`

- [ ] **Step 1: Write end-to-end test**

Test the full flow without DB:
1. Create mock PdC map
2. For each operation type, call the motore
3. Verify all scritture are balanced
4. Verify no warnings for standard cases

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, including existing IVA tests.

- [ ] **Step 3: Commit**

```bash
git commit -m "test(contabilita): add integration tests for full generation flow"
```

---

## Summary — Commit Sequence

| Task | Description | ~Files |
|------|-------------|--------|
| 1 | Prisma schema — new tables and enums | 1 |
| 2 | Piano dei Conti — new accounts | 1 |
| 3 | Causali constants and mappings | 1 |
| 4 | Validation module (TDD) | 2 |
| 5 | ContoResolver (TDD) | 2 |
| 6 | Generator: Fattura Passiva (TDD) | 3 |
| 7 | Generator: Fattura Attiva (TDD) | 2 |
| 8 | Generator: Reverse Charge (TDD) | 2 |
| 9 | Generator: Compenso Amministratore (TDD) | 2 |
| 10 | Generators: all remaining + registry | ~16 |
| 11 | Motore Scritture orchestrator (TDD) | 2 |
| 12 | API: POST /api/operazioni integration | 1 |
| 13 | API: PUT/DELETE integration | 1 |
| 14 | API: Libro Giornale | 1 |
| 15 | API: Libro Mastro | 1 |
| 16 | API: Bilancio di Verifica | 1 |
| 17 | API: Scritture Contabili CRUD | 2 |
| 18 | UI: Libro Giornale page | 2 |
| 19 | UI: Libro Mastro page | 1 |
| 20 | UI: Bilancio di Verifica page | 1 |
| 21 | UI: Scrittura panel on operation detail | 1 |
| 22 | Seed: causali + categoria-conto mapping | 1 |
| 23 | Migration: seed existing operations | 1 |
| 24 | Generator: Chiusura Esercizio (TDD) | 2 |
| 25 | API: Rigenera scrittura endpoint | 1 |
| 26 | UI: Form scrittura manuale (Commercialista) | 1 |
| 27 | Integration tests | 1 |

### Deferred to follow-up tasks
- PDF export (`GET /api/libro-giornale/export`) — requires React-PDF integration
- Floating-point → Decimal.js migration for financial calculations
