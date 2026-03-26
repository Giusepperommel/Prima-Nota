// src/app/api/v1/operazioni/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api/auth-middleware";
import { addCorsHeaders, handleCorsPreflightIfNeeded } from "@/lib/api/cors";

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const preflight = handleCorsPreflightIfNeeded("OPTIONS", origin, []);
  return preflight || new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;
  if (!hasScope(payload.scopes, "read:operazioni")) {
    return NextResponse.json(
      { error: "Scope insufficiente: read:operazioni richiesto" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "20")));
  const da = searchParams.get("da");
  const a = searchParams.get("a");

  const where: Record<string, unknown> = {
    societaId: payload.societaId,
    eliminato: false,
  };
  if (da || a) {
    const dateFilter: Record<string, Date> = {};
    if (da) dateFilter.gte = new Date(da);
    if (a) dateFilter.lte = new Date(a);
    where.dataOperazione = dateFilter;
  }

  const [data, total] = await Promise.all([
    prisma.operazione.findMany({
      where,
      orderBy: { dataOperazione: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.operazione.count({ where }),
  ]);

  const response = NextResponse.json({
    data,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });

  const origin = request.headers.get("origin");
  addCorsHeaders(response, origin, []);
  return response;
}
