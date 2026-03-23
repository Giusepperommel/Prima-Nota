"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, FileText, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/business-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Movimento {
  id: number;
  contoId: number;
  codiceConto: string;
  descrizioneConto: string;
  importoDare: number;
  importoAvere: number;
  descrizione: string | null;
}

interface ScritturaData {
  id: number;
  dataRegistrazione: string;
  dataCompetenza: string;
  numeroProtocollo: number;
  anno: number;
  descrizione: string;
  causale: string;
  tipoScrittura: string;
  stato: "DEFINITIVA" | "PROVVISORIA";
  totaleDare: number;
  totaleAvere: number;
  movimenti: Movimento[];
}

interface ScritturaOperazionePanelProps {
  operazioneId: number;
  isCommercialista?: boolean;
}

export function ScritturaOperazionePanel({
  operazioneId,
  isCommercialista = false,
}: ScritturaOperazionePanelProps) {
  const [scrittura, setScrittura] = useState<ScritturaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchScrittura() {
      try {
        const res = await fetch(`/api/operazioni/${operazioneId}/scrittura`);
        if (!res.ok) return;
        const data = await res.json();
        setScrittura(data);
      } catch {
        // silently fail — panel simply won't show
      } finally {
        setLoading(false);
      }
    }
    fetchScrittura();
  }, [operazioneId]);

  if (loading || !scrittura) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">
                  Scrittura Contabile
                </CardTitle>
                <Badge
                  className={
                    scrittura.stato === "DEFINITIVA"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  }
                  variant="outline"
                >
                  {scrittura.stato}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {isCommercialista && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/bilancio/libro-giornale">
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Modifica
                    </Link>
                  </Button>
                )}
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Codice Conto</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right w-[130px]">Dare</TableHead>
                    <TableHead className="text-right w-[130px]">
                      Avere
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scrittura.movimenti.map((mov) => (
                    <TableRow key={mov.id}>
                      <TableCell className="font-mono text-sm">
                        {mov.codiceConto}
                      </TableCell>
                      <TableCell>{mov.descrizioneConto}</TableCell>
                      <TableCell className="text-right">
                        {mov.importoDare > 0
                          ? `\u20AC ${formatCurrency(mov.importoDare)}`
                          : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {mov.importoAvere > 0
                          ? `\u20AC ${formatCurrency(mov.importoAvere)}`
                          : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/50">
                    <TableCell colSpan={2} className="text-right">
                      Totale
                    </TableCell>
                    <TableCell className="text-right">
                      {`\u20AC ${formatCurrency(scrittura.totaleDare)}`}
                    </TableCell>
                    <TableCell className="text-right">
                      {`\u20AC ${formatCurrency(scrittura.totaleAvere)}`}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
