import { NextRequest, NextResponse } from "next/server";
import { verifyPortaleToken } from "@/lib/portale/auth";
import { prisma } from "@/lib/prisma";
import { hasPortalePermission } from "@/lib/portale/permissions";
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
    if (!auth) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const sezione = searchParams.get("sezione");
    const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));

    const result: Record<string, unknown> = {};

    if (!sezione || sezione === "iva") {
      if (await hasPortalePermission(auth.accessoClienteId, "IVA", "lettura")) {
        result.liquidazioniIva = await prisma.liquidazioneIva.findMany({
          where: { societaId: auth.societaId, anno },
          orderBy: { periodo: "asc" },
        });
      }
    }

    if (!sezione || sezione === "scadenzario") {
      if (await hasPortalePermission(auth.accessoClienteId, "SCADENZARIO", "lettura")) {
        result.scadenze = await prisma.scadenzaFiscale.findMany({
          where: { societaId: auth.societaId, anno },
          orderBy: { scadenza: "asc" },
        });
      }
    }

    if (!sezione || sezione === "fatture") {
      if (await hasPortalePermission(auth.accessoClienteId, "FATTURE", "lettura")) {
        result.fatture = await prisma.fatturaElettronica.findMany({
          where: { societaId: auth.societaId, annoRiferimento: anno },
          orderBy: { dataDocumento: "desc" },
          take: 50,
          select: {
            id: true, numero: true, annoRiferimento: true,
            stato: true, importoTotale: true, dataDocumento: true,
          },
        });
      }
    }

    if (!sezione || sezione === "report") {
      if (await hasPortalePermission(auth.accessoClienteId, "REPORT", "lettura")) {
        result.reports = await prisma.reportGeneratoBI.findMany({
          where: { societaId: auth.societaId, stato: "GENERATO" },
          orderBy: { generatoAt: "desc" },
          take: 10,
          include: { template: { select: { nome: true, tipo: true } } },
        });
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
