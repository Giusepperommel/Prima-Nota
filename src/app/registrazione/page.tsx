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
