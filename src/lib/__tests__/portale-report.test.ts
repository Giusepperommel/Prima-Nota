import { describe, it, expect } from "vitest";
import { buildReportPrompt, parseReportResponse } from "../portale/report-generator";

describe("buildReportPrompt", () => {
  it("builds IVA report prompt with data", () => {
    const prompt = buildReportPrompt("IVA_TRIMESTRALE", {
      societaNome: "Rossi SRL",
      periodo: "Q1 2026",
      ivaCredito: 2340,
      ivaDebito: 1500,
      totaleOperazioniAttive: 50000,
      totaleOperazioniPassive: 30000,
    });
    expect(prompt).toContain("Rossi SRL");
    expect(prompt).toContain("2340");
    expect(prompt).toContain("IVA");
  });

  it("builds andamento report with comparison data", () => {
    const prompt = buildReportPrompt("ANDAMENTO", {
      societaNome: "Bianchi SRL",
      periodo: "Marzo 2026",
      ricavi: 80000,
      costi: 60000,
      ricaviAnnoPrecedente: 70000,
      costiAnnoPrecedente: 55000,
    });
    expect(prompt).toContain("Bianchi SRL");
    expect(prompt).toContain("80000");
  });
});

describe("parseReportResponse", () => {
  it("returns markdown content", () => {
    const result = parseReportResponse("## Situazione IVA\n\nIl credito IVA è di €2.340.");
    expect(result).toContain("Situazione IVA");
  });

  it("strips any non-content prefix", () => {
    const result = parseReportResponse("Ecco il report:\n\n## Situazione\nTesto");
    expect(result).toContain("Situazione");
  });
});
