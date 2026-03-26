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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getPortaleAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id } = await params;
    const richiestaId = Number(id);
    if (isNaN(richiestaId)) {
      return NextResponse.json({ error: "ID non valido" }, { status: 400 });
    }

    // Verify the request belongs to this client
    const richiesta = await prisma.richiestaDocumento.findFirst({
      where: {
        id: richiestaId,
        accessoClienteId: auth.accessoClienteId,
      },
    });

    if (!richiesta) {
      return NextResponse.json({ error: "Richiesta non trovata" }, { status: 404 });
    }

    const body = await request.json();
    const { risposta, domandaId, rispostaSelezionata } = body;

    // If answering a specific question
    if (domandaId && rispostaSelezionata) {
      const domanda = await prisma.domandaCliente.findFirst({
        where: {
          id: Number(domandaId),
          richiestaDocumentoId: richiestaId,
        },
      });

      if (!domanda) {
        return NextResponse.json({ error: "Domanda non trovata" }, { status: 404 });
      }

      await prisma.domandaCliente.update({
        where: { id: Number(domandaId) },
        data: { rispostaSelezionata },
      });
    }

    // If providing a general response, update the request
    if (risposta) {
      await prisma.richiestaDocumento.update({
        where: { id: richiestaId },
        data: {
          stato: "RISPOSTA",
          risposta,
          rispostaAt: new Date(),
        },
      });
    }

    // If all questions answered, mark as RISPOSTA
    if (domandaId && !risposta) {
      const unanswered = await prisma.domandaCliente.count({
        where: {
          richiestaDocumentoId: richiestaId,
          rispostaSelezionata: null,
        },
      });

      if (unanswered === 0) {
        await prisma.richiestaDocumento.update({
          where: { id: richiestaId },
          data: {
            stato: "RISPOSTA",
            rispostaAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore risposta portale:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
