import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRegistroAmmortizzabili } from "@/lib/cespiti/registro-ammortizzabili";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const annoStr = searchParams.get("anno");
    const anno = annoStr ? parseInt(annoStr, 10) : new Date().getFullYear();

    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const registro = await getRegistroAmmortizzabili(societaId, anno);

    return NextResponse.json(registro);
  } catch (error) {
    console.error("Errore nel recupero del registro ammortizzabili:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
