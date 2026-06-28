import type { ReviewOptions } from "./agent.js";

/**
 * Prompt wording for the code reviewer, separated from wiring so prompts can be
 * iterated (and later eval'd) independently of the provider/agent code.
 */

/** System instruction steering the model into a senior-reviewer persona. */
export const reviewSystemPrompt =
  "You are a meticulous senior code reviewer. Be specific and actionable. " +
  "Only flag real issues; prefer the lowest accurate severity.";

/**
 * Build the user prompt that wraps the code for review. An optional `language`
 * hint is prepended and optional `context` is included; with no options the
 * output is byte-identical to the original context-only prompt.
 */
export function buildReviewPrompt(code: string, options?: ReviewOptions): string {
  return [
    options?.language ? `Language: ${options.language}` : null,
    options?.context ? `Context:\n${options.context}` : null,
    "Review this code:",
    "```",
    code,
    "```",
  ]
    .filter(Boolean)
    .join("\n");
}
