"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Step = "email" | "codice";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [codice, setCodice] = useState("");
  const [nuovaPassword, setNuovaPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRichiedi(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch("/api/auth/reset-password/richiedi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setMessage(data.message);
        setStep("codice");
      }
    } catch {
      setError("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifica(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (nuovaPassword !== confermaPassword) {
      setError("Le password non coincidono");
      setLoading(false);
      return;
    }

    if (nuovaPassword.length < 8) {
      setError("La password deve avere almeno 8 caratteri");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password/verifica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codice, nuovaPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        router.push("/login?reset=1");
      }
    } catch {
      setError("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-[120px]" />
      </div>
      <Card className="relative w-full max-w-md border-white/[0.06]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Prima<span className="text-primary">Nota</span>
          </CardTitle>
          <CardDescription>Reset Password</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleRichiedi} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="La tua email registrata"
                  required
                  autoComplete="email"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
              {message && (
                <p className="text-sm text-green-400 text-center">{message}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Invio in corso..." : "Invia codice di reset"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifica} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center mb-2">
                Inserisci il codice ricevuto via email a {email}
              </p>
              <div className="space-y-2">
                <Label htmlFor="codice">Codice di verifica</Label>
                <Input
                  id="codice"
                  value={codice}
                  onChange={(e) => setCodice(e.target.value)}
                  placeholder="12345"
                  maxLength={5}
                  required
                  autoComplete="one-time-code"
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nuovaPassword">Nuova password</Label>
                <Input
                  id="nuovaPassword"
                  type="password"
                  value={nuovaPassword}
                  onChange={(e) => setNuovaPassword(e.target.value)}
                  placeholder="Minimo 8 caratteri"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confermaPassword">Conferma password</Label>
                <Input
                  id="confermaPassword"
                  type="password"
                  value={confermaPassword}
                  onChange={(e) => setConfermaPassword(e.target.value)}
                  placeholder="Ripeti la password"
                  required
                  autoComplete="new-password"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Reset in corso..." : "Reimposta password"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("email");
                  setCodice("");
                  setNuovaPassword("");
                  setConfermaPassword("");
                  setError("");
                }}
              >
                Torna indietro
              </Button>
            </form>
          )}
          <p className="text-sm text-muted-foreground text-center mt-4">
            <Link href="/login" className="text-primary hover:underline">
              Torna al login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
