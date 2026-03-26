import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKey, extractKeyPrefix } from "./api-key";
import { RateLimiter } from "./rate-limiter";
import type { ApiKeyPayload, ApiScope } from "./types";

const rateLimiter = new RateLimiter();

/**
 * Estrae la API key dall'header Authorization.
 * Accetta solo il formato "Bearer <key>".
 */
export function extractApiKeyFromHeader(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}

/**
 * Verifica se un array di scopes contiene lo scope richiesto.
 */
export function hasScope(scopes: ApiScope[], required: ApiScope): boolean {
  return scopes.includes(required);
}

/**
 * Middleware di autenticazione per le API pubbliche.
 * Verifica la chiave, controlla scadenza, aggiorna ultimo utilizzo,
 * applica rate limiting e restituisce il payload autenticato.
 */
export async function authenticateApiKey(
  request: NextRequest
): Promise<
  | { success: true; payload: ApiKeyPayload }
  | { success: false; response: NextResponse }
> {
  const authHeader = request.headers.get("authorization");
  const rawKey = extractApiKeyFromHeader(authHeader);

  if (!rawKey) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "API key mancante o formato non valido. Usa: Authorization: Bearer pk_..." },
        { status: 401 }
      ),
    };
  }

  // Lookup per prefisso
  const prefix = extractKeyPrefix(rawKey);
  const apiKey = await prisma.apiKey.findFirst({
    where: { keyPrefix: prefix, attiva: true },
  });

  if (!apiKey) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "API key non valida o disattivata" },
        { status: 401 }
      ),
    };
  }

  // Verifica hash
  const valid = await verifyApiKey(rawKey, apiKey.keyHash);
  if (!valid) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "API key non valida o disattivata" },
        { status: 401 }
      ),
    };
  }

  // Controlla scadenza
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "API key scaduta" },
        { status: 401 }
      ),
    };
  }

  // Aggiorna ultimo utilizzo (fire-and-forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { ultimoUtilizzo: new Date() },
  }).catch(() => {});

  // Rate limiting
  const rateLimitResult = rateLimiter.check(
    String(apiKey.id),
    apiKey.rateLimitPerHour
  );

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      { error: "Rate limit superato. Riprova dopo il reset." },
      { status: 429 }
    );
    response.headers.set("X-RateLimit-Limit", String(apiKey.rateLimitPerHour));
    response.headers.set("X-RateLimit-Remaining", String(rateLimitResult.remaining));
    response.headers.set("X-RateLimit-Reset", rateLimitResult.resetAt.toISOString());
    return { success: false, response };
  }

  // Per-endpoint rate limiting
  const endpointLimits = (apiKey.rateLimitPerEndpoint as Record<string, number>) || {};
  const endpoint = request.nextUrl.pathname;
  const endpointLimit = endpointLimits[endpoint];
  if (endpointLimit) {
    const endpointResult = rateLimiter.checkEndpoint(String(apiKey.id), endpoint, endpointLimit);
    if (!endpointResult.allowed) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Rate limit per-endpoint superato" },
          { status: 429 }
        ),
      };
    }
  }

  const scopes = (apiKey.scopes as string[]) as ApiScope[];

  // Audit log for API calls (fire-and-forget)
  // The LogAttivita model doesn't support API_CALL actions yet,
  // so we log to console with structured data for observability.
  console.log("[API_AUDIT]", JSON.stringify({
    timestamp: new Date().toISOString(),
    societaId: apiKey.societaId,
    keyId: apiKey.id,
    keyNome: apiKey.nome,
    keyPrefix: apiKey.keyPrefix,
    endpoint: request.nextUrl.pathname,
    method: request.method,
  }));

  return {
    success: true,
    payload: {
      keyId: apiKey.id,
      societaId: apiKey.societaId,
      scopes,
    },
  };
}
