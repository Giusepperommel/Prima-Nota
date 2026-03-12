"use client";

import { Loader2 } from "lucide-react";
import type { OcrStatus } from "@/lib/ocr/types";

type Props = {
  status: OcrStatus;
};

const STATUS_MESSAGES: Record<OcrStatus, string> = {
  idle: "",
  loading: "Caricamento motore OCR...",
  processing: "Scansione in corso...",
  parsing: "Estrazione dati...",
  done: "",
  error: "",
};

export function OcrOverlay({ status }: Props) {
  const message = STATUS_MESSAGES[status];
  if (!message) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
