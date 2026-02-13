"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";

function CreaSocietaForm() {
  const router = useRouter();
  const { update } = useSession();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const ragioneSociale = formData.get("ragioneSociale") as string;
    const partitaIva = formData.get("partitaIva") as string;
    const codiceFiscale = formData.get("codiceFiscale") as string;
    const indirizzo = formData.get("indirizzo") as string;
    const regimeFiscale = formData.get("regimeFiscale") as string;
    const capitaleSociale = formData.get("capitaleSociale") as string;
    const dataCostituzione = formData.get("dataCostituzione") as string;

    try {
      const res = await fetch("/api/societa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ragioneSociale,
          partitaIva,
          codiceFiscale,
          indirizzo: indirizzo || null,
          regimeFiscale: regimeFiscale || null,
          capitaleSociale: capitaleSociale ? parseFloat(capitaleSociale) : null,
          dataCostituzione: dataCostituzione || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Errore durante la creazione della societa");
        setLoading(false);
        return;
      }

      // Update the session with the new societaId and role
      await update({ societaId: data.societaId, ruolo: "ADMIN" });

      router.push("/dashboard");
    } catch {
      setError("Errore di connessione. Riprova.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="ragioneSociale">Ragione Sociale *</Label>
          <Input
            id="ragioneSociale"
            name="ragioneSociale"
            required
            placeholder="Es. Mario Rossi S.r.l."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="partitaIva">Partita IVA *</Label>
          <Input
            id="partitaIva"
            name="partitaIva"
            required
            maxLength={11}
            placeholder="12345678901"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="codiceFiscale">Codice Fiscale *</Label>
          <Input
            id="codiceFiscale"
            name="codiceFiscale"
            required
            maxLength={16}
            placeholder="RSSMRA80A01H501U"
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="indirizzo">Indirizzo</Label>
          <Textarea
            id="indirizzo"
            name="indirizzo"
            placeholder="Via Roma 1, 00100 Roma (RM)"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="regimeFiscale">Regime Fiscale</Label>
          <Input
            id="regimeFiscale"
            name="regimeFiscale"
            placeholder="Es. Ordinario, Forfettario"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="capitaleSociale">Capitale Sociale</Label>
          <Input
            id="capitaleSociale"
            name="capitaleSociale"
            type="number"
            step="0.01"
            min="0"
            placeholder="Es. 50000.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dataCostituzione">Data Costituzione</Label>
          <Input
            id="dataCostituzione"
            name="dataCostituzione"
            type="date"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Building2 className="mr-2 h-4 w-4" />
        )}
        {loading ? "Creazione in corso..." : "Crea Societa"}
      </Button>
    </form>
  );
}

export default function CreaSocietaPage() {
  return (
    <SessionProvider>
      <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              Configura la tua Societa
            </CardTitle>
            <CardDescription>
              Per iniziare a usare Prima Nota, inserisci i dati della tua
              societa. Diventerai automaticamente l&apos;amministratore.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreaSocietaForm />
          </CardContent>
        </Card>
      </div>
    </SessionProvider>
  );
}
