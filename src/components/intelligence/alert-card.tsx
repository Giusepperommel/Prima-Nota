"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, AlertCircle, Eye, Clock, Check } from "lucide-react";

interface AlertCardProps {
  id: number;
  messaggio: string;
  gravita: "INFO" | "WARNING" | "CRITICAL";
  categoria: string;
  linkAzione?: string;
  stato: string;
  createdAt: string;
  onAction?: (id: number, azione: "visto" | "snooze" | "risolvi") => void;
}

const SEVERITY_CONFIG = {
  CRITICAL: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", badge: "destructive" as const },
  WARNING: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", badge: "secondary" as const },
  INFO: { icon: Info, color: "text-blue-600", bg: "bg-blue-50 border-blue-200", badge: "outline" as const },
};

export function AlertCard({ id, messaggio, gravita, categoria, linkAzione, stato, createdAt, onAction }: AlertCardProps) {
  const config = SEVERITY_CONFIG[gravita] || SEVERITY_CONFIG.INFO;
  const Icon = config.icon;
  const timeAgo = getTimeAgo(createdAt);

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${config.bg}`}>
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={config.badge} className="text-[10px]">{categoria.replace(/_/g, " ")}</Badge>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <p className="text-sm leading-snug">{messaggio}</p>
        {stato === "NUOVO" && onAction && (
          <div className="flex gap-1 mt-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAction(id, "visto")}>
              <Eye className="h-3 w-3 mr-1" /> Visto
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAction(id, "snooze")}>
              <Clock className="h-3 w-3 mr-1" /> Rinvia
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onAction(id, "risolvi")}>
              <Check className="h-3 w-3 mr-1" /> Risolto
            </Button>
          </div>
        )}
      </div>
      {linkAzione && (
        <a href={linkAzione} className="shrink-0 text-xs text-blue-600 hover:underline mt-0.5">Vai</a>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  return `${days}g fa`;
}
