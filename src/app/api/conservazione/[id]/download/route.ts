import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const { id } = await params;
    const pacchettoId = parseInt(id, 10);

    if (isNaN(pacchettoId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    const pacchetto = await prisma.pacchettoConservazione.findFirst({
      where: { id: pacchettoId, societaId },
    });

    if (!pacchetto) {
      return NextResponse.json({ error: "Pacchetto non trovato" }, { status: 404 });
    }

    // Build a simple text-based package representation
    // In production this would be a real ZIP file
    const content = JSON.stringify(
      {
        id: pacchetto.id,
        anno: pacchetto.anno,
        tipo: pacchetto.tipo,
        hashSHA256: pacchetto.hashSHA256,
        metadatiXml: pacchetto.metadatiXml,
        documenti: pacchetto.fileContenuto ? JSON.parse(pacchetto.fileContenuto) : [],
      },
      null,
      2,
    );

    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="pacchetto_${pacchetto.anno}_${pacchetto.tipo}_${pacchetto.id}.json"`,
      },
    });
  } catch (error) {
    console.error("Errore nel download del pacchetto:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
