import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportData } from "@/lib/export/export-engine";
import {
  getEntityConfig,
  ALL_ENTITY_TYPES,
} from "@/lib/export/entity-configs";
import { exportAllToZip } from "@/lib/export/zip-exporter";
import type { EntityType, ExportFormat } from "@/lib/export/types";
import { format as formatDate } from "date-fns";

// ─── Date field mapping per entity (for date range filters) ─────────────────

const DATE_FIELD_MAP: Record<EntityType, string> = {
  operazioni: "dataOperazione",
  "scritture-contabili": "dataRegistrazione",
  "piano-dei-conti": "createdAt",
  anagrafiche: "createdAt",
  "fatture-elettroniche": "dataDocumento",
  "registri-iva": "dataRegistrazione",
  "liquidazioni-iva": "createdAt",
  f24: "dataScadenza",
  cu: "createdAt",
  cespiti: "dataAcquisto",
  "movimenti-bancari": "data",
  scadenzario: "dataScadenza",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWhereFromFilters(
  entityType: EntityType,
  societaId: number,
  filters: Record<string, unknown> = {}
): Record<string, unknown> {
  const where: Record<string, unknown> = { societaId };

  // Soft-delete filter for entities that support it
  if (entityType === "operazioni" || entityType === "registri-iva") {
    where.eliminato = false;
    where.bozza = false;
  }
  if (entityType === "scritture-contabili") {
    where.eliminato = false;
  }

  // Registro IVA requires a non-null registroIva
  if (entityType === "registri-iva") {
    where.registroIva = { not: null };
  }

  // Date range filters (da / a)
  const dateField = DATE_FIELD_MAP[entityType];
  if (filters.da || filters.a) {
    const dateFilter: Record<string, unknown> = {};
    if (filters.da) dateFilter.gte = new Date(String(filters.da));
    if (filters.a) dateFilter.lte = new Date(String(filters.a));
    where[dateField] = dateFilter;
  }

  // Year filter (anno) for entities that have it
  if (
    filters.anno &&
    ["scritture-contabili", "liquidazioni-iva", "f24", "cu"].includes(
      entityType
    )
  ) {
    where.anno = Number(filters.anno);
  }

  // Stato filter
  if (filters.stato) {
    where.stato = String(filters.stato);
  }

  // Tipo filter
  if (filters.tipo) {
    if (entityType === "operazioni" || entityType === "registri-iva") {
      where.tipoOperazione = String(filters.tipo);
    } else if (entityType === "anagrafiche") {
      where.tipo = String(filters.tipo);
    } else if (entityType === "liquidazioni-iva") {
      where.tipo = String(filters.tipo);
    }
  }

  // Registro IVA specific filter
  if (filters.registro && entityType === "registri-iva") {
    where.registroIva = String(filters.registro);
  }

  return where;
}

const VALID_FORMATS: ExportFormat[] = ["csv", "json", "xlsx", "pdf"];

// ─── POST: Export data ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const user = session.user as any;
    const societaId = user.societaId as number;

    if (!societaId) {
      return NextResponse.json(
        { error: "Nessuna società selezionata" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      entityType: rawEntityType,
      format,
      filters = {},
      fields: selectedFields,
      limit,
      offset,
    } = body as {
      entityType: string;
      format: ExportFormat;
      filters?: Record<string, unknown>;
      fields?: string[];
      limit?: number;
      offset?: number;
    };

    // ─── Bulk backup (ZIP of all entities) ───────────────────────────────────
    if (rawEntityType === "backup-completo") {
      const dataByEntity = {} as Record<EntityType, Record<string, unknown>[]>;

      for (const et of ALL_ENTITY_TYPES) {
        const cfg = getEntityConfig(et);
        const prismaModel = (prisma as any)[cfg.prismaModel];
        if (!prismaModel) continue;

        const where: Record<string, unknown> = { societaId };
        if (et === "operazioni" || et === "registri-iva") {
          where.eliminato = false;
          where.bozza = false;
        }
        if (et === "scritture-contabili") {
          where.eliminato = false;
        }
        if (et === "registri-iva") {
          where.registroIva = { not: null };
        }

        const raw = await prismaModel.findMany({
          where,
          orderBy: cfg.defaultOrderBy,
        });
        dataByEntity[et] = JSON.parse(JSON.stringify(raw));
      }

      const zipBuffer = await exportAllToZip(dataByEntity);
      const dateStr = formatDate(new Date(), "yyyy-MM-dd");

      return new NextResponse(new Uint8Array(zipBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="backup-completo_${dateStr}.zip"`,
        },
      });
    }

    // Validate entityType
    if (!rawEntityType || !ALL_ENTITY_TYPES.includes(rawEntityType as EntityType)) {
      return NextResponse.json(
        {
          error: `Tipo entità non valido. Tipi supportati: ${ALL_ENTITY_TYPES.join(", ")}, backup-completo`,
        },
        { status: 400 }
      );
    }

    const entityType = rawEntityType as EntityType;

    // Validate format
    if (!format || !VALID_FORMATS.includes(format)) {
      return NextResponse.json(
        {
          error: `Formato non valido. Formati supportati: ${VALID_FORMATS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const config = getEntityConfig(entityType);
    const where = buildWhereFromFilters(entityType, societaId, filters);

    // Query data from Prisma
    const prismaModel = (prisma as any)[config.prismaModel];
    if (!prismaModel) {
      return NextResponse.json(
        { error: `Modello Prisma non trovato: ${config.prismaModel}` },
        { status: 500 }
      );
    }

    const queryOptions: Record<string, unknown> = {
      where,
      orderBy: config.defaultOrderBy,
    };

    if (limit) queryOptions.take = Math.min(limit, 100_000);
    if (offset) queryOptions.skip = offset;

    const data = await prismaModel.findMany(queryOptions);

    // Serialize Prisma data (Decimal, Date, etc.)
    const serialized = JSON.parse(JSON.stringify(data));

    // Export
    const result = await exportData(
      serialized,
      entityType,
      format,
      selectedFields
    );

    // Return file response
    if (format === "xlsx") {
      return new NextResponse(new Uint8Array(result.data as Buffer), {
        status: 200,
        headers: {
          "Content-Type": result.mimeType,
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "X-Row-Count": String(result.rowCount),
        },
      });
    }

    return new NextResponse(result.data as string, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Row-Count": String(result.rowCount),
      },
    });
  } catch (error) {
    console.error("Errore esportazione:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Errore interno durante l'esportazione",
      },
      { status: 500 }
    );
  }
}

// ─── GET: List available entities and formats ─────────────────────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const entities = ALL_ENTITY_TYPES.map((entityType) => {
      const config = getEntityConfig(entityType);
      return {
        entityType: config.entityType,
        displayName: config.displayName,
        fields: config.fields.map((f) => ({
          key: f.key,
          label: f.label,
        })),
      };
    });

    return NextResponse.json({
      entities,
      formats: [
        { value: "csv", label: "CSV (separatore ;)" },
        { value: "json", label: "JSON" },
        { value: "xlsx", label: "Excel (XLSX)" },
        { value: "pdf", label: "PDF" },
      ],
    });
  } catch (error) {
    console.error("Errore lista entità esportazione:", error);
    return NextResponse.json(
      { error: "Errore interno" },
      { status: 500 }
    );
  }
}
