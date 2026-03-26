"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Key, RotateCw, Trash2 } from "lucide-react";
import { ApiKeyForm } from "./api-key-form";

interface ApiKeyData {
  id: number;
  nome: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerHour: number;
  attiva: boolean;
  ultimoUtilizzo: string | null;
  createdAt: string;
}

export function ApiKeyList() {
  const [keys, setKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/configurazione/api");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (err) {
      console.error("[ApiKeys] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleRotate = async (id: number) => {
    try {
      const res = await fetch("/api/configurazione/api", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Nuova chiave: ${data.key}\n\nSalvala — non verrà più mostrata.`);
        fetchKeys();
      }
    } catch (err) {
      console.error("[ApiKeys] Rotate error:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminare questa chiave API?")) return;
    try {
      await fetch(`/api/configurazione/api?id=${id}`, { method: "DELETE" });
      fetchKeys();
    } catch (err) {
      console.error("[ApiKeys] Delete error:", err);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Chiavi API</CardTitle>
        <ApiKeyForm onCreated={fetchKeys} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}</div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessuna chiave API creata</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Ultimo uso</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{k.keyPrefix}...</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{k.scopes.length} scopes</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{k.ultimoUtilizzo ? new Date(k.ultimoUtilizzo).toLocaleDateString("it-IT") : "Mai"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRotate(k.id)} title="Ruota chiave">
                        <RotateCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleDelete(k.id)} title="Elimina">
                        <Trash2 className="h-3.5 w-3.5" />
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
  );
}
