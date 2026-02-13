"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, SessionProvider } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Building2, User, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";

type SocietaData = {
  ragioneSociale: string;
  partitaIva: string;
  codiceFiscaleSocieta: string;
  indirizzo: string;
  regimeFiscale: string;
  capitaleSociale: string;
  dataCostituzione: string;
};

type SocioData = {
  codiceFiscale: string;
  quotaPercentuale: string;
  dataIngresso: string;
};

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Societa" },
    { num: 2, label: "I tuoi dati" },
    { num: 3, label: "Conferma" },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              currentStep > step.num
                ? "bg-primary text-primary-foreground"
                : currentStep === step.num
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {currentStep > step.num ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              step.num
            )}
          </div>
          <span
            className={`text-xs hidden sm:inline ${
              currentStep >= step.num
                ? "text-foreground font-medium"
                : "text-muted-foreground"
            }`}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`w-8 h-px ${
                currentStep > step.num ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CreaSocietaWizard() {
  const router = useRouter();
  const { update } = useSession();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [societaData, setSocietaData] = useState<SocietaData>({
    ragioneSociale: "",
    partitaIva: "",
    codiceFiscaleSocieta: "",
    indirizzo: "",
    regimeFiscale: "",
    capitaleSociale: "",
    dataCostituzione: "",
  });

  const [socioData, setSocioData] = useState<SocioData>({
    codiceFiscale: "",
    quotaPercentuale: "100",
    dataIngresso: new Date().toISOString().split("T")[0],
  });

  function handleSocietaChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setSocietaData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSocioChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSocioData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function validateStep1(): boolean {
    if (!societaData.ragioneSociale.trim()) {
      setError("Ragione sociale obbligatoria");
      return false;
    }
    if (!/^\d{11}$/.test(societaData.partitaIva)) {
      setError("La partita IVA deve essere composta da 11 cifre");
      return false;
    }
    if (!/^[A-Z0-9]{11,16}$/i.test(societaData.codiceFiscaleSocieta)) {
      setError("Il codice fiscale della societa non e' valido");
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    if (!/^[A-Z0-9]{16}$/i.test(socioData.codiceFiscale)) {
      setError("Il codice fiscale deve essere di 16 caratteri alfanumerici");
      return false;
    }
    const quota = parseFloat(socioData.quotaPercentuale);
    if (isNaN(quota) || quota <= 0 || quota > 100) {
      setError("La quota percentuale deve essere tra 0.01 e 100");
      return false;
    }
    if (!socioData.dataIngresso) {
      setError("La data di ingresso e' obbligatoria");
      return false;
    }
    return true;
  }

  function goToStep2() {
    setError("");
    if (validateStep1()) {
      setStep(2);
    }
  }

  function goToStep3() {
    setError("");
    if (validateStep2()) {
      setStep(3);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/societa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ragioneSociale: societaData.ragioneSociale,
          partitaIva: societaData.partitaIva,
          codiceFiscaleSocieta: societaData.codiceFiscaleSocieta,
          indirizzo: societaData.indirizzo || null,
          regimeFiscale: societaData.regimeFiscale || null,
          capitaleSociale: societaData.capitaleSociale
            ? parseFloat(societaData.capitaleSociale)
            : null,
          dataCostituzione: societaData.dataCostituzione || null,
          socio: {
            codiceFiscale: socioData.codiceFiscale,
            quotaPercentuale: parseFloat(socioData.quotaPercentuale),
            dataIngresso: socioData.dataIngresso,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Errore durante la configurazione");
        setLoading(false);
        return;
      }

      await update({ societaId: data.societaId, ruolo: "ADMIN" });
      router.push("/dashboard");
    } catch {
      setError("Errore di connessione. Riprova.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <StepIndicator currentStep={step} />

      {/* Step 1: Dati Societa */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span>Dati della societa</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="ragioneSociale">Ragione Sociale *</Label>
              <Input
                id="ragioneSociale"
                name="ragioneSociale"
                value={societaData.ragioneSociale}
                onChange={handleSocietaChange}
                placeholder="Es. Mario Rossi S.r.l."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partitaIva">Partita IVA *</Label>
              <Input
                id="partitaIva"
                name="partitaIva"
                value={societaData.partitaIva}
                onChange={handleSocietaChange}
                maxLength={11}
                placeholder="12345678901"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codiceFiscaleSocieta">Codice Fiscale Societa *</Label>
              <Input
                id="codiceFiscaleSocieta"
                name="codiceFiscaleSocieta"
                value={societaData.codiceFiscaleSocieta}
                onChange={handleSocietaChange}
                maxLength={16}
                placeholder="12345678901"
              />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="indirizzo">Indirizzo</Label>
              <Textarea
                id="indirizzo"
                name="indirizzo"
                value={societaData.indirizzo}
                onChange={handleSocietaChange}
                placeholder="Via Roma 1, 00100 Roma (RM)"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regimeFiscale">Regime Fiscale</Label>
              <Input
                id="regimeFiscale"
                name="regimeFiscale"
                value={societaData.regimeFiscale}
                onChange={handleSocietaChange}
                placeholder="Es. Ordinario, Forfettario"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capitaleSociale">Capitale Sociale</Label>
              <Input
                id="capitaleSociale"
                name="capitaleSociale"
                type="number"
                step="0.01"
                min="0"
                value={societaData.capitaleSociale}
                onChange={handleSocietaChange}
                placeholder="Es. 50000.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataCostituzione">Data Costituzione</Label>
              <Input
                id="dataCostituzione"
                name="dataCostituzione"
                type="date"
                value={societaData.dataCostituzione}
                onChange={handleSocietaChange}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex justify-end">
            <Button type="button" onClick={goToStep2}>
              Avanti
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Dati Socio */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>I tuoi dati come socio fondatore</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="codiceFiscale">Codice Fiscale Personale *</Label>
              <Input
                id="codiceFiscale"
                name="codiceFiscale"
                value={socioData.codiceFiscale}
                onChange={handleSocioChange}
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
                min="0.01"
                max="100"
                value={socioData.quotaPercentuale}
                onChange={handleSocioChange}
                placeholder="Es. 100"
              />
              <p className="text-xs text-muted-foreground">
                La tua quota di partecipazione nella societa. Potrai aggiungere altri soci in seguito.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataIngresso">Data Ingresso *</Label>
              <Input
                id="dataIngresso"
                name="dataIngresso"
                type="date"
                value={socioData.dataIngresso}
                onChange={handleSocioChange}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Indietro
            </Button>
            <Button type="button" onClick={goToStep3}>
              Avanti
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Riepilogo e Conferma */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Dati Societa
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ragione Sociale</span>
                  <span className="font-medium">{societaData.ragioneSociale}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Partita IVA</span>
                  <span className="font-medium">{societaData.partitaIva}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Codice Fiscale</span>
                  <span className="font-medium">{societaData.codiceFiscaleSocieta}</span>
                </div>
                {societaData.indirizzo && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Indirizzo</span>
                    <span className="font-medium text-right max-w-[200px]">
                      {societaData.indirizzo}
                    </span>
                  </div>
                )}
                {societaData.regimeFiscale && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Regime Fiscale</span>
                    <span className="font-medium">{societaData.regimeFiscale}</span>
                  </div>
                )}
                {societaData.capitaleSociale && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capitale Sociale</span>
                    <span className="font-medium">
                      {parseFloat(societaData.capitaleSociale).toLocaleString("it-IT", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </span>
                  </div>
                )}
                {societaData.dataCostituzione && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data Costituzione</span>
                    <span className="font-medium">
                      {new Date(societaData.dataCostituzione).toLocaleDateString("it-IT")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                I tuoi dati
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Codice Fiscale</span>
                  <span className="font-medium">{socioData.codiceFiscale}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quota</span>
                  <span className="font-medium">{socioData.quotaPercentuale}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data Ingresso</span>
                  <span className="font-medium">
                    {new Date(socioData.dataIngresso).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ruolo</span>
                  <span className="font-medium">Amministratore</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                Verranno create automaticamente <strong>20 categorie di spesa</strong> standard
                (carburante, telefonia, consulenze, ecc.) con le percentuali di deducibilita
                previste dalla normativa italiana. Potrai modificarle in seguito.
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError("");
                setStep(2);
              }}
              disabled={loading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Indietro
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              {loading ? "Configurazione in corso..." : "Conferma e Crea"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreaSocietaPage() {
  return (
    <SessionProvider>
      <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-8">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              Configura la tua Societa
            </CardTitle>
            <CardDescription>
              Completa la configurazione iniziale per iniziare a usare Prima Nota.
              Diventerai automaticamente l&apos;amministratore.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreaSocietaWizard />
          </CardContent>
        </Card>
      </div>
    </SessionProvider>
  );
}
