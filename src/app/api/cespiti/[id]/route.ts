import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const ruolo = user.ruolo as string;
    const socioId = user.socioId as number;
    const { id } = await context.params;
    const cespiteId = parseInt(id, 10);

    if (isNaN(cespiteId)) {
      return NextResponse.json(
        { error: "ID cespite non valido" },
        { status: 400 },
      );
    }

    const cespite = await prisma.cespite.findFirst({
      where: {
        id: cespiteId,
        societaId,
        operazione: { eliminato: false, bozza: false },
      },
      include: {
        operazione: {
          include: {
            categoria: { select: { id: true, nome: true } },
            ripartizioni: {
              include: {
                socio: {
                  select: {
                    id: true,
                    nome: true,
                    cognome: true,
                    quotaPercentuale: true,
                  },
                },
              },
              orderBy: { socio: { cognome: "asc" } },
            },
          },
        },
        quoteAmmortamento: {
          orderBy: { anno: "asc" },
        },
      },
    });

    if (!cespite) {
      return NextResponse.json(
        { error: "Cespite non trovato" },
        { status: 404 },
      );
    }

    // STANDARD users: check access via ripartizione
    if (ruolo === "STANDARD") {
      const hasRipartizione = cespite.operazione.ripartizioni.some(
        (r) => r.socioId === socioId && Number(r.percentuale) > 0,
      );
      if (!hasRipartizione) {
        return NextResponse.json(
          { error: "Accesso negato" },
          { status: 403 },
        );
      }
    }

    const serialized = {
      id: cespite.id,
      descrizione: cespite.descrizione,
      valoreIniziale: Number(cespite.valoreIniziale),
      aliquotaAmmortamento: Number(cespite.aliquotaAmmortamento),
      dataAcquisto: cespite.dataAcquisto.toISOString(),
      annoInizio: cespite.annoInizio,
      stato: cespite.stato,
      fondoAmmortamento: Number(cespite.fondoAmmortamento),
      valoreResiduo:
        Math.round(
          (Number(cespite.valoreIniziale) -
            Number(cespite.fondoAmmortamento)) *
            100,
        ) / 100,
      operazioneId: cespite.operazioneId,
      categoria: cespite.operazione.categoria,
      tipoRipartizione: cespite.operazione.tipoRipartizione,
      ripartizioni: cespite.operazione.ripartizioni.map((r) => ({
        socioId: r.socioId,
        percentuale: Number(r.percentuale),
        importoCalcolato: Number(r.importoCalcolato),
        nome: r.socio.nome,
        cognome: r.socio.cognome,
        quotaPercentuale: Number(r.socio.quotaPercentuale),
      })),
      quoteAmmortamento: cespite.quoteAmmortamento.map((q) => ({
        anno: q.anno,
        aliquotaApplicata: Number(q.aliquotaApplicata),
        importoQuota: Number(q.importoQuota),
        fondoProgressivo: Number(q.fondoProgressivo),
        valoreResiduo:
          Math.round(
            (Number(cespite.valoreIniziale) - Number(q.fondoProgressivo)) *
              100,
          ) / 100,
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero del cespite:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
