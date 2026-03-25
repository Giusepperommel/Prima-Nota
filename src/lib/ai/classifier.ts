import Anthropic from "@anthropic-ai/sdk";
import type { AiSuggestionTipo } from "@prisma/client";
import type { AiClassificationResult } from "./types";

const client = new Anthropic();

const SYSTEM_PROMPT = `Sei un assistente contabile specializzato nella classificazione di documenti fiscali italiani.
Rispondi SEMPRE in formato JSON con questa struttura:
{
  "categoriaId": number | null,
  "contoId": number | null,
  "confidence": number (0.0-1.0),
  "motivazione": "spiegazione breve in italiano"
}

Non includere altro testo. Solo JSON.`;

export function buildClassificationPrompt(
  tipo: AiSuggestionTipo,
  context: Record<string, unknown>,
): string {
  const parts: string[] = [];

  if (tipo === "CLASSIFICAZIONE") {
    parts.push("Classifica questa operazione contabile:");
    if (context.fornitore) parts.push(`Fornitore: ${context.fornitore}`);
    if (context.descrizione) parts.push(`Descrizione: ${context.descrizione}`);
    if (context.importo) parts.push(`Importo: €${context.importo}`);

    if (Array.isArray(context.categorie) && context.categorie.length > 0) {
      parts.push("\nCategorie disponibili:");
      for (const cat of context.categorie as { id: number; nome: string }[]) {
        parts.push(`- ID ${cat.id}: ${cat.nome}`);
      }
    }

    parts.push("\nRispondi in formato JSON.");
  } else if (tipo === "RICONCILIAZIONE") {
    parts.push("Analizza questo movimento bancario e suggerisci un match:");
    if (context.descrizione) parts.push(`Causale bancaria: ${context.descrizione}`);
    if (context.importo) parts.push(`Importo: €${context.importo}`);
    parts.push("\nRispondi in formato JSON.");
  } else if (tipo === "ANOMALIA") {
    parts.push("Analizza questa operazione e identifica eventuali anomalie:");
    parts.push(JSON.stringify(context, null, 2));
    parts.push("\nRispondi in formato JSON.");
  }

  return parts.join("\n");
}

export function parseClassificationResponse(text: string): AiClassificationResult {
  try {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);

    const { confidence, motivazione, ...suggestion } = parsed;

    return {
      suggestion,
      confidence: typeof confidence === "number" ? confidence : 0.5,
      motivazione: typeof motivazione === "string" ? motivazione : "",
      tokensUsati: 0, // Set by caller from API response
    };
  } catch {
    return {
      suggestion: {},
      confidence: 0,
      motivazione: "Errore nel parse della risposta AI",
      tokensUsati: 0,
    };
  }
}

export async function classifyWithClaude(
  tipo: AiSuggestionTipo,
  context: Record<string, unknown>,
): Promise<AiClassificationResult> {
  const prompt = buildClassificationPrompt(tipo, context);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text : "";

  const result = parseClassificationResponse(text);
  result.tokensUsati = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  return result;
}
