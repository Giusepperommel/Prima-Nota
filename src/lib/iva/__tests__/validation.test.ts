import { describe, it, expect } from "vitest";
import { validateIva } from "../validation";

describe("IVA Validation", () => {
  it("natura presente con aliquota > 0 → warning (escluso N6.x)", () => {
    const result = validateIva({ naturaIva: "N4", aliquotaIva: 22, nazioneFornitore: "IT", tipoDocumentoSdi: "TD01", tipoMerce: "SERVIZI", isAutofattura: false });
    expect(result.some(w => w.field === "aliquotaIva" && w.severity === "warning")).toBe(true);
  });
  it("N6.x con aliquota > 0 → nessun warning (corretto per autofattura)", () => {
    const result = validateIva({ naturaIva: "N6_3", aliquotaIva: 22, nazioneFornitore: "IT", tipoDocumentoSdi: "TD16", tipoMerce: "SERVIZI", isAutofattura: true });
    expect(result.some(w => w.field === "aliquotaIva")).toBe(false);
  });
  it("N6.x con fornitore estero → warning", () => {
    const result = validateIva({ naturaIva: "N6_3", aliquotaIva: 0, nazioneFornitore: "DE", tipoDocumentoSdi: "TD01", tipoMerce: "SERVIZI", isAutofattura: false });
    expect(result.some(w => w.severity === "warning" && w.message.includes("interno"))).toBe(true);
  });
  it("TD18 con fornitore extra-UE → errore", () => {
    const result = validateIva({ naturaIva: null, aliquotaIva: 22, nazioneFornitore: "US", tipoDocumentoSdi: "TD18", tipoMerce: "BENI", isAutofattura: false });
    expect(result.some(w => w.severity === "error")).toBe(true);
  });
  it("TD18 con SERVIZI → warning", () => {
    const result = validateIva({ naturaIva: null, aliquotaIva: 22, nazioneFornitore: "DE", tipoDocumentoSdi: "TD18", tipoMerce: "SERVIZI", isAutofattura: false });
    expect(result.some(w => w.message.includes("TD17"))).toBe(true);
  });
  it("splitPayment + N6.x → warning priorità RC", () => {
    const result = validateIva({ naturaIva: "N6_3", aliquotaIva: 0, nazioneFornitore: "IT", tipoDocumentoSdi: "TD01", tipoMerce: "SERVIZI", isAutofattura: false, splitPayment: true });
    expect(result.some(w => w.message.includes("priorità"))).toBe(true);
  });
});
