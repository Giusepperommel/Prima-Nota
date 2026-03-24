import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * TODO: Implement PDF export using @react-pdf/renderer.
 *
 * This placeholder returns JSON with the data that would be used to generate the PDF.
 * Install @react-pdf/renderer and create src/lib/pdf/registro-iva-pdf.tsx to enable.
 *
 * Expected query params:
 * - registroIva: VENDITE | ACQUISTI | CORRISPETTIVI
 * - anno: number
 * - mese: number (optional)
 * - sezionale: string (optional)
 * - stampaDefinitiva: boolean (optional, commercialista only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const registroIva = searchParams.get("registroIva");
    const anno = searchParams.get("anno");
    const mese = searchParams.get("mese");

    return NextResponse.json({
      message:
        "PDF export non ancora implementato. Installare @react-pdf/renderer per abilitare.",
      params: { registroIva, anno, mese },
      todo: "Implementare src/lib/pdf/registro-iva-pdf.tsx con @react-pdf/renderer",
    });
  } catch (error) {
    console.error("Errore nell'export PDF registri IVA:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
