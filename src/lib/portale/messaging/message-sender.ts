import { prisma } from "@/lib/prisma";
import type { SendMessageInput } from "./types";

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateMessageInput(input: SendMessageInput): ValidationResult {
  const errors: string[] = [];
  if (!input.testo || input.testo.trim() === "") errors.push("Testo messaggio obbligatorio");
  if (!input.threadId) errors.push("Thread ID obbligatorio");
  return { valid: errors.length === 0, errors };
}

export async function sendMessage(input: SendMessageInput): Promise<number> {
  const validation = validateMessageInput(input);
  if (!validation.valid) throw new Error(validation.errors.join(", "));

  const messaggio = await prisma.messaggioPortale.create({
    data: {
      societaId: input.societaId,
      threadId: input.threadId,
      accessoClienteId: input.accessoClienteId,
      mittenteTipo: input.mittenteTipo as any,
      mittenteId: input.mittenteId,
      testo: input.testo,
    },
  });

  await prisma.threadPortale.update({
    where: { id: input.threadId },
    data: { ultimoMessaggioAt: new Date() },
  });

  return messaggio.id;
}

export async function markMessagesAsRead(
  threadId: number,
  readerType: "CLIENTE" | "COMMERCIALISTA"
): Promise<number> {
  const oppositeType = readerType === "CLIENTE" ? "COMMERCIALISTA" : "CLIENTE";
  const result = await prisma.messaggioPortale.updateMany({
    where: { threadId, mittenteTipo: oppositeType as any, letto: false },
    data: { letto: true, lettoAt: new Date() },
  });
  return result.count;
}

export async function getUnreadCount(
  societaId: number,
  accessoClienteId: number,
  viewerType: "CLIENTE" | "COMMERCIALISTA"
): Promise<number> {
  const oppositeType = viewerType === "CLIENTE" ? "COMMERCIALISTA" : "CLIENTE";
  return prisma.messaggioPortale.count({
    where: {
      societaId,
      accessoClienteId,
      mittenteTipo: oppositeType as any,
      letto: false,
    },
  });
}
