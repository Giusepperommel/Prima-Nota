"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { IncassoForm } from "@/components/portale/incasso-form";
import { PagamentoForm } from "@/components/portale/pagamento-form";
import { FatturaUploadForm } from "@/components/portale/fattura-upload-form";
import { OperazioniPortaleList } from "@/components/portale/operazioni-portale-list";

interface OpPortale {
  id: number;
  tipo: string;
  stato: string;
  noteCommercialista: string | null;
  createdAt: string;
  dati: any;
}

export function PrimaNotaContent() {
  const router = useRouter();
  const [operazioni, setOperazioni] = useState<OpPortale[]>([]);
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(() => {
    const token = localStorage.getItem("portale_token");
    if (!token) {
      router.push("/portale/login");
      return null;
    }
    return token;
  }, [router]);

  const getHeaders = useCallback(() => {
    const token = getToken();
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }, [getToken]);

  const handleAuthError = useCallback(() => {
    localStorage.removeItem("portale_token");
    localStorage.removeItem("portale_nome");
    localStorage.removeItem("portale_ruolo");
    router.push("/portale/login");
  }, [router]);

  const fetchOperazioni = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;

    try {
      const res = await fetch("/api/portale/operazioni", { headers });
      if (res.status === 401) { handleAuthError(); return; }
      if (res.ok) {
        const data = await res.json();
        setOperazioni(data.operazioni || []);
      }
    } catch (error) {
      console.error("[PrimaNota] Error fetching operazioni:", error);
    } finally {
      setLoading(false);
    }
  }, [getHeaders, handleAuthError]);

  useEffect(() => {
    fetchOperazioni();
  }, [fetchOperazioni]);

  const handleSubmit = useCallback(async (payload: { tipo: string; dati: any }) => {
    const headers = getHeaders();
    if (!headers) return;

    const res = await fetch("/api/portale/operazioni", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) { handleAuthError(); return; }

    if (res.ok) {
      // Refresh the operations list
      await fetchOperazioni();
    } else {
      const error = await res.json().catch(() => ({}));
      console.error("[PrimaNota] Submit error:", error);
    }
  }, [getHeaders, handleAuthError, fetchOperazioni]);

  return (
    <div className="space-y-6">
      {/* Form cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <IncassoForm onSubmit={handleSubmit} />
        <PagamentoForm onSubmit={handleSubmit} />
        <FatturaUploadForm onSubmit={handleSubmit} />
      </div>

      {/* Operations list */}
      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <OperazioniPortaleList operazioni={operazioni} />
      )}
    </div>
  );
}
