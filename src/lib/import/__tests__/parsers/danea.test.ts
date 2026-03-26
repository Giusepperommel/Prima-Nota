import { describe, it, expect } from "vitest";
import { parseDaneaXml } from "../../parsers/danea";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<EasyfattDocuments AppVersion="2025">
  <Documents>
    <Document>
      <DocumentType>C</DocumentType>
      <Date>15/01/2026</Date>
      <Number>1</Number>
      <CustomerName>Acme Srl</CustomerName>
      <CustomerFiscalCode>12345678901</CustomerFiscalCode>
      <Total>1220.00</Total>
      <TotalWithoutTax>1000.00</TotalWithoutTax>
      <VatAmount>220.00</VatAmount>
    </Document>
  </Documents>
</EasyfattDocuments>`;

describe("parseDaneaXml", () => {
  it("parses Danea XML to rows", () => {
    const result = parseDaneaXml(SAMPLE_XML);
    expect(result).toHaveLength(1);
    expect(result[0].rowNumber).toBe(1);
    expect(result[0].data.Date).toBe("15/01/2026");
    expect(result[0].data.CustomerName).toBe("Acme Srl");
    expect(result[0].data.Total).toBe("1220.00");
  });

  it("handles empty documents", () => {
    const xml = `<?xml version="1.0"?><EasyfattDocuments><Documents></Documents></EasyfattDocuments>`;
    const result = parseDaneaXml(xml);
    expect(result).toHaveLength(0);
  });
});
