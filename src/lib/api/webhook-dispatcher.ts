import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/** Ritardi tra tentativi: 1m, 5m, 30m, 2h, 12h */
export const RETRY_DELAYS = [60000, 300000, 1800000, 7200000, 43200000];

/** Numero massimo di tentativi prima di disabilitare l'endpoint */
export const MAX_RETRIES = 5;

/**
 * Firma un payload webhook con HMAC-SHA256.
 * Restituisce la firma nel formato "sha256=<hex>".
 */
export function signWebhookPayload(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Verifica la firma di un webhook con confronto timing-safe.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = signWebhookPayload(payload, secret);

  // I buffer devono avere la stessa lunghezza per timingSafeEqual
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * Invia un evento webhook a tutti gli endpoint attivi per la societa.
 * Registra ogni consegna nel DB e gestisce i fallimenti con retry.
 */
export async function dispatchWebhook(
  societaId: number,
  evento: string,
  data: Record<string, unknown>
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      societaId,
      attivo: true,
    },
  });

  const payload = JSON.stringify({ evento, data, timestamp: new Date().toISOString() });

  for (const endpoint of endpoints) {
    // Filtra per eventi sottoscritti
    const eventi = endpoint.eventi as string[];
    if (eventi.length > 0 && !eventi.includes(evento)) {
      continue;
    }

    const signature = signWebhookPayload(payload, endpoint.secret);

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": evento,
        },
        body: payload,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      // Registra consegna
      await prisma.webhookDelivery.create({
        data: {
          webhookEndpointId: endpoint.id,
          evento,
          payload: JSON.parse(payload),
          statoHttp: response.status,
          risposta: await response.text().catch(() => null),
          tentativo: 1,
          stato: response.ok ? "CONSEGNATO" : "FALLITO",
          prossimoTentativoAt: response.ok
            ? null
            : new Date(Date.now() + RETRY_DELAYS[0]),
        },
      });

      if (response.ok) {
        // Reset contatore fallimenti
        await prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: {
            consecutiviFalliti: 0,
            ultimaConsegna: new Date(),
          },
        });
      } else {
        await incrementFailures(endpoint.id, endpoint.consecutiviFalliti);
      }
    } catch (error) {
      // Errore di rete o timeout
      const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto";

      await prisma.webhookDelivery.create({
        data: {
          webhookEndpointId: endpoint.id,
          evento,
          payload: JSON.parse(payload),
          statoHttp: null,
          risposta: errorMessage,
          tentativo: 1,
          stato: "FALLITO",
          prossimoTentativoAt: new Date(Date.now() + RETRY_DELAYS[0]),
        },
      });

      await incrementFailures(endpoint.id, endpoint.consecutiviFalliti);
    }
  }
}

/**
 * Incrementa il contatore dei fallimenti consecutivi.
 * Se supera MAX_RETRIES, disabilita l'endpoint.
 */
async function incrementFailures(
  endpointId: number,
  currentFailures: number
): Promise<void> {
  const newFailures = currentFailures + 1;

  await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      consecutiviFalliti: newFailures,
      attivo: newFailures < MAX_RETRIES,
    },
  });
}
