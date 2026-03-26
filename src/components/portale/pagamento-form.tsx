"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, Loader2 } from "lucide-react";

interface PagamentoFormProps {
  onSubmit: (data: { tipo: string; dati: any }) => Promise<void>;
}

export function PagamentoForm({ onSubmit }: PagamentoFormProps) {
  const [importo, setImporto] = useState("");
  const [fornitore, setFornitore] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!importo || !fornitore || !data) return;
    setSubmitting(true);
    try {
      await onSubmit({
        tipo: "PAGAMENTO",
        dati: { importo: Number(importo), fornitore, data, categoria: categoria || undefined, descrizione: descrizione || undefined },
      });
      setImporto(""); setFornitore(""); setCategoria(""); setDescrizione("");
    } finally { setSubmitting(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-5 w-5 text-red-600" /> Registra Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="Importo (€)" value={importo} onChange={(e) => setImporto(e.target.value)} />
          <Input placeholder="Fornitore" value={fornitore} onChange={(e) => setFornitore(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Input placeholder="Categoria (opzionale)" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        </div>
        <Input placeholder="Descrizione (opzionale)" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        <Button onClick={handleSubmit} disabled={!importo || !fornitore || submitting} variant="destructive" className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Registra Pagamento
        </Button>
      </CardContent>
    </Card>
  );
}
