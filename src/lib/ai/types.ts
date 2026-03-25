import type { AiSuggestionTipo } from "@prisma/client";

export type AiClassificationInput = {
  societaId: number;
  entityType: string;
  entityId: number;
  tipo: AiSuggestionTipo;
  context: Record<string, unknown>;
};

export type AiClassificationResult = {
  suggestion: Record<string, unknown>;
  confidence: number;
  motivazione: string;
  tokensUsati: number;
};

export type PipelineDecision =
  | { action: "DETERMINISTIC"; result: Record<string, unknown> }
  | { action: "AUTO_APPLIED"; result: Record<string, unknown>; aiSuggestionId: number }
  | { action: "PENDING_REVIEW"; aiSuggestionId: number };

export type DeterministicRule<T> = {
  name: string;
  matches: (input: T) => boolean;
  apply: (input: T) => Record<string, unknown>;
};

export const AI_CONFIDENCE_THRESHOLD = 0.9;
