import { describe, it, expect } from "vitest";
import { getNextProtocollo, formatProtocollo } from "../doppia-registrazione";

describe("doppia-registrazione", () => {
  it("formatProtocollo formatta con padding a 4 cifre", () => {
    expect(formatProtocollo(1, 2026)).toBe("0001/2026");
    expect(formatProtocollo(42, 2026)).toBe("0042/2026");
    expect(formatProtocollo(1234, 2026)).toBe("1234/2026");
  });
  it("getNextProtocollo con lista vuota ritorna 1", () => {
    expect(getNextProtocollo(null)).toBe(1);
    expect(getNextProtocollo(undefined as any)).toBe(1);
  });
  it("getNextProtocollo incrementa dal massimo esistente", () => {
    expect(getNextProtocollo("0005/2026")).toBe(6);
    expect(getNextProtocollo("0099/2026")).toBe(100);
  });
});
