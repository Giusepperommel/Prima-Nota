import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    if (!societaId) {
      return NextResponse.json(
        { error: "Nessuna societa selezionata" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const anno = searchParams.get("anno");
    const stato = searchParams.get("stato");
    const tipoDocumento = searchParams.get("tipoDocumento");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.max(
      1,
      Math.min(100, parseInt(searchParams.get("perPage") || "20", 10))
    );

    const where: Prisma.FatturaElettronicaWhereInput = {
      societaId,
    };

    if (anno) {
      where.annoRiferimento = parseInt(anno, 10);
    }

    if (stato) {
      where.stato = stato as any;
    }

    if (tipoDocumento) {
      where.tipoDocumento = tipoDocumento as any;
    }

    const [fatture, total] = await Promise.all([
      prisma.fatturaElettronica.findMany({
        where,
        include: {
          operazione: {
            select: {
              id: true,
              numeroDocumento: true,
              descrizione: true,
              cliente: {
                select: {
                  id: true,
                  denominazione: true,
                },
              },
            },
          },
          sezionale: {
            select: {
              codice: true,
              descrizione: true,
            },
          },
        },
        orderBy: { dataGenerazione: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.fatturaElettronica.count({ where }),
    ]);

    const serialized = fatture.map((f) => ({
      id: f.id,
      numero: f.numero,
      annoRiferimento: f.annoRiferimento,
      nomeFile: f.nomeFile,
      stato: f.stato,
      tipoDocumento: f.tipoDocumento,
      importoTotale: Number(f.importoTotale),
      dataDocumento: f.dataDocumento.toISOString(),
      dataGenerazione: f.dataGenerazione.toISOString(),
      dataInvio: f.dataInvio?.toISOString() || null,
      operazione: f.operazione
        ? {
            id: f.operazione.id,
            numeroDocumento: f.operazione.numeroDocumento,
            descrizione: f.operazione.descrizione,
            cliente: f.operazione.cliente
              ? {
                  id: f.operazione.cliente.id,
                  denominazione: f.operazione.cliente.denominazione,
                }
              : null,
          }
        : null,
      sezionale: f.sezionale
        ? {
            codice: f.sezionale.codice,
            descrizione: f.sezionale.descrizione,
          }
        : null,
    }));

    return NextResponse.json({
      fatture: serialized,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error: any) {
    console.error("Errore lista fatture elettroniche:", error);
    return NextResponse.json(
      { error: "Errore nel caricamento delle fatture" },
      { status: 500 }
    );
  }
}
