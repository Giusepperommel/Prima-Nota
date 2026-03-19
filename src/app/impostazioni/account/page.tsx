"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Loader2 } from "lucide-react";

export default function AccountSettingsPage() {
  const { data: session, update } = useSession();
  const user = session?.user as any;

  const [passwordAttuale, setPasswordAttuale] = useState("");
  const [nuovaPassword, setNuovaPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [showCommercialistaDialog, setShowCommercialistaDialog] = useState(false);
  const [togglingAvanzata, setTogglingAvanzata] = useState(false);
  const [togglingCommercialista, setTogglingCommercialista] = useState(false);

  const modalitaAvanzata = user?.modalitaAvanzata ?? false;
  const modalitaCommercialista = user?.modalitaCommercialista ?? false;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nuovaPassword !== confermaPassword) {
      toast.error("Le password non coincidono");
      return;
    }

    if (nuovaPassword.length < 8) {
      toast.error("La password deve essere di almeno 8 caratteri");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/utente/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordAttuale, nuovaPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Errore nel cambio password");
        return;
      }

      toast.success("Password aggiornata con successo");
      setPasswordAttuale("");
      setNuovaPassword("");
      setConfermaPassword("");
    } catch {
      toast.error("Errore nel cambio password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleToggleAvanzata = async (checked: boolean) => {
    setTogglingAvanzata(true);
    try {
      const res = await fetch("/api/utente/preferenze", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalitaAvanzata: checked }),
      });

      if (!res.ok) {
        toast.error("Errore nell'aggiornamento delle preferenze");
        return;
      }

      await update({ modalitaAvanzata: checked });
      toast.success(checked ? "Modalita avanzata attivata" : "Modalita avanzata disattivata");
    } catch {
      toast.error("Errore nell'aggiornamento delle preferenze");
    } finally {
      setTogglingAvanzata(false);
    }
  };

  const handleToggleCommercialista = async (checked: boolean) => {
    if (checked) {
      setShowCommercialistaDialog(true);
      return;
    }

    setTogglingCommercialista(true);
    try {
      const res = await fetch("/api/utente/preferenze", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalitaCommercialista: false }),
      });

      if (!res.ok) {
        toast.error("Errore nell'aggiornamento delle preferenze");
        return;
      }

      await update({ modalitaCommercialista: false });
      toast.success("Modalita commercialista disattivata");
    } catch {
      toast.error("Errore nell'aggiornamento delle preferenze");
    } finally {
      setTogglingCommercialista(false);
    }
  };

  const handleConfirmCommercialista = async () => {
    setShowCommercialistaDialog(false);
    setTogglingCommercialista(true);
    try {
      const res = await fetch("/api/utente/preferenze", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modalitaCommercialista: true }),
      });

      if (!res.ok) {
        toast.error("Errore nell'aggiornamento delle preferenze");
        return;
      }

      await update({ modalitaCommercialista: true });
      toast.success("Modalita commercialista attivata");
    } catch {
      toast.error("Errore nell'aggiornamento delle preferenze");
    } finally {
      setTogglingCommercialista(false);
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-8 px-4">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni Account</h1>
        <p className="text-muted-foreground">Gestisci il tuo profilo e le preferenze</p>
      </div>

      {/* Dati personali */}
      <Card>
        <CardHeader>
          <CardTitle>Dati personali</CardTitle>
          <CardDescription>Le tue informazioni personali</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">Nome</Label>
            <p className="text-sm font-medium">{user?.nome} {user?.cognome}</p>
          </div>
          <div className="grid gap-1">
            <Label className="text-muted-foreground text-xs">Email</Label>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
        </CardContent>
      </Card>

      {/* Cambio password */}
      <Card>
        <CardHeader>
          <CardTitle>Cambio password</CardTitle>
          <CardDescription>Aggiorna la tua password di accesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="passwordAttuale">Password attuale</Label>
              <Input
                id="passwordAttuale"
                type="password"
                value={passwordAttuale}
                onChange={(e) => setPasswordAttuale(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nuovaPassword">Nuova password</Label>
              <Input
                id="nuovaPassword"
                type="password"
                value={nuovaPassword}
                onChange={(e) => setNuovaPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confermaPassword">Conferma nuova password</Label>
              <Input
                id="confermaPassword"
                type="password"
                value={confermaPassword}
                onChange={(e) => setConfermaPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aggiorna password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Modalita Avanzata */}
      <Card>
        <CardHeader>
          <CardTitle>Modalita Avanzata</CardTitle>
          <CardDescription>
            Attiva funzionalita avanzate come il bilancio, il piano dei conti, i registri IVA e la gestione delle ritenute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="modalitaAvanzata" className="cursor-pointer">
              {modalitaAvanzata ? "Attiva" : "Disattiva"}
            </Label>
            <Switch
              id="modalitaAvanzata"
              checked={modalitaAvanzata}
              onCheckedChange={handleToggleAvanzata}
              disabled={togglingAvanzata}
            />
          </div>
        </CardContent>
      </Card>

      {/* Modalita Commercialista */}
      <Card>
        <CardHeader>
          <CardTitle>Modalita Commercialista</CardTitle>
          <CardDescription>
            Abilita strumenti avanzati riservati ai professionisti contabili. Questa modalita sblocca funzionalita aggiuntive per la gestione contabile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="modalitaCommercialista" className="cursor-pointer">
              {modalitaCommercialista ? "Attiva" : "Disattiva"}
            </Label>
            <Switch
              id="modalitaCommercialista"
              checked={modalitaCommercialista}
              onCheckedChange={handleToggleCommercialista}
              disabled={togglingCommercialista}
            />
          </div>
        </CardContent>
      </Card>

      {/* AlertDialog per conferma Commercialista */}
      <AlertDialog open={showCommercialistaDialog} onOpenChange={setShowCommercialistaDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Attivare la Modalita Commercialista?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Questa modalita sblocca le seguenti funzionalita:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Modifica piano dei conti</li>
                  <li>Registrazioni manuali</li>
                  <li>Export dati contabili</li>
                </ul>
                <p>Sei sicuro di voler procedere?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCommercialista}>
              Attiva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
