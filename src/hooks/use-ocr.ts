"use client";

import { useState, useCallback, useRef } from "react";
import type { OcrResult, OcrStatus, ParsedDocument } from "@/lib/ocr/types";
import { parseDocumentText } from "@/lib/ocr/parser";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED_PDF_TYPES = ["application/pdf"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_PDF_TYPES];

export function useOcr() {
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [result, setResult] = useState<ParsedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const processFile = useCallback(async (file: File) => {
    if (processingRef.current) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato non supportato. Usa PNG, JPG, WEBP o PDF.");
      return;
    }

    processingRef.current = true;
    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      let imageInput: File | Blob = file;

      if (ACCEPTED_PDF_TYPES.includes(file.type)) {
        setStatus("processing");
        const { pdfToImage } = await import("@/lib/ocr/pdf-extractor");
        imageInput = await pdfToImage(file);
      }

      setStatus("processing");
      const { recognizeImage } = await import("@/lib/ocr/tesseract-worker");
      const ocrResult: OcrResult = await recognizeImage(imageInput);

      setStatus("parsing");
      const parsed = parseDocumentText(ocrResult.rawText);
      setResult(parsed);
      setStatus("done");
    } catch (err: any) {
      setError(err.message || "Errore durante la scansione OCR");
      setStatus("error");
    } finally {
      processingRef.current = false;
    }
  }, []);

  const processImage = useCallback(async (blob: Blob) => {
    const file = new File([blob], "screenshot.png", { type: blob.type || "image/png" });
    await processFile(file);
  }, [processFile]);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return {
    status,
    result,
    error,
    isProcessing: status === "loading" || status === "processing" || status === "parsing",
    processFile,
    processImage,
    reset,
  };
}
