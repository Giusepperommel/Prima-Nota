// src/app/api/v1/report/route.ts
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
  if (!hasScope(payload.scopes, "read:report")) {
    return NextResponse.json(
      { error: "Scope insufficiente: read:report richiesto" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") || "10")));

  const [data, total] = await Promise.all([
    prisma.reportGeneratoBI.findMany({
      where: { societaId: payload.societaId },
      orderBy: { generatoAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { template: { select: { nome: true, tipo: true } } },
    }),
    prisma.reportGeneratoBI.count({ where: { societaId: payload.societaId } }),
  ]);

  const response = NextResponse.json({
    data,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });
  const origin = request.headers.get("origin");
  addCorsHeaders(response, origin, []);
  return response;
}
