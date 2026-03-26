import { prisma } from "@/lib/prisma";
import type { TodoItem, TodoGenerationContext } from "../../types";
import type { TodoGeneratorConfig } from "../types";

export const fattureTodoGenerator: TodoGeneratorConfig = {
  fonte: "FATTURA",
  descrizione: "Fatture elettroniche generate ma non ancora inviate",
  modalita: null,
  async generate(ctx: TodoGenerationContext): Promise<TodoItem[]> {
    const count = await prisma.fatturaElettronica.count({
      where: {
        societaId: ctx.societaId,
        stato: "GENERATA",
      },
    });

    if (count === 0) {
      return [];
    }

    return [
      {
        titolo: `${count} fattur${count === 1 ? "a" : "e"} elettronic${count === 1 ? "a" : "he"} da inviare`,
        descrizione: `Hai ${count} fattur${count === 1 ? "a" : "e"} generat${count === 1 ? "a" : "e"} ma non ancora inviat${count === 1 ? "a" : "e"} allo SDI.`,
        priorita: 2,
        linkAzione: "/fatture?stato=GENERATA",
        fonte: "FATTURA" as const,
        dedupeKey: "fatture_generate_summary",
      },
    ];
  },
};
