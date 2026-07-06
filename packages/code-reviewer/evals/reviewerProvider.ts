import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { computeVerdict, reviewCode } from "../src/index.js";

/**
 * Promptfoo custom provider wrapping the package's real `reviewCode()` agent, so
 * the eval measures the actual product surface (system prompt, rubric,
 * structured-output schema, verdict) rather than a re-declared raw-model prompt.
 *
 * Each `providers:` entry in `promptfooconfig.yaml` points at this same file and
 * differs only by `config.model` — that gives the 3-model comparison matrix.
 * Imports come from `../src/index.js` (relative source import) so no build step
 * is needed: Promptfoo runs this `.ts` provider directly via its Node loader,
 * which resolves the `.js` specifier to the sibling `.ts` source.
 *
 * The reviewed diff is loaded from a plain-string path var (`context.vars.diff`)
 * rather than interpolated into the prompt: the fixture contains literal `{{ }}`
 * (React's `dangerouslySetInnerHTML={{ __html }}`), which Nunjucks would try to
 * parse as a variable and error on ("expected variable end"). Reading the file
 * here keeps the raw diff away from Promptfoo's templating engine.
 *
 * Contract: https://www.promptfoo.dev/docs/providers/custom-api/
 */

/** Per-provider `config` block from `promptfooconfig.yaml`. */
interface ReviewerProviderConfig {
  /** OpenRouter model id under test (e.g. `anthropic/claude-sonnet-4.5`). */
  model?: string;
  /** Optional key override; falls back to `process.env.OPENROUTER_API_KEY`. */
  apiKey?: string;
}

/** Options Promptfoo passes to the provider constructor. */
interface ProviderOptions {
  id?: string;
  config?: ReviewerProviderConfig;
}

/** Subset of Promptfoo's `ProviderResponse` this provider returns. */
interface ProviderResponse {
  output?: unknown;
  error?: string;
}

/** Subset of Promptfoo's per-call context this provider reads. */
interface CallApiContext {
  /** Rendered test vars; `diff` is a path (relative to cwd) to the diff fixture. */
  vars?: Record<string, unknown>;
}

/**
 * Reviews the incoming diff with the real agent under a per-provider model and
 * returns the structured review plus its derived verdict as `output`. A failed
 * model returns `{ error }` (never throws) so one bad model can't abort the matrix.
 */
export default class ReviewerProvider {
  private readonly providerId: string;
  private readonly config: ReviewerProviderConfig;

  constructor(options: ProviderOptions = {}) {
    this.config = options.config ?? {};
    this.providerId = options.id ?? `reviewer:${this.config.model ?? "default"}`;
  }

  id(): string {
    return this.providerId;
  }

  /**
   * The reviewed code is the diff fixture, loaded from `context.vars.diff` (a
   * path, resolved against cwd — run the eval from the package dir). Falls back
   * to the rendered `prompt` if no `diff` var is supplied.
   */
  async callApi(prompt: string, context?: CallApiContext): Promise<ProviderResponse> {
    try {
      const diffPath = context?.vars?.diff;
      const code = typeof diffPath === "string" ? await readFile(resolve(process.cwd(), diffPath), "utf8") : prompt;
      const review = await reviewCode(
        code,
        { language: "typescript" },
        { model: this.config.model, apiKey: this.config.apiKey ?? process.env.OPENROUTER_API_KEY },
      );
      return { output: { ...review, verdict: computeVerdict(review.criteria) } };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}
