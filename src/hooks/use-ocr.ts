"use client";

import { useState, useCallback, useRef } from "react";
import type { OcrStatus, ParsedDocument, OcrParseResult, ParsedTransaction } from "@/lib/ocr/types";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const ACCEPTED_PDF_TYPES = ["application/pdf"];
const ACCEPTED_XML_TYPES = ["text/xml", "application/xml"];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_PDF_TYPES, ...ACCEPTED_XML_TYPES];

type VisionMultiResult = {
  type: "multi";
  transactions: Array<{
    dataOperazione: string;
    descrizione: string;
    importo: number;
    segno: "+" | "-";
    categoriaId?: number | null;
  }>;
};

type VisionSingleResult = {
  type: "single";
  document: {
    dataOperazione: string | null;
    numeroDocumento: string | null;
    descrizione: string | null;
    importoTotale: number | null;
    imponibile: number | null;
    aliquotaIva: string | null;
    importoIva: number | null;
    fornitore: string | null;
  };
};

type VisionResult = VisionMultiResult | VisionSingleResult;

export function useOcr() {
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [result, setResult] = useState<OcrParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  const processFile = useCallback(async (file: File) => {
    if (processingRef.current) return;
    const isXml = ACCEPTED_XML_TYPES.includes(file.type) || file.name?.toLowerCase().endsWith(".xml");
    if (!ACCEPTED_TYPES.includes(file.type) && !isXml) {
      setError("Formato non supportato. Usa PNG, JPG, WEBP, PDF o XML.");
      return;
    }

    processingRef.current = true;
    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      let fileToSend = file;

      // XML files are sent directly to the API
      if (!isXml) {
        // Convert PDF to image first
        if (ACCEPTED_PDF_TYPES.includes(file.type)) {
          setStatus("processing");
          const { pdfToImage } = await import("@/lib/ocr/pdf-extractor");
          const blob = await pdfToImage(file);
          fileToSend = new File([blob], "page.png", { type: "image/png" });
        }
      }

      setStatus("processing");
      const formData = new FormData();
      formData.append("image", fileToSend);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Errore ${res.status}`);
      }

      setStatus("parsing");
      const visionResult: VisionResult = await res.json();

      if (visionResult.type === "multi") {
        const transactions: ParsedTransaction[] = visionResult.transactions.map((tx) => ({
          dataOperazione: tx.dataOperazione || null,
          descrizione: tx.descrizione,
          importoTotale: Math.abs(tx.importo),
          categoriaId: tx.categoriaId || null,
          tipoOperazione: tx.segno === "+" ? "FATTURA_ATTIVA" as const : "COSTO" as const,
        }));
        setResult({ type: "multi", transactions });
      } else {
        const doc = visionResult.document;
        const parsed: ParsedDocument = {
          dataOperazione: doc.dataOperazione || null,
          numeroDocumento: doc.numeroDocumento || null,
          descrizione: doc.descrizione || null,
          importoTotale: doc.importoTotale != null ? Math.abs(doc.importoTotale) : null,
          imponibile: doc.imponibile || null,
          aliquotaIva: doc.aliquotaIva || null,
          importoIva: doc.importoIva || null,
          tipoOperazione: doc.importoTotale != null ? "COSTO" : null,
          fornitore: doc.fornitore || null,
        };
        setResult({ type: "single", document: parsed });
      }

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
