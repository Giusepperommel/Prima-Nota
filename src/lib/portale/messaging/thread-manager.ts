import { prisma } from "@/lib/prisma";
import type { CreateThreadInput } from "./types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateThreadInput(input: CreateThreadInput): ValidationResult {
  const errors: string[] = [];
  if (!input.oggetto || input.oggetto.trim() === "") errors.push("Oggetto obbligatorio");
  if (!input.testoIniziale || input.testoIniziale.trim() === "") errors.push("Messaggio iniziale obbligatorio");
  if (!input.mittenteTipo) errors.push("Tipo mittente obbligatorio");
  return { valid: errors.length === 0, errors };
}

export async function createThread(input: CreateThreadInput): Promise<{ threadId: number; messaggioId: number }> {
  const validation = validateThreadInput(input);
  if (!validation.valid) throw new Error(validation.errors.join(", "));

  const thread = await prisma.threadPortale.create({
    data: {
      societaId: input.societaId,
      accessoClienteId: input.accessoClienteId,
      oggetto: input.oggetto,
      contestoTipo: input.contestoTipo as any,
      contestoId: input.contestoId,
      ultimoMessaggioAt: new Date(),
    },
  });

  const messaggio = await prisma.messaggioPortale.create({
    data: {
      societaId: input.societaId,
      threadId: thread.id,
      accessoClienteId: input.accessoClienteId,
      mittenteTipo: input.mittenteTipo as any,
      mittenteId: input.mittenteId,
      testo: input.testoIniziale,
    },
  });

  return { threadId: thread.id, messaggioId: messaggio.id };
}

export async function closeThread(threadId: number): Promise<void> {
  await prisma.threadPortale.update({
    where: { id: threadId },
    data: { stato: "CHIUSO" },
  });
}

export async function listThreads(
  societaId: number,
  accessoClienteId: number,
  options?: { stato?: string; limit?: number }
): Promise<any[]> {
  return prisma.threadPortale.findMany({
    where: {
      societaId,
      accessoClienteId,
      ...(options?.stato && { stato: options.stato as any }),
    },
    orderBy: { ultimoMessaggioAt: "desc" },
    take: options?.limit || 20,
    include: {
      messaggi: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { messaggi: true } },
    },
  });
}
