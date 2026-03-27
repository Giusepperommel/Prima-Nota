"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InboxThreadList } from "@/components/portale/inbox-thread-list";
import { PendingOperationsQueue } from "@/components/portale/pending-operations-queue";
import { ChatView } from "@/components/portale/chat-view";
import { Inbox, MessageSquare } from "lucide-react";

interface InboxThread {
  id: number;
  oggetto: string;
  stato: string;
  ultimoMessaggioAt: string | null;
  accessoCliente: { id: number; nome: string; email: string };
  _count: { messaggi: number };
  messaggi: { testo: string; mittenteTipo: string; letto: boolean; createdAt: string }[];
}

interface PendingOp {
  id: number;
  tipo: string;
  stato: string;
  dati: any;
  createdAt: string;
  accessoCliente: { id: number; nome: string };
}

interface Message {
  id: number;
  testo: string;
  mittenteTipo: "CLIENTE" | "COMMERCIALISTA";
  createdAt: string;
  letto: boolean;
}

interface InboxData {
  threads: InboxThread[];
  operazioniPending: PendingOp[];
  totalNonLetti: number;
}

const POLL_INTERVAL = 30_000;

export function InboxContent() {
  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedThreadOggetto, setSelectedThreadOggetto] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch("/api/portale/inbox");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("[Inbox] Error fetching inbox:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchThreadMessages = useCallback(async (threadId: number) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/portale/messaggi/thread/${threadId}`);
      if (res.ok) {
        const json = await res.json();
        setThreadMessages(json.thread?.messaggi || []);
      }
    } catch (error) {
      console.error("[Inbox] Error fetching thread messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const handleSelectThread = useCallback((id: number) => {
    setSelectedThreadId(id);
    const thread = data?.threads.find((t) => t.id === id);
    setSelectedThreadOggetto(thread?.oggetto || "");
    fetchThreadMessages(id);
  }, [data?.threads, fetchThreadMessages]);

  const handleSendMessage = useCallback(async (testo: string) => {
    if (!selectedThreadId) return;

    const res = await fetch("/api/portale/messaggi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: selectedThreadId, testo }),
    });

    if (res.ok) {
      await Promise.all([
        fetchThreadMessages(selectedThreadId),
        fetchInbox(),
      ]);
    }
  }, [selectedThreadId, fetchThreadMessages, fetchInbox]);

  const handleOperationAction = useCallback(async (
    opId: number,
    azione: "VALIDATA" | "RIFIUTATA",
    note?: string
  ) => {
    const res = await fetch(`/api/portale/operazioni/${opId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione, note }),
    });

    if (res.ok) {
      await fetchInbox();
    }
  }, [fetchInbox]);

  // Initial fetch
  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  // Polling
  useEffect(() => {
    pollRef.current = setInterval(fetchInbox, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchInbox]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Impossibile caricare i dati della inbox</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="flex items-center gap-3">
        <Inbox className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Inbox Unificata</h2>
        {data.totalNonLetti > 0 && (
          <Badge variant="default">
            {data.totalNonLetti} messaggi non letti
          </Badge>
        )}
        {data.operazioniPending.length > 0 && (
          <Badge variant="secondary">
            {data.operazioniPending.length} operazioni in attesa
          </Badge>
        )}
      </div>

      {/* Main content: threads + chat or operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Thread list */}
        <Card className="lg:col-span-1 flex flex-col max-h-[600px] overflow-hidden">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Conversazioni Clienti
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2">
            <InboxThreadList
              threads={data.threads}
              selectedId={selectedThreadId}
              onSelect={handleSelectThread}
            />
          </CardContent>
        </Card>

        {/* Chat view */}
        <Card className="lg:col-span-2 flex flex-col max-h-[600px] overflow-hidden">
          {selectedThreadId ? (
            <>
              <CardHeader className="pb-2 shrink-0 border-b">
                <CardTitle className="text-base">{selectedThreadOggetto}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {threadMessages.length} messaggi
                </p>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : (
                  <ChatView
                    threadId={selectedThreadId}
                    messages={threadMessages}
                    onSend={handleSendMessage}
                    viewerType="COMMERCIALISTA"
                  />
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Seleziona una conversazione per rispondere</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Pending operations */}
      <PendingOperationsQueue
        operazioni={data.operazioniPending}
        onAction={handleOperationAction}
      />
    </div>
  );
}
