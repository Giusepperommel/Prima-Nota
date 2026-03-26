"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { ReportSection } from "./report-section";

interface ReportDetailProps {
  reportId: number;
  onBack: () => void;
}

export function ReportDetail({ reportId, onBack }: ReportDetailProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/bi/report/${reportId}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data.report);
      }
    } catch (err) {
      console.error("[ReportDetail] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}</div>;
  }

  if (!report) {
    return <p className="text-center text-muted-foreground py-8">Report non trovato</p>;
  }

  const reportData = report.dati;
  const sezioni = reportData?.sezioni || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/bi/report/${reportId}/pdf`} download>
            <Download className="h-4 w-4 mr-1" /> Scarica PDF
          </a>
        </Button>
      </div>

      <div>
        <h2 className="text-xl font-semibold">{report.template?.nome || "Report"}</h2>
        <p className="text-sm text-muted-foreground">
          Periodo: {reportData?.periodo || report.periodo} — Generato: {new Date(report.generatoAt).toLocaleDateString("it-IT")}
        </p>
      </div>

      {sezioni.map((sezione: any, i: number) => (
        <ReportSection key={i} titolo={sezione.titolo} tipo={sezione.tipo} dati={sezione.dati} />
      ))}
    </div>
  );
}
