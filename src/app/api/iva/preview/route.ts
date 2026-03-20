import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processIva } from "@/lib/iva/engine";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    const body = await request.json();
    const { nazioneFornitore, tipoMerce, tipoOperazione, descrizione, importoImponibile,
      aliquotaIva, naturaIvaManuale, isReverseChargeInterno, sanMarinoConIva, splitPayment } = body;

    if (!tipoMerce || !tipoOperazione) {
      return NextResponse.json({ error: "tipoMerce e tipoOperazione sono obbligatori" }, { status: 400 });
    }

    const result = processIva({
      nazioneFornitore: nazioneFornitore || "IT", tipoMerce, tipoOperazione,
      descrizione: descrizione || "", importoImponibile: importoImponibile || 0,
      aliquotaIva, naturaIvaManuale, isReverseChargeInterno, sanMarinoConIva, splitPayment,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Errore preview IVA:", error);
    return NextResponse.json({ error: "Errore nella preview IVA" }, { status: 500 });
  }
}
