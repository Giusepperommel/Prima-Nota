import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAmmortamentoTotaleSocieta,
  getAmmortamentoSocio,
} from "@/lib/ammortamento-utils";

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

    const searchParams = request.nextUrl.searchParams;
    const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));

    const inizioAnno = new Date(anno, 0, 1);
    const fineAnno = new Date(anno, 11, 31);

    const baseWhere = {
      societaId,
      eliminato: false,
      dataOperazione: {
        gte: inizioAnno,
        lte: fineAnno,
      },
    };

    // Initialize 12-month result
    const mesiData: { mese: number; fatturato: number; costi: number; ammortamento: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      mesiData.push({ mese: m, fatturato: 0, costi: 0, ammortamento: 0 });
    }

    if (ruolo === "STANDARD") {
      // For STANDARD users: get operations with their ripartizioni
      const operazioni = await prisma.operazione.findMany({
        where: {
          ...baseWhere,
          ripartizioni: {
            some: { socioId },
          },
        },
        select: {
          tipoOperazione: true,
          dataOperazione: true,
          ripartizioni: {
            where: { socioId },
            select: { importoCalcolato: true },
          },
        },
      });

      for (const op of operazioni) {
        const mese = op.dataOperazione.getMonth(); // 0-based
        const importo = Number(op.ripartizioni[0]?.importoCalcolato ?? 0);

        if (op.tipoOperazione === "FATTURA_ATTIVA") {
          mesiData[mese].fatturato += importo;
        } else if (op.tipoOperazione === "COSTO" || op.tipoOperazione === "SPESA") {
          mesiData[mese].costi += importo;
        }
      }
    } else {
      // ADMIN: aggregate full amounts
      const operazioni = await prisma.operazione.findMany({
        where: baseWhere,
        select: {
          tipoOperazione: true,
          dataOperazione: true,
          importoTotale: true,
        },
      });

      for (const op of operazioni) {
        const mese = op.dataOperazione.getMonth(); // 0-based
        const importo = Number(op.importoTotale);

        if (op.tipoOperazione === "FATTURA_ATTIVA") {
          mesiData[mese].fatturato += importo;
        } else if (op.tipoOperazione === "COSTO" || op.tipoOperazione === "SPESA") {
          mesiData[mese].costi += importo;
        }
      }
    }

    // Add depreciation distributed across 12 months
    const ammortamentoAnnuo = ruolo === "STANDARD"
      ? await getAmmortamentoSocio(societaId, socioId, anno)
      : await getAmmortamentoTotaleSocieta(societaId, anno);
    const ammortamentoMensile = Math.round((ammortamentoAnnuo / 12) * 100) / 100;

    // Round values to 2 decimal places
    for (const m of mesiData) {
      m.fatturato = Math.round(m.fatturato * 100) / 100;
      m.costi = Math.round(m.costi * 100) / 100;
      m.ammortamento = ammortamentoMensile;
      m.costi = Math.round((m.costi + ammortamentoMensile) * 100) / 100;
    }

    return NextResponse.json(mesiData);
  } catch (error) {
    console.error("Errore nel recupero trend:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
