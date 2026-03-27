// src/lib/api/openapi-schema.ts

interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  paths: Record<string, any>;
  components: { securitySchemes: Record<string, any>; schemas: Record<string, any> };
  security: any[];
}

export function generateOpenApiSpec(): OpenApiSpec {
  return {
    openapi: "3.0.3",
    info: {
      title: "Prima Nota API",
      version: "1.0.0",
      description:
        "API pubblica per Prima Nota — gestione contabile, alert, KPI, report. Autenticazione via API key Bearer token.",
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        description: "Server principale",
      },
    ],
    paths: {
      "/api/v1/operazioni": {
        get: {
          summary: "Lista operazioni",
          description: "Restituisce le operazioni della società con paginazione e filtri data.",
          tags: ["Operazioni"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            {
              name: "perPage",
              in: "query",
              schema: { type: "integer", default: 20, maximum: 100 },
            },
            {
              name: "da",
              in: "query",
              schema: { type: "string", format: "date" },
              description: "Data inizio (YYYY-MM-DD)",
            },
            {
              name: "a",
              in: "query",
              schema: { type: "string", format: "date" },
              description: "Data fine (YYYY-MM-DD)",
            },
          ],
          responses: {
            "200": {
              description: "Lista operazioni con paginazione",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PaginatedResponse" },
                },
              },
            },
            "401": { description: "API key mancante o non valida" },
            "403": { description: "Scope insufficiente" },
            "429": { description: "Rate limit superato" },
          },
        },
      },
      "/api/v1/alert": {
        get: {
          summary: "Lista alert",
          description:
            "Restituisce gli alert generati per la società. Scope richiesto: read:alert",
          tags: ["Intelligence"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "perPage", in: "query", schema: { type: "integer", default: 20 } },
            {
              name: "stato",
              in: "query",
              schema: {
                type: "string",
                enum: ["NUOVO", "VISTO", "SNOOZED", "RISOLTO"],
              },
            },
          ],
          responses: { "200": { description: "Lista alert con paginazione" } },
        },
      },
      "/api/v1/todo": {
        get: {
          summary: "Lista todo",
          description:
            "Restituisce i todo generati per la società. Scope richiesto: read:todo",
          tags: ["Intelligence"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "perPage", in: "query", schema: { type: "integer", default: 20 } },
            { name: "data", in: "query", schema: { type: "string", format: "date" } },
          ],
          responses: { "200": { description: "Lista todo con paginazione" } },
        },
      },
      "/api/v1/kpi": {
        get: {
          summary: "KPI aziendali",
          description:
            "Calcola e restituisce tutti i KPI per il periodo specificato. Scope richiesto: read:kpi",
          tags: ["Business Intelligence"],
          parameters: [
            {
              name: "anno",
              in: "query",
              schema: { type: "integer" },
              required: true,
            },
            {
              name: "periodo",
              in: "query",
              schema: { type: "integer" },
              required: true,
            },
            {
              name: "periodoTipo",
              in: "query",
              schema: { type: "string", enum: ["MESE", "TRIMESTRE", "ANNO"] },
              required: true,
            },
          ],
          responses: {
            "200": { description: "Array di KPI con valore, variazione, trend" },
          },
        },
      },
      "/api/v1/report": {
        get: {
          summary: "Lista report generati",
          description:
            "Restituisce i report BI generati per la società. Scope richiesto: read:report",
          tags: ["Business Intelligence"],
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "perPage", in: "query", schema: { type: "integer", default: 10 } },
          ],
          responses: { "200": { description: "Lista report con paginazione" } },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "API key generata da /api/configurazione/api. Formato: pk_xxxxx",
        },
      },
      schemas: {
        PaginatedResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: { type: "object" } },
            pagination: {
              type: "object",
              properties: {
                page: { type: "integer" },
                perPage: { type: "integer" },
                total: { type: "integer" },
                totalPages: { type: "integer" },
              },
            },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  };
}
