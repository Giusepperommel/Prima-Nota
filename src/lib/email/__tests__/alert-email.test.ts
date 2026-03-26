// src/lib/email/__tests__/alert-email.test.ts
import { describe, it, expect } from "vitest";
import { formatAlertEmailHtml, formatAlertEmailSubject } from "../alert-email";

describe("alert-email", () => {
  it("formats email subject with severity", () => {
    expect(formatAlertEmailSubject("CRITICAL", "Test alert")).toBe("[CRITICO] Test alert");
    expect(formatAlertEmailSubject("WARNING", "Test alert")).toBe("[AVVISO] Test alert");
    expect(formatAlertEmailSubject("INFO", "Test info")).toBe("[INFO] Test info");
  });

  it("formats email HTML body", () => {
    const html = formatAlertEmailHtml({
      messaggio: "Scadenza IVA tra 3 giorni",
      gravita: "CRITICAL",
      categoria: "SCADENZE",
      linkAzione: "/adempimenti",
      societaNome: "Acme Srl",
    });
    expect(html).toContain("Scadenza IVA tra 3 giorni");
    expect(html).toContain("Acme Srl");
    expect(html).toContain("CRITICO");
  });

  it("handles missing optional fields", () => {
    const html = formatAlertEmailHtml({
      messaggio: "Test",
      gravita: "INFO",
      categoria: "COMPLIANCE",
      societaNome: "Test Srl",
    });
    expect(html).toContain("Test");
    expect(html).not.toContain("undefined");
  });
});
