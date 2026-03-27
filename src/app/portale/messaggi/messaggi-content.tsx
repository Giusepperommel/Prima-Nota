"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ThreadList } from "@/components/portale/thread-list";
import { ChatView } from "@/components/portale/chat-view";
import { NewThreadDialog } from "@/components/portale/new-thread-dialog";
import { MessageSquare } from "lucide-react";

interface Message {
  id: number;
  testo: string;
  mittenteTipo: "CLIENTE" | "COMMERCIALISTA";
  createdAt: string;
  letto: boolean;
}

interface ThreadItem {
  id: number;
  oggetto: string;
  stato: string;
  ultimoMessaggioAt: string | null;
  _count: { messaggi: number };
  messaggi: { testo: string; mittenteTipo: string; letto: boolean; createdAt: string }[];
}

interface ThreadDetail {
  id: number;
  oggetto: string;
  stato: string;
  messaggi: Message[];
}

const POLL_INTERVAL = 30_000;

export function MessaggiContent() {
  const router = useRouter();
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const fetchThreads = useCallback(async () => {
    const headers = getHeaders();
    if (!headers) return;

    try {
      const res = await fetch("/api/portale/messaggi/thread", { headers });
      if (res.status === 401) { handleAuthError(); return; }
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch (error) {
      console.error("[Messaggi] Error fetching threads:", error);
    } finally {
      setLoadingThreads(false);
    }
  }, [getHeaders, handleAuthError]);

  const fetchThreadDetail = useCallback(async (threadId: number) => {
    const headers = getHeaders();
    if (!headers) return;

    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/portale/messaggi/thread/${threadId}`, { headers });
      if (res.status === 401) { handleAuthError(); return; }
      if (res.ok) {
        const data = await res.json();
        setThreadDetail(data.thread || null);
      }
    } catch (error) {
      console.error("[Messaggi] Error fetching thread detail:", error);
    } finally {
      setLoadingDetail(false);
    }
  }, [getHeaders, handleAuthError]);

  const handleSelectThread = useCallback((id: number) => {
    setSelectedThreadId(id);
    fetchThreadDetail(id);
  }, [fetchThreadDetail]);

  const handleSendMessage = useCallback(async (testo: string) => {
    const headers = getHeaders();
    if (!headers || !selectedThreadId) return;

    const res = await fetch("/api/portale/messaggi", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: selectedThreadId, testo }),
    });

    if (res.status === 401) { handleAuthError(); return; }
    if (res.ok) {
      // Refresh thread detail and thread list
      await Promise.all([
        fetchThreadDetail(selectedThreadId),
        fetchThreads(),
      ]);
    }
  }, [getHeaders, selectedThreadId, handleAuthError, fetchThreadDetail, fetchThreads]);

  const handleThreadCreated = useCallback(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Initial fetch
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Polling for new messages
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchThreads();
      if (selectedThreadId) {
        fetchThreadDetail(selectedThreadId);
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchThreads, fetchThreadDetail, selectedThreadId]);

  const token = typeof window !== "undefined" ? localStorage.getItem("portale_token") : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-180px)]">
      {/* Left Panel: Thread List */}
      <Card className="md:col-span-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-2 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Conversazioni
            </CardTitle>
            <NewThreadDialog
              onCreated={handleThreadCreated}
              apiBasePath="/api/portale/messaggi/thread"
              authToken={token || undefined}
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-2">
          {loadingThreads ? (
            <div className="space-y-3 p-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : (
            <ThreadList
              threads={threads}
              selectedId={selectedThreadId}
              onSelect={handleSelectThread}
            />
          )}
        </CardContent>
      </Card>

      {/* Right Panel: Chat View */}
      <Card className="md:col-span-2 flex flex-col overflow-hidden">
        {selectedThreadId && threadDetail ? (
          <>
            <CardHeader className="pb-2 shrink-0 border-b">
              <CardTitle className="text-base">{threadDetail.oggetto}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {threadDetail.messaggi.length} messaggi
              </p>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              {loadingDetail ? (
                <div className="flex items-center justify-center h-full">
                  <Skeleton className="h-8 w-32" />
                </div>
              ) : (
                <ChatView
                  threadId={threadDetail.id}
                  messages={threadDetail.messaggi}
                  onSend={handleSendMessage}
                  viewerType="CLIENTE"
                />
              )}
            </CardContent>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Seleziona una conversazione o creane una nuova</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
