// src/app/api/bi/kpi/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateAndCacheKpis } from "@/lib/bi/kpi/engine";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));
    const periodo = parseInt(searchParams.get("periodo") || String(new Date().getMonth() + 1));
    const periodoTipo = searchParams.get("periodoTipo") || "MESE";

    const kpis = await calculateAndCacheKpis(user.societaId, anno, periodo, periodoTipo);
    return NextResponse.json({ kpis, anno, periodo, periodoTipo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
