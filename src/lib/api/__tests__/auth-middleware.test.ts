import { describe, it, expect } from "vitest";
import { extractApiKeyFromHeader, hasScope } from "../auth-middleware";
import type { ApiScope } from "../types";

describe("auth-middleware", () => {
  describe("extractApiKeyFromHeader", () => {
    it("extracts Bearer token", () => {
      expect(extractApiKeyFromHeader("Bearer pk_abc123")).toBe("pk_abc123");
    });
    it("returns null for missing header", () => {
      expect(extractApiKeyFromHeader(null)).toBeNull();
      expect(extractApiKeyFromHeader("")).toBeNull();
    });
    it("returns null for non-Bearer auth", () => {
      expect(extractApiKeyFromHeader("Basic abc123")).toBeNull();
    });
  });
  describe("hasScope", () => {
    const scopes: ApiScope[] = ["read:operazioni", "write:operazioni"];
    it("returns true when scope is present", () => {
      expect(hasScope(scopes, "read:operazioni")).toBe(true);
    });
    it("returns false when scope is missing", () => {
      expect(hasScope(scopes, "read:anagrafiche")).toBe(false);
    });
  });
});
