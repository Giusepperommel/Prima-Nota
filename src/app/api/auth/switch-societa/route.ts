import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCompanyAccess } from "@/lib/auth-utils";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await request.json();
    const { societaId } = body as { societaId: number };

    if (!societaId || typeof societaId !== "number") {
      return NextResponse.json(
        { error: "societaId richiesto" },
        { status: 400 }
      );
    }

    const access = await requireCompanyAccess(user.id, societaId);
    if (!access) {
      return NextResponse.json(
        { error: "Accesso negato a questa azienda" },
        { status: 403 }
      );
    }

    // Update ultimo accesso on UtenteAzienda
    await prisma.utenteAzienda.update({
      where: { id: access.id },
      data: { ultimoAccesso: new Date() },
    });

    return NextResponse.json({ success: true, societaId });
  } catch (error) {
    console.error("Errore nel cambio societa:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
