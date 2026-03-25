import { describe, it, expect, vi } from "vitest";
import { buildMatchingPrompt, parseMatchingResponse } from "../import/riconciliazione-ai";

describe("buildMatchingPrompt", () => {
  it("builds prompt with movement and candidate operations", () => {
    const prompt = buildMatchingPrompt(
      { descrizione: "BONIFICO A ROSSI SRL FT 001/2026", importo: -1220, data: "2026-03-15" },
      [
        { id: 1, descrizione: "Fattura Rossi SRL", importo: 1220, data: "2026-03-10", fornitore: "Rossi SRL" },
        { id: 2, descrizione: "Fattura Bianchi", importo: 1200, data: "2026-03-12", fornitore: "Bianchi SRL" },
      ],
    );
    expect(prompt).toContain("ROSSI SRL");
    expect(prompt).toContain("1220");
    expect(prompt).toContain("JSON");
  });
});

describe("parseMatchingResponse", () => {
  it("parses valid match response", () => {
    const result = parseMatchingResponse('{"operazioneId": 1, "confidence": 0.92, "motivazione": "Importo e nome corrispondono"}');
    expect(result.operazioneId).toBe(1);
    expect(result.confidence).toBe(0.92);
  });

  it("returns null operazioneId on no match", () => {
    const result = parseMatchingResponse('{"operazioneId": null, "confidence": 0, "motivazione": "Nessun match"}');
    expect(result.operazioneId).toBeNull();
  });

  it("handles parse errors gracefully", () => {
    const result = parseMatchingResponse("not json");
    expect(result.operazioneId).toBeNull();
    expect(result.confidence).toBe(0);
  });
});
