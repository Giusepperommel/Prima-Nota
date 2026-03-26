"use client";

import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

interface ThreadItem {
  id: number;
  oggetto: string;
  stato: string;
  ultimoMessaggioAt: string | null;
  _count: { messaggi: number };
  messaggi: { testo: string; mittenteTipo: string; letto: boolean; createdAt: string }[];
}

interface ThreadListProps {
  threads: ThreadItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function ThreadList({ threads, selectedId, onSelect }: ThreadListProps) {
  return (
    <div className="space-y-1">
      {threads.map((t) => {
        const lastMsg = t.messaggi?.[0];
        const hasUnread = lastMsg && !lastMsg.letto && lastMsg.mittenteTipo !== "CLIENTE";
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors ${selectedId === t.id ? "bg-blue-50 border border-blue-200" : "hover:bg-muted/50"}`}
            onClick={() => onSelect(t.id)}
          >
            <MessageSquare className={`h-5 w-5 mt-0.5 shrink-0 ${hasUnread ? "text-blue-600" : "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={`text-sm truncate ${hasUnread ? "font-semibold" : "font-medium"}`}>{t.oggetto}</p>
                {hasUnread && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />}
              </div>
              {lastMsg && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{lastMsg.testo.slice(0, 60)}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={t.stato === "APERTO" ? "outline" : "secondary"} className="text-[10px]">{t.stato}</Badge>
                <span className="text-[10px] text-muted-foreground">{t._count.messaggi} msg</span>
              </div>
            </div>
          </div>
        );
      })}
      {threads.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nessuna conversazione</p>
      )}
    </div>
  );
}
