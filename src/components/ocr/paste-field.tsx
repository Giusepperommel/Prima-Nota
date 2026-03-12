"use client";

import { useCallback, useRef } from "react";
import { ClipboardPaste } from "lucide-react";

type Props = {
  onImagePaste: (blob: Blob) => void;
  disabled?: boolean;
};

export function PasteField({ onImagePaste, disabled }: Props) {
  const divRef = useRef<HTMLDivElement>(null);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            onImagePaste(blob);
          }
          return;
        }
      }
    },
    [onImagePaste, disabled]
  );

  return (
    <div
      ref={divRef}
      tabIndex={0}
      onPaste={handlePaste}
      className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/25 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-text"
    >
      <ClipboardPaste className="h-4 w-4 shrink-0" />
      <span>Clicca qui e incolla uno screenshot (Ctrl+V / Cmd+V)</span>
    </div>
  );
}
