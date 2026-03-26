import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    const user = session.user as any;

    // Multi-client threads with unread messages (for commercialista)
    const threads = await prisma.threadPortale.findMany({
      where: {
        societaId: user.societaId,
        stato: "APERTO",
      },
      orderBy: { ultimoMessaggioAt: "desc" },
      take: 50,
      include: {
        accessoCliente: { select: { id: true, nome: true, email: true } },
        messaggi: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { testo: true, mittenteTipo: true, letto: true, createdAt: true },
        },
        _count: {
          select: {
            messaggi: { where: { mittenteTipo: "CLIENTE", letto: false } },
          },
        },
      },
    });

    // Pending portal operations
    const operazioniPending = await prisma.operazionePortale.findMany({
      where: { societaId: user.societaId, stato: "BOZZA" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        accessoCliente: { select: { id: true, nome: true } },
      },
    });

    // Count unread messages total
    const totalNonLetti = await prisma.messaggioPortale.count({
      where: {
        societaId: user.societaId,
        mittenteTipo: "CLIENTE",
        letto: false,
      },
    });

    return NextResponse.json({
      threads,
      operazioniPending,
      totalNonLetti,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
