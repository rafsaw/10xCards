import { Output, ToolLoopAgent } from "ai";
import type { ToolSet } from "ai";

import { buildReviewPrompt, reviewSystemPrompt } from "./prompts.js";
import { createModel } from "./provider.js";
import type { ReviewerConfig } from "./provider.js";
import { reviewSchema } from "./schemas.js";
import type { Review } from "./schemas.js";

/** Structured-output spec the agent is bound to (`reviewSchema` → `Review`). */
type ReviewOutput = ReturnType<typeof Output.object<Review>>;

/** The review agent type (no tools; bound to the review structured output). */
export type ReviewAgent = ToolLoopAgent<never, ToolSet, ReviewOutput>;

/**
 * The reusable core. `createReviewAgent` builds a `ToolLoopAgent` bound to the
 * resolved model with the review contract as its structured output — the seam
 * to add review tools later. `createReviewer`/`reviewCode` drive it.
 *
 * `reviewCode` is the primary eval-facing export a future promptfoo eval drives.
 */

/** Review-time options accepted by `reviewCode` (distinct from provider config). */
export interface ReviewOptions {
  /** Language hint for the reviewed code (steers the model). */
  language?: string;
  /** Optional extra context prepended to the prompt. */
  context?: string;
}

/** Build a `ToolLoopAgent` that returns a `reviewSchema`-validated review. */
export function createReviewAgent(config?: ReviewerConfig): ReviewAgent {
  const model = createModel(config);
  return new ToolLoopAgent<never, ToolSet, ReviewOutput>({
    model,
    instructions: reviewSystemPrompt,
    output: Output.object({ schema: reviewSchema }),
    // No tools yet → the default `stopWhen: stepCountIs(20)` never trips (no
    // tool calls), so this performs a single structured generation for now.
  });
}

/** Build a reviewer with its agent (model bound once per call). */
export function createReviewer(config: ReviewerConfig = {}) {
  const agent = createReviewAgent(config);

  return {
    /** Review a snippet of code and return validated, structured feedback. */
    async reviewCode(code: string, options?: ReviewOptions): Promise<Review> {
      const { output } = await agent.generate({
        prompt: buildReviewPrompt(code, options),
      });
      return output;
    },
  };
}

/**
 * Convenience one-shot wrapper. `options` carries review-time hints (`language`,
 * `context`); `config` selects the provider/model. `reviewCode(code, { language })`
 * is the headline eval-facing call shape.
 */
export async function reviewCode(code: string, options?: ReviewOptions, config?: ReviewerConfig): Promise<Review> {
  return createReviewer(config).reviewCode(code, options);
}

/**
 same as reviewCode, but without the reviewer object. This is the video lesson code.
 */
export async function reviewCodeVideoLessonCode(
  code: string,
  options?: ReviewOptions,
  config?: ReviewerConfig,
): Promise<Review> {
  const agent = createReviewAgent(config);
  const { output } = await agent.generate({
    prompt: buildReviewPrompt(code, options),
  });
  return output;
}
