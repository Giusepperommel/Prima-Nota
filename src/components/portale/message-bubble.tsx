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
          {isCliente && letto && <span className="text-[10px] text-blue-200">{"✓✓"}</span>}
        </div>
      </div>
    </div>
  );
}
