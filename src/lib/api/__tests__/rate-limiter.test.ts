import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "../rate-limiter";

describe("rate-limiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it("allows requests within limit", () => {
    const result = limiter.check("key1", 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("blocks requests over limit", () => {
    for (let i = 0; i < 3; i++) {
      limiter.check("key2", 3);
    }
    const result = limiter.check("key2", 3);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("isolates different keys", () => {
    for (let i = 0; i < 5; i++) {
      limiter.check("keyA", 5);
    }
    const result = limiter.check("keyB", 5);
    expect(result.allowed).toBe(true);
  });

  it("resets after window expires", () => {
    const shortLimiter = new RateLimiter(100);
    for (let i = 0; i < 2; i++) {
      shortLimiter.check("key3", 2);
    }
    expect(shortLimiter.check("key3", 2).allowed).toBe(false);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(shortLimiter.check("key3", 2).allowed).toBe(true);
        resolve();
      }, 150);
    });
  });
});
