"use client";

import { Button } from "@/components/ui/button";

interface Permesso {
  sezione: string;
  lettura: boolean;
  scrittura: boolean;
}

const PRESETS: { nome: string; descrizione: string; permessi: Permesso[] }[] = [
  {
    nome: "Visualizzazione Base",
    descrizione: "Solo lettura su KPI, scadenze, fatture",
    permessi: [
      { sezione: "KPI", lettura: true, scrittura: false },
      { sezione: "PRIMA_NOTA", lettura: false, scrittura: false },
      { sezione: "DOCUMENTI", lettura: true, scrittura: false },
      { sezione: "CHAT", lettura: true, scrittura: true },
      { sezione: "IVA", lettura: true, scrittura: false },
      { sezione: "SCADENZARIO", lettura: true, scrittura: false },
      { sezione: "FATTURE", lettura: true, scrittura: false },
      { sezione: "F24", lettura: false, scrittura: false },
      { sezione: "BILANCIO", lettura: false, scrittura: false },
      { sezione: "REPORT", lettura: true, scrittura: false },
    ],
  },
  {
    nome: "Operativo",
    descrizione: "Lettura + scrittura su documenti, chat, prima nota",
    permessi: [
      { sezione: "KPI", lettura: true, scrittura: false },
      { sezione: "PRIMA_NOTA", lettura: true, scrittura: true },
      { sezione: "DOCUMENTI", lettura: true, scrittura: true },
      { sezione: "CHAT", lettura: true, scrittura: true },
      { sezione: "IVA", lettura: true, scrittura: false },
      { sezione: "SCADENZARIO", lettura: true, scrittura: false },
      { sezione: "FATTURE", lettura: true, scrittura: false },
      { sezione: "F24", lettura: true, scrittura: false },
      { sezione: "BILANCIO", lettura: false, scrittura: false },
      { sezione: "REPORT", lettura: true, scrittura: false },
    ],
  },
  {
    nome: "Completo",
    descrizione: "Accesso completo a tutte le sezioni",
    permessi: [
      { sezione: "KPI", lettura: true, scrittura: false },
      { sezione: "PRIMA_NOTA", lettura: true, scrittura: true },
      { sezione: "DOCUMENTI", lettura: true, scrittura: true },
      { sezione: "CHAT", lettura: true, scrittura: true },
      { sezione: "IVA", lettura: true, scrittura: false },
      { sezione: "SCADENZARIO", lettura: true, scrittura: true },
      { sezione: "FATTURE", lettura: true, scrittura: true },
      { sezione: "F24", lettura: true, scrittura: false },
      { sezione: "BILANCIO", lettura: true, scrittura: false },
      { sezione: "REPORT", lettura: true, scrittura: false },
    ],
  },
];

interface PermissionPresetsProps {
  onApply: (permessi: Permesso[]) => void;
}

export function PermissionPresets({ onApply }: PermissionPresetsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {PRESETS.map((preset) => (
        <Button key={preset.nome} variant="outline" size="sm" onClick={() => onApply(preset.permessi)} title={preset.descrizione}>
          {preset.nome}
        </Button>
      ))}
    </div>
  );
}
