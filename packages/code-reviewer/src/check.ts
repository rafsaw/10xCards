import { computeVerdict, createReviewer, loadEnv, reviewSchema } from "./index.js";

/**
 * End-to-end integration check: env -> OpenRouter provider -> model ->
 * generateText -> zod-validated structured output. Makes ONE real (billable)
 * API call. Run with `npm run check`. Exits non-zero on any failure so it can
 * gate CI or a pre-flight step.
 */
async function check(): Promise<void> {
  loadEnv();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("✗ OPENROUTER_API_KEY is not set. Add it to .env or the environment.");
    process.exitCode = 1;
    return;
  }

  const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4.5";
  console.log(`• API key present`);
  console.log(`• Model: ${model}`);
  console.log("• Sending a minimal review request to OpenRouter...");

  const start = Date.now();
  try {
    const reviewer = createReviewer();
    const review = await reviewer.reviewCode("export const sum = (a: number, b: number) => a - b;");

    // Re-validate explicitly to prove the zod contract holds end-to-end.
    reviewSchema.parse(review);

    const { pass, overall } = computeVerdict(review.criteria);
    const ms = Date.now() - start;
    console.log(`✓ Integration OK in ${ms}ms`);
    console.log(`  overall: ${overall.toFixed(1)}, pass: ${pass}, findings: ${review.findings?.length ?? 0}`);
    console.log(JSON.stringify(review, null, 2));
  } catch (error) {
    console.error("✗ Integration check FAILED:");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void check();
