# Acquisto Veicolo Aziendale - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add vehicle purchase management to the existing Cespite (fixed asset) system with automatic Italian fiscal rules, financing with installment payments, and vehicle sale with capital gain/loss calculation.

**Architecture:** The vehicle is a sub-type of the existing Cespite model (one-to-one relationship). When the user creates a CESPITE operation and toggles "E' un veicolo?", the system collects vehicle-specific data and auto-applies fiscal limits per art. 164 TUIR. Financing generates an OperazioneRicorrente for monthly installments (reusing the existing recurring expenses system). Vehicle sale creates a CessioneVeicolo record with automatic plusvalenza/minusvalenza calculation.

**Tech Stack:** Next.js App Router, Prisma (MySQL), TypeScript, shadcn/ui, Tailwind CSS

---

### Task 1: Schema - Add vehicle enums and tables to Prisma

**Files:**
- Modify: `prisma/schema.prisma`

**Context:** The schema already has `Cespite` (line 219-239), `StatoCespite` enum (line 258-262), `OperazioneRicorrente` (line 305-355), and `TipoContratto` enum (line 284-289). We add new enums and tables after the existing ones.

**Step 1: Add the three new enums after `TipoContratto` (line 289)**

```prisma
enum TipoVeicolo {
  AUTOVETTURA
  MOTOCICLO
  CICLOMOTORE
  AUTOCARRO

  @@map("tipo_veicolo")
}

enum UsoVeicolo {
  PROMISCUO
  STRUMENTALE_ESCLUSIVO
  USO_DIPENDENTE
  AGENTE_COMMERCIO

  @@map("uso_veicolo")
}

enum ModalitaAcquisto {
  CONTANTI
  FINANZIAMENTO

  @@map("modalita_acquisto")
}
```

**Step 2: Add the `Veicolo` model after the enums**

```prisma
model Veicolo {
  id                        Int              @id @default(autoincrement())
  cespiteId                 Int              @unique @map("cespite_id")
  tipoVeicolo               TipoVeicolo      @map("tipo_veicolo")
  usoVeicolo                UsoVeicolo       @map("uso_veicolo")
  modalitaAcquisto          ModalitaAcquisto @map("modalita_acquisto")
  marca                     String           @db.VarChar(100)
  modello                   String           @db.VarChar(100)
  targa                     String           @db.VarChar(20)
  limiteFiscale             Decimal          @map("limite_fiscale") @db.Decimal(10, 2)
  percentualeDeducibilita   Decimal          @map("percentuale_deducibilita") @db.Decimal(5, 2)
  percentualeDetraibilitaIva Decimal         @map("percentuale_detraibilita_iva") @db.Decimal(5, 2)
  createdAt                 DateTime         @default(now()) @map("created_at")
  updatedAt                 DateTime         @updatedAt @map("updated_at")

  cespite        Cespite          @relation(fields: [cespiteId], references: [id], onDelete: Cascade)
  finanziamento  Finanziamento?
  cessione       CessioneVeicolo?

  @@map("veicoli")
}
```

**Step 3: Add the `Finanziamento` model**

```prisma
model Finanziamento {
  id                      Int       @id @default(autoincrement())
  veicoloId               Int       @unique @map("veicolo_id")
  importoFinanziato       Decimal   @map("importo_finanziato") @db.Decimal(10, 2)
  anticipo                Decimal   @default(0) @db.Decimal(10, 2)
  numeroRate              Int       @map("numero_rate")
  importoRata             Decimal   @map("importo_rata") @db.Decimal(10, 2)
  tan                     Decimal?  @db.Decimal(5, 2)
  dataPrimaRata           DateTime  @map("data_prima_rata") @db.Date
  operazioneRicorrenteId  Int?      @map("operazione_ricorrente_id")
  createdAt               DateTime  @default(now()) @map("created_at")
  updatedAt               DateTime  @updatedAt @map("updated_at")

  veicolo              Veicolo               @relation(fields: [veicoloId], references: [id], onDelete: Cascade)
  operazioneRicorrente OperazioneRicorrente? @relation(fields: [operazioneRicorrenteId], references: [id])

  @@map("finanziamenti")
}
```

**Step 4: Add the `CessioneVeicolo` model**

```prisma
model CessioneVeicolo {
  id                      Int      @id @default(autoincrement())
  veicoloId               Int      @unique @map("veicolo_id")
  dataCessione            DateTime @map("data_cessione") @db.Date
  prezzoVendita           Decimal  @map("prezzo_vendita") @db.Decimal(10, 2)
  valoreResiduoContabile  Decimal  @map("valore_residuo_contabile") @db.Decimal(10, 2)
  plusvalenza             Decimal  @default(0) @db.Decimal(10, 2)
  plusvalenzaImponibile   Decimal  @default(0) @map("plusvalenza_imponibile") @db.Decimal(10, 2)
  minusvalenza            Decimal  @default(0) @db.Decimal(10, 2)
  minusvalenzaDeducibile  Decimal  @default(0) @map("minusvalenza_deducibile") @db.Decimal(10, 2)
  createdAt               DateTime @default(now()) @map("created_at")

  veicolo Veicolo @relation(fields: [veicoloId], references: [id], onDelete: Cascade)

  @@map("cessioni_veicoli")
}
```

**Step 5: Add inverse relations on existing models**

Add to the `Cespite` model (after line 235 `quoteAmmortamento`):
```prisma
  veicolo           Veicolo?
```

Add to the `OperazioneRicorrente` model (after line 350 `operazioniGenerate`):
```prisma
  finanziamenti     Finanziamento[]
```

**Step 6: Run the migration**

```bash
cd /Users/giuseppeantonacci/Desktop/Prima\ Nota
npx prisma migrate dev --name add-veicolo-tables
```

Expected: Migration creates `veicoli`, `finanziamenti`, `cessioni_veicoli` tables plus enum types.

**Step 7: Verify with prisma generate**

```bash
npx prisma generate
```

Expected: Prisma client regenerated with new types.

**Step 8: Commit**

```bash
git add prisma/
git commit -m "feat: add Veicolo, Finanziamento, CessioneVeicolo schema with enums"
```

---

### Task 2: Fiscal calculation utilities for vehicles

**Files:**
- Create: `src/lib/calcoli-veicoli.ts`

**Context:** The app already has `src/lib/business-utils.ts` (calcolaPianoAmmortamento, calcolaDeducibilita) and `src/lib/calcoli-ricorrenze.ts` (leasing/NLT calculations). This new file handles vehicle-specific fiscal logic.

**Step 1: Create the fiscal constants and utility functions**

Create file `src/lib/calcoli-veicoli.ts`:

```typescript
/**
 * Fiscal calculation utilities for vehicle purchases.
 * Art. 164 TUIR - Italian tax rules for business vehicles.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TipoVeicolo = "AUTOVETTURA" | "MOTOCICLO" | "CICLOMOTORE" | "AUTOCARRO";
export type UsoVeicolo = "PROMISCUO" | "STRUMENTALE_ESCLUSIVO" | "USO_DIPENDENTE" | "AGENTE_COMMERCIO";

// ---------------------------------------------------------------------------
// Fiscal limits per vehicle type (art. 164 TUIR)
// ---------------------------------------------------------------------------

export const LIMITI_FISCALI_VEICOLO: Record<TipoVeicolo, { standard: number; agente: number }> = {
  AUTOVETTURA: { standard: 18075.99, agente: 25822.84 },
  MOTOCICLO: { standard: 4131.66, agente: 4131.66 },
  CICLOMOTORE: { standard: 2065.83, agente: 2065.83 },
  AUTOCARRO: { standard: Infinity, agente: Infinity },
};

// ---------------------------------------------------------------------------
// Deductibility and VAT percentages per usage type
// ---------------------------------------------------------------------------

export const PERCENTUALI_USO: Record<UsoVeicolo, { deducibilita: number; detraibilitaIva: number }> = {
  PROMISCUO: { deducibilita: 20, detraibilitaIva: 40 },
  STRUMENTALE_ESCLUSIVO: { deducibilita: 100, detraibilitaIva: 100 },
  USO_DIPENDENTE: { deducibilita: 70, detraibilitaIva: 40 },
  AGENTE_COMMERCIO: { deducibilita: 80, detraibilitaIva: 100 },
};

// ---------------------------------------------------------------------------
// Get fiscal limit for a vehicle
// ---------------------------------------------------------------------------

/**
 * Returns the fiscal limit for depreciation base, given vehicle type and usage.
 * AUTOCARRO strumentale has no limit (returns Infinity).
 * AGENTE_COMMERCIO gets higher limits for AUTOVETTURA.
 */
export function getLimiteFiscale(
  tipoVeicolo: TipoVeicolo,
  usoVeicolo: UsoVeicolo
): number {
  const limiti = LIMITI_FISCALI_VEICOLO[tipoVeicolo];
  if (usoVeicolo === "AGENTE_COMMERCIO") return limiti.agente;
  if (usoVeicolo === "STRUMENTALE_ESCLUSIVO") return Infinity;
  return limiti.standard;
}

/**
 * Returns the deductibility and VAT deductibility percentages for the given usage.
 */
export function getPercentualiUso(usoVeicolo: UsoVeicolo): {
  deducibilita: number;
  detraibilitaIva: number;
} {
  return PERCENTUALI_USO[usoVeicolo];
}

// ---------------------------------------------------------------------------
// Depreciation base calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the fiscal depreciation base for a vehicle.
 * Base = min(costo + IVA indetraibile, limite fiscale)
 *
 * @param costoAcquisto - Purchase price (net of VAT)
 * @param ivaIndetraibile - Non-deductible VAT amount (gets capitalized)
 * @param limiteFiscale - Fiscal limit for this vehicle type+usage
 * @returns The fiscal base for depreciation calculation
 */
export function calcolaBaseFiscale(
  costoAcquisto: number,
  ivaIndetraibile: number,
  limiteFiscale: number
): number {
  const valoreContabile = costoAcquisto + ivaIndetraibile;
  return Math.min(valoreContabile, limiteFiscale);
}

// ---------------------------------------------------------------------------
// Financing calculations
// ---------------------------------------------------------------------------

export type PianoRataFinanziamento = {
  numeroRata: number;
  quotaCapitale: number;
  quotaInteressi: number;
  importoRata: number;
  debitoResiduo: number;
};

/**
 * Generates the financing amortization schedule (piano ammortamento finanziamento).
 *
 * With TAN: French amortization (constant installment, decreasing interest).
 * Without TAN: Linear interest distribution (total interest split evenly).
 *
 * @param importoFinanziato - Amount financed
 * @param numeroRate - Number of installments
 * @param importoRata - Monthly installment amount
 * @param tan - Optional annual nominal rate (percentage, e.g. 5.5 for 5.5%)
 */
export function calcolaPianoFinanziamento(
  importoFinanziato: number,
  numeroRate: number,
  importoRata: number,
  tan?: number | null
): PianoRataFinanziamento[] {
  const piano: PianoRataFinanziamento[] = [];

  if (tan != null && tan > 0) {
    // French amortization with TAN
    const tassoMensile = tan / 100 / 12;
    let debitoResiduo = importoFinanziato;

    for (let i = 1; i <= numeroRate; i++) {
      const quotaInteressi = Math.round(debitoResiduo * tassoMensile * 100) / 100;
      let quotaCapitale = Math.round((importoRata - quotaInteressi) * 100) / 100;

      // Last installment: adjust to close debt exactly
      if (i === numeroRate) {
        quotaCapitale = Math.round(debitoResiduo * 100) / 100;
        const rataEffettiva = Math.round((quotaCapitale + quotaInteressi) * 100) / 100;
        debitoResiduo = 0;
        piano.push({
          numeroRata: i,
          quotaCapitale,
          quotaInteressi,
          importoRata: rataEffettiva,
          debitoResiduo: 0,
        });
      } else {
        debitoResiduo = Math.round((debitoResiduo - quotaCapitale) * 100) / 100;
        piano.push({
          numeroRata: i,
          quotaCapitale,
          quotaInteressi,
          importoRata,
          debitoResiduo,
        });
      }
    }
  } else {
    // Linear interest distribution (no TAN)
    const totaleRate = Math.round(importoRata * numeroRate * 100) / 100;
    const totaleInteressi = Math.round((totaleRate - importoFinanziato) * 100) / 100;
    const interessePerRata = Math.round((totaleInteressi / numeroRate) * 100) / 100;
    const capitalePerRata = Math.round((importoFinanziato / numeroRate) * 100) / 100;

    let debitoResiduo = importoFinanziato;
    for (let i = 1; i <= numeroRate; i++) {
      let quotaCapitale = capitalePerRata;
      let quotaInteressi = interessePerRata;

      // Last installment: adjust to close residuals
      if (i === numeroRate) {
        quotaCapitale = Math.round(debitoResiduo * 100) / 100;
        quotaInteressi = Math.round((importoRata - quotaCapitale) * 100) / 100;
      }

      debitoResiduo = Math.round((debitoResiduo - quotaCapitale) * 100) / 100;
      if (debitoResiduo < 0) debitoResiduo = 0;

      piano.push({
        numeroRata: i,
        quotaCapitale,
        quotaInteressi,
        importoRata,
        debitoResiduo,
      });
    }
  }

  return piano;
}

/**
 * Calculates total interest from a financing plan.
 */
export function calcolaTotaleInteressi(
  importoFinanziato: number,
  numeroRate: number,
  importoRata: number,
  tan?: number | null
): number {
  const piano = calcolaPianoFinanziamento(importoFinanziato, numeroRate, importoRata, tan);
  return piano.reduce((sum, r) => sum + r.quotaInteressi, 0);
}

// ---------------------------------------------------------------------------
// Sale (cessione) calculations
// ---------------------------------------------------------------------------

export type CalcoloCessione = {
  valoreResiduoContabile: number;
  plusvalenza: number;
  plusvalenzaImponibile: number;
  minusvalenza: number;
  minusvalenzaDeducibile: number;
};

/**
 * Calculates capital gain/loss on vehicle sale.
 *
 * The taxable portion of the gain (or deductible portion of the loss)
 * is proportional to the ratio of tax-deducted depreciation vs total depreciation.
 *
 * @param prezzoVendita - Sale price
 * @param costoStorico - Original asset cost (valoreIniziale of Cespite)
 * @param fondoAmmortamento - Total accumulated depreciation (from QuoteAmmortamento)
 * @param percentualeDeducibilita - Vehicle usage deductibility % (20% promiscuo, etc.)
 */
export function calcolaCessione(
  prezzoVendita: number,
  costoStorico: number,
  fondoAmmortamento: number,
  percentualeDeducibilita: number
): CalcoloCessione {
  const valoreResiduoContabile = Math.round((costoStorico - fondoAmmortamento) * 100) / 100;
  const ammortamentoDedotto = Math.round((fondoAmmortamento * percentualeDeducibilita / 100) * 100) / 100;
  const rapportoDeduzione = fondoAmmortamento > 0
    ? ammortamentoDedotto / fondoAmmortamento
    : percentualeDeducibilita / 100;

  let plusvalenza = 0;
  let plusvalenzaImponibile = 0;
  let minusvalenza = 0;
  let minusvalenzaDeducibile = 0;

  if (prezzoVendita > valoreResiduoContabile) {
    plusvalenza = Math.round((prezzoVendita - valoreResiduoContabile) * 100) / 100;
    plusvalenzaImponibile = Math.round(plusvalenza * rapportoDeduzione * 100) / 100;
  } else if (prezzoVendita < valoreResiduoContabile) {
    minusvalenza = Math.round((valoreResiduoContabile - prezzoVendita) * 100) / 100;
    minusvalenzaDeducibile = Math.round(minusvalenza * rapportoDeduzione * 100) / 100;
  }

  return {
    valoreResiduoContabile,
    plusvalenza,
    plusvalenzaImponibile,
    minusvalenza,
    minusvalenzaDeducibile,
  };
}

// ---------------------------------------------------------------------------
// Labels for display
// ---------------------------------------------------------------------------

export const TIPO_VEICOLO_LABELS: Record<TipoVeicolo, string> = {
  AUTOVETTURA: "Autovettura",
  MOTOCICLO: "Motociclo",
  CICLOMOTORE: "Ciclomotore",
  AUTOCARRO: "Autocarro",
};

export const USO_VEICOLO_LABELS: Record<UsoVeicolo, string> = {
  PROMISCUO: "Uso promiscuo",
  STRUMENTALE_ESCLUSIVO: "Strumentale esclusivo",
  USO_DIPENDENTE: "Uso a dipendente",
  AGENTE_COMMERCIO: "Agente di commercio",
};

export const MODALITA_ACQUISTO_LABELS: Record<string, string> = {
  CONTANTI: "Contanti",
  FINANZIAMENTO: "Finanziamento",
};
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/calcoli-veicoli.ts
git commit -m "feat: add fiscal calculation utilities for vehicle purchases"
```

---

### Task 3: API - Vehicle creation integrated in POST /api/operazioni

**Files:**
- Modify: `src/app/api/operazioni/route.ts` (POST handler, lines 178-474)

**Context:** The POST handler already creates Operazione + Cespite + QuoteAmmortamento in a transaction (lines 356-430). We extend it to also create Veicolo and optionally Finanziamento + OperazioneRicorrente when the operation is a vehicle.

**Step 1: Add imports at the top of the file**

After the existing imports (line 6), add:
```typescript
import {
  getLimiteFiscale,
  getPercentualiUso,
  calcolaBaseFiscale,
  calcolaPianoFinanziamento,
} from "@/lib/calcoli-veicoli";
import { calcolaProssimaGenerazione } from "@/lib/calcoli-ricorrenze";
```

**Step 2: Extract additional vehicle fields from the request body**

After line 213 (`} = body;`), add the vehicle fields extraction:
```typescript
    // Vehicle-specific fields (only when tipoOperazione === "CESPITE" and isVeicolo)
    const {
      isVeicolo,
      tipoVeicolo,
      usoVeicolo,
      modalitaAcquisto,
      marca,
      modelloVeicolo,
      targa,
      // Financing fields
      importoFinanziato,
      anticipoFinanziamento,
      numeroRate,
      importoRata,
      tan,
      dataPrimaRata,
    } = body;
```

**Step 3: Add vehicle validation after cespite validation (after line 328)**

```typescript
    // Validate VEICOLO fields
    if (tipoOperazione === "CESPITE" && isVeicolo) {
      if (!tipoVeicolo || !usoVeicolo || !modalitaAcquisto) {
        return NextResponse.json(
          { error: "Tipo veicolo, uso e modalita acquisto sono obbligatori" },
          { status: 400 }
        );
      }
      if (!marca || !modelloVeicolo || !targa) {
        return NextResponse.json(
          { error: "Marca, modello e targa sono obbligatori" },
          { status: 400 }
        );
      }
      if (modalitaAcquisto === "FINANZIAMENTO") {
        if (!importoFinanziato || !numeroRate || !importoRata || !dataPrimaRata) {
          return NextResponse.json(
            { error: "Importo finanziato, numero rate, importo rata e data prima rata sono obbligatori" },
            { status: 400 }
          );
        }
      }
    }
```

**Step 4: Modify the cespite creation block inside the transaction**

Replace the existing cespite creation block (lines 393-427) with an expanded version that:
1. When `isVeicolo`, calculates the fiscal base using vehicle limits
2. Uses the limited fiscal base for the depreciation schedule (instead of `importo`)
3. Creates the Veicolo record
4. If financing, creates Finanziamento + OperazioneRicorrente for monthly installments

```typescript
      // Create cespite + depreciation schedule if CESPITE
      if (tipoOperazione === "CESPITE") {
        const aliquota = parseFloat(String(aliquotaAmmortamento));
        const annoInizio = new Date(dataOperazione).getFullYear();

        let valorePerAmmortamento = importo;
        let veicoloData: any = null;

        // If vehicle: calculate fiscal base with limits
        if (isVeicolo) {
          const percUso = getPercentualiUso(usoVeicolo);
          const limiteFiscale = getLimiteFiscale(tipoVeicolo, usoVeicolo);
          const ivaIndet = ivaIndetraibile != null ? parseFloat(String(ivaIndetraibile)) : 0;
          valorePerAmmortamento = calcolaBaseFiscale(importo, ivaIndet, limiteFiscale);

          veicoloData = {
            tipoVeicolo,
            usoVeicolo,
            modalitaAcquisto,
            marca,
            modello: modelloVeicolo,
            targa,
            limiteFiscale,
            percentualeDeducibilita: percUso.deducibilita,
            percentualeDetraibilitaIva: percUso.detraibilitaIva,
          };
        }

        const piano = calcolaPianoAmmortamento(valorePerAmmortamento, aliquota, annoInizio);
        const fondoFinale = piano.length > 0
          ? piano[piano.length - 1].fondoProgressivo
          : 0;
        const statoFinale = fondoFinale >= valorePerAmmortamento ? "COMPLETATO" : "IN_AMMORTAMENTO";

        const cespite = await tx.cespite.create({
          data: {
            operazioneId: op.id,
            societaId,
            descrizione,
            valoreIniziale: valorePerAmmortamento,
            aliquotaAmmortamento: aliquota,
            dataAcquisto: new Date(dataOperazione),
            annoInizio,
            stato: statoFinale as any,
            fondoAmmortamento: fondoFinale,
          },
        });

        if (piano.length > 0) {
          await tx.quotaAmmortamento.createMany({
            data: piano.map((q) => ({
              cespiteId: cespite.id,
              anno: q.anno,
              aliquotaApplicata: q.aliquotaApplicata,
              importoQuota: q.importoQuota,
              fondoProgressivo: q.fondoProgressivo,
            })),
          });
        }

        // Create vehicle record if applicable
        if (isVeicolo && veicoloData) {
          const veicolo = await tx.veicolo.create({
            data: {
              cespiteId: cespite.id,
              ...veicoloData,
            },
          });

          // Create financing + recurring operation for installments
          if (modalitaAcquisto === "FINANZIAMENTO") {
            const impFinanziato = parseFloat(String(importoFinanziato));
            const nRate = parseInt(String(numeroRate), 10);
            const impRata = parseFloat(String(importoRata));
            const tanValue = tan != null ? parseFloat(String(tan)) : null;
            const anticipo = anticipoFinanziamento != null ? parseFloat(String(anticipoFinanziamento)) : 0;

            // Calculate interest for each installment
            const pianoFin = calcolaPianoFinanziamento(impFinanziato, nRate, impRata, tanValue);
            // Average monthly interest for the recurring template
            const totInteressi = pianoFin.reduce((sum, r) => sum + r.quotaInteressi, 0);
            const interesseMedio = Math.round((totInteressi / nRate) * 100) / 100;

            // Create recurring operation for monthly installments
            // The recurring operation amount = full installment (capital + interest)
            // but only the interest portion is a deductible cost
            const dataPrimaRataDate = new Date(dataPrimaRata);
            const giornoRata = dataPrimaRataDate.getDate();

            const percDedVeicolo = veicoloData.percentualeDeducibilita;
            const interesseDeducibile = Math.round((interesseMedio * percDedVeicolo / 100) * 100) / 100;

            // Find or use a generic "Interessi passivi" category, or reuse the same category
            const ricorrente = await tx.operazioneRicorrente.create({
              data: {
                societaId,
                createdByUserId: userId,
                tipoOperazione: "COSTO",
                categoriaId: parseInt(String(categoriaId), 10),
                descrizione: `Rata finanziamento ${marca} ${modelloVeicolo} ${targa}`,
                importoTotale: impRata,
                aliquotaIva: null,
                importoImponibile: null,
                importoIva: null,
                percentualeDetraibilitaIva: null,
                ivaDetraibile: null,
                ivaIndetraibile: null,
                percentualeDeducibilita: percDedVeicolo,
                importoDeducibile: interesseDeducibile,
                deducibilitaCustom: true,
                tipoRipartizione: tipoRipartizione as any,
                socioSingoloId: socioSingoloId ? parseInt(String(socioSingoloId), 10) : null,
                note: `Quota capitale media: ${Math.round((impRata - interesseMedio) * 100) / 100} + Quota interessi media: ${interesseMedio}`,
                giornoDelMese: giornoRata,
                dataInizio: dataPrimaRataDate,
                dataFine: null,
                prossimaGenerazione: dataPrimaRataDate,
                rateRimanenti: nRate,
              },
            });

            await tx.finanziamento.create({
              data: {
                veicoloId: veicolo.id,
                importoFinanziato: impFinanziato,
                anticipo: anticipo,
                numeroRate: nRate,
                importoRata: impRata,
                tan: tanValue,
                dataPrimaRata: dataPrimaRataDate,
                operazioneRicorrenteId: ricorrente.id,
              },
            });
          }
        }
      }
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/app/api/operazioni/route.ts
git commit -m "feat: integrate vehicle creation in POST /api/operazioni with fiscal limits and financing"
```

---

### Task 4: API - Vehicle sale (cessione) endpoint

**Files:**
- Create: `src/app/api/cespiti/[id]/cessione/route.ts`

**Context:** This endpoint handles selling a vehicle. It receives the sale price and date, calculates plusvalenza/minusvalenza, updates the cespite status to CEDUTO, creates a CessioneVeicolo record, and optionally creates an ENTRATA operation for the sale proceeds.

**Step 1: Create the cessione API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcolaCessione } from "@/lib/calcoli-veicoli";
import { calcolaRipartizione } from "@/lib/business-utils";
import { logAttivita } from "@/lib/log-helper";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;
    const ruolo = user.ruolo as string;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const { id } = await params;
    const cespiteId = parseInt(id, 10);

    const body = await request.json();
    const { dataCessione, prezzoVendita, categoriaId } = body;

    if (!dataCessione || prezzoVendita == null) {
      return NextResponse.json(
        { error: "Data cessione e prezzo vendita sono obbligatori" },
        { status: 400 }
      );
    }

    const prezzo = parseFloat(String(prezzoVendita));
    if (isNaN(prezzo) || prezzo < 0) {
      return NextResponse.json(
        { error: "Il prezzo di vendita deve essere un valore valido" },
        { status: 400 }
      );
    }

    // Fetch cespite with vehicle data
    const cespite = await prisma.cespite.findFirst({
      where: { id: cespiteId, societaId },
      include: {
        veicolo: true,
        operazione: {
          include: {
            ripartizioni: { include: { socio: { select: { id: true, quotaPercentuale: true } } } },
          },
        },
        quoteAmmortamento: { orderBy: { anno: "asc" } },
      },
    });

    if (!cespite) {
      return NextResponse.json({ error: "Cespite non trovato" }, { status: 404 });
    }

    if (cespite.stato === "CEDUTO") {
      return NextResponse.json({ error: "Cespite gia ceduto" }, { status: 400 });
    }

    if (!cespite.veicolo) {
      return NextResponse.json({ error: "Il cespite non e un veicolo" }, { status: 400 });
    }

    // Calculate plusvalenza/minusvalenza
    const percentualeDeducibilita = Number(cespite.veicolo.percentualeDeducibilita);
    const costoStorico = Number(cespite.valoreIniziale);
    const fondoAmm = Number(cespite.fondoAmmortamento);

    // Recalculate fondo up to cessione year
    const annoCessione = new Date(dataCessione).getFullYear();
    let fondoAllaCessione = 0;
    for (const q of cespite.quoteAmmortamento) {
      if (q.anno <= annoCessione) {
        fondoAllaCessione += Number(q.importoQuota);
      }
    }
    fondoAllaCessione = Math.round(fondoAllaCessione * 100) / 100;

    const risultato = calcolaCessione(
      prezzo,
      costoStorico,
      fondoAllaCessione,
      percentualeDeducibilita
    );

    // Get ripartizione info from original operation
    const soci = cespite.operazione.ripartizioni.map(r => ({
      id: r.socio.id,
      quotaPercentuale: Number(r.socio.quotaPercentuale),
    }));
    const ripartizioniCalc = calcolaRipartizione(
      prezzo,
      cespite.operazione.tipoRipartizione as any,
      soci,
      cespite.operazione.tipoRipartizione === "SINGOLO"
        ? cespite.operazione.ripartizioni.find(r => Number(r.percentuale) === 100)?.socioId
        : undefined
    );

    const result = await prisma.$transaction(async (tx) => {
      // Update cespite stato to CEDUTO
      await tx.cespite.update({
        where: { id: cespiteId },
        data: {
          stato: "CEDUTO",
          fondoAmmortamento: fondoAllaCessione,
        },
      });

      // Remove future depreciation quotas (after cessione year)
      await tx.quotaAmmortamento.deleteMany({
        where: {
          cespiteId,
          anno: { gt: annoCessione },
        },
      });

      // Create CessioneVeicolo
      const cessione = await tx.cessioneVeicolo.create({
        data: {
          veicoloId: cespite.veicolo!.id,
          dataCessione: new Date(dataCessione),
          prezzoVendita: prezzo,
          valoreResiduoContabile: risultato.valoreResiduoContabile,
          plusvalenza: risultato.plusvalenza,
          plusvalenzaImponibile: risultato.plusvalenzaImponibile,
          minusvalenza: risultato.minusvalenza,
          minusvalenzaDeducibile: risultato.minusvalenzaDeducibile,
        },
      });

      // Create ENTRATA operation for the sale proceeds (if price > 0)
      let operazioneVendita = null;
      if (prezzo > 0) {
        operazioneVendita = await tx.operazione.create({
          data: {
            societaId,
            tipoOperazione: "FATTURA_ATTIVA",
            dataOperazione: new Date(dataCessione),
            descrizione: `Cessione veicolo ${cespite.veicolo!.marca} ${cespite.veicolo!.modello} ${cespite.veicolo!.targa}`,
            importoTotale: prezzo,
            categoriaId: categoriaId ? parseInt(String(categoriaId), 10) : cespite.operazione.categoriaId,
            importoDeducibile: 0,
            percentualeDeducibilita: 0,
            tipoRipartizione: cespite.operazione.tipoRipartizione as any,
            createdByUserId: userId,
            note: `Plusvalenza: ${risultato.plusvalenza} (imponibile: ${risultato.plusvalenzaImponibile}) | Minusvalenza: ${risultato.minusvalenza} (deducibile: ${risultato.minusvalenzaDeducibile})`,
          },
        });

        await tx.ripartizioneOperazione.createMany({
          data: ripartizioniCalc.map((rip) => ({
            operazioneId: operazioneVendita!.id,
            socioId: rip.socioId,
            percentuale: rip.percentuale,
            importoCalcolato: rip.importo,
          })),
        });
      }

      // Deactivate financing recurring operation if exists
      if (cespite.veicolo!.id) {
        const finanziamento = await tx.finanziamento.findUnique({
          where: { veicoloId: cespite.veicolo!.id },
        });
        if (finanziamento?.operazioneRicorrenteId) {
          await tx.operazioneRicorrente.update({
            where: { id: finanziamento.operazioneRicorrenteId },
            data: { attiva: false },
          });
        }
      }

      return { cessione, operazioneVendita };
    });

    await logAttivita({
      userId,
      azione: "UPDATE",
      tabella: "cespiti",
      recordId: cespiteId,
      valoriDopo: {
        stato: "CEDUTO",
        dataCessione,
        prezzoVendita: prezzo,
        plusvalenza: risultato.plusvalenza,
        plusvalenzaImponibile: risultato.plusvalenzaImponibile,
        minusvalenza: risultato.minusvalenza,
        minusvalenzaDeducibile: risultato.minusvalenzaDeducibile,
      },
    });

    return NextResponse.json({
      ...risultato,
      cespiteId,
      operazioneVenditaId: result.operazioneVendita?.id || null,
    });
  } catch (error) {
    console.error("Errore nella cessione del veicolo:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/api/cespiti/[id]/cessione/
git commit -m "feat: add vehicle sale (cessione) API with plusvalenza/minusvalenza calculation"
```

---

### Task 5: API - Update cespiti GET endpoints to include vehicle data

**Files:**
- Modify: `src/app/api/cespiti/route.ts`
- Modify: `src/app/api/cespiti/[id]/route.ts`

**Context:** The existing cespiti API endpoints need to include the Veicolo relation (with Finanziamento and CessioneVeicolo) so the UI can display vehicle-specific information.

**Step 1: Update `src/app/api/cespiti/route.ts` GET handler**

In the `prisma.cespite.findMany()` include block, add the veicolo relation:

After the existing `include` for `quoteAmmortamento`, add:
```typescript
        veicolo: {
          include: {
            finanziamento: {
              include: {
                operazioneRicorrente: { select: { id: true, attiva: true, rateRimanenti: true } },
              },
            },
            cessione: true,
          },
        },
```

In the serialization, add vehicle data:
```typescript
      veicolo: c.veicolo ? {
        ...c.veicolo,
        limiteFiscale: Number(c.veicolo.limiteFiscale),
        percentualeDeducibilita: Number(c.veicolo.percentualeDeducibilita),
        percentualeDetraibilitaIva: Number(c.veicolo.percentualeDetraibilitaIva),
        finanziamento: c.veicolo.finanziamento ? {
          ...c.veicolo.finanziamento,
          importoFinanziato: Number(c.veicolo.finanziamento.importoFinanziato),
          anticipo: Number(c.veicolo.finanziamento.anticipo),
          importoRata: Number(c.veicolo.finanziamento.importoRata),
          tan: c.veicolo.finanziamento.tan != null ? Number(c.veicolo.finanziamento.tan) : null,
        } : null,
        cessione: c.veicolo.cessione ? {
          ...c.veicolo.cessione,
          prezzoVendita: Number(c.veicolo.cessione.prezzoVendita),
          valoreResiduoContabile: Number(c.veicolo.cessione.valoreResiduoContabile),
          plusvalenza: Number(c.veicolo.cessione.plusvalenza),
          plusvalenzaImponibile: Number(c.veicolo.cessione.plusvalenzaImponibile),
          minusvalenza: Number(c.veicolo.cessione.minusvalenza),
          minusvalenzaDeducibile: Number(c.veicolo.cessione.minusvalenzaDeducibile),
        } : null,
      } : null,
```

**Step 2: Update `src/app/api/cespiti/[id]/route.ts` GET handler**

Same pattern: add the veicolo include with finanziamento and cessione, and serialize decimal fields.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/app/api/cespiti/
git commit -m "feat: include vehicle data in cespiti API responses"
```

---

### Task 6: UI - Vehicle fields in operazione-form.tsx

**Files:**
- Modify: `src/app/operazioni/operazione-form.tsx`

**Context:** The form already handles CESPITE with aliquotaAmmortamento input and piano preview. We add a toggle "E' un veicolo?" that shows vehicle-specific fields. The form already has a "Spesa Ricorrente" section pattern to follow.

**Step 1: Add imports**

Add at the top with existing imports:
```typescript
import {
  getLimiteFiscale,
  getPercentualiUso,
  calcolaBaseFiscale,
  calcolaTotaleInteressi,
  TIPO_VEICOLO_LABELS,
  USO_VEICOLO_LABELS,
  MODALITA_ACQUISTO_LABELS,
} from "@/lib/calcoli-veicoli";
import type { TipoVeicolo, UsoVeicolo } from "@/lib/calcoli-veicoli";
import { Car, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
```

**Step 2: Add vehicle state variables**

After existing state declarations (near the ricorrenza state), add:
```typescript
  // Vehicle state
  const [isVeicolo, setIsVeicolo] = useState(false);
  const [tipoVeicolo, setTipoVeicolo] = useState<TipoVeicolo>("AUTOVETTURA");
  const [usoVeicolo, setUsoVeicolo] = useState<UsoVeicolo>("PROMISCUO");
  const [modalitaAcquisto, setModalitaAcquisto] = useState<"CONTANTI" | "FINANZIAMENTO">("CONTANTI");
  const [marca, setMarca] = useState("");
  const [modelloVeicolo, setModelloVeicolo] = useState("");
  const [targa, setTarga] = useState("");
  // Financing state
  const [anticipoFinanziamento, setAnticipoFinanziamento] = useState("");
  const [importoFinanziato, setImportoFinanziato] = useState("");
  const [numeroRate, setNumeroRate] = useState("");
  const [importoRata, setImportoRata] = useState("");
  const [tan, setTan] = useState("");
  const [dataPrimaRata, setDataPrimaRata] = useState("");
```

**Step 3: Add computed fiscal values memo**

```typescript
  const veicoloFiscale = useMemo(() => {
    if (!isVeicolo) return null;
    const limiteFiscale = getLimiteFiscale(tipoVeicolo, usoVeicolo);
    const percentuali = getPercentualiUso(usoVeicolo);
    const importoNum = parseFloat(importoTotale) || 0;
    const ivaIndetNum = parseFloat(String(ivaIndetraibileCalc)) || 0;
    const baseFiscale = calcolaBaseFiscale(importoNum, ivaIndetNum, limiteFiscale);
    const superaLimite = (importoNum + ivaIndetNum) > limiteFiscale && limiteFiscale !== Infinity;

    return {
      limiteFiscale,
      baseFiscale,
      superaLimite,
      ...percentuali,
    };
  }, [isVeicolo, tipoVeicolo, usoVeicolo, importoTotale, ivaIndetraibileCalc]);

  const finanziamentoPreview = useMemo(() => {
    if (!isVeicolo || modalitaAcquisto !== "FINANZIAMENTO") return null;
    const impFin = parseFloat(importoFinanziato) || 0;
    const nRate = parseInt(numeroRate) || 0;
    const impRata = parseFloat(importoRata) || 0;
    const tanVal = tan ? parseFloat(tan) : null;

    if (impFin <= 0 || nRate <= 0 || impRata <= 0) return null;

    const totInteressi = calcolaTotaleInteressi(impFin, nRate, impRata, tanVal);
    const percDeduc = veicoloFiscale?.deducibilita || 20;
    const interessiDeducibili = Math.round((totInteressi * percDeduc / 100) * 100) / 100;

    return {
      totaleInteressi: Math.round(totInteressi * 100) / 100,
      interessiDeducibili,
      totalePagato: Math.round((impRata * nRate + (parseFloat(anticipoFinanziamento) || 0)) * 100) / 100,
    };
  }, [isVeicolo, modalitaAcquisto, importoFinanziato, numeroRate, importoRata, tan, anticipoFinanziamento, veicoloFiscale]);
```

**Step 4: Auto-calculate importoFinanziato when anticipo changes**

```typescript
  useEffect(() => {
    if (isVeicolo && modalitaAcquisto === "FINANZIAMENTO") {
      const importoNum = parseFloat(importoTotale) || 0;
      const anticipoNum = parseFloat(anticipoFinanziamento) || 0;
      setImportoFinanziato(String(Math.max(0, importoNum - anticipoNum)));
    }
  }, [importoTotale, anticipoFinanziamento, isVeicolo, modalitaAcquisto]);
```

**Step 5: Add the vehicle UI section in the JSX**

After the existing "Dati Cespite" section (the aliquotaAmmortamento input and piano preview), add the vehicle section. This should be inside the `tipoOperazione === "CESPITE"` conditional:

```tsx
              {/* Vehicle toggle and fields */}
              {tipoOperazione === "CESPITE" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="h-5 w-5" />
                      Veicolo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="isVeicolo"
                        checked={isVeicolo}
                        onCheckedChange={setIsVeicolo}
                      />
                      <Label htmlFor="isVeicolo">E' un veicolo?</Label>
                    </div>

                    {isVeicolo && (
                      <div className="space-y-4 pt-2">
                        {/* Vehicle identification */}
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Marca *</Label>
                            <Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="es. Fiat" />
                          </div>
                          <div className="space-y-2">
                            <Label>Modello *</Label>
                            <Input value={modelloVeicolo} onChange={(e) => setModelloVeicolo(e.target.value)} placeholder="es. Panda" />
                          </div>
                          <div className="space-y-2">
                            <Label>Targa *</Label>
                            <Input value={targa} onChange={(e) => setTarga(e.target.value.toUpperCase())} placeholder="es. AB123CD" />
                          </div>
                        </div>

                        {/* Type and usage selectors */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Tipo Veicolo</Label>
                            <Select value={tipoVeicolo} onValueChange={(v) => setTipoVeicolo(v as TipoVeicolo)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(TIPO_VEICOLO_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Uso Veicolo</Label>
                            <Select value={usoVeicolo} onValueChange={(v) => setUsoVeicolo(v as UsoVeicolo)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(USO_VEICOLO_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Auto-calculated fiscal info */}
                        {veicoloFiscale && (
                          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                            <p className="text-sm font-medium">Dati Fiscali (automatici)</p>
                            <div className="grid gap-2 sm:grid-cols-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Limite fiscale: </span>
                                <span className="font-mono font-medium">
                                  {veicoloFiscale.limiteFiscale === Infinity ? "Nessun limite" : formatCurrency(veicoloFiscale.limiteFiscale)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Deducibilita: </span>
                                <span className="font-mono font-medium">{veicoloFiscale.deducibilita}%</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">IVA detraibile: </span>
                                <span className="font-mono font-medium">{veicoloFiscale.detraibilitaIva}%</span>
                              </div>
                            </div>
                            {veicoloFiscale.superaLimite && (
                              <div className="flex items-center gap-2 text-amber-500 text-sm mt-2">
                                <AlertTriangle className="h-4 w-4" />
                                <span>Il valore del bene supera il limite fiscale. L'ammortamento sara calcolato su {formatCurrency(veicoloFiscale.baseFiscale)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Purchase method */}
                        <div className="space-y-2">
                          <Label>Modalita Acquisto</Label>
                          <Select value={modalitaAcquisto} onValueChange={(v) => setModalitaAcquisto(v as "CONTANTI" | "FINANZIAMENTO")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(MODALITA_ACQUISTO_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Financing fields */}
                        {modalitaAcquisto === "FINANZIAMENTO" && (
                          <div className="space-y-4 rounded-lg border p-4">
                            <p className="text-sm font-medium">Dati Finanziamento</p>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Anticipo versato</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={anticipoFinanziamento}
                                  onChange={(e) => setAnticipoFinanziamento(e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Importo finanziato *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={importoFinanziato}
                                  onChange={(e) => setImportoFinanziato(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Numero rate *</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={numeroRate}
                                  onChange={(e) => setNumeroRate(e.target.value)}
                                  placeholder="es. 48"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Importo rata mensile *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={importoRata}
                                  onChange={(e) => setImportoRata(e.target.value)}
                                  placeholder="es. 350.00"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                  TAN %
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Tasso Annuo Nominale - lo trovi nel contratto di finanziamento.<br/>Se non lo inserisci, gli interessi saranno calcolati linearmente.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={tan}
                                  onChange={(e) => setTan(e.target.value)}
                                  placeholder="es. 5.50 (opzionale)"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Data prima rata *</Label>
                                <Input
                                  type="date"
                                  value={dataPrimaRata}
                                  onChange={(e) => setDataPrimaRata(e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Financing preview */}
                            {finanziamentoPreview && (
                              <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Totale interessi:</span>
                                  <span className="font-mono">{formatCurrency(finanziamentoPreview.totaleInteressi)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Interessi deducibili ({veicoloFiscale?.deducibilita}%):</span>
                                  <span className="font-mono">{formatCurrency(finanziamentoPreview.interessiDeducibili)}</span>
                                </div>
                                <div className="flex justify-between font-medium">
                                  <span className="text-muted-foreground">Totale pagato (anticipo + rate):</span>
                                  <span className="font-mono">{formatCurrency(finanziamentoPreview.totalePagato)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
```

**Step 6: Modify handleSave to include vehicle data**

In the `handleSave` function, when building the body for the POST request, add vehicle fields:

```typescript
      // Add vehicle data if applicable
      if (tipoOperazione === "CESPITE" && isVeicolo) {
        Object.assign(body, {
          isVeicolo: true,
          tipoVeicolo,
          usoVeicolo,
          modalitaAcquisto,
          marca,
          modelloVeicolo,
          targa,
        });

        if (modalitaAcquisto === "FINANZIAMENTO") {
          Object.assign(body, {
            importoFinanziato: parseFloat(importoFinanziato),
            anticipoFinanziamento: parseFloat(anticipoFinanziamento) || 0,
            numeroRate: parseInt(numeroRate),
            importoRata: parseFloat(importoRata),
            tan: tan ? parseFloat(tan) : null,
            dataPrimaRata,
          });
        }
      }
```

**Step 7: When isVeicolo, override IVA detraibilita and deducibilita percentages**

The vehicle's fiscal percentages should override the category defaults. Add logic to update the IVA/deducibilita fields when vehicle usage changes.

**Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 9: Commit**

```bash
git add src/app/operazioni/operazione-form.tsx
git commit -m "feat: add vehicle toggle and fields to operation form with fiscal preview"
```

---

### Task 7: UI - Vehicle details in cespite detail page

**Files:**
- Modify: `src/app/operazioni/cespiti/[id]/page.tsx`

**Context:** The cespite detail page (client component) shows 3 cards: Riepilogo, Attribuzione Soci, Piano Ammortamento. We add a 4th card for vehicle data (tipo, uso, targa, financing info) and a "Registra Cessione" button with dialog for vehicles in IN_AMMORTAMENTO state.

**Step 1: Add vehicle type definitions**

After the existing `CespiteDetail` type, add:
```typescript
type VeicoloDetail = {
  id: number;
  tipoVeicolo: string;
  usoVeicolo: string;
  modalitaAcquisto: string;
  marca: string;
  modello: string;
  targa: string;
  limiteFiscale: number;
  percentualeDeducibilita: number;
  percentualeDetraibilitaIva: number;
  finanziamento: {
    importoFinanziato: number;
    anticipo: number;
    numeroRate: number;
    importoRata: number;
    tan: number | null;
    dataPrimaRata: string;
    operazioneRicorrente: {
      id: number;
      attiva: boolean;
      rateRimanenti: number | null;
    } | null;
  } | null;
  cessione: {
    dataCessione: string;
    prezzoVendita: number;
    valoreResiduoContabile: number;
    plusvalenza: number;
    plusvalenzaImponibile: number;
    minusvalenza: number;
    minusvalenzaDeducibile: number;
  } | null;
};
```

Add `veicolo: VeicoloDetail | null` to the `CespiteDetail` type.

**Step 2: Add imports for Dialog, and vehicle labels**

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, HandCoins } from "lucide-react";
import {
  TIPO_VEICOLO_LABELS,
  USO_VEICOLO_LABELS,
  MODALITA_ACQUISTO_LABELS,
  calcolaCessione,
} from "@/lib/calcoli-veicoli";
```

**Step 3: Add cessione state and handler**

```typescript
  const [showCessione, setShowCessione] = useState(false);
  const [dataCessione, setDataCessione] = useState(new Date().toISOString().split("T")[0]);
  const [prezzoVendita, setPrezzoVendita] = useState("");
  const [cessionePreview, setCessionePreview] = useState<any>(null);
  const [cessioneLoading, setCessioneLoading] = useState(false);

  // Live preview of cessione calculation
  useEffect(() => {
    if (cespite?.veicolo && prezzoVendita) {
      const prezzo = parseFloat(prezzoVendita);
      if (!isNaN(prezzo) && prezzo >= 0) {
        const result = calcolaCessione(
          prezzo,
          cespite.valoreIniziale,
          cespite.fondoAmmortamento,
          cespite.veicolo.percentualeDeducibilita
        );
        setCessionePreview(result);
      }
    } else {
      setCessionePreview(null);
    }
  }, [prezzoVendita, cespite]);

  async function handleCessione() {
    if (!cespite) return;
    setCessioneLoading(true);
    try {
      const res = await fetch(`/api/cespiti/${cespite.id}/cessione`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataCessione,
          prezzoVendita: parseFloat(prezzoVendita),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success("Cessione registrata con successo");
      setShowCessione(false);
      // Reload data
      const resData = await fetch(`/api/cespiti/${params.id}`);
      const data = await resData.json();
      setCespite(data);
    } catch (error: any) {
      toast.error(error.message || "Errore nella registrazione della cessione");
    } finally {
      setCessioneLoading(false);
    }
  }
```

**Step 4: Add Vehicle Info card in JSX (after Riepilogo card)**

```tsx
      {/* Card: Dati Veicolo */}
      {cespite.veicolo && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Dati Veicolo
              </CardTitle>
              {cespite.stato === "IN_AMMORTAMENTO" && (
                <Dialog open={showCessione} onOpenChange={setShowCessione}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <HandCoins className="mr-2 h-4 w-4" />
                      Registra Cessione
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cessione Veicolo</DialogTitle>
                      <DialogDescription>
                        Registra la vendita di {cespite.veicolo.marca} {cespite.veicolo.modello} ({cespite.veicolo.targa})
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Data Cessione</Label>
                        <Input type="date" value={dataCessione} onChange={(e) => setDataCessione(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Prezzo di Vendita</Label>
                        <Input type="number" step="0.01" min="0" value={prezzoVendita} onChange={(e) => setPrezzoVendita(e.target.value)} placeholder="0.00" />
                      </div>
                      {cessionePreview && (
                        <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Valore residuo contabile:</span>
                            <span className="font-mono">{formatCurrency(cessionePreview.valoreResiduoContabile)}</span>
                          </div>
                          {cessionePreview.plusvalenza > 0 && (
                            <>
                              <div className="flex justify-between text-green-500">
                                <span>Plusvalenza:</span>
                                <span className="font-mono">{formatCurrency(cessionePreview.plusvalenza)}</span>
                              </div>
                              <div className="flex justify-between text-green-500">
                                <span>Plusvalenza imponibile:</span>
                                <span className="font-mono font-medium">{formatCurrency(cessionePreview.plusvalenzaImponibile)}</span>
                              </div>
                            </>
                          )}
                          {cessionePreview.minusvalenza > 0 && (
                            <>
                              <div className="flex justify-between text-red-500">
                                <span>Minusvalenza:</span>
                                <span className="font-mono">{formatCurrency(cessionePreview.minusvalenza)}</span>
                              </div>
                              <div className="flex justify-between text-red-500">
                                <span>Minusvalenza deducibile:</span>
                                <span className="font-mono font-medium">{formatCurrency(cessionePreview.minusvalenzaDeducibile)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCessione(false)}>Annulla</Button>
                      <Button onClick={handleCessione} disabled={cessioneLoading || !prezzoVendita}>
                        {cessioneLoading ? "Registrazione..." : "Conferma Cessione"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Veicolo</p>
                <p className="font-medium">{cespite.veicolo.marca} {cespite.veicolo.modello}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Targa</p>
                <p className="font-medium font-mono">{cespite.veicolo.targa}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <p className="font-medium">{TIPO_VEICOLO_LABELS[cespite.veicolo.tipoVeicolo as keyof typeof TIPO_VEICOLO_LABELS] || cespite.veicolo.tipoVeicolo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uso</p>
                <p className="font-medium">{USO_VEICOLO_LABELS[cespite.veicolo.usoVeicolo as keyof typeof USO_VEICOLO_LABELS] || cespite.veicolo.usoVeicolo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Deducibilita</p>
                <p className="font-medium">{formatPercentuale(cespite.veicolo.percentualeDeducibilita)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">IVA Detraibile</p>
                <p className="font-medium">{formatPercentuale(cespite.veicolo.percentualeDetraibilitaIva)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modalita Acquisto</p>
                <p className="font-medium">{MODALITA_ACQUISTO_LABELS[cespite.veicolo.modalitaAcquisto] || cespite.veicolo.modalitaAcquisto}</p>
              </div>
              {cespite.veicolo.limiteFiscale < 999999 && (
                <div>
                  <p className="text-sm text-muted-foreground">Limite Fiscale</p>
                  <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.limiteFiscale)}</p>
                </div>
              )}
            </div>

            {/* Financing info */}
            {cespite.veicolo.finanziamento && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-sm font-medium">Finanziamento</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Importo Finanziato</p>
                    <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.finanziamento.importoFinanziato)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Anticipo</p>
                    <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.finanziamento.anticipo)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rata Mensile</p>
                    <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.finanziamento.importoRata)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Numero Rate</p>
                    <p className="font-medium">{cespite.veicolo.finanziamento.numeroRate}</p>
                  </div>
                  {cespite.veicolo.finanziamento.tan != null && (
                    <div>
                      <p className="text-sm text-muted-foreground">TAN</p>
                      <p className="font-medium">{formatPercentuale(cespite.veicolo.finanziamento.tan)}</p>
                    </div>
                  )}
                  {cespite.veicolo.finanziamento.operazioneRicorrente && (
                    <div>
                      <p className="text-sm text-muted-foreground">Rate Rimanenti</p>
                      <p className="font-medium">
                        {cespite.veicolo.finanziamento.operazioneRicorrente.rateRimanenti ?? "N/D"}
                        {!cespite.veicolo.finanziamento.operazioneRicorrente.attiva && (
                          <Badge variant="outline" className="ml-2 text-xs">Terminato</Badge>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cessione info (if sold) */}
            {cespite.veicolo.cessione && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-sm font-medium">Cessione</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Data Cessione</p>
                    <p className="font-medium font-mono">{formatDate(cespite.veicolo.cessione.dataCessione)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Prezzo Vendita</p>
                    <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.cessione.prezzoVendita)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valore Residuo</p>
                    <p className="font-medium font-mono">{formatCurrency(cespite.veicolo.cessione.valoreResiduoContabile)}</p>
                  </div>
                  {cespite.veicolo.cessione.plusvalenza > 0 && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Plusvalenza</p>
                        <p className="font-medium font-mono text-green-500">{formatCurrency(cespite.veicolo.cessione.plusvalenza)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Plusvalenza Imponibile</p>
                        <p className="font-medium font-mono text-green-500">{formatCurrency(cespite.veicolo.cessione.plusvalenzaImponibile)}</p>
                      </div>
                    </>
                  )}
                  {cespite.veicolo.cessione.minusvalenza > 0 && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Minusvalenza</p>
                        <p className="font-medium font-mono text-red-500">{formatCurrency(cespite.veicolo.cessione.minusvalenza)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Minusvalenza Deducibile</p>
                        <p className="font-medium font-mono text-red-500">{formatCurrency(cespite.veicolo.cessione.minusvalenzaDeducibile)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/app/operazioni/cespiti/[id]/page.tsx
git commit -m "feat: add vehicle details and cessione dialog to cespite detail page"
```

---

### Task 8: UI - Vehicle icon and info in cespiti list

**Files:**
- Modify: `src/app/operazioni/cespiti/cespiti-list.tsx`

**Context:** The cespiti list table already shows all cespiti. We add a vehicle icon (Car) next to the description for vehicle cespiti, and optionally show the targa.

**Step 1: Update the CespiteRow type to include veicolo data**

Add to the existing type:
```typescript
  veicolo: {
    marca: string;
    modello: string;
    targa: string;
    tipoVeicolo: string;
    usoVeicolo: string;
    modalitaAcquisto: string;
  } | null;
```

**Step 2: Add Car icon import**

```typescript
import { Car } from "lucide-react";
```

**Step 3: Update the description column rendering**

In the description `TableCell`, show the car icon and targa:
```tsx
<TableCell>
  <div className="flex items-center gap-2">
    {c.veicolo && <Car className="h-4 w-4 text-muted-foreground shrink-0" />}
    <div>
      <p className="font-medium">{c.descrizione}</p>
      {c.veicolo && (
        <p className="text-xs text-muted-foreground">
          {c.veicolo.marca} {c.veicolo.modello} - {c.veicolo.targa}
        </p>
      )}
    </div>
  </div>
</TableCell>
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/operazioni/cespiti/cespiti-list.tsx
git commit -m "feat: show vehicle icon and info in cespiti list"
```

---

### Task 9: Override IVA and deducibilita when vehicle is selected

**Files:**
- Modify: `src/app/operazioni/operazione-form.tsx`

**Context:** When the user toggles "E' un veicolo?" and selects the usage type, the IVA detraibilita and deducibilita percentages should be automatically overridden from the vehicle fiscal rules instead of using the category defaults. This ensures correct fiscal treatment.

**Step 1: Add useEffect to override fiscal values when vehicle settings change**

When `isVeicolo` is true, the form should:
- Set `percentualeDetraibilitaIva` to the vehicle usage value
- Set deducibilita to the vehicle usage percentage
- Mark `deducibilitaCustom` as true (since it overrides the category default)
- Recalculate IVA amounts and deducibile amounts

This must integrate with the existing IVA calculation logic in the form. The exact implementation depends on how the form currently handles these values (find the relevant useEffect/onChange handlers).

**Step 2: When vehicle is toggled off, restore category defaults**

Reset the overridden values back to the category defaults when the toggle is turned off.

**Step 3: Also override the aliquotaAmmortamento to 25% for vehicles**

When `isVeicolo` is toggled on, auto-set `aliquotaAmmortamento` to 25 (the standard vehicle rate per DM 31/12/1988). The user can still change it if needed, but the default should be correct.

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/app/operazioni/operazione-form.tsx
git commit -m "feat: auto-override IVA and deducibilita when vehicle is selected"
```

---

### Task 10: TypeScript build verification and final cleanup

**Files:**
- All modified files

**Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

**Step 2: Test the dev server starts**

```bash
npx next dev -p 8080
```

Expected: Server starts without errors on port 8080.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve any remaining TypeScript errors for vehicle feature"
```
