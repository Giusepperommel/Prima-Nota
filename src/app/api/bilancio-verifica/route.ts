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
  const anno = parseInt(searchParams.get("anno") || String(new Date().getFullYear()));
  const nascondiSaldoZero = searchParams.get("nascondiSaldoZero") === "true";

  // Aggregate movimenti per conto
  const aggregati = await prisma.movimentoContabile.groupBy({
    by: ["contoId"],
    where: {
      societaId,
      scrittura: { anno, eliminato: false },
    },
    _sum: { importoDare: true, importoAvere: true },
  });

  // Load conto details
  const contiIds = aggregati.map(a => a.contoId);
  const conti = await prisma.pianoDeiConti.findMany({
    where: { id: { in: contiIds } },
    select: { id: true, codice: true, descrizione: true, tipo: true, naturaSaldo: true, voceSp: true, voceCe: true },
  });
  const contiMap = new Map(conti.map(c => [c.id, c]));

  let grandTotaleDare = 0;
  let grandTotaleAvere = 0;

  const righe = aggregati.map(a => {
    const dare = Number(a._sum.importoDare || 0);
    const avere = Number(a._sum.importoAvere || 0);
    const saldo = dare - avere;
    grandTotaleDare += dare;
    grandTotaleAvere += avere;
    const conto = contiMap.get(a.contoId);
    return {
      contoId: a.contoId,
      codice: conto?.codice || "",
      descrizione: conto?.descrizione || "",
      tipo: conto?.tipo || "",
      totaleDare: Math.round(dare * 100) / 100,
      totaleAvere: Math.round(avere * 100) / 100,
      saldo: Math.round(saldo * 100) / 100,
      segno: saldo >= 0 ? "D" : "A",
    };
  }).sort((a, b) => a.codice.localeCompare(b.codice));

  const quadra = Math.abs(grandTotaleDare - grandTotaleAvere) < 0.02;

  return NextResponse.json({
    righe: nascondiSaldoZero ? righe.filter(r => Math.abs(r.saldo) > 0.01) : righe,
    totali: {
      dare: Math.round(grandTotaleDare * 100) / 100,
      avere: Math.round(grandTotaleAvere * 100) / 100,
    },
    quadra,
    anno,
  });
}
