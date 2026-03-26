import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey, hasScope } from "@/lib/api/auth-middleware";
import { addCorsHeaders, handleCorsPreflightIfNeeded } from "@/lib/api/cors";

/**
 * OPTIONS /api/v1/todo
 * CORS preflight handler.
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return handleCorsPreflightIfNeeded("OPTIONS", origin, []) || new NextResponse(null, { status: 204 });
}

/**
 * GET /api/v1/todo
 * Lista todo per la societa. Auth via API key. Scope: read:todo.
 * Query params: data, page, perPage
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (!authResult.success) return authResult.response;

  const { payload } = authResult;
  if (!hasScope(payload.scopes, "read:todo")) {
    return NextResponse.json(
      { error: "Scope insufficiente: read:todo richiesto" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "20")));
  const data = searchParams.get("data");

  const where: any = { societaId: payload.societaId };
  if (data) where.data = new Date(data);

  const [todos, total] = await Promise.all([
    prisma.todoGenerato.findMany({
      where,
      orderBy: [{ priorita: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.todoGenerato.count({ where }),
  ]);

  const response = NextResponse.json({
    data: todos,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
  });

  addCorsHeaders(response, request.headers.get("origin"), []);
  return response;
}
