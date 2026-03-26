import { describe, it, expect } from "vitest";
import { validateMessageInput } from "../message-sender";

describe("message-sender", () => {
  it("validates valid message input", () => {
    const result = validateMessageInput({
      threadId: 1,
      societaId: 1,
      accessoClienteId: 1,
      mittenteTipo: "CLIENTE",
      mittenteId: 1,
      testo: "Hello",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects empty testo", () => {
    const result = validateMessageInput({
      threadId: 1,
      societaId: 1,
      accessoClienteId: 1,
      mittenteTipo: "CLIENTE",
      mittenteId: 1,
      testo: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Testo messaggio obbligatorio");
  });
});
