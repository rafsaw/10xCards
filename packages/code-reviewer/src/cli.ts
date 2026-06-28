import { reviewCode } from "./agent.js";
import { loadEnv } from "./provider.js";

/**
 * Runnable entry for `npm start` — a smoke test of the review pipeline. Owns the
 * only side effects in the package; it is the direct-run entry (not imported by
 * the library, so no `import.meta.url` guard is needed).
 */
async function main(): Promise<void> {
  loadEnv();
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("Set OPENROUTER_API_KEY to run the demo. Example:\n" + "  OPENROUTER_API_KEY=sk-or-... npm start");
    process.exitCode = 1;
    return;
  }

  // Code from the first CLI arg, else the buggy subtraction sample.
  const code = process.argv[2] ?? `export function add(a, b) {\n  return a - b; // BUG: subtraction\n}`;
  const review = await reviewCode(code, { language: "typescript" });
  console.log(JSON.stringify(review, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
