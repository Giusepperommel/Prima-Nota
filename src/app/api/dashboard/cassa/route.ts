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

      // --- Saldo iniziale: capitaleSociale + net cash flow anni precedenti ---

      // 1a. Immediate ops (no piano pagamento) from previous years
      const opsPrecedentiImmediate = await prisma.operazione.findMany({
        where: {
          societaId,
          eliminato: false,
          bozza: false,
          pianoPagamento: { is: null },
          dataOperazione: { lt: dataInizioAnno },
        },
        select: { tipoOperazione: true, importoTotale: true },
      });

      // 1b. Payments from plans in previous years (only EFFETTUATO)
      const pagamentiPrecedenti = await prisma.pagamento.findMany({
        where: {
          stato: "EFFETTUATO",
          data: { lt: dataInizioAnno },
          pianoPagamento: {
            societaId,
            operazione: { eliminato: false, bozza: false },
          },
        },
        select: {
          importo: true,
          pianoPagamento: {
            select: { operazione: { select: { tipoOperazione: true } } },
          },
        },
      });

      let cashFlowPrecedenti = 0;
      for (const op of opsPrecedentiImmediate) {
        const v = Number(op.importoTotale);
        if (op.tipoOperazione === "FATTURA_ATTIVA") cashFlowPrecedenti += v;
        else if (TIPI_USCITA.includes(op.tipoOperazione)) cashFlowPrecedenti -= v;
      }
      for (const pag of pagamentiPrecedenti) {
        const v = Number(pag.importo);
        const tipo = pag.pianoPagamento.operazione.tipoOperazione;
        if (tipo === "FATTURA_ATTIVA") cashFlowPrecedenti += v;
        else if (TIPI_USCITA.includes(tipo)) cashFlowPrecedenti -= v;
      }

      const saldoIniziale = Math.round((capitaleSociale + cashFlowPrecedenti) * 100) / 100;

      // --- Monthly data for selected year ---

      // 2a. Immediate ops (no piano pagamento) for current year
      // SAFETY: pianoPagamento: { is: null } ensures ops with payment plans are NEVER counted here
      const opsImmediate = await prisma.operazione.findMany({
        where: {
          societaId,
          eliminato: false,
          bozza: false,
          pianoPagamento: { is: null },
          dataOperazione: { gte: dataInizioAnno, lte: dataFineAnno },
        },
        select: { id: true, tipoOperazione: true, importoTotale: true, dataOperazione: true },
      });

      // 2b. Payments from plans for current year (EFFETTUATO + PREVISTO = forecast)
      const pagamentiAnno = await prisma.pagamento.findMany({
        where: {
          stato: { in: ["EFFETTUATO", "PREVISTO"] },
          data: { gte: dataInizioAnno, lte: dataFineAnno },
          pianoPagamento: {
            societaId,
            operazione: { eliminato: false, bozza: false },
          },
        },
        select: {
          data: true,
          importo: true,
          pianoPagamento: {
            select: { operazione: { select: { id: true, tipoOperazione: true } } },
          },
        },
      });

      // Runtime safety: detect any op that appears in both channels
      const immediateIds = new Set(opsImmediate.map(op => op.id));
      const pianoOpIds = new Set(pagamentiAnno.map(p => p.pianoPagamento.operazione.id));
      const overlap = [...immediateIds].filter(id => pianoOpIds.has(id));
      if (overlap.length > 0) {
        console.error("CASSA SAFETY: ops counted in both immediate and piano channels:", overlap);
      }

      const mensile = buildMensile();

      for (const op of opsImmediate) {
        const mese = new Date(op.dataOperazione).getMonth() + 1;
        accumulaMovimento(mensile, op.tipoOperazione, Number(op.importoTotale), mese);
      }
      for (const pag of pagamentiAnno) {
        const mese = new Date(pag.data).getMonth() + 1;
        const tipo = pag.pianoPagamento.operazione.tipoOperazione;
        accumulaMovimento(mensile, tipo, Number(pag.importo), mese);
      }

      const saldoFinale = finalizzaMensile(mensile, saldoIniziale);

      const totali = {
        entrate: Math.round(mensile.reduce((s, m) => s + m.entrate, 0) * 100) / 100,
        uscite: Math.round(mensile.reduce((s, m) => s + m.uscite, 0) * 100) / 100,
        saldoFinale,
      };

      // Saldo attuale: only EFFETTUATO payments (not PREVISTO) up to today
      const oggi = new Date();
      const pagamentiEffettuatiAnno = await prisma.pagamento.findMany({
        where: {
          stato: "EFFETTUATO",
          data: { gte: dataInizioAnno, lte: oggi },
          pianoPagamento: {
            societaId,
            operazione: { eliminato: false, bozza: false },
          },
        },
        select: {
          importo: true,
          pianoPagamento: {
            select: { operazione: { select: { tipoOperazione: true } } },
          },
        },
      });
      // Immediate ops up to today
      const opsImmediateOggi = await prisma.operazione.findMany({
        where: {
          societaId,
          eliminato: false,
          bozza: false,
          pianoPagamento: { is: null },
          dataOperazione: { gte: dataInizioAnno, lte: oggi },
        },
        select: { tipoOperazione: true, importoTotale: true },
      });
      let cashFlowAttuale = 0;
      for (const op of opsImmediateOggi) {
        const v = Number(op.importoTotale);
        if (op.tipoOperazione === "FATTURA_ATTIVA") cashFlowAttuale += v;
        else if (TIPI_USCITA.includes(op.tipoOperazione)) cashFlowAttuale -= v;
      }
      for (const pag of pagamentiEffettuatiAnno) {
        const v = Number(pag.importo);
        const tipo = pag.pianoPagamento.operazione.tipoOperazione;
        if (tipo === "FATTURA_ATTIVA") cashFlowAttuale += v;
        else if (TIPI_USCITA.includes(tipo)) cashFlowAttuale -= v;
      }
      const saldoAttuale = Math.round((saldoIniziale + cashFlowAttuale) * 100) / 100;

      return NextResponse.json({ anno, saldoIniziale, saldoAttuale, mensile, totali });

    } else {
      // ─── STANDARD path ─────────────────────────────────────────────────
      // Saldo iniziale: capitaleSociale x quota% + net ripartizioni anni precedenti

      const socio = await prisma.socio.findFirst({
        where: { id: socioId, societaId },
        select: { quotaPercentuale: true },
      });
      const quotaPercentuale = Number(socio?.quotaPercentuale ?? 0);

      // --- Saldo iniziale from previous years ---

      // 1a. Immediate ops (no piano pagamento) — use ripartizioni
      const ripPrecedentiImmediate = await prisma.ripartizioneOperazione.findMany({
        where: {
          socioId,
          operazione: {
            societaId,
            eliminato: false,
            bozza: false,
            pianoPagamento: { is: null },
            dataOperazione: { lt: dataInizioAnno },
          },
        },
        select: {
          importoCalcolato: true,
          operazione: { select: { tipoOperazione: true } },
        },
      });

      // 1b. Payments from plans in previous years (only EFFETTUATO)
      //     Apply socio's ripartizione percentage to each payment
      const pagamentiPrecedentiStd = await prisma.pagamento.findMany({
        where: {
          stato: "EFFETTUATO",
          data: { lt: dataInizioAnno },
          pianoPagamento: {
            societaId,
            operazione: { eliminato: false, bozza: false },
          },
        },
        select: {
          importo: true,
          pianoPagamento: {
            select: {
              operazione: {
                select: {
                  tipoOperazione: true,
                  ripartizioni: { where: { socioId }, select: { percentuale: true } },
                },
              },
            },
          },
        },
      });

      let cashFlowPrecedenti = 0;
      for (const rip of ripPrecedentiImmediate) {
        const v = Number(rip.importoCalcolato);
        if (rip.operazione.tipoOperazione === "FATTURA_ATTIVA") cashFlowPrecedenti += v;
        else if (TIPI_USCITA.includes(rip.operazione.tipoOperazione)) cashFlowPrecedenti -= v;
      }
      for (const pag of pagamentiPrecedentiStd) {
        const ripartizione = pag.pianoPagamento.operazione.ripartizioni[0];
        if (!ripartizione) continue;
        const v = Number(pag.importo) * Number(ripartizione.percentuale) / 100;
        const tipo = pag.pianoPagamento.operazione.tipoOperazione;
        if (tipo === "FATTURA_ATTIVA") cashFlowPrecedenti += v;
        else if (TIPI_USCITA.includes(tipo)) cashFlowPrecedenti -= v;
      }

      const saldoIniziale = Math.round(
        (capitaleSociale * (quotaPercentuale / 100) + cashFlowPrecedenti) * 100
      ) / 100;

      // --- Monthly data for selected year ---

      // 2a. Immediate ops (no piano pagamento) — use ripartizioni
      const ripsImmediate = await prisma.ripartizioneOperazione.findMany({
        where: {
          socioId,
          operazione: {
            societaId,
            eliminato: false,
            bozza: false,
            pianoPagamento: { is: null },
            dataOperazione: { gte: dataInizioAnno, lte: dataFineAnno },
          },
        },
        select: {
          importoCalcolato: true,
          operazione: { select: { tipoOperazione: true, dataOperazione: true } },
        },
      });

      // 2b. Payments from plans for current year (EFFETTUATO + PREVISTO)
      const pagamentiAnnoStd = await prisma.pagamento.findMany({
        where: {
          stato: { in: ["EFFETTUATO", "PREVISTO"] },
          data: { gte: dataInizioAnno, lte: dataFineAnno },
          pianoPagamento: {
            societaId,
            operazione: { eliminato: false, bozza: false },
          },
        },
        select: {
          data: true,
          importo: true,
          pianoPagamento: {
            select: {
              operazione: {
                select: {
                  tipoOperazione: true,
                  ripartizioni: { where: { socioId }, select: { percentuale: true } },
                },
              },
            },
          },
        },
      });

      const mensile = buildMensile();

      for (const rip of ripsImmediate) {
        const mese = new Date(rip.operazione.dataOperazione).getMonth() + 1;
        accumulaMovimento(mensile, rip.operazione.tipoOperazione, Number(rip.importoCalcolato), mese);
      }
      for (const pag of pagamentiAnnoStd) {
        const ripartizione = pag.pianoPagamento.operazione.ripartizioni[0];
        if (!ripartizione) continue;
        const v = Number(pag.importo) * Number(ripartizione.percentuale) / 100;
        const mese = new Date(pag.data).getMonth() + 1;
        const tipo = pag.pianoPagamento.operazione.tipoOperazione;
        accumulaMovimento(mensile, tipo, v, mese);
      }

      const saldoFinale = finalizzaMensile(mensile, saldoIniziale);

      const totali = {
        entrate: Math.round(mensile.reduce((s, m) => s + m.entrate, 0) * 100) / 100,
        uscite: Math.round(mensile.reduce((s, m) => s + m.uscite, 0) * 100) / 100,
        saldoFinale,
      };

      // Saldo attuale (STANDARD): only EFFETTUATO payments up to today
      const oggi = new Date();
      const pagEffStd = await prisma.pagamento.findMany({
        where: {
          stato: "EFFETTUATO",
          data: { gte: dataInizioAnno, lte: oggi },
          pianoPagamento: {
            societaId,
            operazione: { eliminato: false, bozza: false },
          },
        },
        select: {
          importo: true,
          pianoPagamento: {
            select: {
              operazione: {
                select: {
                  tipoOperazione: true,
                  ripartizioni: { where: { socioId }, select: { percentuale: true } },
                },
              },
            },
          },
        },
      });
      const ripsImmOggi = await prisma.ripartizioneOperazione.findMany({
        where: {
          socioId,
          operazione: {
            societaId,
            eliminato: false,
            bozza: false,
            pianoPagamento: { is: null },
            dataOperazione: { gte: dataInizioAnno, lte: oggi },
          },
        },
        select: {
          importoCalcolato: true,
          operazione: { select: { tipoOperazione: true } },
        },
      });
      let cashFlowAttuale = 0;
      for (const rip of ripsImmOggi) {
        const v = Number(rip.importoCalcolato);
        if (rip.operazione.tipoOperazione === "FATTURA_ATTIVA") cashFlowAttuale += v;
        else if (TIPI_USCITA.includes(rip.operazione.tipoOperazione)) cashFlowAttuale -= v;
      }
      for (const pag of pagEffStd) {
        const ripartizione = pag.pianoPagamento.operazione.ripartizioni[0];
        if (!ripartizione) continue;
        const v = Number(pag.importo) * Number(ripartizione.percentuale) / 100;
        const tipo = pag.pianoPagamento.operazione.tipoOperazione;
        if (tipo === "FATTURA_ATTIVA") cashFlowAttuale += v;
        else if (TIPI_USCITA.includes(tipo)) cashFlowAttuale -= v;
      }
      const saldoAttuale = Math.round((saldoIniziale + cashFlowAttuale) * 100) / 100;

      return NextResponse.json({ anno, saldoIniziale, saldoAttuale, mensile, totali });
    }
  } catch (error) {
    console.error("Errore simulazione cassa:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
