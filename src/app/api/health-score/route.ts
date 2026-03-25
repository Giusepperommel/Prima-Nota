import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateHealthScore } from "@/lib/controlli/health-score";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const anno = parseInt(searchParams.get("anno") || String(now.getFullYear()), 10);
    const mese = parseInt(searchParams.get("mese") || String(now.getMonth() + 1), 10);

    const score = await calculateHealthScore(societaId, anno, mese);

    return NextResponse.json(score);
  } catch (error) {
    console.error("Errore calcolo health score:", error);
    return NextResponse.json(
      { error: "Errore durante il calcolo dello health score" },
      { status: 500 }
    );
  }
}
