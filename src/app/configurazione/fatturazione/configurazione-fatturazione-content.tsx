"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, FileDown, Radio, Lock } from "lucide-react";
import { toast } from "sonner";

type Sezionale = {
  id: number;
  codice: string;
  descrizione: string;
  prefisso: string;
  separatore: string;
  tipiDocumento: string[];
  ultimoNumero: number;
  numeroIniziale: number;
  annoCorrente: number;
  paddingCifre: number;
  attivo: boolean;
  predefinito: boolean;
};

type ProviderConfig = {
  id?: number;
  provider: string;
  attivo: boolean;
  configurazione: any;
  ultimoTest?: string | null;
  esitoTest?: boolean | null;
};

const PROVIDERS = [
  {
    id: "MANUALE",
    name: "Manuale",
    description: "Scarica l'XML e caricalo manualmente sul portale SDI o sul tuo provider",
    available: true,
  },
  {
    id: "ARUBA",
    name: "Aruba",
    description: "Invio automatico tramite Aruba PEC / Fatturazione",
    available: false,
  },
  {
    id: "INFOCERT",
    name: "Infocert",
    description: "Invio automatico tramite Infocert Legalinvoice",
    available: false,
  },
];

export function ConfigurazioneFatturazioneContent() {
  // Sezionali state
  const [sezionali, setSezionali] = useState<Sezionale[]>([]);
  const [loadingSezionali, setLoadingSezionali] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSezionale, setEditingSezionale] = useState<Sezionale | null>(null);
  const [sezionaleForm, setSezionaleForm] = useState({
    codice: "",
    descrizione: "",
    prefisso: "",
    separatore: "/",
    paddingCifre: 1,
    predefinito: false,
  });
  const [saving, setSaving] = useState(false);

  // Provider state
  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    provider: "MANUALE",
    attivo: false,
    configurazione: null,
  });
  const [loadingProvider, setLoadingProvider] = useState(true);

  const loadSezionali = useCallback(async () => {
    setLoadingSezionali(true);
    try {
      const res = await fetch("/api/sezionali");
      if (res.ok) {
        const data = await res.json();
        setSezionali(data.sezionali);
      }
    } catch {
      toast.error("Errore nel caricamento dei sezionali");
    } finally {
      setLoadingSezionali(false);
    }
  }, []);

  const loadProvider = useCallback(async () => {
    setLoadingProvider(true);
    try {
      const res = await fetch("/api/configurazione/provider-fe");
      if (res.ok) {
        const data = await res.json();
        setProviderConfig(data.config);
      }
    } catch {
      toast.error("Errore nel caricamento della configurazione provider");
    } finally {
      setLoadingProvider(false);
    }
  }, []);

  useEffect(() => {
    loadSezionali();
    loadProvider();
  }, [loadSezionali, loadProvider]);

  const openNewSezionale = () => {
    setEditingSezionale(null);
    setSezionaleForm({
      codice: "",
      descrizione: "",
      prefisso: "",
      separatore: "/",
      paddingCifre: 1,
      predefinito: false,
    });
    setDialogOpen(true);
  };

  const openEditSezionale = (s: Sezionale) => {
    setEditingSezionale(s);
    setSezionaleForm({
      codice: s.codice,
      descrizione: s.descrizione,
      prefisso: s.prefisso,
      separatore: s.separatore,
      paddingCifre: s.paddingCifre,
      predefinito: s.predefinito,
    });
    setDialogOpen(true);
  };

  const handleSaveSezionale = async () => {
    setSaving(true);
    try {
      if (editingSezionale) {
        const res = await fetch(`/api/sezionali/${editingSezionale.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sezionaleForm),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
        toast.success("Sezionale aggiornato");
      } else {
        const res = await fetch("/api/sezionali", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...sezionaleForm,
            tipiDocumento: ["TD01"],
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
        toast.success("Sezionale creato");
      }
      setDialogOpen(false);
      loadSezionali();
    } catch (error: any) {
      toast.error(error.message || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSezionale = async (id: number) => {
    if (!confirm("Eliminare questo sezionale?")) return;
    try {
      const res = await fetch(`/api/sezionali/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Sezionale eliminato");
      loadSezionali();
    } catch (error: any) {
      toast.error(error.message || "Errore nell'eliminazione");
    }
  };

  const handleSelectProvider = async (providerId: string) => {
    try {
      const res = await fetch("/api/configurazione/provider-fe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const data = await res.json();
      setProviderConfig(data.config);
      toast.success(`Provider impostato: ${providerId}`);
    } catch (error: any) {
      toast.error(error.message || "Errore nel salvataggio");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Configurazione Fatturazione Elettronica</h1>

      <Tabs defaultValue="sezionali">
        <TabsList>
          <TabsTrigger value="sezionali">Sezionali</TabsTrigger>
          <TabsTrigger value="provider">Provider</TabsTrigger>
        </TabsList>

        {/* ─── Sezionali Tab ─────────────────────────────────────────────── */}
        <TabsContent value="sezionali" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sezionali Fattura</CardTitle>
                  <CardDescription>
                    Configura i registri di numerazione per le fatture elettroniche
                  </CardDescription>
                </div>
                <Button onClick={openNewSezionale}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Sezionale
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSezionali ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sezionali.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nessun sezionale configurato
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codice</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead>Prefisso</TableHead>
                      <TableHead>Separatore</TableHead>
                      <TableHead className="text-right">Ultimo N.</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sezionali.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono">{s.codice}</TableCell>
                        <TableCell>{s.descrizione}</TableCell>
                        <TableCell className="font-mono">{s.prefisso}</TableCell>
                        <TableCell className="font-mono">{s.separatore}</TableCell>
                        <TableCell className="text-right">{s.ultimoNumero}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {s.predefinito && (
                              <Badge variant="default" className="text-xs">
                                Predefinito
                              </Badge>
                            )}
                            <Badge
                              variant={s.attivo ? "secondary" : "outline"}
                              className={
                                s.attivo
                                  ? "bg-green-100 text-green-700 text-xs"
                                  : "text-xs"
                              }
                            >
                              {s.attivo ? "Attivo" : "Disattivo"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditSezionale(s)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSezionale(s.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Provider Tab ──────────────────────────────────────────────── */}
        <TabsContent value="provider" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Fatturazione Elettronica</CardTitle>
              <CardDescription>
                Scegli come inviare le fatture elettroniche al Sistema di Interscambio (SDI)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProvider ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid gap-4">
                  {PROVIDERS.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        providerConfig.provider === p.id
                          ? "border-primary bg-primary/5"
                          : p.available
                          ? "hover:border-gray-400 cursor-pointer"
                          : "opacity-60"
                      }`}
                      onClick={() => p.available && handleSelectProvider(p.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            providerConfig.provider === p.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-gray-100"
                          }`}
                        >
                          {p.available ? (
                            p.id === "MANUALE" ? (
                              <FileDown className="h-5 w-5" />
                            ) : (
                              <Radio className="h-5 w-5" />
                            )
                          ) : (
                            <Lock className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">
                            {p.name}
                            {!p.available && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Coming soon
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {p.description}
                          </p>
                        </div>
                      </div>
                      {providerConfig.provider === p.id && (
                        <Badge variant="default">Attivo</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Sezionale Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSezionale ? "Modifica Sezionale" : "Nuovo Sezionale"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codice">Codice</Label>
                <Input
                  id="codice"
                  value={sezionaleForm.codice}
                  onChange={(e) =>
                    setSezionaleForm((f) => ({ ...f, codice: e.target.value }))
                  }
                  placeholder="FT"
                  disabled={!!editingSezionale}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefisso">Prefisso</Label>
                <Input
                  id="prefisso"
                  value={sezionaleForm.prefisso}
                  onChange={(e) =>
                    setSezionaleForm((f) => ({ ...f, prefisso: e.target.value }))
                  }
                  placeholder="FT"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descrizione">Descrizione</Label>
              <Input
                id="descrizione"
                value={sezionaleForm.descrizione}
                onChange={(e) =>
                  setSezionaleForm((f) => ({
                    ...f,
                    descrizione: e.target.value,
                  }))
                }
                placeholder="Fatture"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="separatore">Separatore</Label>
                <Input
                  id="separatore"
                  value={sezionaleForm.separatore}
                  onChange={(e) =>
                    setSezionaleForm((f) => ({
                      ...f,
                      separatore: e.target.value,
                    }))
                  }
                  placeholder="/"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paddingCifre">Cifre numerazione</Label>
                <Input
                  id="paddingCifre"
                  type="number"
                  min={1}
                  max={10}
                  value={sezionaleForm.paddingCifre}
                  onChange={(e) =>
                    setSezionaleForm((f) => ({
                      ...f,
                      paddingCifre: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={sezionaleForm.predefinito}
                onCheckedChange={(checked) =>
                  setSezionaleForm((f) => ({ ...f, predefinito: checked }))
                }
              />
              <Label>Sezionale predefinito</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSaveSezionale} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSezionale ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
