import { describe, it, expect } from "vitest";
import { validateOperazione } from "../operation-handler";

describe("operation-handler", () => {
  it("validates incasso operation", () => {
    const result = validateOperazione({
      societaId: 1,
      accessoClienteId: 1,
      tipo: "INCASSO",
      dati: { importo: 100, cliente: "Acme", data: "2026-01-15", metodoPagamento: "bonifico" },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects incasso without importo", () => {
    const result = validateOperazione({
      societaId: 1,
      accessoClienteId: 1,
      tipo: "INCASSO",
      dati: { importo: 0, cliente: "Acme", data: "2026-01-15", metodoPagamento: "bonifico" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Importo obbligatorio e maggiore di zero");
  });

  it("validates pagamento operation", () => {
    const result = validateOperazione({
      societaId: 1,
      accessoClienteId: 1,
      tipo: "PAGAMENTO",
      dati: { importo: 50, fornitore: "Supplier", data: "2026-01-15" },
    });
    expect(result.valid).toBe(true);
  });

  it("validates fattura operation", () => {
    const result = validateOperazione({
      societaId: 1,
      accessoClienteId: 1,
      tipo: "FATTURA",
      dati: { fileUrl: "/uploads/doc.pdf" },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects fattura without fileUrl", () => {
    const result = validateOperazione({
      societaId: 1,
      accessoClienteId: 1,
      tipo: "FATTURA",
      dati: { fileUrl: "" },
    });
    expect(result.valid).toBe(false);
  });
});
