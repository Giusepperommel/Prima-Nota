import { describe, it, expect } from "vitest";
import { mapRuoloForSession } from "../auth-utils";

describe("mapRuoloForSession", () => {
  it("maps COMMERCIALISTA to ADMIN", () => {
    expect(mapRuoloForSession("COMMERCIALISTA")).toBe("ADMIN");
  });
  it("keeps ADMIN as ADMIN", () => {
    expect(mapRuoloForSession("ADMIN")).toBe("ADMIN");
  });
  it("keeps STANDARD as STANDARD", () => {
    expect(mapRuoloForSession("STANDARD")).toBe("STANDARD");
  });
});
