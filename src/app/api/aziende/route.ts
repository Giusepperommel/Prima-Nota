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
        note: { select: { id: true } },
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

        const [fatturatoResult, costiResult, alertNonLetti, prossimaScadenza] =
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
            // Prossima scadenza
            prisma.scadenzaAzienda.findFirst({
              where: { societaId, completata: false },
              orderBy: { dataScadenza: "asc" },
              select: {
                id: true,
                descrizione: true,
                dataScadenza: true,
                tipoScadenza: true,
                priorita: true,
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
          prossimaScadenza: prossimaScadenza
            ? {
                ...prossimaScadenza,
                dataScadenza: prossimaScadenza.dataScadenza
                  .toISOString()
                  .split("T")[0],
              }
            : null,
          noteCount: ua.note.length,
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
