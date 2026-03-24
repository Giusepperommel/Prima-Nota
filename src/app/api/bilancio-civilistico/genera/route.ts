import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generaBilancio } from "@/lib/bilancio/engine";
import type { SaldoConto } from "@/lib/bilancio/types";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const user = session.user as any;
  const societaId = user.societaId as number;

  if (!societaId) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  let body: { anno?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
  }

  const anno = body.anno || new Date().getFullYear();

  // Aggregate movimenti per conto (same logic as bilancio-verifica)
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
    select: {
      id: true,
      codice: true,
      descrizione: true,
      tipo: true,
      naturaSaldo: true,
      voceSp: true,
      voceCe: true,
    },
  });
  const contiMap = new Map(conti.map(c => [c.id, c]));

  // Build saldi array
  const saldi: SaldoConto[] = aggregati.map(a => {
    const dare = Number(a._sum.importoDare || 0);
    const avere = Number(a._sum.importoAvere || 0);
    const conto = contiMap.get(a.contoId);
    return {
      contoId: a.contoId,
      codice: conto?.codice || "",
      descrizione: conto?.descrizione || "",
      tipo: conto?.tipo || "",
      naturaSaldo: conto?.naturaSaldo || "DARE",
      voceSp: conto?.voceSp || null,
      voceCe: conto?.voceCe || null,
      totaleDare: Math.round(dare * 100) / 100,
      totaleAvere: Math.round(avere * 100) / 100,
      saldo: Math.round((dare - avere) * 100) / 100,
    };
  });

  // Generate bilancio
  const bilancio = generaBilancio(anno, saldi);

  // Upsert into database
  await prisma.bilancioGenerato.upsert({
    where: {
      societaId_anno: { societaId, anno },
    },
    create: {
      societaId,
      anno,
      tipo: bilancio.tipo,
      datiSp: bilancio.statoPatrimoniale as any,
      datiCe: bilancio.contoEconomico as any,
      totaleAttivo: bilancio.totaleAttivo,
      totalePassivo: bilancio.totalePassivo,
      utileEsercizio: bilancio.utileEsercizio,
    },
    update: {
      tipo: bilancio.tipo,
      datiSp: bilancio.statoPatrimoniale as any,
      datiCe: bilancio.contoEconomico as any,
      totaleAttivo: bilancio.totaleAttivo,
      totalePassivo: bilancio.totalePassivo,
      utileEsercizio: bilancio.utileEsercizio,
      dataGenerazione: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    anno,
    bilancio,
  });
}
