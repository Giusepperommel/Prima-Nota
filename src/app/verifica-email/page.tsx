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
