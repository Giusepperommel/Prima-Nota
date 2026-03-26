import { XMLParser } from "fast-xml-parser";
import type { ParsedRow } from "../import-types";

/**
 * Parses Danea Easyfatt XML export into ParsedRow[].
 * Extracts all Document elements from <Documents> and converts
 * their fields to string key-value pairs.
 */
export function parseDaneaXml(xml: string): ParsedRow[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Preserve values as strings
    parseTagValue: false,
  });

  const parsed = parser.parse(xml);

  const documents = parsed?.EasyfattDocuments?.Documents?.Document;

  if (!documents) {
    return [];
  }

  // Normalize to array (single document comes as object)
  const docArray = Array.isArray(documents) ? documents : [documents];

  return docArray.map((doc: Record<string, unknown>, index: number) => {
    const data: Record<string, string> = {};

    for (const [key, value] of Object.entries(doc)) {
      // Skip XML attributes
      if (key.startsWith("@_")) continue;
      data[key] = String(value ?? "");
    }

    return {
      rowNumber: index + 1,
      data,
    };
  });
}
