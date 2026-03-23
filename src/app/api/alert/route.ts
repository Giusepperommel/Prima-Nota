import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const { searchParams } = new URL(request.url);
    const letto = searchParams.get("letto");

    const where: any = { societaId };

    if (letto !== null && letto !== "") {
      where.letto = letto === "true";
    }

    const alert = await prisma.alertAzienda.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const serialized = alert.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero degli alert:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
