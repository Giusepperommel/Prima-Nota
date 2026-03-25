/**
 * Pacchetto di Conservazione generator.
 * Orchestrates creation of a preservation package:
 * 1. Collects documents for the given year/type
 * 2. Calculates SHA-256 hashes
 * 3. Generates UNI SInCRO XML index
 * 4. Returns package data (ready for ZIP download)
 */

import { sha256, hashDocuments } from "./hash-utils";
import { generaIndiceSinCRO, DocumentoIndice } from "./uni-sincro";

export type TipoPacchetto = "FATTURE_ATTIVE" | "FATTURE_PASSIVE" | "LIBRO_GIORNALE" | "REGISTRI_IVA";

export type DocumentoPacchetto = {
  nome: string;
  contenuto: string;
  tipo: string;
  dataCreazione: string;
};

export type PacchettoGenerato = {
  indiceXml: string;
  hashPacchetto: string;
  documenti: { nome: string; contenuto: string; hash: string }[];
  dataCreazione: string;
};

export const TIPO_PACCHETTO_LABELS: Record<TipoPacchetto, string> = {
  FATTURE_ATTIVE: "Fatture Attive",
  FATTURE_PASSIVE: "Fatture Passive",
  LIBRO_GIORNALE: "Libro Giornale",
  REGISTRI_IVA: "Registri IVA",
};

/**
 * Generates a preservation package from a list of documents.
 * Pure function - no DB dependency.
 */
export async function generaPacchetto(params: {
  idPacchetto: string;
  produttore: { denominazione: string; partitaIva: string };
  anno: number;
  tipo: TipoPacchetto;
  documenti: DocumentoPacchetto[];
}): Promise<PacchettoGenerato> {
  const { idPacchetto, produttore, anno, tipo, documenti } = params;
  const dataCreazione = new Date().toISOString();

  // 1. Hash each document
  const hashedDocs = await hashDocuments(
    documenti.map((d) => ({ name: d.nome, content: d.contenuto })),
  );

  const documentiConHash = documenti.map((d, i) => ({
    nome: d.nome,
    contenuto: d.contenuto,
    hash: hashedDocs[i].hash,
  }));

  // 2. Build index entries
  const indiceDocumenti: DocumentoIndice[] = documenti.map((d, i) => ({
    id: `DOC_${String(i + 1).padStart(4, "0")}`,
    nome: d.nome,
    hashSHA256: hashedDocs[i].hash,
    tipo: d.tipo,
    dataCreazione: d.dataCreazione,
  }));

  // 3. Generate UNI SInCRO XML index
  const indiceXml = generaIndiceSinCRO({
    idPacchetto,
    produttore,
    anno,
    tipo: TIPO_PACCHETTO_LABELS[tipo] || tipo,
    dataCreazione,
    documenti: indiceDocumenti,
  });

  // 4. Hash the entire package (index + all document hashes concatenated)
  const packageContent = indiceXml + hashedDocs.map((d) => d.hash).join("");
  const hashPacchetto = await sha256(packageContent);

  return {
    indiceXml,
    hashPacchetto,
    documenti: documentiConHash,
    dataCreazione,
  };
}
