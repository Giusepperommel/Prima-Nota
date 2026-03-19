import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function buildSystemPrompt(categorie: { id: number; nome: string }[]) {
  const categorieList = categorie.map((c) => `  - id: ${c.id}, nome: "${c.nome}"`).join("\n");

  return `Sei un assistente specializzato nell'estrarre dati da screenshot di estratti conto bancari italiani.

Analizza l'immagine e restituisci SOLO un JSON valido (senza markdown, senza backtick) con questo formato:

Per estratti conto con più operazioni:
{
  "type": "multi",
  "transactions": [
    {
      "dataOperazione": "YYYY-MM-DD",
      "descrizione": "descrizione operazione",
      "importo": 1234.56,
      "segno": "+" oppure "-",
      "categoriaId": 123
    }
  ]
}

Per un singolo documento/fattura:
{
  "type": "single",
  "document": {
    "dataOperazione": "YYYY-MM-DD" o null,
    "numeroDocumento": "string" o null,
    "descrizione": "string" o null,
    "importoTotale": 1234.56 o null,
    "imponibile": 1234.56 o null,
    "aliquotaIva": "22" o null,
    "importoIva": 1234.56 o null,
    "fornitore": "string" o null,
    "categoriaId": 123 o null
  }
}

Categorie di spesa disponibili:
${categorieList}

Regole:
- Usa la DATA OPERAZIONE (non la data valuta) se entrambe sono presenti
- Gli importi sono numeri decimali (es. 1144.00, non "1.144,00")
- Il segno indica se è un'entrata (+) o un'uscita (-). Le voci con "+" davanti all'importo sono ENTRATE (segno "+"), quelle con "-" sono USCITE (segno "-")
- La descrizione deve includere il nome dell'operazione e il tipo (es. "BONIFICO ISTANTANEO")
- Estrai TUTTE le operazioni visibili nello screenshot, ma NON duplicare mai la stessa riga. Ogni operazione deve comparire UNA SOLA VOLTA nel risultato
- MANTIENI L'ORDINE esatto in cui le operazioni appaiono nello screenshot, dall'alto verso il basso
- Per categoriaId, scegli la categoria più appropriata dalla lista in base alla descrizione dell'operazione. Se non sei sicuro, usa null.
- Rispondi SOLO con il JSON, nient'altro`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nessuna immagine fornita" }, { status: 400 });
    }

    // Load categories for this società
    const categorie = await prisma.categoriaSpesa.findMany({
      where: { societaId, attiva: true },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const mediaType = file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif";

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "Estrai tutte le operazioni da questo screenshot bancario.",
            },
          ],
        },
      ],
      system: buildSystemPrompt(categorie),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Risposta vuota dal modello" }, { status: 500 });
    }

    // Strip markdown code fences if present (```json ... ```)
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    const parsed = JSON.parse(jsonText);
    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Errore OCR Vision:", error);
    const message = error?.message || "Errore durante l'analisi dell'immagine";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
