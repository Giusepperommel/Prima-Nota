import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPortaleToken, verifyPortaleToken } from "../portale/auth";

describe("Portal JWT auth", () => {
  it("creates and verifies a valid token", async () => {
    const token = await createPortaleToken({ accessoClienteId: 1, societaId: 1, ruolo: "TITOLARE" });
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");

    const payload = await verifyPortaleToken(token);
    expect(payload.accessoClienteId).toBe(1);
    expect(payload.societaId).toBe(1);
    expect(payload.ruolo).toBe("TITOLARE");
  });

  it("throws on invalid token", async () => {
    await expect(verifyPortaleToken("invalid")).rejects.toThrow();
  });
});
