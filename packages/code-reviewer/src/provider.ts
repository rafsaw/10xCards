import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

/**
 * Model/provider resolution behind a factory, so the agent (and future
 * evals/tools) get a `LanguageModel` without knowing about OpenRouter wiring or
 * env loading. Env concerns sit here too (`loadEnv`).
 */

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
export const FALLBACK_MODEL = "anthropic/claude-sonnet-4.5";

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

/** Resolve an OpenRouter-bound language model from config + env. */
export function createModel(config: ReviewerConfig = {}): LanguageModel {
  const apiKey = config.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OpenRouter API key: set OPENROUTER_API_KEY or pass { apiKey }.");
  }

  const openrouter = createOpenRouter({ apiKey });
  return openrouter(config.model ?? process.env.OPENROUTER_MODEL ?? FALLBACK_MODEL);
}
