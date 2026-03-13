"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const verified = searchParams.get("verified");
  const reset = searchParams.get("reset");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Email o password non validi");
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <>
      {verified && (
        <p className="text-sm text-green-400 text-center mb-4">
          Email verificata con successo! Ora puoi accedere.
        </p>
      )}
      {reset && (
        <p className="text-sm text-green-400 text-center mb-4">
          Password reimpostata con successo! Accedi con la nuova password.
        </p>
      )}
    <form onSubmit={handleSubmit} className="space-y-4">
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
          required
          autoComplete="current-password"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Accesso in corso..." : "Accedi"}
      </Button>
    </form>
          <p className="text-sm text-muted-foreground text-center mt-3">
            <Link href="/reset-password" className="text-primary hover:underline">
              Password dimenticata?
            </Link>
          </p>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Non hai un account?{" "}
            <Link href="/registrazione" className="text-primary hover:underline">
              Registrati
            </Link>
          </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-[120px]" />
      </div>
      <Card className="relative w-full max-w-md border-white/[0.06]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Prima<span className="text-primary">Nota</span></CardTitle>
          <CardDescription>Gestionale Contabile SRL</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
