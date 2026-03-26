import { SignJWT, jwtVerify } from "jose";
import type { PortaleTokenPayload } from "./types";

const SECRET = new TextEncoder().encode(process.env.PORTALE_JWT_SECRET ?? "portale-secret-change-me");

export async function createPortaleToken(payload: PortaleTokenPayload): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifyPortaleToken(token: string): Promise<PortaleTokenPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return {
    accessoClienteId: payload.accessoClienteId as number,
    societaId: payload.societaId as number,
    ruolo: payload.ruolo as string,
  };
}
