import { readFileSync } from "node:fs";

import { reviewCode } from "./agent.js";
import { loadEnv } from "./provider.js";
import { computeVerdict } from "./verdict.js";

/**
 * CI entry — the PR-reviewer counterpart to the `cli.ts` smoke harness. Reads PR
 * title/body from the environment and the diff from a file path (both kept off the
 * shell command line to avoid injection from attacker-controlled PR text), runs the
 * agent, derives a pass/fail verdict, and prints a single JSON object the composite
 * action consumes. `reviewCode` and its signature are untouched.
 */

/** PR descriptions can be long; cap the body to bound token cost. */
const MAX_BODY_CHARS = 2000;

async function main(): Promise<void> {
  loadEnv();
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set.");
    process.exitCode = 1;
    return;
  }

  const diffFile = process.env.DIFF_FILE;
  if (!diffFile) {
    console.error("DIFF_FILE is not set (path to the diff file to review).");
    process.exitCode = 1;
    return;
  }

  const title = process.env.PR_TITLE ?? "";
  const body = (process.env.PR_BODY ?? "").slice(0, MAX_BODY_CHARS);
  const diff = readFileSync(diffFile, "utf8");

  const context = [`PR title: ${title}`, body ? `PR description:\n${body}` : null].filter(Boolean).join("\n\n");

  const review = await reviewCode(diff, { language: "typescript", context });
  const { pass, overall } = computeVerdict(review.criteria);

  console.log(JSON.stringify({ ...review, overall, pass }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
