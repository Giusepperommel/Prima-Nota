"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Eye, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------- Types ----------

type UtenteOption = {
  id: number;
  email: string;
  nome: string;
  cognome: string;
};

type LogEntry = {
  id: number;
  userId: number;
  azione: "INSERT" | "UPDATE" | "DELETE";
  tabella: string;
  recordId: number;
  valoriPrima: Record<string, unknown> | null;
  valoriDopo: Record<string, unknown> | null;
  ipAddress: string | null;
  timestamp: string;
  utente: {
    id: number;
    email: string;
    socio: {
      nome: string;
      cognome: string;
    };
  };
};

type LogResponse = {
  data: LogEntry[];
  total: number;
  page: number;
  perPage: number;
};

type Props = {
  utenti: UtenteOption[];
  tabelle: string[];
};

// ---------- Helpers ----------

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatFullTimestamp(isoString: string): string {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function getAzioneBadge(azione: "INSERT" | "UPDATE" | "DELETE") {
  switch (azione) {
    case "INSERT":
      return (
        <Badge className="bg-green-500/15 text-green-400 hover:bg-green-500/20">
          INSERT
        </Badge>
      );
    case "UPDATE":
      return (
        <Badge className="bg-blue-500/15 text-blue-400 hover:bg-blue-500/20">
          UPDATE
        </Badge>
      );
    case "DELETE":
      return (
        <Badge className="bg-red-500/15 text-red-400 hover:bg-red-500/20">
          DELETE
        </Badge>
      );
  }
}

/**
 * Renders a JSON value with highlighted differences compared to another JSON object.
 * Changed keys are highlighted with a colored background.
 */
function JsonDiffView({
  data,
  compareWith,
  highlightColor,
}: {
  data: Record<string, unknown> | null;
  compareWith?: Record<string, unknown> | null;
  highlightColor: "red" | "green";
}) {
  if (!data) {
    return (
      <p className="text-muted-foreground text-sm italic">Nessun dato</p>
    );
  }

  const bgClass =
    highlightColor === "red"
      ? "bg-red-500/15"
      : "bg-green-500/15";

  const entries = Object.entries(data);

  return (
    <pre className="text-xs overflow-auto max-h-96 rounded-md border bg-muted/50 p-3 font-mono leading-relaxed">
      <code>
        {"{\n"}
        {entries.map(([key, value], index) => {
          const isChanged =
            compareWith !== undefined &&
            compareWith !== null &&
            JSON.stringify(compareWith[key]) !== JSON.stringify(value);
          const isNewKey =
            compareWith !== undefined &&
            compareWith !== null &&
            !(key in compareWith);
          const isRemovedKey =
            compareWith !== undefined && compareWith === null;

          const shouldHighlight = isChanged || isNewKey || isRemovedKey;
          const formattedValue = JSON.stringify(value, null, 2);
          const line = `  "${key}": ${formattedValue}${index < entries.length - 1 ? "," : ""}`;

          return (
            <span
              key={key}
              className={shouldHighlight ? bgClass : undefined}
            >
              {line}
              {"\n"}
            </span>
          );
        })}
        {"}"}
      </code>
    </pre>
  );
}

// ---------- Component ----------

export function LogTable({ utenti, tabelle }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters
  const [filterDa, setFilterDa] = useState("");
  const [filterA, setFilterA] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterAzione, setFilterAzione] = useState("");
  const [filterTabella, setFilterTabella] = useState("");

  const totalPages = Math.ceil(total / perPage);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(perPage));

      if (filterDa) params.set("da", filterDa);
      if (filterA) params.set("a", filterA);
      if (filterUserId) params.set("userId", filterUserId);
      if (filterAzione) params.set("azione", filterAzione);
      if (filterTabella) params.set("tabella", filterTabella);

      const response = await fetch(`/api/log-attivita?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || "Errore nel caricamento dei log");
        return;
      }

      const result: LogResponse = await response.json();
      setLogs(result.data);
      setTotal(result.total);
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, filterDa, filterA, filterUserId, filterAzione, filterTabella]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleSearch() {
    setPage(1);
    fetchLogs();
  }

  function handleReset() {
    setFilterDa("");
    setFilterA("");
    setFilterUserId("");
    setFilterAzione("");
    setFilterTabella("");
    setPage(1);
  }

  function openDetail(log: LogEntry) {
    setSelectedLog(log);
    setDialogOpen(true);
  }

  return (
    <>
      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Filtri</CardTitle>
          <CardDescription>Filtra i log per periodo, utente, azione o tabella.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="grid gap-2">
              <Label htmlFor="filter-da">Data da</Label>
              <Input
                id="filter-da"
                type="date"
                value={filterDa}
                onChange={(e) => setFilterDa(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="filter-a">Data a</Label>
              <Input
                id="filter-a"
                type="date"
                value={filterA}
                onChange={(e) => setFilterA(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label>Utente</Label>
              <Select
                value={filterUserId}
                onValueChange={(value) =>
                  setFilterUserId(value === "__all__" ? "" : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tutti gli utenti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutti gli utenti</SelectItem>
                  {utenti.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.cognome} {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Azione</Label>
              <Select
                value={filterAzione}
                onValueChange={(value) =>
                  setFilterAzione(value === "__all__" ? "" : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tutte le azioni" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutte le azioni</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Tabella</Label>
              <Select
                value={filterTabella}
                onValueChange={(value) =>
                  setFilterTabella(value === "__all__" ? "" : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tutte le tabelle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutte le tabelle</SelectItem>
                  {tabelle.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSearch} size="sm">
              <Search className="mr-2 h-4 w-4" />
              Cerca
            </Button>
            <Button onClick={handleReset} variant="outline" size="sm">
              <X className="mr-2 h-4 w-4" />
              Resetta filtri
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Log Attivita</CardTitle>
          <CardDescription>
            {total > 0
              ? `${total} risultat${total === 1 ? "o" : "i"} trovati - Pagina ${page} di ${totalPages}`
              : "Nessun risultato trovato"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground text-sm">Caricamento...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground text-sm">
                Nessun log trovato con i filtri selezionati.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Ora</TableHead>
                    <TableHead>Utente</TableHead>
                    <TableHead>Azione</TableHead>
                    <TableHead>Tabella</TableHead>
                    <TableHead>Record ID</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.utente.socio.nome} {log.utente.socio.cognome}
                      </TableCell>
                      <TableCell>{getAzioneBadge(log.azione)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.tabella}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.recordId}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetail(log)}
                          title="Visualizza dettaglio"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">Dettaglio</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(page - 1) * perPage + 1}-
                    {Math.min(page * perPage, total)} di {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Precedente
                    </Button>
                    <span className="text-sm font-medium px-2">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page >= totalPages}
                    >
                      Successiva
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dettaglio Log</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              {/* Info section */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Data e ora</Label>
                  <p className="font-medium">
                    {formatFullTimestamp(selectedLog.timestamp)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Utente</Label>
                  <p className="font-medium">
                    {selectedLog.utente.socio.nome}{" "}
                    {selectedLog.utente.socio.cognome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedLog.utente.email}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Azione</Label>
                  <div className="mt-1">{getAzioneBadge(selectedLog.azione)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tabella</Label>
                  <p className="font-medium">{selectedLog.tabella}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Record ID</Label>
                  <p className="font-mono font-medium">{selectedLog.recordId}</p>
                </div>
                {selectedLog.ipAddress && (
                  <div>
                    <Label className="text-muted-foreground">Indirizzo IP</Label>
                    <p className="font-mono font-medium">
                      {selectedLog.ipAddress}
                    </p>
                  </div>
                )}
              </div>

              {/* JSON Data */}
              {selectedLog.azione === "INSERT" && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">
                    Dopo (valori inseriti)
                  </Label>
                  <JsonDiffView
                    data={selectedLog.valoriDopo as Record<string, unknown> | null}
                    highlightColor="green"
                  />
                </div>
              )}

              {selectedLog.azione === "DELETE" && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">
                    Prima (valori eliminati)
                  </Label>
                  <JsonDiffView
                    data={selectedLog.valoriPrima as Record<string, unknown> | null}
                    highlightColor="red"
                  />
                </div>
              )}

              {selectedLog.azione === "UPDATE" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground mb-2 block">
                      Prima
                    </Label>
                    <JsonDiffView
                      data={
                        selectedLog.valoriPrima as Record<string, unknown> | null
                      }
                      compareWith={
                        selectedLog.valoriDopo as Record<string, unknown> | null
                      }
                      highlightColor="red"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground mb-2 block">
                      Dopo
                    </Label>
                    <JsonDiffView
                      data={
                        selectedLog.valoriDopo as Record<string, unknown> | null
                      }
                      compareWith={
                        selectedLog.valoriPrima as Record<string, unknown> | null
                      }
                      highlightColor="green"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
