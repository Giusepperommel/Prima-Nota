import { prisma } from "@/lib/prisma";
import type { CreateOperazioneInput, IncassoData, PagamentoData, FatturaData } from "./types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateOperazione(input: CreateOperazioneInput): ValidationResult {
  const errors: string[] = [];
  const { tipo, dati } = input;

  if (tipo === "INCASSO") {
    const d = dati as IncassoData;
    if (!d.importo || d.importo <= 0) errors.push("Importo obbligatorio e maggiore di zero");
    if (!d.cliente) errors.push("Cliente obbligatorio");
    if (!d.data) errors.push("Data obbligatoria");
    if (!d.metodoPagamento) errors.push("Metodo pagamento obbligatorio");
  } else if (tipo === "PAGAMENTO") {
    const d = dati as PagamentoData;
    if (!d.importo || d.importo <= 0) errors.push("Importo obbligatorio e maggiore di zero");
    if (!d.fornitore) errors.push("Fornitore obbligatorio");
    if (!d.data) errors.push("Data obbligatoria");
  } else if (tipo === "FATTURA") {
    const d = dati as FatturaData;
    if (!d.fileUrl) errors.push("File fattura obbligatorio");
  }

  return { valid: errors.length === 0, errors };
}

export async function createPortalOperation(input: CreateOperazioneInput): Promise<number> {
  const validation = validateOperazione(input);
  if (!validation.valid) throw new Error(validation.errors.join(", "));

  const op = await prisma.operazionePortale.create({
    data: {
      societaId: input.societaId,
      accessoClienteId: input.accessoClienteId,
      tipo: input.tipo as any,
      dati: input.dati as any,
      documentoAllegato: input.documentoAllegato,
    },
  });

  // Try OCR extraction for FATTURA operations (non-blocking)
  if (input.tipo === "FATTURA" && input.dati && (input.dati as any).fileUrl) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const ocrRes = await fetch(`${baseUrl}/api/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: (input.dati as any).fileUrl }),
      });
      if (ocrRes.ok) {
        const ocrData = await ocrRes.json();
        await prisma.operazionePortale.update({
          where: { id: op.id },
          data: { dati: { ...(input.dati as any), ocrEstratto: ocrData } },
        });
      }
    } catch {
      // OCR is optional — log and continue
      console.warn(`[PortalOp] OCR extraction failed for operation ${op.id}`);
    }
  }

  return op.id;
}

export async function validatePortalOperation(
  operazioneId: number,
  azione: "VALIDATA" | "RIFIUTATA",
  noteCommercialista?: string
): Promise<void> {
  await prisma.operazionePortale.update({
    where: { id: operazioneId },
    data: {
      stato: azione as any,
      noteCommercialista,
      validataAt: azione === "VALIDATA" ? new Date() : null,
    },
  });
}
