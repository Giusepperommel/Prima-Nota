import { describe, it, expect } from "vitest";
import { sha256, hashDocuments } from "../hash-utils";
import { generaIndiceSinCRO } from "../uni-sincro";
import { generaPacchetto } from "../pacchetto-generator";

describe("sha256", () => {
  it("returns a 64-char hex string", async () => {
    const hash = await sha256("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces consistent hashes", async () => {
    const hash1 = await sha256("test data");
    const hash2 = await sha256("test data");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await sha256("input A");
    const hash2 = await sha256("input B");
    expect(hash1).not.toBe(hash2);
  });
});

describe("hashDocuments", () => {
  it("hashes multiple documents", async () => {
    const results = await hashDocuments([
      { name: "doc1.xml", content: "<doc>1</doc>" },
      { name: "doc2.xml", content: "<doc>2</doc>" },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("doc1.xml");
    expect(results[0].hash).toHaveLength(64);
    expect(results[0].hash).not.toBe(results[1].hash);
  });
});

describe("generaIndiceSinCRO", () => {
  it("generates valid XML with correct structure", () => {
    const xml = generaIndiceSinCRO({
      idPacchetto: "PKG_001",
      produttore: { denominazione: "Test SRL", partitaIva: "12345678901" },
      anno: 2025,
      tipo: "Fatture Attive",
      dataCreazione: "2026-01-15T10:00:00Z",
      documenti: [
        {
          id: "DOC_0001",
          nome: "fattura_1.xml",
          hashSHA256: "abc123",
          tipo: "Fattura Attiva",
          dataCreazione: "2025-06-01T00:00:00Z",
        },
      ],
    });

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("urn:uni:uninfo:sincro:2020");
    expect(xml).toContain("<ID>PKG_001</ID>");
    expect(xml).toContain("<FormalName>Test SRL</FormalName>");
    expect(xml).toContain("12345678901");
    expect(xml).toContain("<Anno>2025</Anno>");
    expect(xml).toContain("<Algorithm>SHA-256</Algorithm>");
    expect(xml).toContain("<Path>fattura_1.xml</Path>");
  });

  it("escapes XML special characters", () => {
    const xml = generaIndiceSinCRO({
      idPacchetto: "PKG_002",
      produttore: { denominazione: "A & B <SRL>", partitaIva: "12345678901" },
      anno: 2025,
      tipo: "Test",
      dataCreazione: "2026-01-15T10:00:00Z",
      documenti: [],
    });

    expect(xml).toContain("A &amp; B &lt;SRL&gt;");
    expect(xml).not.toContain("A & B <SRL>");
  });
});

describe("generaPacchetto", () => {
  it("generates a package with hash and index", async () => {
    const result = await generaPacchetto({
      idPacchetto: "TEST_PKG",
      produttore: { denominazione: "Test SRL", partitaIva: "12345678901" },
      anno: 2025,
      tipo: "FATTURE_ATTIVE",
      documenti: [
        {
          nome: "fattura_001.xml",
          contenuto: "<fattura>test</fattura>",
          tipo: "Fattura Attiva",
          dataCreazione: "2025-01-01T00:00:00Z",
        },
        {
          nome: "fattura_002.xml",
          contenuto: "<fattura>test2</fattura>",
          tipo: "Fattura Attiva",
          dataCreazione: "2025-02-01T00:00:00Z",
        },
      ],
    });

    expect(result.hashPacchetto).toHaveLength(64);
    expect(result.indiceXml).toContain("TEST_PKG");
    expect(result.documenti).toHaveLength(2);
    expect(result.documenti[0].hash).toHaveLength(64);
    expect(result.documenti[1].hash).toHaveLength(64);
    expect(result.documenti[0].hash).not.toBe(result.documenti[1].hash);
    expect(result.dataCreazione).toBeTruthy();
  });

  it("produces consistent output for same input", async () => {
    const params = {
      idPacchetto: "CONSISTENT_TEST",
      produttore: { denominazione: "Test", partitaIva: "00000000000" },
      anno: 2025,
      tipo: "LIBRO_GIORNALE" as const,
      documenti: [
        {
          nome: "doc.xml",
          contenuto: "<data>hello</data>",
          tipo: "Libro Giornale",
          dataCreazione: "2025-01-01T00:00:00Z",
        },
      ],
    };

    const r1 = await generaPacchetto(params);
    const r2 = await generaPacchetto(params);

    // Document hashes should be the same
    expect(r1.documenti[0].hash).toBe(r2.documenti[0].hash);
  });
});
