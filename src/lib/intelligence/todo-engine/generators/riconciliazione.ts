import { prisma } from "@/lib/prisma";
import type { TodoItem, TodoGenerationContext } from "../../types";
import type { TodoGeneratorConfig } from "../types";

export const riconciliazioneTodoGenerator: TodoGeneratorConfig = {
  fonte: "RICONCILIAZIONE",
  descrizione: "Movimenti bancari da riconciliare",
  modalita: ["avanzata", "commercialista"],
  async generate(ctx: TodoGenerationContext): Promise<TodoItem[]> {
    if (!ctx.modalitaAvanzata && !ctx.modalitaCommercialista) {
      return [];
    }

    const count = await prisma.movimentoBancario.count({
      where: {
        societaId: ctx.societaId,
        statoRiconciliazione: "NON_RICONCILIATO",
      },
    });

    if (count === 0) {
      return [];
    }

    const priorita = count > 20 ? 2 : 4;

    return [
      {
        titolo: `${count} moviment${count === 1 ? "o" : "i"} bancar${count === 1 ? "io" : "i"} da riconciliare`,
        descrizione: `Ci sono ${count} movimenti bancari non ancora riconciliati con le operazioni registrate.`,
        priorita,
        linkAzione: "/riconciliazione",
        fonte: "RICONCILIAZIONE" as const,
        dedupeKey: "riconciliazione_summary",
      },
    ];
  },
};
