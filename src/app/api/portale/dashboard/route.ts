import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import type { PortaleTokenPayload } from "@/lib/portale/types";

async function getPortaleAuth(req: NextRequest): Promise<PortaleTokenPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return await verifyPortaleToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const config = await prisma.configurazionePortale.findUnique({
      where: { societaId: auth.societaId },
    });

    // Count pending requests
    const pendingRequests = await prisma.richiestaDocumento.count({
      where: {
        accessoClienteId: auth.accessoClienteId,
        stato: { in: ["INVIATA", "VISTA"] },
      },
    });

    // Situazione IVA (if enabled)
    let situazioneIva = null;
    if (config?.clienteVedeSituazioneIva) {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const operazioni = await prisma.operazione.findMany({
        where: {
          societaId: auth.societaId,
          dataOperazione: { gte: startOfYear },
          aliquotaIva: { not: null },
          eliminato: false,
        },
        select: {
          importoIva: true,
          tipoOperazione: true,
        },
      });

      let ivaDebito = 0;
      let ivaCredito = 0;
      for (const op of operazioni) {
        const iva = Number(op.importoIva ?? 0);
        if (op.tipoOperazione === "FATTURA_ATTIVA") {
          ivaDebito += iva;
        } else {
          ivaCredito += iva;
        }
      }
      situazioneIva = {
        ivaDebito: Math.round(ivaDebito * 100) / 100,
        ivaCredito: Math.round(ivaCredito * 100) / 100,
        saldo: Math.round((ivaDebito - ivaCredito) * 100) / 100,
      };
    }

    // Next scadenza (if enabled)
    let nextScadenza = null;
    if (config?.clienteVedeScadenze) {
      const scadenza = await prisma.scadenzaAzienda.findFirst({
        where: {
          societaId: auth.societaId,
          completata: false,
          dataScadenza: { gte: new Date() },
        },
        orderBy: { dataScadenza: "asc" },
        select: {
          id: true,
          descrizione: true,
          dataScadenza: true,
          tipoScadenza: true,
        },
      });
      if (scadenza) {
        nextScadenza = {
          id: scadenza.id,
          titolo: scadenza.descrizione,
          dataScadenza: scadenza.dataScadenza,
          tipo: scadenza.tipoScadenza,
        };
      }
    }

    // Recent documents
    const recentDocuments = await prisma.documentoCondiviso.findMany({
      where: { accessoClienteId: auth.accessoClienteId },
      orderBy: { condivisoAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      pendingRequests,
      situazioneIva,
      nextScadenza,
      recentDocuments,
    });
  } catch (error) {
    console.error("Errore dashboard portale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
