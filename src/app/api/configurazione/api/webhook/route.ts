import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * GET /api/configurazione/api/webhook
 * Lista gli endpoint webhook della societa oppure, se viene passato
 * ?endpointId=<id>, restituisce lo storico delle consegne.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    if (!societaId) {
      return NextResponse.json({ error: "Nessuna societa selezionata" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const endpointId = searchParams.get("endpointId");

    // Se viene passato endpointId, restituisci lo storico consegne
    if (endpointId) {
      // Verifica che l'endpoint appartenga alla societa
      const endpoint = await prisma.webhookEndpoint.findFirst({
        where: { id: parseInt(endpointId, 10), societaId },
      });

      if (!endpoint) {
        return NextResponse.json(
          { error: "Endpoint webhook non trovato" },
          { status: 404 }
        );
      }

      const deliveries = await prisma.webhookDelivery.findMany({
        where: { webhookEndpointId: parseInt(endpointId, 10) },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return NextResponse.json({ deliveries });
    }

    // Altrimenti lista tutti gli endpoint della societa
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { societaId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ endpoints });
  } catch (error) {
    console.error("Errore GET /api/configurazione/api/webhook:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/configurazione/api/webhook
 * Crea un nuovo endpoint webhook. Il secret viene generato automaticamente
 * e restituito SOLO in questa risposta.
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
    const { url, eventi } = body;

    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return NextResponse.json(
        { error: "URL obbligatorio" },
        { status: 400 }
      );
    }

    // Validazione URL base
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "URL non valido" },
        { status: 400 }
      );
    }

    const secret = crypto.randomBytes(32).toString("hex");

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        societaId,
        url: url.trim(),
        eventi: Array.isArray(eventi) && eventi.length > 0 ? eventi : ["*"],
        secret,
      },
    });

    return NextResponse.json(
      {
        id: endpoint.id,
        url: endpoint.url,
        eventi: endpoint.eventi,
        secret,
        avviso: "Salva il secret — non verra' piu' mostrato.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Errore POST /api/configurazione/api/webhook:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
