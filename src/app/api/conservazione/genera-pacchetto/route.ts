import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generaPacchetto, TipoPacchetto } from "@/lib/conservazione/pacchetto-generator";

const VALID_TYPES: TipoPacchetto[] = ["FATTURE_ATTIVE", "FATTURE_PASSIVE", "LIBRO_GIORNALE", "REGISTRI_IVA"];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    const body = await request.json();
    const { anno, tipo } = body;

    if (!anno || !tipo) {
      return NextResponse.json({ error: "Anno e tipo sono obbligatori" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(tipo)) {
      return NextResponse.json({ error: "Tipo pacchetto non valido" }, { status: 400 });
    }

    // Get societa info for producer metadata
    const societa = await prisma.societa.findUnique({
      where: { id: societaId },
      select: { ragioneSociale: true, partitaIva: true },
    });
    if (!societa) {
      return NextResponse.json({ error: "Societa non trovata" }, { status: 404 });
    }

    // Collect documents based on type
    const documenti = await collectDocuments(societaId, anno, tipo);

    if (documenti.length === 0) {
      return NextResponse.json(
        { error: "Nessun documento trovato per il periodo selezionato" },
        { status: 404 },
      );
    }

    const idPacchetto = `PKG_${societaId}_${anno}_${tipo}_${Date.now()}`;

    const pacchetto = await generaPacchetto({
      idPacchetto,
      produttore: {
        denominazione: societa.ragioneSociale,
        partitaIva: societa.partitaIva,
      },
      anno,
      tipo,
      documenti,
    });

    // Save to DB
    const saved = await prisma.pacchettoConservazione.create({
      data: {
        societaId,
        anno,
        tipo,
        stato: "GENERATO",
        hashSHA256: pacchetto.hashPacchetto,
        metadatiXml: pacchetto.indiceXml,
        fileContenuto: JSON.stringify(
          pacchetto.documenti.map((d) => ({ nome: d.nome, hash: d.hash })),
        ),
      },
    });

    return NextResponse.json({
      id: saved.id,
      hashSHA256: pacchetto.hashPacchetto,
      numDocumenti: documenti.length,
      dataCreazione: pacchetto.dataCreazione,
    });
  } catch (error) {
    console.error("Errore nella generazione del pacchetto:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 },
    );
  }
}

async function collectDocuments(
  societaId: number,
  anno: number,
  tipo: TipoPacchetto,
) {
  const startDate = new Date(anno, 0, 1);
  const endDate = new Date(anno, 11, 31);

  if (tipo === "FATTURE_ATTIVE" || tipo === "FATTURE_PASSIVE") {
    const tipoOp = tipo === "FATTURE_ATTIVE" ? "FATTURA_ATTIVA" : "COSTO";
    const operazioni = await prisma.operazione.findMany({
      where: {
        societaId,
        tipoOperazione: tipoOp,
        eliminato: false,
        dataOperazione: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        descrizione: true,
        dataOperazione: true,
        importoTotale: true,
        numeroDocumento: true,
        fileXml: true,
      },
      orderBy: { dataOperazione: "asc" },
    });

    return operazioni.map((op) => ({
      nome: `${tipo.toLowerCase()}_${op.id}_${op.numeroDocumento || "nd"}.xml`,
      contenuto: op.fileXml || `<documento><id>${op.id}</id><descrizione>${op.descrizione}</descrizione><importo>${op.importoTotale}</importo></documento>`,
      tipo: tipo === "FATTURE_ATTIVE" ? "Fattura Attiva" : "Fattura Passiva",
      dataCreazione: op.dataOperazione.toISOString(),
    }));
  }

  // LIBRO_GIORNALE / REGISTRI_IVA: generate from scritture contabili
  const scritture = await prisma.scritturaContabile.findMany({
    where: {
      societaId,
      dataRegistrazione: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      descrizione: true,
      dataRegistrazione: true,
    },
    orderBy: { dataRegistrazione: "asc" },
  });

  return scritture.map((s) => ({
    nome: `${tipo.toLowerCase()}_${s.id}.xml`,
    contenuto: `<scrittura><id>${s.id}</id><descrizione>${s.descrizione}</descrizione><data>${s.dataRegistrazione.toISOString()}</data></scrittura>`,
    tipo: tipo === "LIBRO_GIORNALE" ? "Libro Giornale" : "Registro IVA",
    dataCreazione: s.dataRegistrazione.toISOString(),
  }));
}
