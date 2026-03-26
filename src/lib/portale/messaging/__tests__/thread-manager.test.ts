import { describe, it, expect } from "vitest";
import { validateThreadInput } from "../thread-manager";

describe("thread-manager", () => {
  it("validates valid thread input", () => {
    const result = validateThreadInput({
      societaId: 1,
      accessoClienteId: 1,
      oggetto: "Test subject",
      testoIniziale: "Hello",
      mittenteTipo: "CLIENTE",
      mittenteId: 1,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects empty oggetto", () => {
    const result = validateThreadInput({
      societaId: 1,
      accessoClienteId: 1,
      oggetto: "",
      testoIniziale: "Hello",
      mittenteTipo: "CLIENTE",
      mittenteId: 1,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Oggetto obbligatorio");
  });

  it("rejects empty testoIniziale", () => {
    const result = validateThreadInput({
      societaId: 1,
      accessoClienteId: 1,
      oggetto: "Test",
      testoIniziale: "",
      mittenteTipo: "CLIENTE",
      mittenteId: 1,
    });
    expect(result.valid).toBe(false);
  });
});
