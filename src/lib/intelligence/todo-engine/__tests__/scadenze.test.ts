import { describe, it, expect } from "vitest";
import { scadenzeTodoGenerator } from "../generators/scadenze";

describe("scadenze todo generator", () => {
  it("has correct config", () => {
    expect(scadenzeTodoGenerator.fonte).toBe("SCADENZA");
    expect(scadenzeTodoGenerator.modalita).toBeNull();
  });

  it("has a descrizione", () => {
    expect(scadenzeTodoGenerator.descrizione).toBeTruthy();
  });

  it("has a generate function", () => {
    expect(typeof scadenzeTodoGenerator.generate).toBe("function");
  });
});
