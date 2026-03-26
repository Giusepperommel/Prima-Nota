# Fase 5: Portale Clienti Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full client portal frontend: evolved dashboard with KPI/health/deadlines, messaging UI with threads and chat, simplified first note forms, self-service fiscal tabs, and commercialista unified inbox.

**Architecture:** New pages under `src/app/(app)/portale/` using existing portal JWT auth pattern (Bearer token in localStorage). Components fetch from existing SP14 APIs (`/api/portale/*`). Commercialista inbox at `/portale/inbox` uses main session auth. All follow existing shadcn/ui + Tailwind patterns.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Card, Tabs, Badge, Table, Dialog, Input, Textarea), Tailwind CSS 4, existing portal JWT auth.

**Spec:** `docs/superpowers/specs/2026-03-26-frontend-infrastruttura-roadmap.md` (Fase 5)

---

## File Structure

### New files
```
src/components/portale/
  health-badge.tsx               — Semaforo salute azienda (cerchio colorato + score)
  kpi-summary.tsx                — KPI semplificati per il cliente (ricavi, costi, margine)
  scadenza-countdown.tsx         — Countdown scadenza con urgenza colorata
  thread-list.tsx                — Lista thread messaggi con badge non letti
  chat-view.tsx                  — Vista conversazione con bolle chat
  message-bubble.tsx             — Singola bolla messaggio (cliente/commercialista)
  new-thread-dialog.tsx          — Dialog per creare nuovo thread
  incasso-form.tsx               — Form registra incasso
  pagamento-form.tsx             — Form registra pagamento
  fattura-upload-form.tsx        — Form carica fattura
  operazioni-portale-list.tsx    — Lista operazioni portale con stato
  fiscale-tabs.tsx               — Tab navigation per sezioni fiscali
  inbox-thread-list.tsx          — Lista thread multi-cliente per commercialista
  pending-operations-queue.tsx   — Coda operazioni da validare

src/app/(app)/portale/
  dashboard-content.tsx          — Dashboard portale evoluta (replace existing basic)
  messaggi/page.tsx              — Pagina messaggistica
  messaggi/messaggi-content.tsx
  prima-nota/page.tsx            — Pagina prima nota semplificata
  prima-nota/prima-nota-content.tsx
  fiscale/page.tsx               — Pagina self-service fiscale
  fiscale/fiscale-content.tsx
  inbox/page.tsx                 — Inbox commercialista (main auth)
  inbox/inbox-content.tsx
```

---

## Task 1: Portal Health Badge and KPI Summary Components

**Files:**
- Create: `src/components/portale/health-badge.tsx`
- Create: `src/components/portale/kpi-summary.tsx`
- Create: `src/components/portale/scadenza-countdown.tsx`

- [ ] **Step 1: Create HealthBadge**

```tsx
// src/components/portale/health-badge.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";

interface HealthBadgeProps {
  score: number | null;
  label?: string;
}

function getColor(score: number): { bg: string; text: string; ring: string } {
  if (score >= 70) return { bg: "bg-emerald-100", text: "text-emerald-700", ring: "ring-emerald-500" };
  if (score >= 40) return { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-500" };
  return { bg: "bg-red-100", text: "text-red-700", ring: "ring-red-500" };
}

export function HealthBadge({ score, label = "Salute Azienda" }: HealthBadgeProps) {
  if (score === null) return null;
  const colors = getColor(score);

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${colors.bg} ring-4 ${colors.ring}`}>
          <span className={`text-2xl font-bold ${colors.text}`}>{score}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={`text-lg font-semibold ${colors.text}`}>
            {score >= 70 ? "Buono" : score >= 40 ? "Attenzione" : "Critico"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create KpiSummary**

```tsx
// src/components/portale/kpi-summary.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KpiItem {
  codice: string;
  nome: string;
  valore: number;
  variazione: number | null;
  trend: string | null;
}

interface KpiSummaryProps {
  kpis: KpiItem[];
}

export function KpiSummary({ kpis }: KpiSummaryProps) {
  const display = kpis.filter((k) => ["RICAVI", "COSTI", "MARGINE_LORDO", "UTILE_NETTO"].includes(k.codice));

  return (
    <div className="grid grid-cols-2 gap-3">
      {display.map((kpi) => {
        const Icon = kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : Minus;
        const trendColor = kpi.trend === "up" ? "text-emerald-600" : kpi.trend === "down" ? "text-red-600" : "text-gray-400";
        return (
          <Card key={kpi.codice}>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">{kpi.nome}</p>
              <p className="text-xl font-bold">€ {kpi.valore.toLocaleString("it-IT", { maximumFractionDigits: 0 })}</p>
              {kpi.variazione !== null && (
                <span className={`inline-flex items-center gap-1 text-xs ${trendColor}`}>
                  <Icon className="h-3 w-3" />
                  {kpi.variazione > 0 ? "+" : ""}{kpi.variazione.toFixed(1)}%
                </span>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create ScadenzaCountdown**

```tsx
// src/components/portale/scadenza-countdown.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { differenceInDays } from "date-fns";

interface ScadenzaCountdownProps {
  scadenze: { id: number; tipo: string; scadenza: string; stato: string; percentualeCompletamento: number }[];
}

export function ScadenzaCountdown({ scadenze }: ScadenzaCountdownProps) {
  const now = new Date();

  return (
    <div className="space-y-2">
      {scadenze.map((s) => {
        const giorni = differenceInDays(new Date(s.scadenza), now);
        const urgency = giorni <= 3 ? "destructive" : giorni <= 7 ? "secondary" : "outline";
        return (
          <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{s.tipo.replace(/_/g, " ")}</p>
              <p className="text-xs text-muted-foreground">{s.percentualeCompletamento}% completato</p>
            </div>
            <Badge variant={urgency as any}>
              {giorni <= 0 ? "Scaduto" : giorni === 1 ? "Domani" : `${giorni} giorni`}
            </Badge>
          </div>
        );
      })}
      {scadenze.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Nessuna scadenza imminente</p>}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/portale/health-badge.tsx src/components/portale/kpi-summary.tsx src/components/portale/scadenza-countdown.tsx
git commit -m "feat(fase5): add portal HealthBadge, KpiSummary, and ScadenzaCountdown"
```

---

## Task 2: Messaging Components (MessageBubble, ChatView, ThreadList, NewThreadDialog)

**Files:**
- Create: `src/components/portale/message-bubble.tsx`
- Create: `src/components/portale/chat-view.tsx`
- Create: `src/components/portale/thread-list.tsx`
- Create: `src/components/portale/new-thread-dialog.tsx`

- [ ] **Step 1: Create MessageBubble**

```tsx
// src/components/portale/message-bubble.tsx
"use client";

interface MessageBubbleProps {
  testo: string;
  mittenteTipo: "CLIENTE" | "COMMERCIALISTA";
  createdAt: string;
  letto: boolean;
}

export function MessageBubble({ testo, mittenteTipo, createdAt, letto }: MessageBubbleProps) {
  const isCliente = mittenteTipo === "CLIENTE";
  return (
    <div className={`flex ${isCliente ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isCliente ? "bg-blue-600 text-white" : "bg-muted"}`}>
        <p className="text-sm whitespace-pre-wrap">{testo}</p>
        <div className={`flex items-center gap-1 mt-1 ${isCliente ? "justify-end" : ""}`}>
          <span className={`text-[10px] ${isCliente ? "text-blue-200" : "text-muted-foreground"}`}>
            {new Date(createdAt).toLocaleString("it-IT", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
          </span>
          {isCliente && letto && <span className="text-[10px] text-blue-200">✓✓</span>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ChatView**

```tsx
// src/components/portale/chat-view.tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { MessageBubble } from "./message-bubble";

interface Message {
  id: number;
  testo: string;
  mittenteTipo: "CLIENTE" | "COMMERCIALISTA";
  createdAt: string;
  letto: boolean;
}

interface ChatViewProps {
  threadId: number;
  messages: Message[];
  onSend: (testo: string) => Promise<void>;
  viewerType: "CLIENTE" | "COMMERCIALISTA";
}

export function ChatView({ threadId, messages, onSend, viewerType }: ChatViewProps) {
  const [testo, setTesto] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!testo.trim()) return;
    setSending(true);
    try {
      await onSend(testo.trim());
      setTesto("");
    } finally {
      setSending(false);
    }
  }, [testo, onSend]);

  return (
    <div className="flex flex-col h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} testo={msg.testo} mittenteTipo={msg.mittenteTipo} createdAt={msg.createdAt} letto={msg.letto} />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3 flex gap-2">
        <Textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Scrivi un messaggio..."
          className="min-h-[40px] max-h-[100px] resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <Button size="icon" onClick={handleSend} disabled={!testo.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ThreadList**

```tsx
// src/components/portale/thread-list.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

interface ThreadItem {
  id: number;
  oggetto: string;
  stato: string;
  ultimoMessaggioAt: string | null;
  _count: { messaggi: number };
  messaggi: { testo: string; mittenteTipo: string; letto: boolean; createdAt: string }[];
}

interface ThreadListProps {
  threads: ThreadItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function ThreadList({ threads, selectedId, onSelect }: ThreadListProps) {
  return (
    <div className="space-y-1">
      {threads.map((t) => {
        const lastMsg = t.messaggi?.[0];
        const hasUnread = lastMsg && !lastMsg.letto && lastMsg.mittenteTipo !== "CLIENTE";
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors ${selectedId === t.id ? "bg-blue-50 border border-blue-200" : "hover:bg-muted/50"}`}
            onClick={() => onSelect(t.id)}
          >
            <MessageSquare className={`h-5 w-5 mt-0.5 shrink-0 ${hasUnread ? "text-blue-600" : "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={`text-sm truncate ${hasUnread ? "font-semibold" : "font-medium"}`}>{t.oggetto}</p>
                {hasUnread && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />}
              </div>
              {lastMsg && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{lastMsg.testo.slice(0, 60)}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={t.stato === "APERTO" ? "outline" : "secondary"} className="text-[10px]">{t.stato}</Badge>
                <span className="text-[10px] text-muted-foreground">{t._count.messaggi} msg</span>
              </div>
            </div>
          </div>
        );
      })}
      {threads.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nessuna conversazione</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create NewThreadDialog**

```tsx
// src/components/portale/new-thread-dialog.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface NewThreadDialogProps {
  onCreated: () => void;
  apiBasePath: string; // "/api/portale/messaggi/thread"
  authToken?: string;
}

export function NewThreadDialog({ onCreated, apiBasePath, authToken }: NewThreadDialogProps) {
  const [open, setOpen] = useState(false);
  const [oggetto, setOggetto] = useState("");
  const [testo, setTesto] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!oggetto.trim() || !testo.trim()) return;
    setCreating(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
      const res = await fetch(apiBasePath, {
        method: "POST",
        headers,
        body: JSON.stringify({ oggetto, testo }),
      });
      if (res.ok) {
        setOggetto("");
        setTesto("");
        setOpen(false);
        onCreated();
      }
    } catch (err) {
      console.error("[NewThread] Error:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuova Conversazione</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuova Conversazione</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <Input placeholder="Oggetto" value={oggetto} onChange={(e) => setOggetto(e.target.value)} />
          <Textarea placeholder="Scrivi il tuo messaggio..." value={testo} onChange={(e) => setTesto(e.target.value)} rows={4} />
          <Button onClick={handleCreate} disabled={!oggetto.trim() || !testo.trim() || creating}>Invia</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/portale/message-bubble.tsx src/components/portale/chat-view.tsx src/components/portale/thread-list.tsx src/components/portale/new-thread-dialog.tsx
git commit -m "feat(fase5): add messaging components (bubble, chat, thread list, new thread)"
```

---

## Task 3: Simplified First Note Components

**Files:**
- Create: `src/components/portale/incasso-form.tsx`
- Create: `src/components/portale/pagamento-form.tsx`
- Create: `src/components/portale/fattura-upload-form.tsx`
- Create: `src/components/portale/operazioni-portale-list.tsx`

- [ ] **Step 1: Create IncassoForm**

```tsx
// src/components/portale/incasso-form.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, Loader2 } from "lucide-react";

interface IncassoFormProps {
  onSubmit: (data: { tipo: string; dati: any }) => Promise<void>;
}

export function IncassoForm({ onSubmit }: IncassoFormProps) {
  const [importo, setImporto] = useState("");
  const [cliente, setCliente] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [metodo, setMetodo] = useState("bonifico");
  const [descrizione, setDescrizione] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!importo || !cliente || !data) return;
    setSubmitting(true);
    try {
      await onSubmit({
        tipo: "INCASSO",
        dati: { importo: Number(importo), cliente, data, metodoPagamento: metodo, descrizione: descrizione || undefined },
      });
      setImporto(""); setCliente(""); setDescrizione("");
    } finally { setSubmitting(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="h-5 w-5 text-emerald-600" /> Registra Incasso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="Importo (€)" value={importo} onChange={(e) => setImporto(e.target.value)} />
          <Input placeholder="Cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Select value={metodo} onValueChange={setMetodo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bonifico">Bonifico</SelectItem>
              <SelectItem value="contanti">Contanti</SelectItem>
              <SelectItem value="carta">Carta</SelectItem>
              <SelectItem value="assegno">Assegno</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="Descrizione (opzionale)" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        <Button onClick={handleSubmit} disabled={!importo || !cliente || submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Registra Incasso
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create PagamentoForm**

```tsx
// src/components/portale/pagamento-form.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, Loader2 } from "lucide-react";

interface PagamentoFormProps {
  onSubmit: (data: { tipo: string; dati: any }) => Promise<void>;
}

export function PagamentoForm({ onSubmit }: PagamentoFormProps) {
  const [importo, setImporto] = useState("");
  const [fornitore, setFornitore] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!importo || !fornitore || !data) return;
    setSubmitting(true);
    try {
      await onSubmit({
        tipo: "PAGAMENTO",
        dati: { importo: Number(importo), fornitore, data, categoria: categoria || undefined, descrizione: descrizione || undefined },
      });
      setImporto(""); setFornitore(""); setCategoria(""); setDescrizione("");
    } finally { setSubmitting(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-5 w-5 text-red-600" /> Registra Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input type="number" placeholder="Importo (€)" value={importo} onChange={(e) => setImporto(e.target.value)} />
          <Input placeholder="Fornitore" value={fornitore} onChange={(e) => setFornitore(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Input placeholder="Categoria (opzionale)" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        </div>
        <Input placeholder="Descrizione (opzionale)" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
        <Button onClick={handleSubmit} disabled={!importo || !fornitore || submitting} variant="destructive" className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Registra Pagamento
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create FatturaUploadForm**

```tsx
// src/components/portale/fattura-upload-form.tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUp, Loader2 } from "lucide-react";

interface FatturaUploadFormProps {
  onSubmit: (data: { tipo: string; dati: any }) => Promise<void>;
}

export function FatturaUploadForm({ onSubmit }: FatturaUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      // In production, upload file first and get URL. For now, use filename as placeholder.
      await onSubmit({
        tipo: "FATTURA",
        dati: { fileUrl: `/uploads/${file.name}`, note: note || undefined },
      });
      setFile(null); setNote("");
    } finally { setSubmitting(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="h-5 w-5 text-blue-600" /> Carica Fattura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <input type="file" accept=".pdf,.xml,.jpg,.png" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
          {file && <p className="text-xs text-muted-foreground mt-1">{file.name}</p>}
        </div>
        <Input placeholder="Note (opzionale)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button onClick={handleSubmit} disabled={!file || submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Carica Fattura
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create OperazioniPortaleList**

```tsx
// src/components/portale/operazioni-portale-list.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OpPortale {
  id: number;
  tipo: string;
  stato: string;
  noteCommercialista: string | null;
  createdAt: string;
  dati: any;
}

interface OperazioniPortaleListProps {
  operazioni: OpPortale[];
}

const TIPO_LABELS: Record<string, string> = { INCASSO: "Incasso", PAGAMENTO: "Pagamento", FATTURA: "Fattura" };
const STATO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  BOZZA: "secondary", VALIDATA: "default", RIFIUTATA: "destructive",
};

export function OperazioniPortaleList({ operazioni }: OperazioniPortaleListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Le tue operazioni</CardTitle>
      </CardHeader>
      <CardContent>
        {operazioni.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessuna operazione registrata</p>
        ) : (
          <div className="space-y-2">
            {operazioni.map((op) => (
              <div key={op.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{TIPO_LABELS[op.tipo] || op.tipo}</span>
                    <Badge variant={STATO_VARIANT[op.stato] || "outline"} className="text-[10px]">{op.stato}</Badge>
                  </div>
                  {op.dati?.importo && <p className="text-xs text-muted-foreground">€ {Number(op.dati.importo).toLocaleString("it-IT")}</p>}
                  {op.noteCommercialista && <p className="text-xs text-amber-600 mt-0.5">Nota: {op.noteCommercialista}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{new Date(op.createdAt).toLocaleDateString("it-IT")}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/portale/incasso-form.tsx src/components/portale/pagamento-form.tsx src/components/portale/fattura-upload-form.tsx src/components/portale/operazioni-portale-list.tsx
git commit -m "feat(fase5): add simplified first note components (incasso, pagamento, fattura, list)"
```

---

## Task 4: Portal Dashboard Evolution

**Files:**
- Create: `src/app/(app)/portale/dashboard-content.tsx`

- [ ] **Step 1: Read existing portal page**

Read `src/app/(app)/portale/page.tsx` to understand current structure. The new dashboard-content will be imported there.

- [ ] **Step 2: Create dashboard content**

Create a new dashboard content component that fetches from `/api/portale/kpi` and renders HealthBadge, KpiSummary, ScadenzaCountdown, and recent alerts. This component needs the portal JWT token to authenticate API calls.

The component should:
- Get token from localStorage (existing portal auth pattern)
- Fetch from `/api/portale/kpi` with Bearer token
- Render: HealthBadge, KpiSummary (4 KPIs), ScadenzaCountdown (5 deadlines), alert list
- Show loading skeletons while fetching

- [ ] **Step 3: Integrate into existing portal page**

Modify `src/app/(app)/portale/page.tsx` to include the new dashboard content component.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/portale/
git commit -m "feat(fase5): evolve portal dashboard with KPI, health, deadlines, alerts"
```

---

## Task 5: Messaging Page

**Files:**
- Create: `src/app/(app)/portale/messaggi/page.tsx`
- Create: `src/app/(app)/portale/messaggi/messaggi-content.tsx`

- [ ] **Step 1: Create pages**

Server page following existing pattern, client content with:
- Left panel: ThreadList + NewThreadDialog
- Right panel: ChatView (when thread selected)
- Fetch threads from `/api/portale/messaggi/thread` with Bearer token
- Fetch thread detail from `/api/portale/messaggi/thread/[id]`
- Send messages via POST `/api/portale/messaggi`
- Poll for new messages every 30s

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/portale/messaggi/
git commit -m "feat(fase5): add portal messaging page with threads and chat"
```

---

## Task 6: Prima Nota Semplificata Page

**Files:**
- Create: `src/app/(app)/portale/prima-nota/page.tsx`
- Create: `src/app/(app)/portale/prima-nota/prima-nota-content.tsx`

- [ ] **Step 1: Create pages**

Server page + client content with:
- 3 action cards (IncassoForm, PagamentoForm, FatturaUploadForm)
- Below: OperazioniPortaleList showing past operations
- Submit handler: POST `/api/portale/operazioni` with Bearer token
- Fetch operations: GET `/api/portale/operazioni`

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/portale/prima-nota/
git commit -m "feat(fase5): add simplified first note page with incasso/pagamento/fattura"
```

---

## Task 7: Self-Service Fiscal Page

**Files:**
- Create: `src/app/(app)/portale/fiscale/page.tsx`
- Create: `src/app/(app)/portale/fiscale/fiscale-content.tsx`

- [ ] **Step 1: Create pages**

Server page + client content with:
- Tabs: IVA | Scadenzario | Fatture | Report
- Each tab fetches from `/api/portale/fiscale?sezione=X` with Bearer token
- IVA: Table of liquidazioni
- Scadenzario: ScadenzaCountdown list
- Fatture: Table of fatture with status badges
- Report: List of available reports with download links

- [ ] **Step 2: Commit**

```bash
git add src/app/(app)/portale/fiscale/
git commit -m "feat(fase5): add self-service fiscal page with IVA, scadenze, fatture, report tabs"
```

---

## Task 8: Commercialista Inbox Page

**Files:**
- Create: `src/components/portale/inbox-thread-list.tsx`
- Create: `src/components/portale/pending-operations-queue.tsx`
- Create: `src/app/(app)/portale/inbox/page.tsx`
- Create: `src/app/(app)/portale/inbox/inbox-content.tsx`

- [ ] **Step 1: Create InboxThreadList**

Similar to ThreadList but shows client name for each thread, uses main session auth (not portal JWT).

- [ ] **Step 2: Create PendingOperationsQueue**

List of pending portal operations with approve/reject inline buttons. PATCH `/api/portale/operazioni/[id]` with azione.

- [ ] **Step 3: Create inbox page**

Server page (main auth, not portal JWT) + client content with:
- Header: total unread count
- Two sections: Thread list (with client names), Pending operations queue
- Fetches from GET `/api/portale/inbox` (main session auth)

- [ ] **Step 4: Commit**

```bash
git add src/components/portale/inbox-thread-list.tsx src/components/portale/pending-operations-queue.tsx src/app/(app)/portale/inbox/
git commit -m "feat(fase5): add commercialista unified inbox with threads and pending ops"
```

---

## Task 9: Full Build Verification

- [ ] **Step 1: Run full project tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: TypeScript compiles successfully.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(fase5): address build issues"
```

---

## Summary

| Task | Component | Type |
|------|-----------|------|
| 1 | HealthBadge + KpiSummary + ScadenzaCountdown | New components |
| 2 | MessageBubble + ChatView + ThreadList + NewThreadDialog | New components |
| 3 | IncassoForm + PagamentoForm + FatturaUploadForm + OperazioniPortaleList | New components |
| 4 | Portal dashboard evolution | Modified page |
| 5 | Messaging page (/portale/messaggi) | New page |
| 6 | Prima nota page (/portale/prima-nota) | New page |
| 7 | Fiscal page (/portale/fiscale) | New page |
| 8 | Commercialista inbox (/portale/inbox) | New page + components |
| 9 | Full build verification | Verification |

**Total: 9 tasks, ~14 new components, 4 new pages, ~9 commits**
