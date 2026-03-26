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
