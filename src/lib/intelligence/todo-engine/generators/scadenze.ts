import { addDays, differenceInDays, format } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import type { TodoItem, TodoGenerationContext } from "../../types";
import type { TodoGeneratorConfig } from "../types";

export const scadenzeTodoGenerator: TodoGeneratorConfig = {
  fonte: "SCADENZA",
  descrizione: "Scadenze fiscali in avvicinamento (prossimi 14 giorni)",
  modalita: null,
  async generate(ctx: TodoGenerationContext): Promise<TodoItem[]> {
    const limite = addDays(ctx.oggi, 14);

    const scadenze = await prisma.scadenzaFiscale.findMany({
      where: {
        societaId: ctx.societaId,
        stato: { in: ["NON_INIZIATA", "IN_PREPARAZIONE"] },
        scadenza: { gte: ctx.oggi, lte: limite },
      },
      orderBy: { scadenza: "asc" },
    });

    return scadenze.map((s) => {
      const giorniMancanti = differenceInDays(s.scadenza, ctx.oggi);
      const dataFormattata = format(s.scadenza, "d MMMM", { locale: itLocale });

      let priorita: number;
      if (giorniMancanti <= 3) {
        priorita = 1;
      } else if (giorniMancanti <= 7) {
        priorita = 2;
      } else {
        priorita = 3;
      }

      return {
        titolo: `Scadenza ${s.tipo.replace(/_/g, " ")} entro il ${dataFormattata}`,
        descrizione: `Stato: ${s.stato}, completamento: ${s.percentualeCompletamento}%`,
        priorita,
        linkAzione: `/adempimenti/${s.id}`,
        fonte: "SCADENZA" as const,
        dedupeKey: `scadenza_${s.id}`,
      };
    });
  },
};
