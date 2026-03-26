// src/app/api/bi/comparativa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { comparePeriods } from "@/lib/bi/comparativa/periodo";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));
    const periodo = parseInt(searchParams.get("periodo") || String(new Date().getMonth() + 1));
    const periodoTipo = searchParams.get("periodoTipo") || "MESE";

    const result = await comparePeriods(user.societaId, anno, periodo, periodoTipo);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
