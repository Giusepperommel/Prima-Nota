// src/lib/ocr/tesseract-worker.ts
import { createWorker, Worker } from "tesseract.js";
import type { OcrResult } from "./types";

let worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (!worker) {
    worker = await createWorker("ita", undefined, {
      logger: () => {},
    });
  }
  return worker;
}

export async function recognizeImage(image: File | Blob | string): Promise<OcrResult> {
  const w = await getWorker();
  const { data } = await w.recognize(image);
  return {
    rawText: data.text,
    confidence: data.confidence,
  };
}

export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
