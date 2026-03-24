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
    const annoParam = searchParams.get("anno");

    if (!annoParam) {
      return NextResponse.json(
        { error: "Parametro anno obbligatorio" },
        { status: 400 }
      );
    }

    const anno = parseInt(annoParam, 10);

    const invii = await prisma.lipeInvio.findMany({
      where: {
        societaId,
        anno,
      },
      orderBy: { trimestre: "asc" },
      select: {
        id: true,
        anno: true,
        trimestre: true,
        nomeFile: true,
        stato: true,
        dataGenerazione: true,
        dataInvio: true,
        scadenzaInvio: true,
      },
    });

    const serialized = invii.map((inv) => ({
      ...inv,
      dataGenerazione: inv.dataGenerazione.toISOString(),
      dataInvio: inv.dataInvio?.toISOString() ?? null,
      scadenzaInvio: inv.scadenzaInvio.toISOString(),
    }));

    return NextResponse.json({ data: serialized });
  } catch (error) {
    console.error("Errore nel recupero LIPE:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
