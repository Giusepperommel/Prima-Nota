import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = session.user as any;

    const { searchParams } = new URL(request.url);
    const anno = searchParams.get("anno");
    const stato = searchParams.get("stato");

    const f24 = await prisma.f24Versamento.findMany({
      where: {
        societaId: user.societaId,
        ...(anno ? { anno: parseInt(anno, 10) } : {}),
        ...(stato ? { stato: stato as any } : {}),
      },
      include: {
        righe: true,
      },
      orderBy: [{ anno: "desc" }, { mese: "desc" }],
    });

    const serialized = f24.map((v) => ({
      ...v,
      totaleDebito: Number(v.totaleDebito),
      totaleCredito: Number(v.totaleCredito),
      totaleVersamento: Number(v.totaleVersamento),
      righe: v.righe.map((r) => ({
        ...r,
        importoDebito: Number(r.importoDebito),
        importoCredito: Number(r.importoCredito),
      })),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero F24:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
