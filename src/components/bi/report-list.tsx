"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Plus, Loader2 } from "lucide-react";

interface ReportItem {
  id: number;
  periodo: string;
  stato: string;
  generatoAt: string;
  template: { nome: string; tipo: string };
}

interface TemplateOption {
  tipo: string;
  nome: string;
  descrizione: string;
}

export function ReportList({ onSelectReport }: { onSelectReport?: (id: number) => void }) {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/api/bi/report");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setTemplates(data.templateDisponibili || []);
      }
    } catch (err) {
      console.error("[ReportList] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/bi/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: selectedTemplate }),
      });
      if (res.ok) {
        await fetchReports();
        setSelectedTemplate("");
      }
    } catch (err) {
      console.error("[ReportList] Generate error:", err);
    } finally {
      setGenerating(false);
    }
  }, [selectedTemplate, fetchReports]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="flex-1 h-9">
              <SelectValue placeholder="Seleziona tipo report..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.tipo} value={t.tipo}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleGenerate} disabled={!selectedTemplate || generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">Genera</span>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun report generato</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Periodo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => onSelectReport?.(r.id)}>
                  <TableCell className="font-medium">{r.template.nome}</TableCell>
                  <TableCell>{r.periodo}</TableCell>
                  <TableCell>
                    <Badge variant={r.stato === "GENERATO" ? "secondary" : "outline"}>{r.stato}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.generatoAt).toLocaleDateString("it-IT")}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild onClick={(e) => e.stopPropagation()}>
                      <a href={`/api/bi/report/${r.id}/pdf`} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
