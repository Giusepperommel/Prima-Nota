import { prisma } from "@/lib/prisma";
import type { TodoItem, TodoGenerationContext } from "../../types";
import type { TodoGeneratorConfig } from "../types";

export const anomalieTodoGenerator: TodoGeneratorConfig = {
  fonte: "ANOMALIA",
  descrizione: "Anomalie contabili aperte da risolvere",
  modalita: ["avanzata", "commercialista"],
  async generate(ctx: TodoGenerationContext): Promise<TodoItem[]> {
    if (!ctx.modalitaAvanzata && !ctx.modalitaCommercialista) {
      return [];
    }

    const anomalie = await prisma.anomalia.findMany({
      where: {
        societaId: ctx.societaId,
        stato: "APERTA",
      },
      take: 10,
      orderBy: [{ priorita: "asc" }, { createdAt: "desc" }],
    });

    return anomalie.map((a) => {
      let priorita: number;
      if (a.priorita === "CRITICA") {
        priorita = 1;
      } else if (a.priorita === "ALTA") {
        priorita = 2;
      } else {
        priorita = 3;
      }

      return {
        titolo: a.titolo,
        descrizione: a.descrizione,
        priorita,
        linkAzione: `/anomalie/${a.id}`,
        fonte: "ANOMALIA" as const,
        dedupeKey: `anomalia_${a.id}`,
      };
    });
  },
};
