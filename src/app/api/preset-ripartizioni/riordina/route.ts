import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const ruolo = user.ruolo as string;

    if (ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const societaId = user.societaId as number;

    const body = await request.json();
    const { ordine } = body;

    if (!ordine || !Array.isArray(ordine) || ordine.length === 0) {
      return NextResponse.json(
        { error: "L'array ordine e obbligatorio" },
        { status: 400 }
      );
    }

    // Update ordinamento for each preset in a transaction
    await prisma.$transaction(
      ordine.map((item: { id: number; ordinamento: number }) =>
        prisma.presetRipartizione.updateMany({
          where: { id: item.id, societaId },
          data: { ordinamento: item.ordinamento },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Errore nel riordinamento dei preset ripartizioni:",
      error
    );
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
