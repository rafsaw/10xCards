import { z } from "zod";

/**
 * Structured-output contract for a code review. Lives in its own module so both
 * the agent and future promptfoo assertions can import it without pulling in
 * agent/runtime code. The reusable sub-pieces are exported too (eval ergonomics).
 */

/** Severity of a single finding, lowest to highest. */
export const severitySchema = z.enum(["info", "minor", "major", "critical"]);

/** Overall recommendation for the change. */
export const verdictSchema = z.enum(["approve", "comment", "request_changes"]);

/** A single, concrete, actionable review finding. */
export const findingSchema = z.object({
  severity: severitySchema,
  title: z.string(),
  detail: z.string(),
  suggestion: z.string().optional(),
});

/** Structured shape we ask the model to return — also our runtime contract. */
export const reviewSchema = z.object({
  summary: z.string().describe("One-paragraph overview of the change."),
  verdict: verdictSchema.describe("Overall recommendation for the change."),
  findings: z.array(findingSchema).describe("Concrete, actionable review findings."),
});

export type Review = z.infer<typeof reviewSchema>;
