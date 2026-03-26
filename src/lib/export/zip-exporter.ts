import archiver from "archiver";
import { exportToCsv } from "./csv-exporter";
import { getEntityConfig, ALL_ENTITY_TYPES } from "./entity-configs";
import type { EntityType } from "./types";

export async function exportAllToZip(
  dataByEntity: Record<EntityType, Record<string, unknown>[]>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    for (const entityType of ALL_ENTITY_TYPES) {
      const data = dataByEntity[entityType];
      if (!data || data.length === 0) continue;
      const config = getEntityConfig(entityType);
      const csv = exportToCsv(data, config.fields);
      archive.append(csv, { name: `${entityType}.csv` });
    }

    archive.finalize();
  });
}
