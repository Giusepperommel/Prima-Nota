"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, UserX, AlertTriangle, UserPlus, Search } from "lucide-react";

type SocioData = {
  id: number;
  societaId: number | null;
  nome: string;
  cognome: string;
  codiceFiscale: string;
  email: string;
  quotaPercentuale: number;
  ruolo: string;
  dataIngresso: string | null;
  attivo: boolean;
  socioLavoratore: boolean;
  hasAccount: boolean;
  ultimoAccesso: string | null;
};

type SocioFormData = {
  nome: string;
  cognome: string;
  codiceFiscale: string;
  email: string;
  quotaPercentuale: string;
  ruolo: string;
  dataIngresso: string;
  socioLavoratore: boolean;
};

const emptyForm: SocioFormData = {
  nome: "",
  cognome: "",
  codiceFiscale: "",
  email: "",
  quotaPercentuale: "",
  ruolo: "STANDARD",
  dataIngresso: "",
  socioLavoratore: false,
};

type Props = {
  initialSoci: SocioData[];
  initialSommaQuote: number;
  currentSocioId: number | null;
};

type InviteFormData = {
  email: string;
  ruolo: string;
  quotaPercentuale: string;
  codiceFiscale: string;
  dataIngresso: string;
};

const emptyInviteForm: InviteFormData = {
  email: "",
  ruolo: "STANDARD",
  quotaPercentuale: "",
  codiceFiscale: "",
  dataIngresso: "",
};

export function SociClient({ initialSoci, initialSommaQuote, currentSocioId }: Props) {
  const [soci, setSoci] = useState<SocioData[]>(initialSoci);
  const [sommaQuote, setSommaQuote] = useState(initialSommaQuote);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedSocio, setSelectedSocio] = useState<SocioData | null>(null);
  const [formData, setFormData] = useState<SocioFormData>(emptyForm);
  const [inviteFormData, setInviteFormData] = useState<InviteFormData>(emptyInviteForm);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const ricalcolaSommaQuote = useCallback((lista: SocioData[]) => {
    const somma = lista
      .filter((s) => s.attivo)
      .reduce((sum, s) => sum + s.quotaPercentuale, 0);
    setSommaQuote(somma);
    return somma;
  }, []);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRuoloChange = (value: string) => {
    setFormData((prev) => ({ ...prev, ruolo: value }));
  };

  const handleSocioLavoratoreChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, socioLavoratore: checked }));
  };

  // --- CREAZIONE ---
  const openCreateDialog = () => {
    setFormData(emptyForm);
    setCreateDialogOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/soci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.nome,
          cognome: formData.cognome || null,
          codiceFiscale: formData.codiceFiscale || null,
          email: formData.email || null,
          quotaPercentuale: formData.quotaPercentuale ? parseFloat(formData.quotaPercentuale) : null,
          ruolo: formData.ruolo,
          dataIngresso: formData.dataIngresso || null,
          socioLavoratore: formData.socioLavoratore,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Errore durante la creazione");
        return;
      }

      const nuovoSocio: SocioData = {
        id: data.id,
        societaId: data.societaId,
        nome: data.nome,
        cognome: data.cognome,
        codiceFiscale: data.codiceFiscale,
        email: data.email,
        quotaPercentuale: data.quotaPercentuale,
        ruolo: data.ruolo,
        dataIngresso: data.dataIngresso
          ? new Date(data.dataIngresso).toISOString().split("T")[0]
          : null,
        attivo: data.attivo,
        socioLavoratore: data.socioLavoratore ?? false,
        hasAccount: true,
        ultimoAccesso: null,
      };

      const nuovaLista = [...soci, nuovoSocio].sort((a, b) => {
        if (a.attivo !== b.attivo) return a.attivo ? -1 : 1;
        return a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome);
      });

      setSoci(nuovaLista);
      ricalcolaSommaQuote(nuovaLista);
      setCreateDialogOpen(false);
      toast.success("Socio e account utente creati con successo");

      if (data.warningQuote) {
        toast.warning(data.warningQuote);
      }
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setLoading(false);
    }
  };

  // --- MODIFICA ---
  const openEditDialog = (socio: SocioData) => {
    setSelectedSocio(socio);
    setFormData({
      nome: socio.nome,
      cognome: socio.cognome,
      codiceFiscale: socio.codiceFiscale,
      email: socio.email,
      quotaPercentuale: String(socio.quotaPercentuale),
      ruolo: socio.ruolo,
      dataIngresso: socio.dataIngresso ?? "",
      socioLavoratore: socio.socioLavoratore,
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSocio) return;
    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        nome: formData.nome,
        cognome: formData.cognome || null,
        codiceFiscale: formData.codiceFiscale || null,
        email: formData.email || null,
        quotaPercentuale: formData.quotaPercentuale ? parseFloat(formData.quotaPercentuale) : null,
        ruolo: formData.ruolo,
        dataIngresso: formData.dataIngresso || null,
        socioLavoratore: formData.socioLavoratore,
      };

      const res = await fetch(`/api/soci/${selectedSocio.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Errore durante l'aggiornamento");
        return;
      }

      const existingSocio = soci.find((s) => s.id === selectedSocio.id);
      const socioAggiornato: SocioData = {
        id: data.id,
        societaId: data.societaId,
        nome: data.nome,
        cognome: data.cognome,
        codiceFiscale: data.codiceFiscale,
        email: data.email,
        quotaPercentuale: data.quotaPercentuale,
        ruolo: data.ruolo,
        dataIngresso: data.dataIngresso
          ? new Date(data.dataIngresso).toISOString().split("T")[0]
          : null,
        attivo: data.attivo,
        socioLavoratore: data.socioLavoratore ?? false,
        hasAccount: existingSocio?.hasAccount ?? true,
        ultimoAccesso: existingSocio?.ultimoAccesso ?? null,
      };

      const nuovaLista = soci
        .map((s) => (s.id === socioAggiornato.id ? socioAggiornato : s))
        .sort((a, b) => {
          if (a.attivo !== b.attivo) return a.attivo ? -1 : 1;
          return a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome);
        });

      setSoci(nuovaLista);
      ricalcolaSommaQuote(nuovaLista);
      setEditDialogOpen(false);
      setSelectedSocio(null);
      toast.success("Socio aggiornato con successo");

      if (data.warningQuote) {
        toast.warning(data.warningQuote);
      }
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setLoading(false);
    }
  };

  // --- DISATTIVAZIONE ---
  const openDeactivateDialog = (socio: SocioData) => {
    setSelectedSocio(socio);
    setDeactivateDialogOpen(true);
  };

  const handleDeactivate = async () => {
    if (!selectedSocio) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/soci/${selectedSocio.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Errore durante la disattivazione");
        return;
      }

      const nuovaLista = soci
        .map((s) => (s.id === selectedSocio.id ? { ...s, attivo: false } : s))
        .sort((a, b) => {
          if (a.attivo !== b.attivo) return a.attivo ? -1 : 1;
          return a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome);
        });

      setSoci(nuovaLista);
      ricalcolaSommaQuote(nuovaLista);
      setDeactivateDialogOpen(false);
      setSelectedSocio(null);
      toast.success("Socio disattivato con successo");

      if (data.warningQuote) {
        toast.warning(data.warningQuote);
      }
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setLoading(false);
    }
  };

  // --- INVITO SOCIO ESISTENTE ---
  const openInviteDialog = () => {
    setInviteFormData(emptyInviteForm);
    setInviteDialogOpen(true);
  };

  const handleInviteFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInviteFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInviteRuoloChange = (value: string) => {
    setInviteFormData((prev) => ({ ...prev, ruolo: value }));
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);

    try {
      const res = await fetch("/api/soci/invita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteFormData.email,
          ruolo: inviteFormData.ruolo,
          quotaPercentuale: parseFloat(inviteFormData.quotaPercentuale),
          codiceFiscale: inviteFormData.codiceFiscale || undefined,
          dataIngresso: inviteFormData.dataIngresso || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Errore durante l'invito");
        return;
      }

      const nuovoSocio: SocioData = {
        id: data.id,
        societaId: data.societaId,
        nome: data.nome,
        cognome: data.cognome,
        codiceFiscale: data.codiceFiscale,
        email: data.email,
        quotaPercentuale: data.quotaPercentuale,
        ruolo: data.ruolo,
        dataIngresso: data.dataIngresso,
        attivo: data.attivo,
        socioLavoratore: data.socioLavoratore ?? false,
        hasAccount: true,
        ultimoAccesso: null,
      };

      const nuovaLista = [...soci, nuovoSocio].sort((a, b) => {
        if (a.attivo !== b.attivo) return a.attivo ? -1 : 1;
        return a.cognome.localeCompare(b.cognome) || a.nome.localeCompare(b.nome);
      });

      setSoci(nuovaLista);
      ricalcolaSommaQuote(nuovaLista);
      setInviteDialogOpen(false);
      toast.success(`${data.nome} ${data.cognome} aggiunto alla societa`);

      if (data.warningQuote) {
        toast.warning(data.warningQuote);
      }
    } catch {
      toast.error("Errore di connessione al server");
    } finally {
      setInviteLoading(false);
    }
  };

  const quoteOk = Math.abs(sommaQuote - 100) < 0.01;

  return (
    <div className="space-y-6">
      {/* Avviso somma quote */}
      {!quoteOk && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <strong>Attenzione:</strong> la somma delle quote dei soci attivi e&apos;{" "}
            <strong>{sommaQuote.toFixed(2)}%</strong> (dovrebbe essere 100%).
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Elenco Soci</CardTitle>
            <CardDescription>
              Gestisci i soci della societa. Somma quote attive:{" "}
              <span className={quoteOk ? "text-green-400 font-semibold" : "text-yellow-400 font-semibold"}>
                {sommaQuote.toFixed(2)}%
              </span>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openInviteDialog}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invita Socio
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuovo Socio
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Aggiungi Nuovo Socio</DialogTitle>
                <DialogDescription>
                  Inserisci i dati del nuovo socio. Il socio potra&apos; registrarsi
                  autonomamente sulla piattaforma in seguito.
                </DialogDescription>
              </DialogHeader>
              <SocioForm
                formData={formData}
                onChange={handleFormChange}
                onRuoloChange={handleRuoloChange}
                onSocioLavoratoreChange={handleSocioLavoratoreChange}
                onSubmit={handleCreate}
                loading={loading}
                isEdit={false}
              />
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {soci.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nessun socio presente. Clicca su &quot;Nuovo Socio&quot; per aggiungerne uno.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cognome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Quota %</TableHead>
                  <TableHead className="text-center">Ruolo</TableHead>
                  <TableHead className="text-center">Lavoratore</TableHead>
                  <TableHead className="text-center">Account</TableHead>
                  <TableHead className="text-center">Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soci.map((socio) => (
                  <TableRow
                    key={socio.id}
                    className={!socio.attivo ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">{socio.nome}</TableCell>
                    <TableCell>{socio.cognome}</TableCell>
                    <TableCell>{socio.email}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {socio.quotaPercentuale.toFixed(2)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={socio.ruolo === "ADMIN" ? "default" : "secondary"}
                      >
                        {socio.ruolo === "ADMIN" ? "Amministratore" : "Standard"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          socio.socioLavoratore
                            ? "bg-violet-500/15 text-violet-400 border-violet-500/25"
                            : "text-muted-foreground"
                        }
                      >
                        {socio.socioLavoratore ? "Si" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {socio.hasAccount ? (
                        <div className="text-xs">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
                            Attivo
                          </Badge>
                          {socio.ultimoAccesso && (
                            <p className="text-muted-foreground mt-1">
                              Ultimo: {new Date(socio.ultimoAccesso).toLocaleDateString("it-IT")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Nessun account
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={socio.attivo ? "default" : "destructive"}
                        className={
                          socio.attivo
                            ? "bg-green-500/15 text-green-400"
                            : ""
                        }
                      >
                        {socio.attivo ? "Attivo" : "Disattivato"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(socio)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Modifica</span>
                        </Button>
                        {socio.attivo && socio.id !== currentSocioId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => openDeactivateDialog(socio)}
                          >
                            <UserX className="h-4 w-4" />
                            <span className="sr-only">Disattiva</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog Modifica */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifica Socio</DialogTitle>
            <DialogDescription>
              Modifica i dati del socio {selectedSocio?.nome} {selectedSocio?.cognome}.
            </DialogDescription>
          </DialogHeader>
          <SocioForm
            formData={formData}
            onChange={handleFormChange}
            onRuoloChange={handleRuoloChange}
            onSocioLavoratoreChange={handleSocioLavoratoreChange}
            onSubmit={handleEdit}
            loading={loading}
            isEdit={true}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog Conferma Disattivazione */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Disattivazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler disattivare il socio{" "}
              <strong>
                {selectedSocio?.nome} {selectedSocio?.cognome}
              </strong>
              ? L&apos;utente non potra&apos; piu&apos; accedere al sistema.
              Questa azione non elimina i dati ma disabilita l&apos;accesso.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateDialogOpen(false)}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserX className="mr-2 h-4 w-4" />
              )}
              Disattiva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Invita Socio Esistente */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invita Socio Esistente</DialogTitle>
            <DialogDescription>
              Aggiungi un utente gia registrato su Prima Nota alla tua societa.
              L&apos;utente deve essersi registrato e aver verificato la sua email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="invite-email">Email dell&apos;utente *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    name="email"
                    type="email"
                    value={inviteFormData.email}
                    onChange={handleInviteFormChange}
                    required
                    placeholder="email@utente.com"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Inserisci l&apos;email con cui l&apos;utente si e registrato.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-codiceFiscale">Codice Fiscale</Label>
                <Input
                  id="invite-codiceFiscale"
                  name="codiceFiscale"
                  value={inviteFormData.codiceFiscale}
                  onChange={handleInviteFormChange}
                  maxLength={16}
                  placeholder="RSSMRA80A01H501U"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-quotaPercentuale">Quota (%) *</Label>
                <Input
                  id="invite-quotaPercentuale"
                  name="quotaPercentuale"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  value={inviteFormData.quotaPercentuale}
                  onChange={handleInviteFormChange}
                  required
                  placeholder="20.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-ruolo">Ruolo *</Label>
                <Select value={inviteFormData.ruolo} onValueChange={handleInviteRuoloChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona ruolo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard</SelectItem>
                    <SelectItem value="ADMIN">Amministratore</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-dataIngresso">Data Ingresso</Label>
                <Input
                  id="invite-dataIngresso"
                  name="dataIngresso"
                  type="date"
                  value={inviteFormData.dataIngresso}
                  onChange={handleInviteFormChange}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={inviteLoading}>
                {inviteLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Invita Socio
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Componente Form riutilizzabile ---

function SocioForm({
  formData,
  onChange,
  onRuoloChange,
  onSocioLavoratoreChange,
  onSubmit,
  loading,
  isEdit,
}: {
  formData: SocioFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRuoloChange: (value: string) => void;
  onSocioLavoratoreChange: (checked: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  isEdit: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome *</Label>
          <Input
            id="nome"
            name="nome"
            value={formData.nome}
            onChange={onChange}
            required
            placeholder="Mario"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cognome">Cognome</Label>
          <Input
            id="cognome"
            name="cognome"
            value={formData.cognome}
            onChange={onChange}
            placeholder="Rossi"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={onChange}
            placeholder="mario.rossi@email.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="codiceFiscale">Codice Fiscale</Label>
          <Input
            id="codiceFiscale"
            name="codiceFiscale"
            value={formData.codiceFiscale}
            onChange={onChange}
            maxLength={16}
            placeholder="RSSMRA80A01H501U"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quotaPercentuale">Quota Percentuale (%)</Label>
          <Input
            id="quotaPercentuale"
            name="quotaPercentuale"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.quotaPercentuale}
            onChange={onChange}
            placeholder="50.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ruolo">Ruolo</Label>
          <Select value={formData.ruolo} onValueChange={onRuoloChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleziona ruolo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STANDARD">Standard</SelectItem>
              <SelectItem value="ADMIN">Amministratore</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dataIngresso">Data Ingresso</Label>
          <Input
            id="dataIngresso"
            name="dataIngresso"
            type="date"
            value={formData.dataIngresso}
            onChange={onChange}
          />
        </div>
        <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="socioLavoratore">Socio Lavoratore</Label>
            <p className="text-xs text-muted-foreground">
              Attiva se il socio presta opera nella societa (per calcolo INPS).
            </p>
          </div>
          <Switch
            id="socioLavoratore"
            checked={formData.socioLavoratore}
            onCheckedChange={onSocioLavoratoreChange}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {isEdit ? "Salva Modifiche" : "Crea Socio"}
        </Button>
      </DialogFooter>
    </form>
  );
}
