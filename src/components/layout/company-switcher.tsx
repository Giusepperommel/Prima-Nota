"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronsUpDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

type Azienda = {
  utenteAziendaId: number;
  ruolo: string;
  ultimoAccesso: string | null;
  societa: {
    id: number;
    ragioneSociale: string;
    tipoAttivita: string;
    partitaIva: string | null;
  };
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-green-600 text-white hover:bg-green-600",
  STANDARD: "bg-blue-600 text-white hover:bg-blue-600",
  COMMERCIALISTA: "bg-purple-600 text-white hover:bg-purple-600",
};

function RoleBadge({ ruolo }: { ruolo: string }) {
  return (
    <Badge
      variant="secondary"
      className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[ruolo] ?? ""}`}
    >
      {ruolo}
    </Badge>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "Mai";
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function CompanySwitcher() {
  const { data: session, update } = useSession();
  const [aziende, setAziende] = useState<Azienda[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const user = session?.user as any;
  const currentSocietaId = user?.societaId as number | null;
  const numeroAziende = (user?.numeroAziende as number) ?? 1;

  useEffect(() => {
    if (numeroAziende > 1) {
      fetch("/api/aziende")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setAziende(data);
        })
        .catch(() => {});
    }
  }, [numeroAziende]);

  // Also fetch for single company to get the name
  useEffect(() => {
    if (numeroAziende === 1 && aziende.length === 0) {
      fetch("/api/aziende")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setAziende(data);
        })
        .catch(() => {});
    }
  }, [numeroAziende, aziende.length]);

  const currentAzienda = aziende.find(
    (a) => a.societa.id === currentSocietaId
  );
  const otherAziende = aziende.filter(
    (a) => a.societa.id !== currentSocietaId
  );

  const handleSwitch = async (societaId: number) => {
    setSwitching(true);
    try {
      const res = await fetch("/api/auth/switch-societa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ societaId }),
      });
      if (res.ok) {
        await update({ societaId });
        window.location.reload();
      }
    } catch {
      // ignore
    } finally {
      setSwitching(false);
      setOpen(false);
    }
  };

  const displayName =
    currentAzienda?.societa.ragioneSociale ?? "Caricamento...";
  const displayRuolo = currentAzienda?.ruolo;

  // Single company: just show the name, no dropdown
  if (numeroAziende <= 1) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium truncate">{displayName}</span>
          {displayRuolo && <RoleBadge ruolo={displayRuolo} />}
        </div>
      </div>
    );
  }

  // Multiple companies: show popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between px-2 py-1.5 h-auto"
          disabled={switching}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate max-w-[140px]">
                {displayName}
              </span>
              {displayRuolo && <RoleBadge ruolo={displayRuolo} />}
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="flex flex-col gap-1">
          {otherAziende.map((a) => (
            <button
              key={a.societa.id}
              onClick={() => handleSwitch(a.societa.id)}
              disabled={switching}
              className="flex flex-col gap-0.5 rounded-md px-2 py-2 text-left hover:bg-accent transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {a.societa.ragioneSociale}
                </span>
                <RoleBadge ruolo={a.ruolo} />
              </div>
              <span className="text-xs text-muted-foreground">
                Ultimo accesso: {formatDate(a.ultimoAccesso)}
              </span>
            </button>
          ))}
        </div>
        <div className="border-t mt-1 pt-1">
          <Link
            href="/aziende"
            onClick={() => setOpen(false)}
            className="flex items-center rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            Tutte le aziende
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
