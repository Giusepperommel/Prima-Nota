"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUp, Loader2 } from "lucide-react";

interface FatturaUploadFormProps {
  onSubmit: (data: { tipo: string; dati: any }) => Promise<void>;
}

export function FatturaUploadForm({ onSubmit }: FatturaUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      // In production, upload file first and get URL. For now, use filename as placeholder.
      await onSubmit({
        tipo: "FATTURA",
        dati: { fileUrl: `/uploads/${file.name}`, note: note || undefined },
      });
      setFile(null); setNote("");
    } finally { setSubmitting(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="h-5 w-5 text-blue-600" /> Carica Fattura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <input type="file" accept=".pdf,.xml,.jpg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
          {file && <p className="text-xs text-muted-foreground mt-1">{file.name}</p>}
        </div>
        <Input placeholder="Note (opzionale)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button onClick={handleSubmit} disabled={!file || submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Carica Fattura
        </Button>
      </CardContent>
    </Card>
  );
}
