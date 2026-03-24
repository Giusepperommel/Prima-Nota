import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { generaF24 } from "@/lib/dichiarazioni/f24";
import type { RitenutaDaVersare, IvaDaVersare, ImpostaDaVersare, BolloDaVersare, CreditoDisponibile } from "@/lib/dichiarazioni/f24";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const user = session.user as any;

    const body = await request.json();
    const { anno, mese, includiIva, imposte, bolli, creditiCompensazione } = body;

    if (!anno || !mese) {
      return NextResponse.json(
        { error: "anno e mese sono obbligatori" },
        { status: 400 },
      );
    }

    // 1. Fetch ritenute da versare for the specified month
    const ritenute = await prisma.ritenuta.findMany({
      where: {
        societaId: user.societaId,
        meseCompetenza: mese,
        annoCompetenza: anno,
        statoVersamento: "DA_VERSARE",
      },
    });

    const ritenuteDaVersare: RitenutaDaVersare[] = ritenute.map((r) => ({
      codiceTributo: r.codiceTributo,
      importoRitenuta: Number(r.importoRitenuta),
      meseCompetenza: r.meseCompetenza,
      annoCompetenza: r.annoCompetenza,
    }));

    // 2. IVA (optional — passed from client or auto-calculated)
    const iva: IvaDaVersare | undefined = includiIva ? {
      importo: includiIva.importo,
      periodo: includiIva.periodo ?? mese,
      anno: includiIva.anno ?? anno,
      tipo: includiIva.tipo ?? "MENSILE",
    } : undefined;

    // 3. Generate F24
    const f24 = generaF24({
      anno,
      mese,
      ritenute: ritenuteDaVersare,
      iva,
      imposte: (imposte ?? []) as ImpostaDaVersare[],
      bolli: (bolli ?? []) as BolloDaVersare[],
      creditiCompensazione: (creditiCompensazione ?? []) as CreditoDisponibile[],
    });

    // 4. Check if F24 already exists for this period
    const existing = await prisma.f24Versamento.findFirst({
      where: {
        societaId: user.societaId,
        anno,
        mese,
        stato: "DA_PAGARE",
      },
    });

    if (existing) {
      // Delete existing and recreate
      await prisma.f24Versamento.delete({ where: { id: existing.id } });
    }

    // 5. Persist
    const created = await prisma.f24Versamento.create({
      data: {
        societaId: user.societaId,
        anno: f24.anno,
        mese: f24.mese,
        dataScadenza: f24.dataScadenza,
        stato: "DA_PAGARE",
        totaleDebito: f24.totaleDebito,
        totaleCredito: f24.totaleCredito,
        totaleVersamento: f24.totaleVersamento,
        righe: {
          create: f24.righe.map((r) => ({
            sezione: r.sezione,
            codiceTributo: r.codiceTributo,
            rateazione: r.rateazione ?? null,
            annoRiferimento: r.annoRiferimento,
            periodoRiferimento: r.periodoRiferimento ?? null,
            importoDebito: r.importoDebito,
            importoCredito: r.importoCredito,
            descrizione: r.descrizione ?? null,
          })),
        },
      },
      include: { righe: true },
    });

    return NextResponse.json({
      success: true,
      f24: {
        ...created,
        totaleDebito: Number(created.totaleDebito),
        totaleCredito: Number(created.totaleCredito),
        totaleVersamento: Number(created.totaleVersamento),
        righe: created.righe.map((r) => ({
          ...r,
          importoDebito: Number(r.importoDebito),
          importoCredito: Number(r.importoCredito),
        })),
      },
    });
  } catch (error) {
    console.error("Errore nella generazione F24:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
