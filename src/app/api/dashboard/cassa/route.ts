// src/app/api/dashboard/cassa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MESI_LABEL = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const TIPI_USCITA = ["COSTO", "CESPITE", "PAGAMENTO_IMPOSTE", "DISTRIBUZIONE_DIVIDENDI", "COMPENSO_AMMINISTRATORE"];

type MensileItem = {
  mese: number;
  meseLabel: string;
  entrate: number;
  uscite: number;
  usciteDettaglio: {
    costiOperativi: number;
    cespiti: number;
    imposte: number;
    dividendi: number;
    compensiAmm: number;
  };
  saldoProgressivo: number;
};

function buildMensile(): MensileItem[] {
  return Array.from({ length: 12 }, (_, i) => ({
    mese: i + 1,
    meseLabel: MESI_LABEL[i],
    entrate: 0,
    uscite: 0,
    usciteDettaglio: { costiOperativi: 0, cespiti: 0, imposte: 0, dividendi: 0, compensiAmm: 0 },
    saldoProgressivo: 0,
  }));
}

function accumulaMovimento(mensile: MensileItem[], tipoOperazione: string, importo: number, mese: number) {
  const idx = mese - 1;
  if (idx < 0 || idx > 11) return;
  if (tipoOperazione === "FATTURA_ATTIVA") {
    mensile[idx].entrate += importo;
  } else if (TIPI_USCITA.includes(tipoOperazione)) {
    mensile[idx].uscite += importo;
    const d = mensile[idx].usciteDettaglio;
    if (tipoOperazione === "COSTO") d.costiOperativi += importo;
    else if (tipoOperazione === "CESPITE") d.cespiti += importo;
    else if (tipoOperazione === "PAGAMENTO_IMPOSTE") d.imposte += importo;
    else if (tipoOperazione === "DISTRIBUZIONE_DIVIDENDI") d.dividendi += importo;
    else if (tipoOperazione === "COMPENSO_AMMINISTRATORE") d.compensiAmm += importo;
  }
}

function finalizzaMensile(mensile: MensileItem[], saldoIniziale: number) {
  let saldo = saldoIniziale;
  for (const m of mensile) {
    m.entrate = Math.round(m.entrate * 100) / 100;
    m.uscite = Math.round(m.uscite * 100) / 100;
    m.usciteDettaglio.costiOperativi = Math.round(m.usciteDettaglio.costiOperativi * 100) / 100;
    m.usciteDettaglio.cespiti = Math.round(m.usciteDettaglio.cespiti * 100) / 100;
    m.usciteDettaglio.imposte = Math.round(m.usciteDettaglio.imposte * 100) / 100;
    m.usciteDettaglio.dividendi = Math.round(m.usciteDettaglio.dividendi * 100) / 100;
    m.usciteDettaglio.compensiAmm = Math.round(m.usciteDettaglio.compensiAmm * 100) / 100;
    saldo = Math.round((saldo + m.entrate - m.uscite) * 100) / 100;
    m.saldoProgressivo = saldo;
  }
  return saldo; // saldoFinale
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;
    const ruolo = user.ruolo as string;
    const socioId = user.socioId as number | undefined;

    const { searchParams } = new URL(request.url);
    const annoParam = searchParams.get("anno");
    if (!annoParam) {
      return NextResponse.json({ error: "Il parametro 'anno' è obbligatorio" }, { status: 400 });
    }
    const anno = parseInt(annoParam, 10);

    if (isNaN(anno) || anno < 2000 || anno > 2100) {
      return NextResponse.json({ error: "Anno non valido" }, { status: 400 });
    }

    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: { capitaleSociale: true },
    });
    const capitaleSociale = Number(societa?.capitaleSociale ?? 0);

    const dataInizioAnno = new Date(`${anno}-01-01`);
    const dataFineAnno = new Date(`${anno}-12-31`);

    if (ruolo === "ADMIN") {
      // ─── ADMIN path ────────────────────────────────────────────────────
      // Saldo iniziale: capitaleSociale + net cash flow anni precedenti
      const opsPrecedenti = await prisma.operazione.findMany({
        where: {
          societaId,
          eliminato: false,
          bozza: false,
          dataOperazione: { lt: dataInizioAnno },
        },
        select: { tipoOperazione: true, importoTotale: true },
      });

      let cashFlowPrecedenti = 0;
      for (const op of opsPrecedenti) {
        const v = Number(op.importoTotale);
        if (op.tipoOperazione === "FATTURA_ATTIVA") cashFlowPrecedenti += v;
        else if (TIPI_USCITA.includes(op.tipoOperazione)) cashFlowPrecedenti -= v;
      }
      const saldoIniziale = Math.round((capitaleSociale + cashFlowPrecedenti) * 100) / 100;

      // Monthly data for selected year
      const ops = await prisma.operazione.findMany({
        where: {
          societaId,
          eliminato: false,
          bozza: false,
          dataOperazione: { gte: dataInizioAnno, lte: dataFineAnno },
        },
        select: { tipoOperazione: true, importoTotale: true, dataOperazione: true },
      });

      const mensile = buildMensile();
      for (const op of ops) {
        const mese = new Date(op.dataOperazione).getMonth() + 1;
        accumulaMovimento(mensile, op.tipoOperazione, Number(op.importoTotale), mese);
      }
      const saldoFinale = finalizzaMensile(mensile, saldoIniziale);

      const totali = {
        entrate: Math.round(mensile.reduce((s, m) => s + m.entrate, 0) * 100) / 100,
        uscite: Math.round(mensile.reduce((s, m) => s + m.uscite, 0) * 100) / 100,
        saldoFinale,
      };

      return NextResponse.json({ anno, saldoIniziale, mensile, totali });

    } else {
      // ─── STANDARD path ─────────────────────────────────────────────────
      // Saldo iniziale: capitaleSociale × quota% + net ripartizioni anni precedenti
      const socio = await prisma.socio.findFirst({
        where: { id: socioId, societaId },
        select: { quotaPercentuale: true },
      });
      const quotaPercentuale = Number(socio?.quotaPercentuale ?? 0);

      const ripPrecedenti = await prisma.ripartizioneOperazione.findMany({
        where: {
          socioId,
          operazione: {
            societaId,
            eliminato: false,
            bozza: false,
            dataOperazione: { lt: dataInizioAnno },
          },
        },
        select: {
          importoCalcolato: true,
          operazione: { select: { tipoOperazione: true } },
        },
      });

      let cashFlowPrecedenti = 0;
      for (const rip of ripPrecedenti) {
        const v = Number(rip.importoCalcolato);
        if (rip.operazione.tipoOperazione === "FATTURA_ATTIVA") cashFlowPrecedenti += v;
        else if (TIPI_USCITA.includes(rip.operazione.tipoOperazione)) cashFlowPrecedenti -= v;
      }
      const saldoIniziale = Math.round(
        (capitaleSociale * (quotaPercentuale / 100) + cashFlowPrecedenti) * 100
      ) / 100;

      // Monthly ripartizioni for selected year
      const rips = await prisma.ripartizioneOperazione.findMany({
        where: {
          socioId,
          operazione: {
            societaId,
            eliminato: false,
            bozza: false,
            dataOperazione: { gte: dataInizioAnno, lte: dataFineAnno },
          },
        },
        select: {
          importoCalcolato: true,
          operazione: { select: { tipoOperazione: true, dataOperazione: true } },
        },
      });

      const mensile = buildMensile();
      for (const rip of rips) {
        const mese = new Date(rip.operazione.dataOperazione).getMonth() + 1;
        accumulaMovimento(mensile, rip.operazione.tipoOperazione, Number(rip.importoCalcolato), mese);
      }
      const saldoFinale = finalizzaMensile(mensile, saldoIniziale);

      const totali = {
        entrate: Math.round(mensile.reduce((s, m) => s + m.entrate, 0) * 100) / 100,
        uscite: Math.round(mensile.reduce((s, m) => s + m.uscite, 0) * 100) / 100,
        saldoFinale,
      };

      return NextResponse.json({ anno, saldoIniziale, mensile, totali });
    }
  } catch (error) {
    console.error("Errore simulazione cassa:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
