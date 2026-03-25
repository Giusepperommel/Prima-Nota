import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

type MovimentoInput = {
  descrizione: string;
  importo: number;
  data: string;
};

type CandidateOp = {
  id: number;
  descrizione: string;
  importo: number;
  data: string;
  fornitore?: string;
};

type MatchResult = {
  operazioneId: number | null;
  confidence: number;
  motivazione: string;
  tokensUsati: number;
};

const SYSTEM_PROMPT = `Sei un assistente contabile. Ti viene dato un movimento bancario e una lista di operazioni candidate.
Identifica quale operazione corrisponde al movimento bancario, analizzando: importo, descrizione/causale, date, nome fornitore/cliente.
Rispondi SEMPRE in JSON: {"operazioneId": number|null, "confidence": 0.0-1.0, "motivazione": "spiegazione"}
Se nessuna operazione corrisponde, rispondi con operazioneId: null.`;

export function buildMatchingPrompt(
  movimento: MovimentoInput,
  candidati: CandidateOp[],
): string {
  const parts = [
    "Movimento bancario:",
    `  Descrizione: ${movimento.descrizione}`,
    `  Importo: €${Math.abs(movimento.importo)} (${movimento.importo < 0 ? "uscita" : "entrata"})`,
    `  Data: ${movimento.data}`,
    "",
    "Operazioni candidate:",
  ];

  for (const c of candidati) {
    parts.push(`  ID ${c.id}: ${c.descrizione} — €${c.importo} — ${c.data}${c.fornitore ? ` — ${c.fornitore}` : ""}`);
  }

  parts.push("", "Rispondi in formato JSON.");
  return parts.join("\n");
}

export function parseMatchingResponse(text: string): Omit<MatchResult, "tokensUsati"> {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const parsed = JSON.parse(cleaned);
    return {
      operazioneId: parsed.operazioneId ?? null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      motivazione: parsed.motivazione ?? "",
    };
  } catch {
    return { operazioneId: null, confidence: 0, motivazione: "Errore nel parse della risposta AI" };
  }
}

export async function matchWithClaude(
  movimento: MovimentoInput,
  candidati: CandidateOp[],
): Promise<MatchResult> {
  if (candidati.length === 0) {
    return { operazioneId: null, confidence: 0, motivazione: "Nessun candidato disponibile", tokensUsati: 0 };
  }

  const prompt = buildMatchingPrompt(movimento, candidati);
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const result = parseMatchingResponse(text);
  return {
    ...result,
    tokensUsati: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
  };
}
