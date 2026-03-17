"use client";

import { useMemo } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/business-utils";
import { generaPianoPagamento } from "@/lib/calcoli-pagamenti";
import { PianoPagamentiPreview } from "./piano-pagamenti-preview";

export type ModalitaPagamento = "IMMEDIATO" | "RATEALE" | "CUSTOM";

export type PianoPagamentoFormData = {
  modalita: ModalitaPagamento;
  numeroRate?: number;
  tan?: number;
  anticipo?: number;
  dataInizio?: string;
  pagamentiCustom?: Array<{ data: string; importo: number; note?: string }>;
};

type Props = {
  importoTotale: number;
  value: PianoPagamentoFormData;
  onChange: (data: PianoPagamentoFormData) => void;
};

export function SelettoreModalitaPagamento({ importoTotale, value, onChange }: Props) {
  const pianoPreview = useMemo(() => {
    if (value.modalita !== "RATEALE" || !value.numeroRate || !value.dataInizio) return null;
    const anticipoVal = value.anticipo || 0;
    const importoDaFinanziare = importoTotale - anticipoVal;
    if (importoDaFinanziare <= 0) return null;
    return generaPianoPagamento(
      importoDaFinanziare,
      value.numeroRate,
      value.tan || 0,
      new Date(value.dataInizio)
    );
  }, [importoTotale, value.modalita, value.numeroRate, value.tan, value.anticipo, value.dataInizio]);

  const coperturaCustom = useMemo(() => {
    if (value.modalita !== "CUSTOM" || !value.pagamentiCustom) return 0;
    return value.pagamentiCustom.reduce((sum, p) => sum + (p.importo || 0), 0);
  }, [value.modalita, value.pagamentiCustom]);

  const addPagamentoCustom = () => {
    const current = value.pagamentiCustom || [];
    onChange({
      ...value,
      pagamentiCustom: [...current, { data: "", importo: 0 }],
    });
  };

  const removePagamentoCustom = (index: number) => {
    const current = value.pagamentiCustom || [];
    onChange({
      ...value,
      pagamentiCustom: current.filter((_, i) => i !== index),
    });
  };

  const updatePagamentoCustom = (index: number, field: string, val: any) => {
    const current = [...(value.pagamentiCustom || [])];
    current[index] = { ...current[index], [field]: val };
    onChange({ ...value, pagamentiCustom: current });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Label className="text-base font-semibold">Modalità di pagamento</Label>

        <RadioGroup
          value={value.modalita}
          onValueChange={(v) => onChange({ ...value, modalita: v as ModalitaPagamento })}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="IMMEDIATO" id="pay-immediato" />
            <Label htmlFor="pay-immediato">Immediato</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="RATEALE" id="pay-rateale" />
            <Label htmlFor="pay-rateale">Rateale</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="CUSTOM" id="pay-custom" />
            <Label htmlFor="pay-custom">Personalizzato</Label>
          </div>
        </RadioGroup>

        {value.modalita === "RATEALE" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Anticipo (&euro;)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={value.anticipo || ""}
                  onChange={(e) => onChange({ ...value, anticipo: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Numero rate</Label>
                <Input
                  type="number"
                  value={value.numeroRate || ""}
                  onChange={(e) => onChange({ ...value, numeroRate: parseInt(e.target.value) || 0 })}
                  placeholder="24"
                />
              </div>
              <div>
                <Label>TAN %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={value.tan || ""}
                  onChange={(e) => onChange({ ...value, tan: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Data prima rata</Label>
                <Input
                  type="date"
                  value={value.dataInizio || ""}
                  onChange={(e) => onChange({ ...value, dataInizio: e.target.value })}
                />
              </div>
            </div>

            {pianoPreview && (
              <PianoPagamentiPreview
                rate={pianoPreview.rate}
                totaleInteressi={pianoPreview.totaleInteressi}
                anticipo={value.anticipo || 0}
              />
            )}
          </div>
        )}

        {value.modalita === "CUSTOM" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                Coperto: <strong>{formatCurrency(coperturaCustom)}</strong> / {formatCurrency(importoTotale)}
              </div>
              {coperturaCustom > importoTotale && (
                <Badge variant="destructive">Importo superato</Badge>
              )}
            </div>

            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${Math.min((coperturaCustom / importoTotale) * 100, 100)}%` }}
              />
            </div>

            {(value.pagamentiCustom || []).map((pag, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={pag.data}
                    onChange={(e) => updatePagamentoCustom(i, "data", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label>Importo (&euro;)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pag.importo || ""}
                    onChange={(e) => updatePagamentoCustom(i, "importo", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => removePagamentoCustom(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={addPagamentoCustom}
              disabled={coperturaCustom >= importoTotale}
            >
              <Plus className="h-4 w-4 mr-1" /> Aggiungi pagamento
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
