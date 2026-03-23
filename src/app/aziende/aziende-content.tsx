"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Building2, Plus, Loader2 } from "lucide-react";
import { AziendaCard } from "./azienda-card";

export type Scadenza = {
  id: number;
  descrizione: string;
  dataScadenza: string;
  tipoScadenza: "FISCALE" | "CONTABILE" | "GENERICA";
  priorita: "ALTA" | "MEDIA" | "BASSA";
  completata: boolean;
};

export type Nota = {
  id: number;
  testo: string;
  colore: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Azienda = {
  utenteAziendaId: number;
  ruolo: string;
  ultimoAccesso: string | null;
  societa: {
    id: number;
    ragioneSociale: string;
    tipoAttivita: string;
    partitaIva: string;
  };
  fatturatoYTD: number;
  costiYTD: number;
  alertNonLetti: number;
  scadenze: Scadenza[];
  note: Nota[];
};

type Props = {
  userName: string;
};

export function AziendeContent({ userName }: Props) {
  const router = useRouter();
  const [aziende, setAziende] = useState<Azienda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchAziende() {
    try {
      const res = await fetch("/api/aziende");
      if (!res.ok) throw new Error("Errore nel caricamento");
      const data = await res.json();
      setAziende(data);
    } catch {
      setError("Impossibile caricare le aziende. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAziende();
  }, []);

  function handleRefresh() {
    setLoading(true);
    setError("");
    fetchAziende();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={handleRefresh}>
          Riprova
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            Le mie aziende
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {aziende.length} {aziende.length === 1 ? "azienda" : "aziende"} &middot; Ciao, {userName}
          </p>
        </div>
        <Button onClick={() => router.push("/crea-societa")}>
          <Plus className="h-4 w-4 mr-2" />
          Crea nuova azienda
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {aziende.map((az) => (
          <AziendaCard
            key={az.utenteAziendaId}
            azienda={az}
            onUpdate={handleRefresh}
          />
        ))}
      </div>
    </div>
  );
}
