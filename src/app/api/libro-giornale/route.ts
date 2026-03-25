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
    const societaId = user.societaId as number;

    if (!societaId) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));
    const mese = searchParams.get("mese") ? parseInt(searchParams.get("mese")!) : null;
    const causale = searchParams.get("causale");
    const stato = searchParams.get("stato");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    const where: any = {
      societaId,
      anno,
      eliminato: false,
    };

    if (mese) {
      const startDate = new Date(anno, mese - 1, 1);
      const endDate = new Date(anno, mese, 0);
      where.dataRegistrazione = { gte: startDate, lte: endDate };
    }
    if (causale) where.causale = causale;
    if (stato) where.stato = stato;

    const [scritture, total] = await Promise.all([
      prisma.scritturaContabile.findMany({
        where,
        include: {
          movimenti: {
            include: { conto: { select: { codice: true, descrizione: true } } },
            orderBy: { ordine: "asc" },
          },
          operazione: { select: { id: true, tipoOperazione: true, numeroDocumento: true } },
        },
        orderBy: [{ dataRegistrazione: "asc" }, { numeroProtocollo: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.scritturaContabile.count({ where }),
    ]);

    // Calculate page totals
    const totaleDarePagina = scritture.reduce((s, sc) => s + Number(sc.totaleDare), 0);
    const totaleAverePagina = scritture.reduce((s, sc) => s + Number(sc.totaleAvere), 0);

    return NextResponse.json({
      scritture: scritture.map(s => ({
        ...s,
        totaleDare: Number(s.totaleDare),
        totaleAvere: Number(s.totaleAvere),
        movimenti: s.movimenti.map(m => ({
          ...m,
          importoDare: Number(m.importoDare),
          importoAvere: Number(m.importoAvere),
        })),
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      totaliPagina: { dare: Math.round(totaleDarePagina * 100) / 100, avere: Math.round(totaleAverePagina * 100) / 100 },
      contatoreRegistrazioni: total,
    });
  } catch (error) {
    console.error("[libro-giornale]", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
