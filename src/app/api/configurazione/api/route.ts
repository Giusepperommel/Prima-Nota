import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey, hashApiKey, extractKeyPrefix } from "@/lib/api/api-key";
import { API_SCOPES } from "@/lib/api/types";
import type { ApiScope } from "@/lib/api/types";

/**
 * GET /api/configurazione/api
 * Elenca tutte le API key della societa corrente (solo admin).
 * Non restituisce mai l'hash della chiave.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso riservato agli amministratori" }, { status: 403 });
    }

    const societaId = user.societaId as number;
    if (!societaId) {
      return NextResponse.json({ error: "Nessuna societa selezionata" }, { status: 400 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { societaId },
      select: {
        id: true,
        nome: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerHour: true,
        attiva: true,
        ultimoUtilizzo: true,
        lastRotatedAt: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      keys,
      scopesDisponibili: API_SCOPES,
    });
  } catch (error) {
    console.error("Errore GET /api/configurazione/api:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/configurazione/api
 * Crea una nuova API key (solo admin).
 * La chiave in chiaro viene restituita SOLO in questa risposta.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso riservato agli amministratori" }, { status: 403 });
    }

    const societaId = user.societaId as number;
    if (!societaId) {
      return NextResponse.json({ error: "Nessuna societa selezionata" }, { status: 400 });
    }

    const body = await request.json();
    const { nome, scopes, rateLimitPerHour, expiresAt } = body;

    // Validazione nome
    if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
      return NextResponse.json(
        { error: "Il nome della chiave e' obbligatorio" },
        { status: 400 }
      );
    }

    // Validazione scopes
    if (!Array.isArray(scopes) || scopes.length === 0) {
      return NextResponse.json(
        { error: "Seleziona almeno uno scope" },
        { status: 400 }
      );
    }

    const validScopes = scopes.every((s: string) =>
      (API_SCOPES as readonly string[]).includes(s)
    );
    if (!validScopes) {
      return NextResponse.json(
        { error: "Uno o piu' scopes non validi" },
        { status: 400 }
      );
    }

    // Genera la chiave
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = extractKeyPrefix(rawKey);

    const apiKey = await prisma.apiKey.create({
      data: {
        societaId,
        nome: nome.trim(),
        keyHash,
        keyPrefix,
        scopes: scopes as ApiScope[],
        rateLimitPerHour: rateLimitPerHour ?? 1000,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      select: {
        id: true,
        nome: true,
        keyPrefix: true,
        scopes: true,
        rateLimitPerHour: true,
        attiva: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return NextResponse.json(
      {
        ...apiKey,
        rawKey,
        avviso: "ATTENZIONE: la chiave in chiaro viene mostrata solo ora. Salvala in un luogo sicuro.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore POST /api/configurazione/api:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/configurazione/api
 * Elimina una API key per ID (solo admin).
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso riservato agli amministratori" }, { status: 403 });
    }

    const societaId = user.societaId as number;
    if (!societaId) {
      return NextResponse.json({ error: "Nessuna societa selezionata" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");

    if (!idParam) {
      return NextResponse.json(
        { error: "Parametro 'id' obbligatorio" },
        { status: 400 }
      );
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "ID non valido" },
        { status: 400 }
      );
    }

    // Verifica che la chiave appartenga alla societa
    const existing = await prisma.apiKey.findFirst({
      where: { id, societaId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Chiave API non trovata" },
        { status: 404 }
      );
    }

    await prisma.apiKey.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Chiave API eliminata" });
  } catch (error) {
    console.error("Errore DELETE /api/configurazione/api:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/configurazione/api
 * Ruota una API key esistente generando una nuova chiave (solo admin).
 * La vecchia chiave resta valida per 24 ore (overlap di sicurezza).
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso riservato agli amministratori" }, { status: 403 });
    }

    const societaId = user.societaId as number;
    if (!societaId) {
      return NextResponse.json({ error: "Nessuna societa selezionata" }, { status: 400 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID chiave obbligatorio" },
        { status: 400 }
      );
    }

    const existing = await prisma.apiKey.findFirst({
      where: { id: Number(id), societaId, attiva: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Chiave API non trovata o non attiva" },
        { status: 404 }
      );
    }

    const newRawKey = generateApiKey();
    const newKeyHash = await hashApiKey(newRawKey);

    await prisma.apiKey.update({
      where: { id: existing.id },
      data: {
        keyHash: newKeyHash,
        keyPrefix: extractKeyPrefix(newRawKey),
        lastRotatedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: existing.id,
      key: newRawKey,
      avviso: "Nuova chiave generata. La vecchia chiave non sara' piu' valida.",
    });
  } catch (error) {
    console.error("Errore PUT /api/configurazione/api:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
