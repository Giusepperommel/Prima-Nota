"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ReportSectionProps {
  titolo: string;
  tipo: string;
  dati: any;
}

export function ReportSection({ titolo, tipo, dati }: ReportSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{titolo}</CardTitle>
      </CardHeader>
      <CardContent>
        {tipo === "kpi_summary" || tipo === "kpi_table" ? (
          <KpiTable kpis={Array.isArray(dati) ? dati : []} />
        ) : tipo === "comparison" ? (
          <ComparisonTable data={dati} />
        ) : tipo === "health_score" ? (
          <HealthScoreView data={dati} />
        ) : tipo === "alert_summary" ? (
          <AlertSummary alerts={Array.isArray(dati) ? dati : []} />
        ) : tipo === "text" ? (
          <div className="prose prose-sm max-w-none">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{dati?.narrativaAI || dati?.testo || "Nessun contenuto"}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sezione non supportata</p>
        )}
      </CardContent>
    </Card>
  );
}

function KpiTable({ kpis }: { kpis: any[] }) {
  if (kpis.length === 0) return <p className="text-sm text-muted-foreground">Nessun dato</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>KPI</TableHead>
          <TableHead className="text-right">Valore</TableHead>
          <TableHead className="text-right">Var. %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {kpis.map((kpi: any, i: number) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{kpi.nome || kpi.codice}</TableCell>
            <TableCell className="text-right">{kpi.valore != null ? Number(kpi.valore).toLocaleString("it-IT") : "\u2014"} {kpi.unita || ""}</TableCell>
            <TableCell className="text-right">
              {kpi.variazione != null ? (
                <span className={kpi.variazione > 0 ? "text-emerald-600" : kpi.variazione < 0 ? "text-red-600" : ""}>
                  {kpi.variazione > 0 ? "+" : ""}{Number(kpi.variazione).toFixed(1)}%
                </span>
              ) : "\u2014"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ComparisonTable({ data }: { data: any }) {
  if (!data?.righe) return <p className="text-sm text-muted-foreground">Nessun dato</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Voce</TableHead>
          <TableHead className="text-right">{data.periodoCorrente || "Corrente"}</TableHead>
          <TableHead className="text-right">{data.periodoPrecedente || "Precedente"}</TableHead>
          <TableHead className="text-right">Delta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.righe.map((r: any, i: number) => (
          <TableRow key={i}>
            <TableCell className="font-medium">{r.label}</TableCell>
            <TableCell className="text-right">{Number(r.valoreCorrente).toLocaleString("it-IT")}</TableCell>
            <TableCell className="text-right">{Number(r.valorePrecedente).toLocaleString("it-IT")}</TableCell>
            <TableCell className="text-right">
              <span className={r.delta > 0 ? "text-emerald-600" : r.delta < 0 ? "text-red-600" : ""}>
                {r.delta > 0 ? "+" : ""}{Number(r.delta).toLocaleString("it-IT")}
                {r.deltaPerc != null ? ` (${r.deltaPerc > 0 ? "+" : ""}${Number(r.deltaPerc).toFixed(1)}%)` : ""}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function HealthScoreView({ data }: { data: any }) {
  if (!data) return <p className="text-sm text-muted-foreground">Nessun dato</p>;
  const areas = [
    { label: "Contabilit\u00e0", value: data.areaContabilita },
    { label: "IVA", value: data.areaIva },
    { label: "Scadenze", value: data.areaScadenze },
    { label: "Documentale", value: data.areaDocumentale },
    { label: "Banca", value: data.areaBanca },
  ];
  return (
    <div className="space-y-3">
      <div className="text-center">
        <span className="text-3xl font-bold">{data.scoreComplessivo}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
      {areas.map((a) => (
        <div key={a.label} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>{a.label}</span>
            <span className="font-medium">{a.value ?? 0}%</span>
          </div>
          <Progress value={a.value ?? 0} className="h-2" />
        </div>
      ))}
    </div>
  );
}

function AlertSummary({ alerts }: { alerts: any[] }) {
  if (alerts.length === 0) return <p className="text-sm text-muted-foreground">Nessun alert attivo</p>;
  return (
    <div className="space-y-2">
      {alerts.slice(0, 5).map((a: any) => (
        <div key={a.id} className="flex items-center gap-2 text-sm">
          <Badge variant={a.gravita === "CRITICAL" ? "destructive" : "secondary"} className="text-[10px]">
            {a.gravita}
          </Badge>
          <span className="truncate">{a.messaggio}</span>
        </div>
      ))}
    </div>
  );
}
