import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generaFatturaElettronica } from "@/lib/fatturazione/genera-fattura";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;

    if (!societaId) {
      return NextResponse.json(
        { error: "Nessuna societa selezionata" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { operazioneId, sezionaleId } = body;

    if (!operazioneId || typeof operazioneId !== "number") {
      return NextResponse.json(
        { error: "operazioneId e obbligatorio" },
        { status: 400 }
      );
    }

    const result = await generaFatturaElettronica({
      operazioneId,
      societaId,
      userId,
      sezionaleId: sezionaleId || undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Errore generazione fattura elettronica:", error);
    return NextResponse.json(
      { error: error.message || "Errore nella generazione della fattura" },
      { status: 400 }
    );
  }
}
