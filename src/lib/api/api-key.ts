import crypto from "crypto";
import bcrypt from "bcryptjs";

const KEY_PREFIX = "pk_";
const KEY_LENGTH = 40;
const HASH_ROUNDS = 10;

/**
 * Genera una nuova API key con prefisso "pk_".
 * La chiave ha lunghezza totale KEY_PREFIX + KEY_LENGTH caratteri.
 */
export function generateApiKey(): string {
  const randomPart = crypto.randomBytes(30).toString("base64url").slice(0, KEY_LENGTH);
  return `${KEY_PREFIX}${randomPart}`;
}

/**
 * Estrae il prefisso identificativo dalla chiave (pk_ + primi 6 caratteri).
 * Usato per lookup rapido nel DB senza esporre la chiave intera.
 */
export function extractKeyPrefix(key: string): string {
  return key.slice(0, KEY_PREFIX.length + 6);
}

/**
 * Crea un hash bcrypt della API key per storage sicuro nel DB.
 */
export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, HASH_ROUNDS);
}

/**
 * Verifica una API key in chiaro contro il suo hash bcrypt.
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}
