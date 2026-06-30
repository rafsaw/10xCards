import { z } from "zod";

/**
 * Structured-output contract for a code review. Lives in its own module so both
 * the agent and future promptfoo assertions can import it without pulling in
 * agent/runtime code. The reusable sub-pieces are exported too (eval ergonomics).
 */

/** Severity of a single finding, lowest to highest. */
export const severitySchema = z.enum(["info", "minor", "major", "critical"]);

/** A single, concrete, actionable review finding. */
export const findingSchema = z.object({
  severity: severitySchema,
  title: z.string(),
  detail: z.string(),
  suggestion: z.string().optional(),
});

/**
 * A single criterion's 1–10 score with a short justification. We use a plain
 * `z.number()` (not `.int()`/`.min`/`.max`): Anthropic's structured-output endpoint
 * rejects `minimum`/`maximum` on an integer property, and zod v4's `.int()` emits
 * the JS safe-integer bounds as exactly those. The integer 1–10 range lives in the
 * prompt rubric and this description instead; the model honors it.
 */
export const criterionScoreSchema = z.object({
  score: z.number().describe("Integer rating from 1 (worst) to 10 (best)."),
  rationale: z.string().describe("Brief justification for the score."),
});

/** The six review criteria, in display order. */
export const CRITERION_KEYS = [
  "implementationCorrectness",
  "idiomaticity",
  "complexityMaintainability",
  "testsRiskCoverage",
  "documentation",
  "securitySafety",
] as const;

/** Union of the six criterion keys. */
export type CriterionKey = (typeof CRITERION_KEYS)[number];

/** Per-criterion 1–10 scores — the heart of the review rubric. */
export const criteriaSchema = z.object({
  implementationCorrectness: criterionScoreSchema,
  idiomaticity: criterionScoreSchema,
  complexityMaintainability: criterionScoreSchema,
  testsRiskCoverage: criterionScoreSchema,
  documentation: criterionScoreSchema,
  securitySafety: criterionScoreSchema,
});

/** Structured shape we ask the model to return — also our runtime contract. */
export const reviewSchema = z.object({
  summary: z.string().describe("One-paragraph overview of the change."),
  criteria: criteriaSchema.describe("Per-criterion 1–10 scores against the six review criteria."),
  findings: z.array(findingSchema).describe("Concrete, actionable review findings.").optional(),
});

export type CriterionScore = z.infer<typeof criterionScoreSchema>;
export type Criteria = z.infer<typeof criteriaSchema>;
export type Review = z.infer<typeof reviewSchema>;
