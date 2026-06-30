/**
 * Public barrel for `@10xcards/code-reviewer`. Re-exports only — no runtime
 * demo lives here (that moved to `src/cli.ts`). `reviewCode` is the primary
 * eval-facing export a future promptfoo eval drives.
 */

export {
  reviewSchema,
  severitySchema,
  findingSchema,
  criterionScoreSchema,
  criteriaSchema,
  CRITERION_KEYS,
} from "./schemas.js";
export type { Review, Criteria, CriterionScore, CriterionKey } from "./schemas.js";

export { reviewSystemPrompt, buildReviewPrompt } from "./prompts.js";

export { createModel, loadEnv, FALLBACK_MODEL } from "./provider.js";
export type { ReviewerConfig } from "./provider.js";

export { createReviewAgent, createReviewer, reviewCode } from "./agent.js";
export type { ReviewOptions } from "./agent.js";

export { computeVerdict, PASS_THRESHOLD, CORRECTNESS_FLOOR, SECURITY_FLOOR } from "./verdict.js";
export type { VerdictResult } from "./verdict.js";
