"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, Loader2 } from "lucide-react";

interface IncassoFormProps {
  onSubmit: (data: { tipo: string; dati: any }) => Promise<void>;
}

export function IncassoForm({ onSubmit }: IncassoFormProps) {
  const [importo, setImporto] = useState("");
  const [cliente, setCliente] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState("bonifico");
  const [descrizione, setDescrizione] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!importo || !cliente || !data) return;
    setSubmitting(true);
    try {
      await onSubmit({
        tipo: "INCASSO",
        dati: { importo: Number(importo), cliente, data, metodoPagamento: metodo, descrizione: descrizione || undefined },
      });
      setImporto(""); setCliente(""); setDescrizione("");
    } finally { setSubmitting(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="h-5 w-5 text-emerald-600" /> Registra Incasso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="Importo (€)" value={importo} onChange={(e) => setImporto(e.target.value)} />
          <Input placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Select value={metodo} onValueChange={setMetodo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bonifico">Bonifico</SelectItem>
              <SelectItem value="contanti">Contanti</SelectItem>
              <SelectItem value="carta">Carta</SelectItem>
              <SelectItem value="assegno">Assegno</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="Descrizione (opzionale)" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        <Button onClick={handleSubmit} disabled={!importo || !cliente || submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Registra Incasso
        </Button>
      </CardContent>
    </Card>
  );
}
