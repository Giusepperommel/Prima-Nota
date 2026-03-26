"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface BudgetRow {
  contoId: number;
  contoDescrizione: string;
  importi: number[]; // 12 months
}

interface BudgetGridProps {
  righe: BudgetRow[];
  readOnly?: boolean;
  onSave?: (righe: { contoId: number; mese: number; importo: number }[]) => void;
}

const MESI_SHORT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export function BudgetGrid({ righe: initialRighe, readOnly = false, onSave }: BudgetGridProps) {
  const [righe, setRighe] = useState(initialRighe);

  const updateCell = (rowIdx: number, meseIdx: number, value: string) => {
    const updated = [...righe];
    updated[rowIdx] = {
      ...updated[rowIdx],
      importi: updated[rowIdx].importi.map((v, i) => (i === meseIdx ? Number(value) || 0 : v)),
    };
    setRighe(updated);
  };

  const handleSave = () => {
    if (!onSave) return;
    const flat: { contoId: number; mese: number; importo: number }[] = [];
    for (const riga of righe) {
      for (let m = 0; m < 12; m++) {
        if (riga.importi[m] !== 0) {
          flat.push({ contoId: riga.contoId, mese: m + 1, importo: riga.importi[m] });
        }
      }
    }
    onSave(flat);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2 font-medium min-w-[180px] sticky left-0 bg-muted/50">Conto</th>
              {MESI_SHORT.map((m) => (
                <th key={m} className="text-right p-2 font-medium min-w-[80px]">{m}</th>
              ))}
              <th className="text-right p-2 font-medium min-w-[90px]">Totale</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((riga, ri) => {
              const totale = riga.importi.reduce((s, v) => s + v, 0);
              return (
                <tr key={riga.contoId} className="border-t">
                  <td className="p-2 font-medium sticky left-0 bg-background">{riga.contoDescrizione}</td>
                  {riga.importi.map((val, mi) => (
                    <td key={mi} className="p-1 text-right">
                      {readOnly ? (
                        <span>{val.toLocaleString("it-IT")}</span>
                      ) : (
                        <Input
                          type="number"
                          value={val || ""}
                          onChange={(e) => updateCell(ri, mi, e.target.value)}
                          className="h-7 text-xs text-right w-full"
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-2 text-right font-bold">{totale.toLocaleString("it-IT")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && onSave && (
        <Button size="sm" onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" /> Salva Budget
        </Button>
      )}
    </div>
  );
}
