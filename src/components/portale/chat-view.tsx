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
