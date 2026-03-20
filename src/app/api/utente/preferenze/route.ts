import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const user = session.user as any;
  const body = await request.json();

  const updateData: Record<string, boolean> = {};

  if (typeof body.modalitaAvanzata === "boolean") {
    updateData.modalitaAvanzata = body.modalitaAvanzata;
  }
  if (typeof body.modalitaCommercialista === "boolean") {
    updateData.modalitaCommercialista = body.modalitaCommercialista;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nessun campo da aggiornare" }, { status: 400 });
  }

  try {
    await prisma.utente.update({
      where: { id: user.id },
      data: updateData,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Errore aggiornamento preferenze:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
