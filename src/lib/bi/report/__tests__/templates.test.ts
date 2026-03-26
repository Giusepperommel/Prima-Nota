// src/lib/bi/report/__tests__/templates.test.ts
import { describe, it, expect } from "vitest";
import { PREDEFINED_REPORTS, getReportTemplate } from "../templates";

describe("report templates", () => {
  it("has 6 predefined reports", () => {
    expect(PREDEFINED_REPORTS).toHaveLength(6);
  });

  it("all have required fields", () => {
    for (const r of PREDEFINED_REPORTS) {
      expect(r.tipo).toBeTruthy();
      expect(r.nome).toBeTruthy();
      expect(r.sezioni.length).toBeGreaterThan(0);
    }
  });

  it("getReportTemplate returns template by tipo", () => {
    const t = getReportTemplate("CRUSCOTTO_MENSILE");
    expect(t).toBeDefined();
    expect(t!.nome).toContain("Cruscotto");
  });

  it("getReportTemplate returns undefined for unknown", () => {
    expect(getReportTemplate("UNKNOWN")).toBeUndefined();
  });
});
