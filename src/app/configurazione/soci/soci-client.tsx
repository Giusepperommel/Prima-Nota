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
import { toast } from "sonner";
import { Loader2, Plus, Pencil, UserX, AlertTriangle, KeyRound } from "lucide-react";

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
  password: string;
};

const emptyForm: SocioFormData = {
  nome: "",
  cognome: "",
  codiceFiscale: "",
  email: "",
  quotaPercentuale: "",
  ruolo: "STANDARD",
  dataIngresso: "",
  password: "",
};

type Props = {
  initialSoci: SocioData[];
  initialSommaQuote: number;
  currentSocioId: number;
};

export function SociClient({ initialSoci, initialSommaQuote, currentSocioId }: Props) {
  const [soci, setSoci] = useState<SocioData[]>(initialSoci);
  const [sommaQuote, setSommaQuote] = useState(initialSommaQuote);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [selectedSocio, setSelectedSocio] = useState<SocioData | null>(null);
  const [formData, setFormData] = useState<SocioFormData>(emptyForm);
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
          cognome: formData.cognome,
          codiceFiscale: formData.codiceFiscale,
          email: formData.email,
          quotaPercentuale: parseFloat(formData.quotaPercentuale),
          ruolo: formData.ruolo,
          dataIngresso: formData.dataIngresso || null,
          password: formData.password,
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
      password: "",
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
        cognome: formData.cognome,
        codiceFiscale: formData.codiceFiscale,
        email: formData.email,
        quotaPercentuale: parseFloat(formData.quotaPercentuale),
        ruolo: formData.ruolo,
        dataIngresso: formData.dataIngresso || null,
      };
      if (formData.password) {
        payload.password = formData.password;
      }

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
      const passwordChanged = formData.password.length > 0;
      toast.success(
        passwordChanged
          ? "Socio aggiornato e password modificata con successo"
          : "Socio aggiornato con successo"
      );

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
              <span className={quoteOk ? "text-green-600 font-semibold" : "text-yellow-600 font-semibold"}>
                {sommaQuote.toFixed(2)}%
              </span>
            </CardDescription>
          </div>
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
                  Inserisci i dati del nuovo socio. Verra&apos; creato anche l&apos;account utente
                  per l&apos;accesso al sistema.
                </DialogDescription>
              </DialogHeader>
              <SocioForm
                formData={formData}
                onChange={handleFormChange}
                onRuoloChange={handleRuoloChange}
                onSubmit={handleCreate}
                loading={loading}
                isEdit={false}
              />
            </DialogContent>
          </Dialog>
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
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
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
    </div>
  );
}

// --- Componente Form riutilizzabile ---

function SocioForm({
  formData,
  onChange,
  onRuoloChange,
  onSubmit,
  loading,
  isEdit,
}: {
  formData: SocioFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRuoloChange: (value: string) => void;
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
          <Label htmlFor="cognome">Cognome *</Label>
          <Input
            id="cognome"
            name="cognome"
            value={formData.cognome}
            onChange={onChange}
            required
            placeholder="Rossi"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={onChange}
            required
            placeholder="mario.rossi@email.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="codiceFiscale">Codice Fiscale *</Label>
          <Input
            id="codiceFiscale"
            name="codiceFiscale"
            value={formData.codiceFiscale}
            onChange={onChange}
            required
            maxLength={16}
            placeholder="RSSMRA80A01H501U"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quotaPercentuale">Quota Percentuale (%) *</Label>
          <Input
            id="quotaPercentuale"
            name="quotaPercentuale"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.quotaPercentuale}
            onChange={onChange}
            required
            placeholder="50.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ruolo">Ruolo *</Label>
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
        <div className="space-y-2">
          <Label htmlFor="password">
            {isEdit ? (
              <span className="flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5" />
                Nuova Password
                <span className="text-muted-foreground font-normal">(opzionale)</span>
              </span>
            ) : (
              "Password *"
            )}
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={onChange}
            required={!isEdit}
            minLength={8}
            placeholder={isEdit ? "Lascia vuoto per non modificare" : "Min. 8 caratteri"}
          />
          {isEdit && (
            <p className="text-xs text-muted-foreground">
              Compila solo se vuoi cambiare la password dell&apos;utente.
            </p>
          )}
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
