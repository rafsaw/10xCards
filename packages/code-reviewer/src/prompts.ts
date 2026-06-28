/**
 * Prompt wording for the code reviewer, separated from wiring so prompts can be
 * iterated (and later eval'd) independently of the provider/agent code.
 */

/** System instruction steering the model into a senior-reviewer persona. */
export const reviewSystemPrompt =
  "You are a meticulous senior code reviewer. Be specific and actionable. " +
  "Only flag real issues; prefer the lowest accurate severity.";

/** Build the user prompt that wraps the code (and optional context) for review. */
export function buildReviewPrompt(code: string, context?: string): string {
  return [context ? `Context:\n${context}` : null, "Review this code:", "```", code, "```"]
    .filter(Boolean)
    .join("\n");
}
