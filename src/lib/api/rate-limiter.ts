import type { RateLimitResult } from "./types";

interface WindowEntry {
  timestamps: number[];
}

/**
 * Rate limiter con finestra scorrevole (sliding window) in memoria.
 * Ogni chiave API ha il proprio contatore isolato.
 */
export class RateLimiter {
  private windows: Map<string, WindowEntry> = new Map();
  private windowMs: number;

  /**
   * @param windowMs Durata della finestra in millisecondi (default: 1 ora)
   */
  constructor(windowMs: number = 3600000) {
    this.windowMs = windowMs;
  }

  /**
   * Verifica se una richiesta è consentita per la chiave data.
   * @param key Identificativo della chiave API
   * @param limit Numero massimo di richieste nella finestra
   */
  check(key: string, limit: number): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let entry = this.windows.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.windows.set(key, entry);
    }

    // Rimuovi timestamp fuori dalla finestra corrente
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    const resetAt = new Date(now + this.windowMs);

    if (entry.timestamps.length >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    entry.timestamps.push(now);

    return {
      allowed: true,
      remaining: limit - entry.timestamps.length,
      resetAt,
    };
  }
}
