import { describe, it, expect } from "vitest";
import { buildClassificationPrompt, parseClassificationResponse } from "../ai/classifier";

describe("buildClassificationPrompt", () => {
  it("builds prompt for fattura classification", () => {
    const prompt = buildClassificationPrompt("CLASSIFICAZIONE", {
      fornitore: "Rossi SRL",
      descrizione: "Consulenza informatica",
      importo: 1000,
      categorie: [
        { id: 1, nome: "Consulenze" },
        { id: 2, nome: "Hardware" },
      ],
    });

    expect(prompt).toContain("Rossi SRL");
    expect(prompt).toContain("Consulenze");
    expect(prompt).toContain("JSON");
  });
});

describe("parseClassificationResponse", () => {
  it("parses valid JSON response", () => {
    const response = `{"categoriaId": 1, "confidence": 0.95, "motivazione": "Consulenza informatica"}`;
    const result = parseClassificationResponse(response);
    expect(result.suggestion).toEqual({ categoriaId: 1 });
    expect(result.confidence).toBe(0.95);
    expect(result.motivazione).toBe("Consulenza informatica");
  });

  it("handles markdown-wrapped JSON", () => {
    const response = "```json\n{\"categoriaId\": 2, \"confidence\": 0.8, \"motivazione\": \"Hardware\"}\n```";
    const result = parseClassificationResponse(response);
    expect(result.suggestion).toEqual({ categoriaId: 2 });
  });

  it("returns low confidence on parse error", () => {
    const result = parseClassificationResponse("not json");
    expect(result.confidence).toBe(0);
    expect(result.motivazione).toContain("parse");
  });
});
