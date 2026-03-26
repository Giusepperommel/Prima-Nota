// src/app/api/v1/kpi/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, hasScope } from "@/lib/api/auth-middleware";
import { addCorsHeaders, handleCorsPreflightIfNeeded } from "@/lib/api/cors";
import { calculateAllKpis } from "@/lib/bi/kpi/engine";

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const preflight = handleCorsPreflightIfNeeded("OPTIONS", origin, []);
  return preflight || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;
  if (!hasScope(payload.scopes, "read:kpi")) {
    return NextResponse.json(
      { error: "Scope insufficiente: read:kpi richiesto" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));
  const periodo = parseInt(searchParams.get("periodo") || String(new Date().getMonth() + 1));
  const periodoTipo = searchParams.get("periodoTipo") || "MESE";

  const kpis = await calculateAllKpis(payload.societaId, anno, periodo, periodoTipo);

  const response = NextResponse.json({ data: kpis, anno, periodo, periodoTipo });
  const origin = request.headers.get("origin");
  addCorsHeaders(response, origin, []);
  return response;
}
