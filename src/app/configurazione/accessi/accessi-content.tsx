"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  UserPlus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Mail,
} from "lucide-react";
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
  DialogDescription,
  DialogFooter,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---------- Types ----------

type UtenteOption = {
  id: number;
  nome: string;
  cognome: string;
  email: string;
};

type Accesso = {
  id: number;
  utenteId: number;
  societaId: number;
  ruolo: string;
  attivo: boolean;
  ultimoAccesso: string | null;
  createdAt: string;
  updatedAt: string;
  utente: {
    id: number;
    nome: string;
    cognome: string;
    email: string;
  };
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
    nome: string;
    cognome: string;
  };
};

type LogResponse = {
  data: LogEntry[];
  total: number;
  page: number;
  perPage: number;
};

type Props = {
  currentUserId: number;
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

// ---------- Access Management Section ----------

function AccessiUtenti({
  currentUserId,
  accessi,
  onRefresh,
}: {
  currentUserId: number;
  accessi: Accesso[];
  onRefresh: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [invitaDialogOpen, setInvitaDialogOpen] = useState(false);
  const [invitaCommercialistaOpen, setInvitaCommercialistaOpen] = useState(false);
  const [invitaEmail, setInvitaEmail] = useState("");
  const [invitaLoading, setInvitaLoading] = useState(false);

  async function handleToggleAttivo(accesso: Accesso) {
    setUpdatingId(accesso.id);
    try {
      const res = await fetch(`/api/azienda/accessi/${accesso.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attivo: !accesso.attivo }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Errore nell'aggiornamento");
        return;
      }
      toast.success(
        accesso.attivo ? "Accesso disattivato" : "Accesso riattivato"
      );
      onRefresh();
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleChangeRuolo(accesso: Accesso, newRuolo: string) {
    setUpdatingId(accesso.id);
    try {
      const res = await fetch(`/api/azienda/accessi/${accesso.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruolo: newRuolo }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Errore nell'aggiornamento del ruolo");
        return;
      }
      toast.success("Ruolo aggiornato");
      onRefresh();
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/azienda/accessi/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Errore nella rimozione");
        return;
      }
      toast.success("Accesso rimosso");
      onRefresh();
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  async function handleInvitaCommercialista() {
    if (!invitaEmail.trim()) {
      toast.error("Inserisci un indirizzo email");
      return;
    }
    setInvitaLoading(true);
    try {
      const res = await fetch("/api/azienda/invita-commercialista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: invitaEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Errore nell'invito");
        return;
      }
      if (data.invitoPendente) {
        toast.success(
          `Invito inviato a ${invitaEmail}. L'utente dovra registrarsi per accettarlo.`
        );
      } else {
        toast.success(`Commercialista ${invitaEmail} aggiunto con successo.`);
      }
      setInvitaEmail("");
      setInvitaCommercialistaOpen(false);
      onRefresh();
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setInvitaLoading(false);
    }
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Utenti con accesso</CardTitle>
              <CardDescription>
                Gestisci chi puo accedere a questa azienda
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInvitaDialogOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Invita utente
              </Button>
              <Button
                size="sm"
                onClick={() => setInvitaCommercialistaOpen(true)}
              >
                <Mail className="mr-2 h-4 w-4" />
                Invita commercialista
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {accessi.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Nessun utente con accesso.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Ultimo Accesso</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessi.map((a) => {
                  const isSelf = a.utenteId === currentUserId;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {a.utente.nome} {a.utente.cognome}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (tu)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.utente.email}
                      </TableCell>
                      <TableCell>
                        {isSelf ? (
                          <Badge variant="outline">{a.ruolo}</Badge>
                        ) : (
                          <Select
                            value={a.ruolo}
                            onValueChange={(val) => handleChangeRuolo(a, val)}
                            disabled={updatingId === a.id}
                          >
                            <SelectTrigger className="w-[170px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ADMIN">ADMIN</SelectItem>
                              <SelectItem value="STANDARD">STANDARD</SelectItem>
                              <SelectItem value="COMMERCIALISTA">
                                COMMERCIALISTA
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {a.ultimoAccesso
                          ? formatTimestamp(a.ultimoAccesso)
                          : "Mai"}
                      </TableCell>
                      <TableCell>
                        {a.attivo ? (
                          <Badge className="bg-green-500/15 text-green-400">
                            Attivo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/15 text-red-400">
                            Disattivato
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSelf && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleAttivo(a)}
                              disabled={updatingId === a.id}
                              title={
                                a.attivo
                                  ? "Disattiva accesso"
                                  : "Riattiva accesso"
                              }
                            >
                              {a.attivo ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteId(a.id)}
                              disabled={deletingId === a.id}
                              title="Rimuovi accesso"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invita utente (placeholder) */}
      <Dialog open={invitaDialogOpen} onOpenChange={setInvitaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invita utente</DialogTitle>
            <DialogDescription>
              Per invitare un utente standard, comunicagli il link di
              registrazione e poi aggiungilo manualmente dalla lista accessi una
              volta registrato.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInvitaDialogOpen(false)}
            >
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invita commercialista */}
      <Dialog
        open={invitaCommercialistaOpen}
        onOpenChange={setInvitaCommercialistaOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invita commercialista</DialogTitle>
            <DialogDescription>
              Inserisci l&apos;email del commercialista. Se gia registrato, verra
              aggiunto immediatamente. Altrimenti ricevera un invito.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invita-email">Email</Label>
              <Input
                id="invita-email"
                type="email"
                placeholder="commercialista@esempio.it"
                value={invitaEmail}
                onChange={(e) => setInvitaEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInvitaCommercialista();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInvitaCommercialistaOpen(false);
                setInvitaEmail("");
              }}
            >
              Annulla
            </Button>
            <Button
              onClick={handleInvitaCommercialista}
              disabled={invitaLoading}
            >
              {invitaLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Invita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rimuovere accesso?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;utente non potra piu accedere a questa azienda. Questa
              azione non puo essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId !== null) handleDelete(confirmDeleteId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Rimuovi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------- Log Section ----------

function LogAttivitaSection({
  utenti,
  tabelle,
}: {
  utenti: UtenteOption[];
  tabelle: string[];
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters
  const [filterDal, setFilterDal] = useState("");
  const [filterAl, setFilterAl] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterAzione, setFilterAzione] = useState("");
  const [filterTabella, setFilterTabella] = useState("");

  const totalPages = Math.ceil(total / perPage);

  // Build a lookup of commercialista user IDs for row highlighting
  const [commercialistaIds, setCommercialistaIds] = useState<Set<number>>(
    new Set()
  );

  // Fetch accessi to know which users are COMMERCIALISTA
  useEffect(() => {
    async function fetchAccessi() {
      try {
        const res = await fetch("/api/azienda/accessi");
        if (res.ok) {
          const data: Accesso[] = await res.json();
          const ids = new Set(
            data
              .filter((a) => a.ruolo === "COMMERCIALISTA")
              .map((a) => a.utenteId)
          );
          setCommercialistaIds(ids);
        }
      } catch {
        // ignore
      }
    }
    fetchAccessi();
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("perPage", String(perPage));
      if (filterDal) params.set("dal", filterDal);
      if (filterAl) params.set("al", filterAl);
      if (filterUserId) params.set("utenteId", filterUserId);
      if (filterAzione) params.set("azione", filterAzione);
      if (filterTabella) params.set("tabella", filterTabella);

      const res = await fetch(`/api/azienda/log?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json();
        toast.error(errorData.error || "Errore nel caricamento dei log");
        return;
      }

      const result: LogResponse = await res.json();
      setLogs(result.data);
      setTotal(result.total);
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, filterDal, filterAl, filterUserId, filterAzione, filterTabella]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function handleSearch() {
    setPage(1);
    fetchLogs();
  }

  function handleReset() {
    setFilterDal("");
    setFilterAl("");
    setFilterUserId("");
    setFilterAzione("");
    setFilterTabella("");
    setPage(1);
  }

  return (
    <>
      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Filtri Log</CardTitle>
          <CardDescription>
            Filtra i log per periodo, utente, azione o tabella.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="grid gap-2">
              <Label htmlFor="filter-dal">Dal</Label>
              <Input
                id="filter-dal"
                type="date"
                value={filterDal}
                onChange={(e) => setFilterDal(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="filter-al">Al</Label>
              <Input
                id="filter-al"
                type="date"
                value={filterAl}
                onChange={(e) => setFilterAl(e.target.value)}
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

      {/* Log Table */}
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
                    <TableHead className="text-right">Dettaglio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const isCommercialista = commercialistaIds.has(log.userId);
                    return (
                      <TableRow
                        key={log.id}
                        className={
                          isCommercialista
                            ? "bg-violet-500/5 hover:bg-violet-500/10"
                            : undefined
                        }
                      >
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatTimestamp(log.timestamp)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.utente.nome} {log.utente.cognome}
                          {isCommercialista && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-xs border-violet-500/30 text-violet-400"
                            >
                              Commercialista
                            </Badge>
                          )}
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
                            onClick={() => {
                              setSelectedLog(log);
                              setDialogOpen(true);
                            }}
                            title="Visualizza dettaglio"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Dettaglio</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* Log Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dettaglio Log</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Data e ora</Label>
                  <p className="font-medium">
                    {formatTimestamp(selectedLog.timestamp)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Utente</Label>
                  <p className="font-medium">
                    {selectedLog.utente.nome} {selectedLog.utente.cognome}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Azione</Label>
                  <div className="mt-1">
                    {getAzioneBadge(selectedLog.azione)}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tabella</Label>
                  <p className="font-medium">{selectedLog.tabella}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Record ID</Label>
                  <p className="font-mono font-medium">
                    {selectedLog.recordId}
                  </p>
                </div>
                {selectedLog.ipAddress && (
                  <div>
                    <Label className="text-muted-foreground">
                      Indirizzo IP
                    </Label>
                    <p className="font-mono font-medium">
                      {selectedLog.ipAddress}
                    </p>
                  </div>
                )}
              </div>

              {(selectedLog.valoriPrima || selectedLog.valoriDopo) && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">
                    Dati
                  </Label>
                  <pre className="text-xs overflow-auto max-h-96 rounded-md border bg-muted/50 p-3 font-mono leading-relaxed">
                    <code>
                      {selectedLog.valoriPrima && (
                        <>
                          <span className="text-red-400">- Prima:</span>
                          {"\n"}
                          {JSON.stringify(selectedLog.valoriPrima, null, 2)}
                          {"\n\n"}
                        </>
                      )}
                      {selectedLog.valoriDopo && (
                        <>
                          <span className="text-green-400">+ Dopo:</span>
                          {"\n"}
                          {JSON.stringify(selectedLog.valoriDopo, null, 2)}
                        </>
                      )}
                    </code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Main Component ----------

export function AccessiContent({ currentUserId, utenti, tabelle }: Props) {
  const [accessi, setAccessi] = useState<Accesso[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccessi = useCallback(async () => {
    try {
      const res = await fetch("/api/azienda/accessi");
      if (res.ok) {
        const data = await res.json();
        setAccessi(data);
      } else {
        toast.error("Errore nel caricamento degli accessi");
      }
    } catch {
      toast.error("Errore di connessione");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccessi();
  }, [fetchAccessi]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AccessiUtenti
        currentUserId={currentUserId}
        accessi={accessi}
        onRefresh={fetchAccessi}
      />
      <LogAttivitaSection utenti={utenti} tabelle={tabelle} />
    </div>
  );
}
