import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const utenteId = user.id as number;

    // Fetch all active company associations for this user
    const utentiAzienda = await prisma.utenteAzienda.findMany({
      where: { utenteId, attivo: true },
      include: {
        societa: {
          select: {
            id: true,
            ragioneSociale: true,
            tipoAttivita: true,
            partitaIva: true,
          },
        },
      },
      orderBy: { ultimoAccesso: { sort: "desc", nulls: "last" } },
    });

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    // Aggregate KPIs for each company in parallel
    const aziende = await Promise.all(
      utentiAzienda.map(async (ua) => {
        const societaId = ua.societaId;

        const [fatturatoResult, costiResult, alertNonLetti, scadenze, noteAzienda] =
          await Promise.all([
            // Fatturato YTD
            prisma.operazione.aggregate({
              where: {
                societaId,
                tipoOperazione: "FATTURA_ATTIVA",
                dataOperazione: { gte: startOfYear, lte: endOfYear },
                eliminato: false,
                bozza: false,
              },
              _sum: { importoTotale: true },
            }),
            // Costi YTD
            prisma.operazione.aggregate({
              where: {
                societaId,
                tipoOperazione: {
                  in: ["COSTO", "CESPITE", "COMPENSO_AMMINISTRATORE"],
                },
                dataOperazione: { gte: startOfYear, lte: endOfYear },
                eliminato: false,
                bozza: false,
              },
              _sum: { importoTotale: true },
            }),
            // Alert non letti
            prisma.alertAzienda.count({
              where: { societaId, letto: false },
            }),
            // All upcoming scadenze (incomplete)
            prisma.scadenzaAzienda.findMany({
              where: { societaId, completata: false },
              orderBy: { dataScadenza: "asc" },
              take: 10,
              select: {
                id: true,
                descrizione: true,
                dataScadenza: true,
                tipoScadenza: true,
                priorita: true,
                completata: true,
              },
            }),
            // All notes for this user-company association
            prisma.notaAzienda.findMany({
              where: { utenteAziendaId: ua.id },
              orderBy: { updatedAt: "desc" },
              select: {
                id: true,
                testo: true,
                colore: true,
                createdAt: true,
                updatedAt: true,
              },
            }),
          ]);

        return {
          utenteAziendaId: ua.id,
          ruolo: ua.ruolo,
          ultimoAccesso: ua.ultimoAccesso?.toISOString() ?? null,
          societa: ua.societa,
          fatturatoYTD: Number(fatturatoResult._sum.importoTotale ?? 0),
          costiYTD: Number(costiResult._sum.importoTotale ?? 0),
          alertNonLetti,
          scadenze: scadenze.map((s) => ({
            ...s,
            dataScadenza: s.dataScadenza.toISOString().split("T")[0],
          })),
          note: noteAzienda.map((n) => ({
            ...n,
            createdAt: n.createdAt.toISOString(),
            updatedAt: n.updatedAt.toISOString(),
          })),
        };
      })
    );

    return NextResponse.json(aziende);
  } catch (error) {
    console.error("Errore nel recupero delle aziende:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
