import { prisma } from "@/lib/prisma";
import type { TodoItem, TodoGenerationContext } from "../../types";
import type { TodoGeneratorConfig } from "../types";

export const bozzeTodoGenerator: TodoGeneratorConfig = {
  fonte: "BOZZA",
  descrizione: "Operazioni in bozza da completare",
  modalita: null,
  async generate(ctx: TodoGenerationContext): Promise<TodoItem[]> {
    const count = await prisma.operazione.count({
      where: {
        societaId: ctx.societaId,
        bozza: true,
        eliminato: false,
      },
    });

    if (count === 0) {
      return [];
    }

    return [
      {
        titolo: `${count} operazion${count === 1 ? "e" : "i"} in bozza da completare`,
        descrizione: `Hai ${count} operazion${count === 1 ? "e" : "i"} salvat${count === 1 ? "a" : "e"} come bozza. Completale per registrarle in prima nota.`,
        priorita: 3,
        linkAzione: "/operazioni?filtro=bozze",
        fonte: "BOZZA" as const,
        dedupeKey: "bozze_summary",
      },
    ];
  },
};
