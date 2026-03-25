import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    if (!societaId) {
      return NextResponse.json(
        { error: "Nessuna societa selezionata" },
        { status: 400 }
      );
    }

    const config = await prisma.configurazioneProviderFe.findUnique({
      where: { societaId },
    });

    if (!config) {
      return NextResponse.json({
        config: {
          provider: "MANUALE",
          attivo: false,
          configurazione: null,
        },
      });
    }

    return NextResponse.json({
      config: {
        id: config.id,
        provider: config.provider,
        attivo: config.attivo,
        configurazione: config.configurazione,
        ultimoTest: config.ultimoTest?.toISOString() || null,
        esitoTest: config.esitoTest,
      },
    });
  } catch (error: any) {
    console.error("Errore lettura configurazione provider:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento della configurazione" },
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
    const societaId = user.societaId as number;

    if (!societaId) {
      return NextResponse.json(
        { error: "Nessuna societa selezionata" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { provider, configurazione } = body;

    if (!provider) {
      return NextResponse.json(
        { error: "Provider e obbligatorio" },
        { status: 400 }
      );
    }

    // Only MANUALE is currently supported
    const validProviders = ["MANUALE", "ARUBA", "INFOCERT"];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: "Provider non valido" },
        { status: 400 }
      );
    }

    const config = await prisma.configurazioneProviderFe.upsert({
      where: { societaId },
      create: {
        societaId,
        provider,
        attivo: provider === "MANUALE",
        configurazione: configurazione || null,
      },
      update: {
        provider,
        attivo: provider === "MANUALE",
        configurazione: configurazione || null,
      },
    });

    return NextResponse.json({
      config: {
        id: config.id,
        provider: config.provider,
        attivo: config.attivo,
        configurazione: config.configurazione,
      },
    });
  } catch (error: any) {
    console.error("Errore salvataggio configurazione provider:", error);
    return NextResponse.json(
      { error: "Errore nel salvataggio della configurazione" },
      { status: 500 }
    );
  }
}
