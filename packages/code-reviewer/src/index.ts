/**
 * Public barrel for `@10xcards/code-reviewer`. Re-exports only — no runtime
 * demo lives here (that moved to `src/cli.ts`). `reviewCode` is the primary
 * eval-facing export a future promptfoo eval drives.
 */

export { reviewSchema, severitySchema, verdictSchema, findingSchema } from "./schemas.js";
export type { Review } from "./schemas.js";

export { reviewSystemPrompt, buildReviewPrompt } from "./prompts.js";

export { createModel, loadEnv, FALLBACK_MODEL } from "./provider.js";
export type { ReviewerConfig } from "./provider.js";

export { createReviewAgent, createReviewer, reviewCode } from "./agent.js";
export type { ReviewOptions } from "./agent.js";
