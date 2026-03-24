import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const anno = searchParams.get("anno");

    if (!anno) {
      return NextResponse.json({ error: "anno obbligatorio" }, { status: 400 });
    }

    const cu = await prisma.certificazioneUnica.findMany({
      where: {
        societaId: user.societaId,
        anno: parseInt(anno, 10),
      },
      include: {
        anagrafica: {
          select: {
            id: true,
            denominazione: true,
            codiceFiscale: true,
            partitaIva: true,
            indirizzo: true,
            cap: true,
            citta: true,
            provincia: true,
          },
        },
      },
      orderBy: { anagrafica: { denominazione: "asc" } },
    });

    const serialized = cu.map((c) => ({
      ...c,
      ammontareLordo: Number(c.ammontareLordo),
      imponibile: Number(c.imponibile),
      ritenutaAcconto: Number(c.ritenutaAcconto),
      rivalsaInps: Number(c.rivalsaInps),
      cassaPrevidenza: Number(c.cassaPrevidenza),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero CU:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
