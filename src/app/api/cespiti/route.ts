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
    const ruolo = user.ruolo as string;
    const socioId = user.socioId as number;

    const { searchParams } = new URL(request.url);
    const stato = searchParams.get("stato");

    const where: any = {
      societaId,
      operazione: { eliminato: false, bozza: false },
    };

    if (stato) {
      where.stato = stato;
    }

    // STANDARD users: only see cespiti where they have a ripartizione
    if (ruolo === "STANDARD") {
      where.operazione.ripartizioni = {
        some: { socioId, percentuale: { gt: 0 } },
      };
    }

    const cespiti = await prisma.cespite.findMany({
      where,
      include: {
        operazione: {
          include: {
            categoria: { select: { id: true, nome: true } },
            ripartizioni: {
              include: {
                socio: {
                  select: { id: true, nome: true, cognome: true },
                },
              },
            },
          },
        },
        quoteAmmortamento: {
          orderBy: { anno: "asc" },
        },
        veicolo: {
          include: {
            cessione: true,
          },
        },
      },
      orderBy: { dataAcquisto: "desc" },
    });

    const serialized = cespiti.map((c) => ({
      id: c.id,
      descrizione: c.descrizione,
      valoreIniziale: Number(c.valoreIniziale),
      aliquotaAmmortamento: Number(c.aliquotaAmmortamento),
      dataAcquisto: c.dataAcquisto.toISOString(),
      annoInizio: c.annoInizio,
      stato: c.stato,
      fondoAmmortamento: Number(c.fondoAmmortamento),
      valoreResiduo:
        Math.round(
          (Number(c.valoreIniziale) - Number(c.fondoAmmortamento)) * 100,
        ) / 100,
      operazioneId: c.operazioneId,
      categoria: c.operazione.categoria,
      tipoRipartizione: c.operazione.tipoRipartizione,
      ripartizioni: c.operazione.ripartizioni
        .filter((r) => Number(r.percentuale) > 0)
        .map((r) => ({
          socioId: r.socioId,
          percentuale: Number(r.percentuale),
          nome: r.socio.nome,
          cognome: r.socio.cognome,
        })),
      quoteAmmortamento: c.quoteAmmortamento.map((q) => ({
        anno: q.anno,
        aliquotaApplicata: Number(q.aliquotaApplicata),
        importoQuota: Number(q.importoQuota),
        fondoProgressivo: Number(q.fondoProgressivo),
      })),
      veicolo: c.veicolo ? {
        ...c.veicolo,
        limiteFiscale: Number(c.veicolo.limiteFiscale),
        percentualeDeducibilita: Number(c.veicolo.percentualeDeducibilita),
        percentualeDetraibilitaIva: Number(c.veicolo.percentualeDetraibilitaIva),
        cessione: c.veicolo.cessione ? {
          ...c.veicolo.cessione,
          prezzoVendita: Number(c.veicolo.cessione.prezzoVendita),
          valoreResiduoContabile: Number(c.veicolo.cessione.valoreResiduoContabile),
          plusvalenza: Number(c.veicolo.cessione.plusvalenza),
          plusvalenzaImponibile: Number(c.veicolo.cessione.plusvalenzaImponibile),
          minusvalenza: Number(c.veicolo.cessione.minusvalenza),
          minusvalenzaDeducibile: Number(c.veicolo.cessione.minusvalenzaDeducibile),
          dataCessione: c.veicolo.cessione.dataCessione.toISOString(),
          createdAt: c.veicolo.cessione.createdAt.toISOString(),
        } : null,
        createdAt: c.veicolo.createdAt.toISOString(),
        updatedAt: c.veicolo.updatedAt.toISOString(),
      } : null,
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Errore nel recupero dei cespiti:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}
