import { NextRequest, NextResponse } from "next/server";

export function verifyCronSecret(secret: string): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return secret === expected;
}

export function authenticateCron(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.replace("Bearer ", "") || "";

  if (!verifyCronSecret(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // authenticated
}
