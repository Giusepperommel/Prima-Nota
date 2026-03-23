import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
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
  const contoId = parseInt(searchParams.get("contoId") || "0");
  const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));
  const dal = searchParams.get("dal");
  const al = searchParams.get("al");

  if (!contoId) {
    return NextResponse.json({ error: "contoId required" }, { status: 400 });
  }

  const movimenti = await prisma.movimentoContabile.findMany({
    where: {
      societaId,
      contoId,
      scrittura: {
        anno,
        eliminato: false,
        ...(dal || al
          ? {
              dataRegistrazione: {
                ...(dal ? { gte: new Date(dal) } : {}),
                ...(al ? { lte: new Date(al) } : {}),
              },
            }
          : {}),
      },
    },
    include: {
      scrittura: {
        select: {
          id: true,
          dataRegistrazione: true,
          numeroProtocollo: true,
          descrizione: true,
          causale: true,
        },
      },
    },
    orderBy: { scrittura: { dataRegistrazione: "asc" } },
  });

  // Calculate progressive saldo
  let saldoProgressivo = 0;
  const movimentiConSaldo = movimenti.map(m => {
    saldoProgressivo += Number(m.importoDare) - Number(m.importoAvere);
    return {
      ...m,
      importoDare: Number(m.importoDare),
      importoAvere: Number(m.importoAvere),
      saldoProgressivo: Math.round(saldoProgressivo * 100) / 100,
    };
  });

  const conto = await prisma.pianoDeiConti.findUnique({
    where: { id: contoId },
    select: { codice: true, descrizione: true, tipo: true, naturaSaldo: true },
  });

  return NextResponse.json({
    conto,
    movimenti: movimentiConSaldo,
    saldoFinale: Math.round(saldoProgressivo * 100) / 100,
    totaleDare: Math.round(movimenti.reduce((s, m) => s + Number(m.importoDare), 0) * 100) / 100,
    totaleAvere: Math.round(movimenti.reduce((s, m) => s + Number(m.importoAvere), 0) * 100) / 100,
  });
}
