"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ListTodo, ExternalLink } from "lucide-react";

interface TodoData {
  id: number;
  titolo: string;
  descrizione?: string;
  priorita: number;
  linkAzione?: string;
  fonte: string;
  stato: string;
}

const PRIORITY_COLORS: Record<number, string> = {
  1: "bg-red-100 text-red-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-blue-100 text-blue-800",
  4: "bg-gray-100 text-gray-800",
  5: "bg-gray-50 text-gray-600",
};

const FONTE_LABELS: Record<string, string> = {
  SCADENZA: "Scadenza",
  ANOMALIA: "Anomalia",
  BOZZA: "Bozza",
  RICONCILIAZIONE: "Riconciliazione",
  FATTURA: "Fattura",
  PORTALE: "Portale",
  ALTRO: "Altro",
};

export function TodoWidget() {
  const [todos, setTodos] = useState<TodoData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todo");
      if (res.ok) {
        const data = await res.json();
        setTodos(data.todos || []);
      }
    } catch (err) {
      console.error("[TodoWidget] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleComplete = useCallback(async (id: number) => {
    try {
      await fetch(`/api/todo/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stato: "COMPLETATA" }),
      });
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("[TodoWidget] Complete error:", err);
    }
  }, []);

  const activeTodos = todos.filter((t) => t.stato === "DA_FARE" || t.stato === "IN_CORSO");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4" />
          Da fare oggi
          {activeTodos.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{activeTodos.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : activeTodos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Tutto fatto per oggi!</p>
        ) : (
          <div className="space-y-2">
            {activeTodos.slice(0, 8).map((todo) => (
              <div key={todo.id} className="flex items-start gap-3 py-1.5">
                <Checkbox
                  className="mt-0.5"
                  onCheckedChange={() => handleComplete(todo.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-snug">{todo.titolo}</span>
                    {todo.linkAzione && (
                      <a href={todo.linkAzione} className="shrink-0">
                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-1 mt-0.5">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[todo.priorita] || ""}`}>
                      P{todo.priorita}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {FONTE_LABELS[todo.fonte] || todo.fonte}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
