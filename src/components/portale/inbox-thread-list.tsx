"use client";

import { Badge } from "@/components/ui/badge";
import { MessageSquare, User } from "lucide-react";

interface InboxThread {
  id: number;
  oggetto: string;
  stato: string;
  ultimoMessaggioAt: string | null;
  accessoCliente: { id: number; nome: string; email: string };
  _count: { messaggi: number };
  messaggi: { testo: string; mittenteTipo: string; letto: boolean; createdAt: string }[];
}

interface InboxThreadListProps {
  threads: InboxThread[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function InboxThreadList({ threads, selectedId, onSelect }: InboxThreadListProps) {
  return (
    <div className="space-y-1">
      {threads.map((t) => {
        const lastMsg = t.messaggi?.[0];
        const unreadCount = t._count.messaggi;
        const hasUnread = unreadCount > 0;

        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors ${
              selectedId === t.id
                ? "bg-blue-50 border border-blue-200"
                : "hover:bg-muted/50"
            }`}
            onClick={() => onSelect(t.id)}
          >
            <MessageSquare
              className={`h-5 w-5 mt-0.5 shrink-0 ${
                hasUnread ? "text-blue-600" : "text-muted-foreground"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm truncate ${hasUnread ? "font-semibold" : "font-medium"}`}>
                  {t.oggetto}
                </p>
                {hasUnread && (
                  <Badge variant="default" className="text-[10px] shrink-0">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">
                  {t.accessoCliente.nome}
                </span>
              </div>
              {lastMsg && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {lastMsg.mittenteTipo === "CLIENTE" ? "Cliente: " : "Tu: "}
                  {lastMsg.testo.slice(0, 60)}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={t.stato === "APERTO" ? "outline" : "secondary"}
                  className="text-[10px]"
                >
                  {t.stato}
                </Badge>
                {t.ultimoMessaggioAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(t.ultimoMessaggioAt).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {threads.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nessuna conversazione aperta
        </p>
      )}
    </div>
  );
}
