import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseFatturaXml } from "@/lib/providers/adapters/fatture-file";
import { importaFattureXml } from "@/lib/import/fatture-import";
import type { FatturaImportata } from "@/lib/providers/types";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const userId = user.id as number;

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "Nessun file caricato" }, { status: 400 });
    }

    const fatture: FatturaImportata[] = [];

    for (const file of files) {
      const text = await file.text();

      if (file.name.endsWith(".xml")) {
        try {
          fatture.push(parseFatturaXml(text));
        } catch (err: any) {
          return NextResponse.json(
            { error: `Errore nel parsing di ${file.name}: ${err.message}` },
            { status: 400 },
          );
        }
      }
      // ZIP support to be added later
    }

    if (fatture.length === 0) {
      return NextResponse.json({ error: "Nessuna fattura XML trovata nei file caricati" }, { status: 400 });
    }

    const result = await importaFattureXml(societaId, userId, fatture);

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/import/fatture error:", error);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
