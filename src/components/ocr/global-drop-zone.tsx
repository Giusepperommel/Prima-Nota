"use client";

import { useState, useCallback, useRef, type ReactNode, type DragEvent } from "react";
import { Upload } from "lucide-react";

type Props = {
  onFileDrop: (file: File) => void;
  disabled?: boolean;
  children: ReactNode;
};

export function GlobalDropZone({ onFileDrop, disabled, children }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounterRef.current++;
      if (dragCounterRef.current === 1) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;
      if (disabled) return;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        onFileDrop(files[0]);
      }
    },
    [onFileDrop, disabled]
  );

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg border-2 border-dashed border-amber-500 bg-amber-500/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-amber-500">
            <Upload className="h-10 w-10" />
            <p className="text-lg font-medium">Rilascia per scansionare</p>
            <p className="text-sm text-amber-400">Immagine o PDF</p>
          </div>
        </div>
      )}
    </div>
  );
}
