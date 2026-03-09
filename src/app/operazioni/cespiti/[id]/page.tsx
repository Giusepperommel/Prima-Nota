"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/business-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink } from "lucide-react";

type QuotaAmmortamento = {
  anno: number;
  aliquotaApplicata: number;
  importoQuota: number;
  fondoProgressivo: number;
  valoreResiduo: number;
};

type Ripartizione = {
  socioId: number;
  percentuale: number;
  importoCalcolato: number;
  nome: string;
  cognome: string;
  quotaPercentuale: number;
};

type CespiteDetail = {
  id: number;
  descrizione: string;
  valoreIniziale: number;
  aliquotaAmmortamento: number;
  dataAcquisto: string;
  annoInizio: number;
  stato: string;
  fondoAmmortamento: number;
  valoreResiduo: number;
  operazioneId: number;
  categoria: { id: number; nome: string };
  tipoRipartizione: string;
  ripartizioni: Ripartizione[];
  quoteAmmortamento: QuotaAmmortamento[];
};

const STATO_LABELS: Record<string, string> = {
  IN_AMMORTAMENTO: "In Ammortamento",
  COMPLETATO: "Completato",
  CEDUTO: "Ceduto",
};

const STATO_BADGE_CLASSES: Record<string, string> = {
  IN_AMMORTAMENTO: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  COMPLETATO: "bg-green-500/15 text-green-400 border-green-500/25",
  CEDUTO: "bg-zinc-500/15 text-zinc-400 border-zinc-500/25",
};

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatPercentuale(value: number): string {
  return (
    new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + "%"
  );
}

export default function DettaglioCespitePage() {
  const params = useParams();
  const router = useRouter();
  const [cespite, setCespite] = useState<CespiteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    async function fetchCespite() {
      setLoading(true);
      try {
        const res = await fetch(`/api/cespiti/${params.id}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Errore nel caricamento");
        }
        const data = await res.json();
        setCespite(data);
      } catch (error: any) {
        toast.error(error.message || "Errore nel caricamento del cespite");
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchCespite();
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!cespite) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Cespite non trovato
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/operazioni/cespiti")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna alla lista
        </Button>
      </div>

      {/* Card: Riepilogo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Riepilogo Cespite</CardTitle>
            <Badge
              variant="outline"
              className={STATO_BADGE_CLASSES[cespite.stato] || ""}
            >
              {STATO_LABELS[cespite.stato] || cespite.stato}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Descrizione</p>
              <p className="font-medium">{cespite.descrizione}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data Acquisto</p>
              <p className="font-medium font-mono">
                {formatDate(cespite.dataAcquisto)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Categoria</p>
              <p className="font-medium">{cespite.categoria.nome}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valore Iniziale</p>
              <p className="font-medium font-mono">
                {formatCurrency(cespite.valoreIniziale)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aliquota Ammortamento</p>
              <p className="font-medium">
                {formatPercentuale(cespite.aliquotaAmmortamento)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Anno Inizio</p>
              <p className="font-medium">{cespite.annoInizio}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Fondo Ammortamento
              </p>
              <p className="font-medium font-mono">
                {formatCurrency(cespite.fondoAmmortamento)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valore Residuo</p>
              <p className="font-medium font-mono">
                {formatCurrency(cespite.valoreResiduo)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Operazione</p>
              <Button
                variant="link"
                className="h-auto p-0"
                onClick={() =>
                  router.push(`/operazioni/${cespite.operazioneId}`)
                }
              >
                #{cespite.operazioneId}
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card: Attribuzione */}
      <Card>
        <CardHeader>
          <CardTitle>Attribuzione Soci</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Socio</TableHead>
                <TableHead className="text-right">Quota Societaria</TableHead>
                <TableHead className="text-right">% Ripartizione</TableHead>
                <TableHead className="text-right">Importo Cespite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cespite.ripartizioni.map((r) => (
                <TableRow key={r.socioId}>
                  <TableCell className="font-medium">
                    {r.cognome} {r.nome}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(r.quotaPercentuale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(r.percentuale)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(r.importoCalcolato)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Card: Piano Ammortamento */}
      <Card>
        <CardHeader>
          <CardTitle>Piano Ammortamento</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Anno</TableHead>
                <TableHead className="text-right">Aliquota</TableHead>
                <TableHead className="text-right">Quota Annua</TableHead>
                <TableHead className="text-right">Fondo Progressivo</TableHead>
                <TableHead className="text-right">Valore Residuo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cespite.quoteAmmortamento.map((q) => (
                <TableRow
                  key={q.anno}
                  className={
                    q.anno === currentYear
                      ? "bg-primary/10 font-medium"
                      : ""
                  }
                >
                  <TableCell className="font-mono">
                    {q.anno}
                    {q.anno === currentYear && (
                      <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                        corrente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentuale(q.aliquotaApplicata)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(q.importoQuota)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(q.fondoProgressivo)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(q.valoreResiduo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
