import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const where: any = { societaId };

    if (search) {
      where.OR = [
        { codice: { contains: search } },
        { descrizione: { contains: search } },
      ];
    }

    const conti = await prisma.pianoDeiConti.findMany({
      where,
      orderBy: { codice: "asc" },
    });

    return NextResponse.json(conti);
  } catch (error) {
    console.error("Errore nel recupero del piano dei conti:", error);
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
    const societaId = user.societaId as number;

    if (!user.modalitaCommercialista) {
      return NextResponse.json(
        { error: "Solo la modalità commercialista può creare nuovi conti" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { codice, descrizione, tipo, voceSp, voceCe, naturaSaldo } = body;

    // Validate required fields
    if (!codice || !descrizione || !tipo || !naturaSaldo) {
      return NextResponse.json(
        { error: "Codice, descrizione, tipo e natura saldo sono obbligatori" },
        { status: 400 }
      );
    }

    // Validate codice format
    const codiceRegex = /^\d{3}\.\d{3}$/;
    if (!codiceRegex.test(codice)) {
      return NextResponse.json(
        { error: "Il codice deve essere nel formato NNN.NNN (es. 310.090)" },
        { status: 400 }
      );
    }

    // Validate tipo
    const tipiValidi = ["PATRIMONIALE_ATTIVO", "PATRIMONIALE_PASSIVO", "ECONOMICO_COSTO", "ECONOMICO_RICAVO", "ORDINE"];
    if (!tipiValidi.includes(tipo)) {
      return NextResponse.json(
        { error: "Tipo conto non valido" },
        { status: 400 }
      );
    }

    // Validate naturaSaldo
    if (!["DARE", "AVERE"].includes(naturaSaldo)) {
      return NextResponse.json(
        { error: "Natura saldo non valida" },
        { status: 400 }
      );
    }

    // Check for duplicate codice within the same società
    const existing = await prisma.pianoDeiConti.findUnique({
      where: { societaId_codice: { societaId, codice } },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Il codice ${codice} esiste già per questa società` },
        { status: 409 }
      );
    }

    const conto = await prisma.pianoDeiConti.create({
      data: {
        societaId,
        codice,
        descrizione,
        tipo,
        voceSp: voceSp || null,
        voceCe: voceCe || null,
        naturaSaldo,
        attivo: true,
        preConfigurato: false,
        modificabile: true,
      },
    });

    return NextResponse.json(conto, { status: 201 });
  } catch (error) {
    console.error("Errore nella creazione del conto:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
