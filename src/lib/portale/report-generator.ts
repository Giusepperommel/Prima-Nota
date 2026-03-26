import Anthropic from "@anthropic-ai/sdk";
import type { ReportClienteTipo } from "@prisma/client";

const client = new Anthropic();

const SYSTEM_PROMPT = `Sei un assistente di studio commercialista. Scrivi report per i clienti in italiano, chiaro e professionale.
Il report deve essere in formato Markdown, comprensibile da un imprenditore non esperto di contabilità.
Usa un tono cortese e rassicurante. Includi numeri e percentuali. Non usare gergo tecnico senza spiegarlo.
Mantieni il report conciso (300-500 parole).`;

export function buildReportPrompt(
  tipo: ReportClienteTipo | string,
  data: Record<string, unknown>,
): string {
  const parts: string[] = [];
  const nome = data.societaNome ?? "l'azienda";
  const periodo = data.periodo ?? "";

  switch (tipo) {
    case "IVA_TRIMESTRALE":
      parts.push(`Scrivi un report sulla situazione IVA di ${nome} per il periodo ${periodo}.`);
      parts.push(`Dati:`);
      if (data.ivaCredito !== undefined) parts.push(`- IVA a credito: €${data.ivaCredito}`);
      if (data.ivaDebito !== undefined) parts.push(`- IVA a debito: €${data.ivaDebito}`);
      if (data.totaleOperazioniAttive !== undefined) parts.push(`- Totale vendite: €${data.totaleOperazioniAttive}`);
      if (data.totaleOperazioniPassive !== undefined) parts.push(`- Totale acquisti: €${data.totaleOperazioniPassive}`);
      break;

    case "ANDAMENTO":
      parts.push(`Scrivi un report sull'andamento economico di ${nome} per ${periodo}.`);
      parts.push(`Dati:`);
      if (data.ricavi !== undefined) parts.push(`- Ricavi: €${data.ricavi}`);
      if (data.costi !== undefined) parts.push(`- Costi: €${data.costi}`);
      if (data.ricaviAnnoPrecedente !== undefined) parts.push(`- Ricavi anno precedente: €${data.ricaviAnnoPrecedente}`);
      if (data.costiAnnoPrecedente !== undefined) parts.push(`- Costi anno precedente: €${data.costiAnnoPrecedente}`);
      break;

    case "PRE_SCADENZA":
      parts.push(`Scrivi un promemoria pre-scadenza per ${nome}.`);
      parts.push(`Scadenza: ${data.scadenza ?? "N/D"}`);
      parts.push(`Importo: €${data.importo ?? 0}`);
      parts.push(`Tipo: ${data.tipoScadenza ?? "F24"}`);
      break;

    case "ANNUALE":
      parts.push(`Scrivi un riepilogo annuale per ${nome} — anno ${periodo}.`);
      if (data.utile !== undefined) parts.push(`- Utile/Perdita: €${data.utile}`);
      if (data.ricaviTotali !== undefined) parts.push(`- Ricavi totali: €${data.ricaviTotali}`);
      if (data.costiTotali !== undefined) parts.push(`- Costi totali: €${data.costiTotali}`);
      break;
  }

  return parts.join("\n");
}

export function parseReportResponse(text: string): string {
  // Return as-is — Claude already generates markdown
  return text.trim();
}

export async function generateReport(
  tipo: ReportClienteTipo | string,
  data: Record<string, unknown>,
): Promise<{ contenuto: string; tokensUsati: number }> {
  const prompt = buildReportPrompt(tipo, data);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const contenuto = textBlock && textBlock.type === "text" ? parseReportResponse(textBlock.text) : "";
  const tokensUsati = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

  return { contenuto, tokensUsati };
}
