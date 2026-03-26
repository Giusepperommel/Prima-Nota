import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, verifyApiKey, extractKeyPrefix } from "../api-key";

describe("api-key", () => {
  it("generates a key with pk_ prefix", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^pk_[a-zA-Z0-9_-]{40}$/);
  });

  it("extracts prefix from key", () => {
    const key = "pk_abcdefghij1234567890abcdefghij1234567890";
    expect(extractKeyPrefix(key)).toBe("pk_abcdef");
  });

  it("hashes and verifies key correctly", async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key);
    expect(hash).not.toBe(key);
    expect(await verifyApiKey(key, hash)).toBe(true);
    expect(await verifyApiKey("pk_wrong", hash)).toBe(false);
  });
});
