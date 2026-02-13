# Registrazione con Verifica Email OTP - Piano di Implementazione

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Aggiungere self-registration con verifica email OTP a 5 cifre (1 ora scadenza) usando Resend.

**Architecture:** Nuova tabella `VerificaEmail` per i codici OTP. Il `Socio.societaId` diventa nullable per supportare utenti appena registrati senza società. Nuove API routes per registrazione, verifica e reinvio codice. Nuovo ruolo `SUPER_ADMIN` per lo sviluppatore.

**Tech Stack:** Next.js 16, Prisma (MySQL), NextAuth v5 beta, Resend, bcryptjs, Zod, shadcn/ui

**Design doc:** `docs/plans/2025-02-13-registrazione-verifica-email-design.md`

---

## Task 1: Installare dipendenza Resend

**Files:**
- Modify: `package.json`

**Step 1: Installare resend**

```bash
npm install resend
```

**Step 2: Aggiungere variabili ambiente**

Aggiungere a `.env`:
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@tuodominio.com
```

> Nota: per sviluppo locale si può usare la test API key di Resend. Registrarsi su https://resend.com per ottenere la chiave.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add resend dependency for email OTP"
```

---

## Task 2: Aggiornare schema Prisma

**Files:**
- Modify: `prisma/schema.prisma` (linee 29-48 per Socio, 50-63 per Utente, 148-153 per enum)

**Step 1: Aggiungere SUPER_ADMIN all'enum RuoloUtente**

In `prisma/schema.prisma`, l'enum `RuoloUtente` (linea 148) diventa:

```prisma
enum RuoloUtente {
  ADMIN
  STANDARD
  SUPER_ADMIN

  @@map("ruolo_utente")
}
```

**Step 2: Rendere societaId nullable nel model Socio**

In `prisma/schema.prisma`, il model `Socio` (linea 29):

Cambiare la linea 31:
```
  societaId         Int      @map("societa_id")
```
in:
```
  societaId         Int?     @map("societa_id")
```

Cambiare la linea 43:
```
  societa              Societa @relation(fields: [societaId], references: [id])
```
in:
```
  societa              Societa? @relation(fields: [societaId], references: [id])
```

**Step 3: Aggiungere emailVerificata al model Utente**

In `prisma/schema.prisma`, nel model `Utente` (linea 50), aggiungere dopo `passwordHash` (linea 54):

```
  emailVerificata Boolean @default(false) @map("email_verificata")
```

**Step 4: Aggiungere il model VerificaEmail**

Aggiungere prima degli enum (prima della linea 148):

```prisma
model VerificaEmail {
  id         Int      @id @default(autoincrement())
  email      String   @db.VarChar(255)
  codice     String   @db.VarChar(5)
  scadenza   DateTime
  verificato Boolean  @default(false)
  tentativi  Int      @default(0)
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([email, verificato, scadenza])
  @@map("verifica_email")
}
```

**Step 5: Creare la migration**

```bash
npx prisma migrate dev --name add_verifica_email_and_registration_fields
```

> Nota: Prisma chiederà conferma perché `societaId` diventa nullable. Accettare.

**Step 6: Verificare che il client Prisma si rigeneri**

```bash
npx prisma generate
```

**Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add VerificaEmail model, nullable societaId, emailVerificata field, SUPER_ADMIN role"
```

---

## Task 3: Creare utility invio email

**Files:**
- Create: `src/lib/email.ts`

**Step 1: Creare il file email utility**

Creare `src/lib/email.ts`:

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export async function inviaOtpEmail(
  email: string,
  nome: string,
  codice: string
) {
  const { error } = await resend.emails.send({
    from: `Prima Nota <${fromEmail}>`,
    to: email,
    subject: `Il tuo codice di verifica: ${codice}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a; margin-bottom: 16px;">Prima Nota</h2>
        <p>Ciao ${nome},</p>
        <p>Il tuo codice di verifica per Prima Nota è:</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${codice}</span>
        </div>
        <p style="color: #71717a; font-size: 14px;">Questo codice è valido per 1 ora.</p>
        <p style="color: #71717a; font-size: 14px;">Se non hai richiesto questo codice, puoi ignorare questa email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Errore invio email:", error);
    throw new Error("Impossibile inviare l'email di verifica");
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: add email utility for OTP with Resend"
```

---

## Task 4: Creare API registrazione

**Files:**
- Create: `src/app/api/auth/registrazione/route.ts`

**Step 1: Creare l'API route**

Creare `src/app/api/auth/registrazione/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { inviaOtpEmail } from "@/lib/email";

const registrazioneSchema = z.object({
  nome: z.string().min(1, "Nome obbligatorio").max(100),
  cognome: z.string().min(1, "Cognome obbligatorio").max(100),
  email: z.email("Email non valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registrazioneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { nome, cognome, email, password } = parsed.data;

    // Verifica email non già registrata
    const esistente = await prisma.utente.findUnique({
      where: { email },
    });

    if (esistente) {
      return NextResponse.json(
        { error: "Email già registrata" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Crea Socio + Utente in transazione
    await prisma.$transaction(async (tx) => {
      const socio = await tx.socio.create({
        data: {
          nome,
          cognome,
          email,
          codiceFiscale: "",
          quotaPercentuale: 0,
          ruolo: "ADMIN",
          societaId: null,
        },
      });

      await tx.utente.create({
        data: {
          socioId: socio.id,
          email,
          passwordHash,
          emailVerificata: false,
        },
      });
    });

    // Genera codice OTP 5 cifre
    const codice = String(crypto.randomInt(10000, 100000));

    // Salva codice in DB
    await prisma.verificaEmail.create({
      data: {
        email,
        codice,
        scadenza: new Date(Date.now() + 60 * 60 * 1000), // +1 ora
      },
    });

    // Invia email
    await inviaOtpEmail(email, nome, codice);

    return NextResponse.json(
      { message: "Registrazione completata. Controlla la tua email per il codice di verifica." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore registrazione:", error);
    return NextResponse.json(
      { error: "Errore durante la registrazione" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/auth/registrazione/route.ts
git commit -m "feat: add registration API endpoint with OTP generation"
```

---

## Task 5: Creare API verifica email

**Files:**
- Create: `src/app/api/auth/verifica-email/route.ts`

**Step 1: Creare l'API route**

Creare `src/app/api/auth/verifica-email/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";

const verificaSchema = z.object({
  email: z.email("Email non valida"),
  codice: z.string().length(5, "Il codice deve essere di 5 cifre"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verificaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, codice } = parsed.data;

    // Cerca ultimo codice non verificato e non scaduto
    const verifica = await prisma.verificaEmail.findFirst({
      where: {
        email,
        verificato: false,
        scadenza: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!verifica) {
      return NextResponse.json(
        { error: "Codice scaduto o non trovato. Richiedi un nuovo codice." },
        { status: 400 }
      );
    }

    // Controlla tentativi
    if (verifica.tentativi >= 5) {
      return NextResponse.json(
        { error: "Troppi tentativi errati. Richiedi un nuovo codice." },
        { status: 429 }
      );
    }

    // Verifica codice
    if (verifica.codice !== codice) {
      await prisma.verificaEmail.update({
        where: { id: verifica.id },
        data: { tentativi: verifica.tentativi + 1 },
      });

      const tentativiRimasti = 4 - verifica.tentativi;
      return NextResponse.json(
        { error: `Codice errato. ${tentativiRimasti} tentativi rimasti.` },
        { status: 400 }
      );
    }

    // Codice corretto: aggiorna tutto in transazione
    await prisma.$transaction([
      prisma.verificaEmail.update({
        where: { id: verifica.id },
        data: { verificato: true },
      }),
      prisma.utente.updateMany({
        where: { email },
        data: { emailVerificata: true },
      }),
    ]);

    return NextResponse.json(
      { message: "Email verificata con successo! Ora puoi accedere." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Errore verifica email:", error);
    return NextResponse.json(
      { error: "Errore durante la verifica" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/auth/verifica-email/route.ts
git commit -m "feat: add email verification API endpoint"
```

---

## Task 6: Creare API reinvio codice

**Files:**
- Create: `src/app/api/auth/rinvia-codice/route.ts`

**Step 1: Creare l'API route**

Creare `src/app/api/auth/rinvia-codice/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { inviaOtpEmail } from "@/lib/email";

const rinviaSchema = z.object({
  email: z.email("Email non valida"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = rinviaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Email non valida" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Verifica che l'utente esista e non sia già verificato
    const utente = await prisma.utente.findUnique({
      where: { email },
      include: { socio: true },
    });

    if (!utente || utente.emailVerificata) {
      // Non rivelare se l'email esiste o meno
      return NextResponse.json(
        { message: "Se l'email è registrata, riceverai un nuovo codice." },
        { status: 200 }
      );
    }

    // Rate limit: controlla ultimo invio
    const ultimoInvio = await prisma.verificaEmail.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    if (ultimoInvio) {
      const secondiPassati = (Date.now() - ultimoInvio.createdAt.getTime()) / 1000;
      if (secondiPassati < 60) {
        return NextResponse.json(
          { error: `Attendi ${Math.ceil(60 - secondiPassati)} secondi prima di richiedere un nuovo codice.` },
          { status: 429 }
        );
      }
    }

    // Invalida vecchi codici
    await prisma.verificaEmail.updateMany({
      where: { email, verificato: false },
      data: { verificato: true },
    });

    // Genera e salva nuovo codice
    const codice = String(crypto.randomInt(10000, 100000));

    await prisma.verificaEmail.create({
      data: {
        email,
        codice,
        scadenza: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Invia email
    await inviaOtpEmail(email, utente.socio.nome, codice);

    return NextResponse.json(
      { message: "Nuovo codice inviato. Controlla la tua email." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Errore reinvio codice:", error);
    return NextResponse.json(
      { error: "Errore durante il reinvio del codice" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/auth/rinvia-codice/route.ts
git commit -m "feat: add resend OTP code API endpoint with rate limiting"
```

---

## Task 7: Aggiornare auth.ts per gestire emailVerificata e societaId nullable

**Files:**
- Modify: `src/lib/auth.ts` (linee 14-46)
- Modify: `src/types/index.ts`

**Step 1: Aggiornare SessionUser type**

In `src/types/index.ts`, modificare il tipo:

```typescript
import type { RuoloUtente } from "@prisma/client";

export type SessionUser = {
  id: number;
  email: string;
  nome: string;
  cognome: string;
  ruolo: RuoloUtente;
  socioId: number;
  societaId: number | null;
  quotaPercentuale: number;
  emailVerificata: boolean;
};
```

**Step 2: Aggiornare la funzione authorize in auth.ts**

In `src/lib/auth.ts`, nella funzione `authorize` (linea 14), sostituire il blocco `return` (linee 37-46):

Da:
```typescript
        return {
          id: String(utente.id),
          email: utente.email,
          nome: utente.socio.nome,
          cognome: utente.socio.cognome,
          ruolo: utente.socio.ruolo,
          socioId: utente.socio.id,
          societaId: utente.socio.societaId,
          quotaPercentuale: Number(utente.socio.quotaPercentuale),
        };
```

A:
```typescript
        return {
          id: String(utente.id),
          email: utente.email,
          nome: utente.socio.nome,
          cognome: utente.socio.cognome,
          ruolo: utente.socio.ruolo,
          socioId: utente.socio.id,
          societaId: utente.socio.societaId,
          quotaPercentuale: Number(utente.socio.quotaPercentuale),
          emailVerificata: utente.emailVerificata,
        };
```

**Step 3: Aggiornare i callbacks JWT e session**

In `src/lib/auth.ts`, nel callback `jwt` (linea 51), aggiungere dopo `token.quotaPercentuale`:

```typescript
        token.emailVerificata = (user as any).emailVerificata;
```

Nel callback `session` (linea 63), aggiungere dopo `quotaPercentuale`:

```typescript
        (session.user as any).emailVerificata = token.emailVerificata;
```

**Step 4: Commit**

```bash
git add src/lib/auth.ts src/types/index.ts
git commit -m "feat: add emailVerificata and nullable societaId to auth session"
```

---

## Task 8: Aggiornare middleware per rotte pubbliche

**Files:**
- Modify: `src/middleware.ts` (linee 1-19)

**Step 1: Aggiornare il middleware**

Sostituire il contenuto di `src/middleware.ts`:

```typescript
import { auth } from "@/lib/auth";

const publicPaths = ["/login", "/registrazione", "/verifica-email", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Consenti accesso alle rotte pubbliche
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return;
  }

  // Se non autenticato, redirect a login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  // Se email non verificata, redirect a verifica
  const user = req.auth.user as any;
  if (user && !user.emailVerificata) {
    const verificaUrl = new URL("/verifica-email", req.url);
    verificaUrl.searchParams.set("email", user.email);
    return Response.redirect(verificaUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: update middleware for public registration routes and email verification check"
```

---

## Task 9: Creare pagina registrazione

**Files:**
- Create: `src/app/registrazione/page.tsx`

**Step 1: Creare la pagina**

Creare `src/app/registrazione/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegistrazionePage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const nome = formData.get("nome") as string;
    const cognome = formData.get("cognome") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confermaPassword = formData.get("confermaPassword") as string;

    if (password !== confermaPassword) {
      setError("Le password non corrispondono");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/registrazione", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, cognome, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Errore durante la registrazione");
        setLoading(false);
        return;
      }

      // Redirect a verifica email
      router.push(`/verifica-email?email=${encodeURIComponent(email)}`);
    } catch {
      setError("Errore di connessione. Riprova.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Crea il tuo account</CardTitle>
          <CardDescription>Registrati per iniziare a usare Prima Nota</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  name="nome"
                  placeholder="Mario"
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cognome">Cognome</Label>
                <Input
                  id="cognome"
                  name="cognome"
                  placeholder="Rossi"
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="mario.rossi@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Minimo 8 caratteri"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confermaPassword">Conferma password</Label>
              <Input
                id="confermaPassword"
                name="confermaPassword"
                type="password"
                placeholder="Ripeti la password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registrazione in corso..." : "Registrati"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center mt-4">
            Hai già un account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Accedi
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/registrazione/page.tsx
git commit -m "feat: add registration page UI"
```

---

## Task 10: Creare pagina verifica email OTP

**Files:**
- Create: `src/app/verifica-email/page.tsx`

**Step 1: Creare la pagina**

Creare `src/app/verifica-email/page.tsx`:

```tsx
"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function VerificaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [codice, setCodice] = useState(["", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer per reinvio
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Focus sul primo input al mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return; // Solo cifre

    const newCodice = [...codice];
    newCodice[index] = value.slice(-1); // Solo ultimo carattere
    setCodice(newCodice);
    setError("");

    // Auto-focus sul prossimo input
    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit quando tutte le cifre sono inserite
    if (value && index === 4) {
      const codiceCompleto = newCodice.join("");
      if (codiceCompleto.length === 5) {
        handleVerifica(codiceCompleto);
      }
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !codice[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 5);
    if (pasted.length === 5) {
      const newCodice = pasted.split("");
      setCodice(newCodice);
      inputRefs.current[4]?.focus();
      handleVerifica(pasted);
    }
  }

  async function handleVerifica(codiceStr: string) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verifica-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codice: codiceStr }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Errore durante la verifica");
        setCodice(["", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }

      setSuccess("Email verificata con successo! Reindirizzamento...");
      setTimeout(() => router.push("/login?verified=1"), 2000);
    } catch {
      setError("Errore di connessione. Riprova.");
      setLoading(false);
    }
  }

  async function handleRinvia() {
    if (cooldown > 0) return;

    try {
      const res = await fetch("/api/auth/rinvia-codice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setError(data.error);
        return;
      }

      setCodice(["", "", "", "", ""]);
      setError("");
      setSuccess("Nuovo codice inviato!");
      setCooldown(60);
      inputRefs.current[0]?.focus();
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Errore di connessione. Riprova.");
    }
  }

  if (!email) {
    return (
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">Nessuna email specificata.</p>
        <Link href="/registrazione">
          <Button variant="outline">Torna alla registrazione</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-center text-muted-foreground">
        Abbiamo inviato un codice a 5 cifre a<br />
        <span className="font-medium text-foreground">{email}</span>
      </p>

      <div className="flex justify-center gap-3" onPaste={handlePaste}>
        {codice.map((digit, i) => (
          <Input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-12 h-14 text-center text-2xl font-bold"
            disabled={loading}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 text-center">{success}</p>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={handleRinvia}
          disabled={cooldown > 0}
          className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {cooldown > 0
            ? `Rinvia codice tra ${cooldown}s`
            : "Non hai ricevuto il codice? Rinvia"}
        </button>
      </div>
    </div>
  );
}

export default function VerificaEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Verifica la tua email</CardTitle>
          <CardDescription>Inserisci il codice che ti abbiamo inviato</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <VerificaForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/verifica-email/page.tsx
git commit -m "feat: add OTP verification page with auto-submit and paste support"
```

---

## Task 11: Aggiornare pagina login

**Files:**
- Modify: `src/app/login/page.tsx` (linee 1-91)

**Step 1: Aggiungere link registrazione e messaggio verifica**

In `src/app/login/page.tsx`:

1. Aggiungere import `Link` dopo le altre import (linea 5):
```typescript
import Link from "next/link";
```

2. Nella funzione `LoginForm`, aggiungere dopo la riga `const [loading, setLoading] = useState(false);` (linea 16):
```typescript
  const verified = searchParams.get("verified");
```

3. Aggiungere prima del tag `<form>` (linea 43), un messaggio di successo se verificato:
```tsx
      {verified && (
        <p className="text-sm text-green-600 text-center mb-4">
          Email verificata con successo! Ora puoi accedere.
        </p>
      )}
```

4. Dopo il tag `</form>` (linea 72), aggiungere:
```tsx
          <p className="text-sm text-muted-foreground text-center mt-4">
            Non hai un account?{" "}
            <Link href="/registrazione" className="text-primary hover:underline">
              Registrati
            </Link>
          </p>
```

**Step 2: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add registration link and verified message to login page"
```

---

## Task 12: Aggiornare session.ts per gestire SUPER_ADMIN

**Files:**
- Modify: `src/lib/session.ts` (linee 13-19)

**Step 1: Aggiornare requireAdmin per accettare SUPER_ADMIN**

In `src/lib/session.ts`, modificare la funzione `requireAdmin`:

```typescript
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user.ruolo !== "ADMIN" && user.ruolo !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }
  return user;
}
```

**Step 2: Commit**

```bash
git add src/lib/session.ts
git commit -m "feat: update requireAdmin to accept SUPER_ADMIN role"
```

---

## Task 13: Aggiornare seed per aggiungere SUPER_ADMIN e emailVerificata

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Aggiornare il seed**

In `prisma/seed.ts`, aggiungere dopo la creazione degli utenti normali (dopo linea 55) e prima delle categorie (linea 57):

```typescript
  // Super Admin (sviluppatore)
  const superAdminSocio = await prisma.socio.create({
    data: {
      nome: "Super",
      cognome: "Admin",
      email: "admin@primanota.dev",
      codiceFiscale: "SUPERADMIN000000",
      quotaPercentuale: 0,
      ruolo: RuoloUtente.SUPER_ADMIN,
      societaId: null,
    },
  });

  await prisma.utente.create({
    data: {
      socioId: superAdminSocio.id,
      email: "admin@primanota.dev",
      passwordHash,
      emailVerificata: true,
    },
  });

  console.log("✓ Super Admin creato: admin@primanota.dev");
```

Aggiungere `emailVerificata: true` a tutte le creazioni `utente` esistenti nel seed (dentro il loop `for` alla linea 46):

```typescript
    await prisma.utente.create({
      data: {
        socioId: socio.id,
        email: s.email,
        passwordHash,
        emailVerificata: true,
      },
    });
```

**Step 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add SUPER_ADMIN to seed and emailVerificata to all seed users"
```

---

## Task 14: Test manuale end-to-end

**Step 1: Reset database con nuova migration**

```bash
npx prisma migrate reset
```

Questo esegue: drop → migrate → seed.

**Step 2: Avviare il dev server**

```bash
npm run dev
```

**Step 3: Verificare il flusso completo**

1. Andare su `http://localhost:3000/login` → verificare link "Registrati" presente
2. Cliccare "Registrati" → verificare pagina `/registrazione`
3. Compilare il form con dati di test e inviare
4. Verificare redirect a `/verifica-email?email=...`
5. Controllare console/log per il codice OTP (in dev, Resend con test key logga in console)
6. Inserire il codice → verificare redirect a `/login?verified=1`
7. Fare login con le credenziali → verificare accesso alla dashboard
8. Verificare che il super admin `admin@primanota.dev / password123` funzioni

**Step 4: Commit finale se tutto ok**

```bash
git add -A
git commit -m "feat: complete registration with email OTP verification"
```

---

## Riepilogo file

### Nuovi (6 file):
- `src/lib/email.ts` - Utility invio email con Resend
- `src/app/api/auth/registrazione/route.ts` - API registrazione
- `src/app/api/auth/verifica-email/route.ts` - API verifica OTP
- `src/app/api/auth/rinvia-codice/route.ts` - API reinvio codice
- `src/app/registrazione/page.tsx` - Pagina registrazione
- `src/app/verifica-email/page.tsx` - Pagina verifica OTP

### Modificati (6 file):
- `prisma/schema.prisma` - VerificaEmail model, emailVerificata, societaId nullable, SUPER_ADMIN
- `src/lib/auth.ts` - emailVerificata nel token/session
- `src/middleware.ts` - Rotte pubbliche, check verifica email
- `src/app/login/page.tsx` - Link registrazione, messaggio verifica
- `src/types/index.ts` - SessionUser aggiornato
- `src/lib/session.ts` - requireAdmin con SUPER_ADMIN
- `prisma/seed.ts` - Super admin + emailVerificata
