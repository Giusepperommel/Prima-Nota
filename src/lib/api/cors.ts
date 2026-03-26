// src/lib/api/cors.ts
import { NextResponse } from "next/server";

export function addCorsHeaders(
  response: NextResponse,
  origin: string | null,
  allowedOrigins: string[]
): NextResponse {
  if (!origin) return response;

  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  return response;
}

export function handleCorsPreflightIfNeeded(
  method: string,
  origin: string | null,
  allowedOrigins: string[]
): NextResponse | null {
  if (method !== "OPTIONS") return null;

  const response = new NextResponse(null, { status: 204 });
  return addCorsHeaders(response, origin, allowedOrigins);
}
