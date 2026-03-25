import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getScadenzeMultiSocieta,
  generaTuttiF24Pronti,
  calcolaTutteLiquidazioni,
} from "@/lib/adempimenti/batch";

async function getSocietaIds(userId: number): Promise<number[]> {
  const utenteAziende = await prisma.utenteAzienda.findMany({
    where: { utenteId: userId, attivo: true },
    select: { societaId: true },
  });
  return utenteAziende.map((ua) => ua.societaId);
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;

    const societaIds = await getSocietaIds(userId);
    if (societaIds.length === 0) {
      return NextResponse.json([]);
    }

    const now = new Date();
    const anno = now.getFullYear();
    const mese = now.getMonth() + 1;

    const scadenze = await getScadenzeMultiSocieta(societaIds, anno, mese);

    const serialized = scadenze.map((s) => ({
      ...s,
      scadenza: s.scadenza.toISOString(),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      checklist: s.checklist.map((c) => ({
        ...c,
        completataAt: c.completataAt?.toISOString() ?? null,
      })),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero scadenze multi-societa:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const userId = user.id as number;

    const body = await request.json();
    const { action, anno, periodo } = body;

    if (!action || !anno || !periodo) {
      return NextResponse.json(
        { error: "Parametri mancanti: action, anno, periodo sono obbligatori" },
        { status: 400 }
      );
    }

    const societaIds = await getSocietaIds(userId);
    if (societaIds.length === 0) {
      return NextResponse.json({ data: [], message: "Nessuna societa trovata" });
    }

    if (action === "generaTuttiF24") {
      const result = await generaTuttiF24Pronti(societaIds, anno, periodo);
      const serialized = result.map((s) => ({
        ...s,
        scadenza: s.scadenza.toISOString(),
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }));
      return NextResponse.json({ data: serialized });
    }

    if (action === "calcolaTutteLiquidazioni") {
      const result = await calcolaTutteLiquidazioni(societaIds, anno, periodo);
      const serialized = result.map((s) => ({
        ...s,
        scadenza: s.scadenza.toISOString(),
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        checklist: s.checklist.map((c) => ({
          ...c,
          completataAt: c.completataAt?.toISOString() ?? null,
        })),
      }));
      return NextResponse.json({ data: serialized });
    }

    return NextResponse.json(
      { error: `Azione non riconosciuta: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    console.error("Errore nel batch scadenze fiscali:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
