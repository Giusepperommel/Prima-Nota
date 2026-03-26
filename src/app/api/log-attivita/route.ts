import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AzioneLog } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const da = searchParams.get("da");
    const a = searchParams.get("a");
    const userId = searchParams.get("userId");
    const azione = searchParams.get("azione");
    const tabella = searchParams.get("tabella");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.max(1, Math.min(100, parseInt(searchParams.get("perPage") || "20", 10)));

    // Build where clause
    const where: any = {};

    if (da) {
      const dataDa = new Date(da);
      if (!isNaN(dataDa.getTime())) {
        where.timestamp = { ...where.timestamp, gte: dataDa };
      }
    }

    if (a) {
      const dataA = new Date(a);
      if (!isNaN(dataA.getTime())) {
        // Set end of day
        dataA.setHours(23, 59, 59, 999);
        where.timestamp = { ...where.timestamp, lte: dataA };
      }
    }

    if (userId) {
      const parsedUserId = parseInt(userId, 10);
      if (!isNaN(parsedUserId)) {
        where.userId = parsedUserId;
      }
    }

    if (azione && Object.values(AzioneLog).includes(azione as AzioneLog)) {
      where.azione = azione as AzioneLog;
    }

    if (tabella) {
      where.tabella = tabella;
    }

    const skip = (page - 1) * perPage;

    const [data, total] = await Promise.all([
      prisma.logAttivita.findMany({
        where,
        include: {
          utente: {
            include: {
              socio: {
                select: {
                  nome: true,
                  cognome: true,
                },
              },
            },
          },
        },
        orderBy: { timestamp: "desc" },
        skip,
        take: perPage,
      }),
      prisma.logAttivita.count({ where }),
    ]);

    // Serialize dates for the client
    const serialized = data.map((log) => ({
      ...log,
      timestamp: log.timestamp.toISOString(),
    }));

    return NextResponse.json({
      data: serialized,
      total,
      page,
      perPage,
    });
  } catch (error) {
    console.error("Errore nel recupero del log attivita:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
