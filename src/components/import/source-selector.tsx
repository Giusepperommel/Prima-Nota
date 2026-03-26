"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ImportSource {
  id: string;
  nome: string;
  descrizione: string;
  formati: string;
}

const SOURCES: ImportSource[] = [
  { id: "teamsystem", nome: "TeamSystem", descrizione: "Import da file CSV/TXT esportati da TeamSystem", formati: "CSV, TXT" },
  { id: "zucchetti", nome: "Zucchetti", descrizione: "Import da file CSV esportati da Zucchetti", formati: "CSV" },
  { id: "passcom", nome: "Passcom", descrizione: "Import da file CSV esportati da Passcom", formati: "CSV" },
  { id: "fatture-in-cloud", nome: "Fatture in Cloud", descrizione: "Import da file CSV esportati da Fatture in Cloud", formati: "CSV" },
  { id: "danea", nome: "Danea Easyfatt", descrizione: "Import da file XML esportati da Danea Easyfatt", formati: "XML" },
];

interface SourceSelectorProps {
  selected: string;
  onSelect: (sourceId: string) => void;
}

export function SourceSelector({ selected, onSelect }: SourceSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {SOURCES.map((source) => (
        <Card
          key={source.id}
          className={`cursor-pointer transition-all ${selected === source.id ? "border-blue-500 ring-2 ring-blue-200" : "hover:border-gray-400"}`}
          onClick={() => onSelect(source.id)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold">{source.nome}</h3>
              <Badge variant="outline" className="text-[10px]">{source.formati}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{source.descrizione}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
