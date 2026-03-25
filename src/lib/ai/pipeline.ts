import { prisma } from "@/lib/prisma";
import type { AiSuggestionTipo } from "@prisma/client";
import type {
  AiClassificationResult,
  DeterministicRule,
  PipelineDecision,
} from "./types";
import { AI_CONFIDENCE_THRESHOLD } from "./types";

type PipelineContext = {
  societaId: number;
  entityType: string;
  entityId: number;
  tipo: AiSuggestionTipo;
};

type AiClassifier<T> = (input: T, context: PipelineContext) => Promise<AiClassificationResult>;

export class AiPipeline<T> {
  constructor(
    private rules: DeterministicRule<T>[],
    private classifier: AiClassifier<T>,
  ) {}

  async process(input: T, context: PipelineContext): Promise<PipelineDecision> {
    // Step 1: Try deterministic rules
    for (const rule of this.rules) {
      if (rule.matches(input)) {
        return { action: "DETERMINISTIC", result: rule.apply(input) };
      }
    }

    // Step 2: Try AI classification
    try {
      const aiResult = await this.classifier(input, context);

      const suggestion = await prisma.aiSuggestion.create({
        data: {
          societaId: context.societaId,
          tipo: context.tipo,
          entityType: context.entityType,
          entityId: context.entityId,
          suggestion: aiResult.suggestion,
          confidence: aiResult.confidence,
          motivazione: aiResult.motivazione,
          tokensUsati: aiResult.tokensUsati,
          stato: aiResult.confidence >= AI_CONFIDENCE_THRESHOLD
            ? "AUTO_APPLIED"
            : "PENDING",
        },
      });

      if (aiResult.confidence >= AI_CONFIDENCE_THRESHOLD) {
        return {
          action: "AUTO_APPLIED",
          result: aiResult.suggestion,
          aiSuggestionId: suggestion.id,
        };
      }

      return { action: "PENDING_REVIEW", aiSuggestionId: suggestion.id };
    } catch (error) {
      // AI unavailable — degrade gracefully, create pending suggestion
      console.error("AI classifier failed, degrading to manual review:", error);

      const suggestion = await prisma.aiSuggestion.create({
        data: {
          societaId: context.societaId,
          tipo: context.tipo,
          entityType: context.entityType,
          entityId: context.entityId,
          suggestion: {},
          confidence: 0,
          motivazione: "Classificazione AI non disponibile — richiede review manuale",
          stato: "PENDING",
        },
      });

      return { action: "PENDING_REVIEW", aiSuggestionId: suggestion.id };
    }
  }
}
