import { pathToFileURL } from "node:url";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";

/**
 * Basic entry-point wiring the AI SDK (`ai`) to the OpenRouter provider with a
 * zod-validated structured output. Intended as the seed for further code-review
 * features — keep the surface small and import-safe so other modules can reuse
 * `reviewCode` / `createReviewer` without triggering the demo.
 */

/** Structured shape we ask the model to return — also our runtime contract. */
export const reviewSchema = z.object({
  summary: z.string().describe("One-paragraph overview of the change."),
  verdict: z
    .enum(["approve", "comment", "request_changes"])
    .describe("Overall recommendation for the change."),
  findings: z
    .array(
      z.object({
        severity: z.enum(["info", "minor", "major", "critical"]),
        title: z.string(),
        detail: z.string(),
        suggestion: z.string().optional(),
      }),
    )
    .describe("Concrete, actionable review findings."),
});

export type Review = z.infer<typeof reviewSchema>;

export interface ReviewerConfig {
  /** OpenRouter API key. Defaults to `process.env.OPENROUTER_API_KEY`. */
  apiKey?: string;
  /**
   * OpenRouter model id. Defaults to `process.env.OPENROUTER_MODEL` or a
   * current Anthropic model. Browse ids at https://openrouter.ai/models.
   */
  model?: string;
}

/** Fallback model id when neither config nor `OPENROUTER_MODEL` is set. */
const FALLBACK_MODEL = "anthropic/claude-sonnet-4.5";

/**
 * Load environment variables from a `.env` file using Node's native loader
 * (no dependency). Missing file is fine — vars may be provided another way.
 * Call this before reading `process.env` (e.g. at the start of a CLI run).
 */
export function loadEnv(path = ".env"): void {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

/** Build a reviewer bound to an OpenRouter model. */
export function createReviewer(config: ReviewerConfig = {}) {
  const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OpenRouter API key: set OPENROUTER_API_KEY or pass { apiKey }.");
  }

  const openrouter = createOpenRouter({ apiKey });
  const model = openrouter(config.model ?? process.env.OPENROUTER_MODEL ?? FALLBACK_MODEL);

  return {
    /** Review a snippet of code and return validated, structured feedback. */
    async reviewCode(code: string, context?: string): Promise<Review> {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: reviewSchema }),
        system:
          "You are a meticulous senior code reviewer. Be specific and actionable. " +
          "Only flag real issues; prefer the lowest accurate severity.",
        prompt: [context ? `Context:\n${context}` : null, "Review this code:", "```", code, "```"]
          .filter(Boolean)
          .join("\n"),
      });
      return output;
    },
  };
}

/** Convenience one-shot wrapper around {@link createReviewer}. */
export async function reviewCode(code: string, config?: ReviewerConfig): Promise<Review> {
  return createReviewer(config).reviewCode(code);
}

/** Tiny demo — runs only when this file is executed directly (e.g. `npm start`). */
async function main(): Promise<void> {
  loadEnv();
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("Set OPENROUTER_API_KEY to run the demo. Example:\n" + "  OPENROUTER_API_KEY=sk-or-... npm start");
    process.exitCode = 1;
    return;
  }

  const sample = `export function add(a, b) {\n  return a - b; // BUG: subtraction\n}`;
  const review = await reviewCode(sample);
  console.log(JSON.stringify(review, null, 2));
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
