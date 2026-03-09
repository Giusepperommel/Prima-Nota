"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

type SocietaData = {
  id: number;
  ragioneSociale: string;
  partitaIva: string;
  codiceFiscale: string;
  indirizzo: string;
  regimeFiscale: string;
  aliquotaIrap: string;
  capitaleSociale: string;
  dataCostituzione: string;
};

export function SocietaForm({ societa }: { societa: SocietaData }) {
  const [formData, setFormData] = useState<SocietaData>(societa);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/societa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ragioneSociale: formData.ragioneSociale,
          partitaIva: formData.partitaIva,
          codiceFiscale: formData.codiceFiscale,
          indirizzo: formData.indirizzo || null,
          regimeFiscale: formData.regimeFiscale || null,
          aliquotaIrap: formData.aliquotaIrap ? parseFloat(formData.aliquotaIrap) : 3.9,
          capitaleSociale: formData.capitaleSociale ? parseFloat(formData.capitaleSociale) : null,
          dataCostituzione: formData.dataCostituzione || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Errore durante il salvataggio");
        return;
      }

      toast.success("Dati della societa aggiornati con successo");
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Dati della Societa</CardTitle>
        <CardDescription>
          Modifica i dati anagrafici e fiscali della societa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="ragioneSociale">Ragione Sociale *</Label>
              <Input
                id="ragioneSociale"
                name="ragioneSociale"
                value={formData.ragioneSociale}
                onChange={handleChange}
                required
                placeholder="Es. Mario Rossi S.r.l."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="partitaIva">Partita IVA *</Label>
              <Input
                id="partitaIva"
                name="partitaIva"
                value={formData.partitaIva}
                onChange={handleChange}
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
                value={formData.codiceFiscale}
                onChange={handleChange}
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
                value={formData.indirizzo}
                onChange={handleChange}
                placeholder="Via Roma 1, 00100 Roma (RM)"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="regimeFiscale">Regime Fiscale</Label>
              <Select
                value={formData.regimeFiscale || ""}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, regimeFiscale: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona regime" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORDINARIO">Ordinario (IRES)</SelectItem>
                  <SelectItem value="TRASPARENZA">
                    Trasparenza fiscale (Art. 116 TUIR)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aliquotaIrap">Aliquota IRAP (%)</Label>
              <Input
                id="aliquotaIrap"
                name="aliquotaIrap"
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={formData.aliquotaIrap}
                onChange={handleChange}
                placeholder="3.90"
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
                value={formData.capitaleSociale}
                onChange={handleChange}
                placeholder="Es. 50000.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataCostituzione">Data Costituzione</Label>
              <Input
                id="dataCostituzione"
                name="dataCostituzione"
                type="date"
                value={formData.dataCostituzione}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salva Modifiche
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
