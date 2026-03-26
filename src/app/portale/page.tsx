"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardContent } from "./dashboard-content";
import { MessageSquare, FileText, Calculator } from "lucide-react";

type DashboardData = {
  pendingRequests: number;
  situazioneIva: {
    ivaDebito: number;
    ivaCredito: number;
    saldo: number;
  } | null;
  nextScadenza: {
    id: number;
    titolo: string;
    dataScadenza: string;
    importo: number | null;
  } | null;
  recentDocuments: Array<{
    id: number;
    nome: string;
    tipo: string;
    fileUrl: string;
    condivisoAt: string;
  }>;
};

type Richiesta = {
  id: number;
  tipo: string;
  titolo: string;
  messaggio: string;
  scadenza: string | null;
  domande: Array<{
    id: number;
    testo: string;
    opzioni: string[];
    rispostaSelezionata: string | null;
  }>;
};

type Documento = {
  id: number;
  nome: string;
  tipo: string;
  fileUrl: string;
  condivisoAt: string;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

const NAV_LINKS = [
  { href: "/portale/messaggi", label: "Messaggi", icon: MessageSquare },
  { href: "/portale/prima-nota", label: "Prima Nota", icon: FileText },
  { href: "/portale/fiscale", label: "Fiscale", icon: Calculator },
];

export default function PortaleDashboardPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [richieste, setRichieste] = useState<Richiesta[]>([]);
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [rispostaText, setRispostaText] = useState<Record<number, string>>({});

  const getToken = useCallback(() => {
    const token = localStorage.getItem("portale_token");
    if (!token) {
      router.push("/portale/login");
      return null;
    }
    return token;
  }, [router]);

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [dashRes, richRes, docRes] = await Promise.all([
        fetch("/api/portale/dashboard", { headers }),
        fetch("/api/portale/richieste", { headers }),
        fetch("/api/portale/documenti", { headers }),
      ]);

      if (dashRes.status === 401 || richRes.status === 401 || docRes.status === 401) {
        localStorage.removeItem("portale_token");
        localStorage.removeItem("portale_nome");
        localStorage.removeItem("portale_ruolo");
        router.push("/portale/login");
        return;
      }

      const [dashData, richData, docData] = await Promise.all([
        dashRes.json(),
        richRes.json(),
        docRes.json(),
      ]);

      setDashboard(dashData);
      setRichieste(richData);
      setDocumenti(docData);
    } catch (error) {
      console.error("Errore caricamento dati:", error);
    } finally {
      setLoading(false);
    }
  }, [getToken, router]);

  useEffect(() => {
    setNome(localStorage.getItem("portale_nome") || "");
    fetchData();
  }, [fetchData]);

  async function handleRisposta(richiestaId: number) {
    const token = getToken();
    if (!token) return;

    const testo = rispostaText[richiestaId];
    if (!testo?.trim()) return;

    try {
      await fetch(`/api/portale/richieste/${richiestaId}/rispondi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ risposta: testo }),
      });

      setRispostaText((prev) => ({ ...prev, [richiestaId]: "" }));
      fetchData();
    } catch (error) {
      console.error("Errore invio risposta:", error);
    }
  }

  async function handleDomandaRisposta(
    richiestaId: number,
    domandaId: number,
    rispostaSelezionata: string
  ) {
    const token = getToken();
    if (!token) return;

    try {
      await fetch(`/api/portale/richieste/${richiestaId}/rispondi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ domandaId, rispostaSelezionata }),
      });

      fetchData();
    } catch (error) {
      console.error("Errore invio risposta domanda:", error);
    }
  }

  function handleLogout() {
    localStorage.removeItem("portale_token");
    localStorage.removeItem("portale_nome");
    localStorage.removeItem("portale_ruolo");
    router.push("/portale/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Portale Clienti</h1>
            <p className="text-sm text-gray-500">Benvenuto, {nome}</p>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden sm:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Esci
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Dashboard Section */}
        <DashboardContent />

        {/* Summary bar */}
        {dashboard && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-sm text-gray-500">Da fare</p>
              <p className="text-2xl font-bold text-gray-900">
                {dashboard.pendingRequests}
              </p>
              <p className="text-xs text-gray-400">richieste in attesa</p>
            </div>

            {dashboard.situazioneIva && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <p className="text-sm text-gray-500">Situazione IVA</p>
                <p
                  className={`text-2xl font-bold ${
                    dashboard.situazioneIva.saldo >= 0
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {formatCurrency(dashboard.situazioneIva.saldo)}
                </p>
                <p className="text-xs text-gray-400">
                  debito {formatCurrency(dashboard.situazioneIva.ivaDebito)} /
                  credito {formatCurrency(dashboard.situazioneIva.ivaCredito)}
                </p>
              </div>
            )}

            {dashboard.nextScadenza && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <p className="text-sm text-gray-500">Prossima scadenza</p>
                <p className="text-lg font-semibold text-gray-900">
                  {dashboard.nextScadenza.titolo}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(dashboard.nextScadenza.dataScadenza)}
                  {dashboard.nextScadenza.importo &&
                    ` - ${formatCurrency(dashboard.nextScadenza.importo)}`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Richieste */}
        {richieste.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Da fare
            </h2>
            <div className="space-y-3">
              {richieste.map((r) => (
                <div
                  key={r.id}
                  className="bg-white rounded-lg shadow-sm border p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{r.titolo}</h3>
                      <span className="inline-block text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5 mt-1">
                        {r.tipo}
                      </span>
                    </div>
                    {r.scadenza && (
                      <span className="text-xs text-gray-400">
                        Scadenza: {formatDate(r.scadenza)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{r.messaggio}</p>

                  {/* Domande */}
                  {r.domande.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {r.domande.map((d) => (
                        <div
                          key={d.id}
                          className="bg-gray-50 rounded p-3"
                        >
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            {d.testo}
                          </p>
                          {d.rispostaSelezionata ? (
                            <p className="text-sm text-green-600">
                              Risposta: {d.rispostaSelezionata}
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {(d.opzioni as string[]).map((opt) => (
                                <button
                                  key={opt}
                                  onClick={() =>
                                    handleDomandaRisposta(r.id, d.id, opt)
                                  }
                                  className="text-sm px-3 py-1 bg-white border border-gray-300 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Risposta libera */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={rispostaText[r.id] || ""}
                      onChange={(e) =>
                        setRispostaText((prev) => ({
                          ...prev,
                          [r.id]: e.target.value,
                        }))
                      }
                      placeholder="Scrivi una risposta..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleRisposta(r.id)}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Invia
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Documenti */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Documenti
          </h2>
          {documenti.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <p className="text-sm text-gray-500">Nessun documento condiviso</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border divide-y">
              {documenti.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{doc.nome}</p>
                    <p className="text-xs text-gray-400">
                      {doc.tipo} - {formatDate(doc.condivisoAt)}
                    </p>
                  </div>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Scarica
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mobile Navigation */}
        <nav className="sm:hidden grid grid-cols-3 gap-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex flex-col items-center gap-1 p-3 bg-white rounded-lg border text-gray-600 hover:text-gray-900 hover:border-blue-300 transition-colors"
            >
              <link.icon className="h-5 w-5" />
              <span className="text-xs">{link.label}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
