import { Output, stepCountIs, ToolLoopAgent } from "ai";
import type { ToolSet } from "ai";

import { buildReviewPrompt, planReviewInstructions, reviewSystemPrompt } from "./prompts.js";
import { createModel } from "./provider.js";
import type { ReviewerConfig } from "./provider.js";
import { createReadPlanTool, defaultContextRoot } from "./readPlan.js";
import type { PlanRef } from "./readPlan.js";
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
  /**
   * Trusted, validated kebab-case change id under review. When set, the reviewer
   * can read `context/changes/<changeId>/plan.md` via the `readPlan` tool (Phase 3).
   * Absent → tool-less diff-only review, identical to before. Not a model input.
   */
  changeId?: string;
  /**
   * Override for the context root that holds `changes/<id>/plan.md`. Defaults to
   * `<cwd>/../../context`. Review-time input, not provider config.
   */
  contextRoot?: string;
}

/**
 * Trusted plan context binding the `readPlan` tool to the change under review.
 * Only ever built from a validated `changeId` (never a raw model input).
 */
export type PlanContext = PlanRef;

/**
 * Build a `ToolLoopAgent` that returns a `reviewSchema`-validated review.
 *
 * With no `planContext`, the agent is tool-less: a single structured generation,
 * byte-for-byte identical to before. With a `planContext`, it attaches the
 * read-only `readPlan` tool, appends {@link planReviewInstructions}, and bounds
 * the loop with `stepCountIs(3)` (one `readPlan` call plus the final structured
 * generation, with a little headroom). The plan-aware agent is exported so
 * callers (e.g. `ci.ts`, the Phase 4 verifier) can build it directly and read
 * `.output` + `.toolCalls` off `generate(...)` for the tool-call trace.
 */
export function createReviewAgent(config?: ReviewerConfig, planContext?: PlanContext): ReviewAgent {
  const model = createModel(config);

  if (!planContext) {
    return new ToolLoopAgent<never, ToolSet, ReviewOutput>({
      model,
      instructions: reviewSystemPrompt,
      output: Output.object({ schema: reviewSchema }),
      // No tools → the default `stopWhen: stepCountIs(20)` never trips (no tool
      // calls), so this performs a single structured generation.
    });
  }

  return new ToolLoopAgent<never, ToolSet, ReviewOutput>({
    model,
    instructions: reviewSystemPrompt + planReviewInstructions,
    tools: { readPlan: createReadPlanTool(planContext) },
    stopWhen: stepCountIs(3),
    output: Output.object({ schema: reviewSchema }),
  });
}

/** Build a reviewer with its agent (model bound once per call). */
export function createReviewer(config: ReviewerConfig = {}) {
  // The tool-less agent handles every no-changeId review, unchanged. Tools are
  // fixed at construction, so a plan-aware agent is built per-call when a
  // `changeId` is supplied (see `reviewCode` below).
  const agent = createReviewAgent(config);

  return {
    /** Review a snippet of code and return validated, structured feedback. */
    async reviewCode(code: string, options?: ReviewOptions): Promise<Review> {
      const reviewAgent = options?.changeId
        ? createReviewAgent(config, {
            changeId: options.changeId,
            contextRoot: options.contextRoot ?? defaultContextRoot(),
          })
        : agent;
      const { output } = await reviewAgent.generate({
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
