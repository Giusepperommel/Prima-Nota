# Preset Ripartizione Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to create, order, and use predefined distribution presets as additional options alongside COMUNE/SINGOLO/CUSTOM in the operation form.

**Architecture:** New Prisma models (PresetRipartizione + PresetRipartizioneSocio) with CRUD API routes. New config page tab for managing presets with drag & drop ordering. Operation form extended with dynamic radio buttons for each preset, filtered by operation type.

**Tech Stack:** Prisma (MySQL), Next.js 16 App Router, Shadcn/ui, Tailwind CSS 4, Lucide icons

---

### Task 1: Add Prisma models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add PresetRipartizione and PresetRipartizioneSocio models**

Add after the `RipartizioneOperazione` model (line ~153):

```prisma
model PresetRipartizione {
  id            Int      @id @default(autoincrement())
  societaId     Int      @map("societa_id")
  nome          String   @db.VarChar(100)
  tipiOperazione Json    @map("tipi_operazione")
  ordinamento   Int      @default(0)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  societa Societa @relation(fields: [societaId], references: [id])
  soci    PresetRipartizioneSocio[]

  @@index([societaId, ordinamento])
  @@map("preset_ripartizioni")
}

model PresetRipartizioneSocio {
  id                    Int     @id @default(autoincrement())
  presetRipartizioneId  Int     @map("preset_ripartizione_id")
  socioId               Int     @map("socio_id")
  percentuale           Decimal @db.Decimal(5, 2)

  preset PresetRipartizione @relation(fields: [presetRipartizioneId], references: [id], onDelete: Cascade)
  socio  Socio              @relation(fields: [socioId], references: [id])

  @@index([presetRipartizioneId])
  @@index([socioId])
  @@map("preset_ripartizioni_soci")
}
```

Also add the reverse relations:
- In `Societa` model add: `presetRipartizioni PresetRipartizione[]`
- In `Socio` model add: `presetRipartizioni PresetRipartizioneSocio[]`

**Step 2: Run migration**

Run: `npx prisma migrate dev --name add-preset-ripartizioni`

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add PresetRipartizione and PresetRipartizioneSocio models"
```

---

### Task 2: Create API routes for preset CRUD

**Files:**
- Create: `src/app/api/preset-ripartizioni/route.ts`
- Create: `src/app/api/preset-ripartizioni/[id]/route.ts`
- Create: `src/app/api/preset-ripartizioni/riordina/route.ts`

**Step 1: Create GET + POST route**

Create `src/app/api/preset-ripartizioni/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const presets = await prisma.presetRipartizione.findMany({
      where: { societaId },
      include: {
        soci: {
          include: {
            socio: {
              select: { id: true, nome: true, cognome: true, attivo: true },
            },
          },
        },
      },
      orderBy: { ordinamento: "asc" },
    });

    const serialized = presets.map((p) => ({
      ...p,
      soci: p.soci.map((s) => ({
        ...s,
        percentuale: Number(s.percentuale),
      })),
    }));

    return NextResponse.json({ data: serialized });
  } catch (error) {
    console.error("Errore nel recupero dei preset:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const ruolo = user.ruolo as string;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const body = await request.json();
    const { nome, tipiOperazione, soci } = body;

    if (!nome || !tipiOperazione?.length || !soci?.length) {
      return NextResponse.json(
        { error: "Nome, tipi operazione e soci sono obbligatori" },
        { status: 400 }
      );
    }

    // Validate percentages sum to 100
    const somma = soci.reduce(
      (sum: number, s: { percentuale: number }) => sum + s.percentuale,
      0
    );
    if (Math.abs(somma - 100) > 0.01) {
      return NextResponse.json(
        { error: "La somma delle percentuali deve essere 100%" },
        { status: 400 }
      );
    }

    // Get max ordinamento
    const maxOrd = await prisma.presetRipartizione.aggregate({
      where: { societaId },
      _max: { ordinamento: true },
    });
    const nextOrd = (maxOrd._max.ordinamento ?? -1) + 1;

    const preset = await prisma.presetRipartizione.create({
      data: {
        societaId,
        nome,
        tipiOperazione,
        ordinamento: nextOrd,
        soci: {
          create: soci.map((s: { socioId: number; percentuale: number }) => ({
            socioId: s.socioId,
            percentuale: s.percentuale,
          })),
        },
      },
      include: {
        soci: {
          include: {
            socio: {
              select: { id: true, nome: true, cognome: true, attivo: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      ...preset,
      soci: preset.soci.map((s) => ({
        ...s,
        percentuale: Number(s.percentuale),
      })),
    });
  } catch (error) {
    console.error("Errore nella creazione del preset:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
```

**Step 2: Create PUT + DELETE route for single preset**

Create `src/app/api/preset-ripartizioni/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
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
    const ruolo = user.ruolo as string;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const { id } = await params;
    const presetId = parseInt(id, 10);
    const body = await request.json();
    const { nome, tipiOperazione, soci } = body;

    // Verify ownership
    const existing = await prisma.presetRipartizione.findFirst({
      where: { id: presetId, societaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Preset non trovato" }, { status: 404 });
    }

    // Validate percentages
    if (soci) {
      const somma = soci.reduce(
        (sum: number, s: { percentuale: number }) => sum + s.percentuale,
        0
      );
      if (Math.abs(somma - 100) > 0.01) {
        return NextResponse.json(
          { error: "La somma delle percentuali deve essere 100%" },
          { status: 400 }
        );
      }
    }

    const preset = await prisma.$transaction(async (tx) => {
      // Update preset fields
      await tx.presetRipartizione.update({
        where: { id: presetId },
        data: {
          ...(nome && { nome }),
          ...(tipiOperazione && { tipiOperazione }),
        },
      });

      // Replace soci if provided
      if (soci) {
        await tx.presetRipartizioneSocio.deleteMany({
          where: { presetRipartizioneId: presetId },
        });
        await tx.presetRipartizioneSocio.createMany({
          data: soci.map((s: { socioId: number; percentuale: number }) => ({
            presetRipartizioneId: presetId,
            socioId: s.socioId,
            percentuale: s.percentuale,
          })),
        });
      }

      return tx.presetRipartizione.findUnique({
        where: { id: presetId },
        include: {
          soci: {
            include: {
              socio: {
                select: { id: true, nome: true, cognome: true, attivo: true },
              },
            },
          },
        },
      });
    });

    return NextResponse.json({
      ...preset,
      soci: preset!.soci.map((s) => ({
        ...s,
        percentuale: Number(s.percentuale),
      })),
    });
  } catch (error) {
    console.error("Errore nell'aggiornamento del preset:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const ruolo = user.ruolo as string;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const { id } = await params;
    const presetId = parseInt(id, 10);

    const existing = await prisma.presetRipartizione.findFirst({
      where: { id: presetId, societaId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Preset non trovato" }, { status: 404 });
    }

    await prisma.presetRipartizione.delete({ where: { id: presetId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nell'eliminazione del preset:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
```

**Step 3: Create reorder route**

Create `src/app/api/preset-ripartizioni/riordina/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const ruolo = user.ruolo as string;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const body = await request.json();
    const { ordine } = body; // Array of { id: number, ordinamento: number }

    if (!ordine || !Array.isArray(ordine)) {
      return NextResponse.json(
        { error: "Array ordine obbligatorio" },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      ordine.map((item: { id: number; ordinamento: number }) =>
        prisma.presetRipartizione.update({
          where: { id: item.id },
          data: { ordinamento: item.ordinamento },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nel riordino dei preset:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
```

**Step 4: Commit**

```bash
git add src/app/api/preset-ripartizioni/
git commit -m "feat: add CRUD API routes for preset ripartizioni"
```

---

### Task 3: Create configuration page for presets

**Files:**
- Create: `src/app/configurazione/ripartizioni/page.tsx`
- Create: `src/app/configurazione/ripartizioni/preset-ripartizioni-client.tsx`
- Modify: `src/components/layout/app-sidebar.tsx` (add nav item)

**Step 1: Create the server page component**

Create `src/app/configurazione/ripartizioni/page.tsx`:

```typescript
import { requireAdmin } from "@/lib/session";
import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { prisma } from "@/lib/prisma";
import { PresetRipartizioniClient } from "./preset-ripartizioni-client";

export default async function PresetRipartizioniPage() {
  const user = await requireAdmin();

  const [presets, soci] = await Promise.all([
    prisma.presetRipartizione.findMany({
      where: { societaId: user.societaId! },
      include: {
        soci: {
          include: {
            socio: {
              select: { id: true, nome: true, cognome: true, attivo: true },
            },
          },
        },
      },
      orderBy: { ordinamento: "asc" },
    }),
    prisma.socio.findMany({
      where: { societaId: user.societaId! },
      select: { id: true, nome: true, cognome: true, attivo: true },
      orderBy: [{ attivo: "desc" }, { cognome: "asc" }],
    }),
  ]);

  const serializedPresets = presets.map((p) => ({
    ...p,
    soci: p.soci.map((s) => ({
      ...s,
      percentuale: Number(s.percentuale),
    })),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <AuthenticatedLayout user={user} pageTitle="Preset di Ripartizione">
      <PresetRipartizioniClient
        initialPresets={serializedPresets}
        soci={soci}
      />
    </AuthenticatedLayout>
  );
}
```

**Step 2: Create the client component**

Create `src/app/configurazione/ripartizioni/preset-ripartizioni-client.tsx` — a full client component with:

- List of presets as cards, each showing: name, associated operation types (as badges), percentages per socio
- Warning badge (orange `AlertTriangle`) on presets containing inactive soci
- Drag & drop reordering (using up/down arrow buttons for simplicity — `ArrowUp`/`ArrowDown` from lucide)
- Dialog for create/edit with:
  - Name input
  - Checkboxes for operation types (FATTURA_ATTIVA, COSTO, CESPITE)
  - Table of soci with percentage inputs
  - Validation: sum must be 100%
- Delete with confirmation dialog
- Toast notifications for success/error

The component should follow the same patterns as `src/app/configurazione/categorie/categorie-table.tsx` (using shadcn Dialog, Table, Input, Button, Badge, etc.).

Key imports to use:
```typescript
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Pencil, Trash2, ArrowUp, ArrowDown, AlertTriangle, Loader2,
} from "lucide-react";
import { formatPercentuale } from "@/lib/business-utils";
```

Operation type labels map:
```typescript
const TIPO_OPERAZIONE_LABELS: Record<string, string> = {
  FATTURA_ATTIVA: "Fattura Attiva",
  COSTO: "Costo",
  CESPITE: "Cespite",
};
```

**Step 3: Add navigation item in sidebar**

Modify `src/components/layout/app-sidebar.tsx`:

Add import: `import { SplitSquareHorizontal } from "lucide-react";` (or `Percent`)

Add to `adminNavItems` array (after "Ricorrenze"):
```typescript
{ title: "Ripartizioni", href: "/configurazione/ripartizioni", icon: SplitSquareHorizontal },
```

**Step 4: Commit**

```bash
git add src/app/configurazione/ripartizioni/ src/components/layout/app-sidebar.tsx
git commit -m "feat: add preset ripartizioni configuration page with CRUD and reordering"
```

---

### Task 4: Integrate presets into the operation form

**Files:**
- Modify: `src/app/operazioni/operazione-form.tsx`
- Modify: `src/app/operazioni/nuova/page.tsx` (pass presets as prop)
- Modify: `src/app/operazioni/[id]/page.tsx` (pass presets as prop)

**Step 1: Update the parent pages to fetch and pass presets**

In both `src/app/operazioni/nuova/page.tsx` and `src/app/operazioni/[id]/page.tsx`, add a Prisma query to fetch presets for the user's societa (same as in config page), and pass them as a `presets` prop to `<OperazioneForm>`.

**Step 2: Add presets prop to OperazioneForm**

In `src/app/operazioni/operazione-form.tsx`:

Add a new type:
```typescript
type PresetRipartizione = {
  id: number;
  nome: string;
  tipiOperazione: string[];
  ordinamento: number;
  soci: {
    socioId: number;
    percentuale: number;
    socio: { id: number; nome: string; cognome: string; attivo: boolean };
  }[];
};
```

Add `presets` to the component props:
```typescript
presets?: PresetRipartizione[];
```

**Step 3: Filter presets by current operation type**

Add a `useMemo` that filters presets by the currently selected `tipoOperazione`:
```typescript
const presetsDisponibili = useMemo(() => {
  if (!presets) return [];
  return presets
    .filter((p) => p.tipiOperazione.includes(tipoOperazione))
    .sort((a, b) => a.ordinamento - b.ordinamento);
}, [presets, tipoOperazione]);
```

**Step 4: Extend the RadioGroup**

After the existing CUSTOM radio button (line ~1513), add dynamic radio buttons for each preset:

```tsx
{presetsDisponibili.map((preset) => {
  const hasInactiveSocio = preset.soci.some((s) => !s.socio.attivo);
  return (
    <div key={preset.id} className="flex items-center space-x-2">
      <RadioGroupItem
        value={`PRESET_${preset.id}`}
        id={`rip-preset-${preset.id}`}
      />
      <Label
        htmlFor={`rip-preset-${preset.id}`}
        className="cursor-pointer font-normal flex items-center gap-1.5"
      >
        {preset.nome}
        {hasInactiveSocio && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
              </TooltipTrigger>
              <TooltipContent>
                Contiene soci inattivi
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Label>
    </div>
  );
})}
```

Change the RadioGroup `className` from `grid grid-cols-3` to adapt dynamically:
```tsx
className="flex flex-wrap gap-3"
```

**Step 5: Add preset preview table**

After the CUSTOM section (line ~1664), add a preview for selected presets:

```tsx
{tipoRipartizione.startsWith("PRESET_") && (() => {
  const presetId = parseInt(tipoRipartizione.replace("PRESET_", ""), 10);
  const preset = presetsDisponibili.find((p) => p.id === presetId);
  if (!preset) return null;
  const importo = parseFloat(importoTotale) || 0;
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Socio</TableHead>
            <TableHead className="text-right">Quota %</TableHead>
            <TableHead className="text-right">Importo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preset.soci.map((s) => {
            const amount = Math.round(((importo * s.percentuale) / 100) * 100) / 100;
            return (
              <TableRow key={s.socioId}>
                <TableCell className="flex items-center gap-1.5">
                  {s.socio.cognome} {s.socio.nome}
                  {!s.socio.attivo && (
                    <Badge variant="outline" className="text-orange-500 border-orange-500/25 text-xs">
                      Inattivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatPercentuale(s.percentuale)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(amount)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
})()}
```

**Step 6: Add helper link**

After the RadioGroup closing tag, add:
```tsx
<div className="text-sm">
  <a
    href="/configurazione/ripartizioni"
    className="text-primary hover:underline inline-flex items-center gap-1"
  >
    Gestisci preset di ripartizione →
  </a>
</div>
```

**Step 7: Update form submission logic**

In the `handleSubmit` function, when `tipoRipartizione` starts with `PRESET_`:
- Extract the preset's soci percentages
- Set `tipoRipartizione` to `"CUSTOM"` in the payload (the DB enum stays the same)
- Set `ripartizioniCustom` from the preset's soci data

```typescript
// Before building the payload, normalize preset to CUSTOM
let effectiveTipoRipartizione = tipoRipartizione;
let effectiveRipartizioniCustom = undefined;

if (tipoRipartizione.startsWith("PRESET_")) {
  const presetId = parseInt(tipoRipartizione.replace("PRESET_", ""), 10);
  const preset = presetsDisponibili.find((p) => p.id === presetId);
  if (preset) {
    effectiveTipoRipartizione = "CUSTOM";
    effectiveRipartizioniCustom = preset.soci.map((s) => ({
      socioId: s.socioId,
      percentuale: s.percentuale,
    }));
  }
}
```

Then use `effectiveTipoRipartizione` and `effectiveRipartizioniCustom` in the payload.

Also remove the CUSTOM validation check when a preset is selected (since preset percentages are already validated).

**Step 8: Handle editing existing operations that were created with a preset**

When loading an existing operation with `tipoRipartizione === "CUSTOM"`, it will correctly show as CUSTOM. No special handling needed — presets are just a convenience for input, the stored data is always CUSTOM.

**Step 9: Commit**

```bash
git add src/app/operazioni/
git commit -m "feat: integrate preset ripartizioni into operation form"
```

---

### Task 5: Final polish and testing

**Files:**
- All files from previous tasks

**Step 1: Manual testing checklist**

1. Create a preset with 50/50 distribution for COSTO + FATTURA_ATTIVA
2. Create a preset with 70/30 for only COSTO
3. Verify reordering works (move preset up/down)
4. Create a new COSTO operation → both presets should appear
5. Create a new FATTURA_ATTIVA → only the 50/50 preset should appear
6. Create a new CESPITE → no presets should appear (none configured)
7. Select a preset and verify the preview table shows correct amounts
8. Submit the operation and verify ripartizioni are saved correctly
9. Deactivate a socio and verify orange warning appears on affected presets
10. Verify the "Gestisci preset" link navigates correctly
11. Edit a preset, delete a preset
12. Verify sidebar navigation item appears for admin users

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during testing"
```
