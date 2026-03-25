import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generaCalendarioFiscale } from "@/lib/adempimenti/calendar";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const anno = body.anno;

    if (!anno || typeof anno !== "number" || anno < 2000 || anno > 2100) {
      return NextResponse.json(
        { error: "Anno non valido. Fornire un anno tra 2000 e 2100." },
        { status: 400 }
      );
    }

    const result = await generaCalendarioFiscale(societaId, anno);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Errore nella generazione calendario fiscale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
