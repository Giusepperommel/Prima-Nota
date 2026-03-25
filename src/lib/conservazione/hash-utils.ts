/**
 * SHA-256 hash utilities for conservazione sostitutiva.
 */

/**
 * Calculate SHA-256 hash of a string or buffer.
 * Works in both Node.js and browser environments.
 */
export async function sha256(data: string | Buffer | Uint8Array): Promise<string> {
  // Node.js environment
  if (typeof globalThis.process !== "undefined" && globalThis.process.versions?.node) {
    const { createHash } = await import("crypto");
    const hash = createHash("sha256");
    hash.update(typeof data === "string" ? Buffer.from(data, "utf-8") : data);
    return hash.digest("hex");
  }

  // Browser/edge environment
  const encoder = new TextEncoder();
  const buffer = typeof data === "string" ? encoder.encode(data) : new Uint8Array(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Calculate SHA-256 hash for multiple documents and return a manifest.
 */
export async function hashDocuments(
  documents: { name: string; content: string }[],
): Promise<{ name: string; hash: string }[]> {
  const results: { name: string; hash: string }[] = [];
  for (const doc of documents) {
    const hash = await sha256(doc.content);
    results.push({ name: doc.name, hash });
  }
  return results;
}
