/**
 * UNI SInCRO (UNI 11386:2020) XML index generator
 * for conservazione sostitutiva packages.
 */

export type DocumentoIndice = {
  id: string;
  nome: string;
  hashSHA256: string;
  tipo: string;
  dataCreazione: string; // ISO date
};

export type IndiceParams = {
  idPacchetto: string;
  produttore: {
    denominazione: string;
    partitaIva: string;
  };
  anno: number;
  tipo: string;
  dataCreazione: string; // ISO datetime
  documenti: DocumentoIndice[];
};

/**
 * Generates UNI SInCRO compliant XML index for a preservation package.
 */
export function generaIndiceSinCRO(params: IndiceParams): string {
  const { idPacchetto, produttore, anno, tipo, dataCreazione, documenti } = params;

  const fileGroupEntries = documenti
    .map(
      (doc) => `      <File>
        <ID>${escapeXml(doc.id)}</ID>
        <Path>${escapeXml(doc.nome)}</Path>
        <Hash>
          <Algorithm>SHA-256</Algorithm>
          <Value>${doc.hashSHA256}</Value>
        </Hash>
        <MimeType>${getMimeType(doc.nome)}</MimeType>
        <DateCreated>${escapeXml(doc.dataCreazione)}</DateCreated>
      </File>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<IdC xmlns="urn:uni:uninfo:sincro:2020" SchemaVersion="2.0">
  <SelfDescription>
    <ID>${escapeXml(idPacchetto)}</ID>
    <CreatingApplication>
      <Name>PrimaNota</Name>
      <Version>1.0</Version>
    </CreatingApplication>
    <SourceIdC />
    <MoreInfo>
      <EmbeddedMetadata>
        <Anno>${anno}</Anno>
        <TipoDocumenti>${escapeXml(tipo)}</TipoDocumenti>
      </EmbeddedMetadata>
    </MoreInfo>
  </SelfDescription>
  <VdC>
    <ID>VdC_${escapeXml(idPacchetto)}</ID>
    <Description>Volume di Conservazione - ${escapeXml(tipo)} ${anno}</Description>
    <FileGroup>
${fileGroupEntries}
    </FileGroup>
  </VdC>
  <Process>
    <Agent Type="Organization" Role="Producer">
      <AgentName>
        <FormalName>${escapeXml(produttore.denominazione)}</FormalName>
      </AgentName>
      <AgentID Scheme="PIVA">${escapeXml(produttore.partitaIva)}</AgentID>
    </Agent>
    <TimeReference>${escapeXml(dataCreazione)}</TimeReference>
  </Process>
</IdC>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    xml: "application/xml",
    pdf: "application/pdf",
    csv: "text/csv",
    txt: "text/plain",
    p7m: "application/pkcs7-mime",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}
