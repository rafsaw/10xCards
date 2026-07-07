import { readFileSync } from "node:fs";

import { createReviewAgent } from "./agent.js";
import type { PlanContext } from "./agent.js";
import { buildReviewPrompt } from "./prompts.js";
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

  // Optional change-id from the CI action (derived from the PR branch). An unset
  // or empty value degrades to a plain diff-only review, identical to before.
  const changeIdRaw = process.env.CHANGE_ID?.trim();
  const changeId = changeIdRaw === "" ? undefined : changeIdRaw;

  // Build the agent directly (rather than via `reviewCode`) so we can read the
  // tool-call trace: the plan-aware path attaches `readPlan` and we observe
  // whether it fired. `contextRoot` defaults to `<cwd>/../../context`.
  const planContext: PlanContext | undefined = changeId ? { changeId } : undefined;
  const agent = createReviewAgent(undefined, planContext);
  const result = await agent.generate({
    prompt: buildReviewPrompt(diff, { language: "typescript", context }),
  });
  const review = result.output;
  const { pass, overall } = computeVerdict(review.criteria);

  // stdout carries the single review JSON (contract unchanged). The tool-call
  // trace goes to stderr only, so the composite action's stdout parse is untouched.
  // Count across ALL steps: `result.toolCalls` reflects only the last step, which
  // is the structured-output generation (no tool call), so `readPlan` — fired in an
  // earlier step — would falsely read as 0. `result.steps` aggregates every step.
  if (changeId) {
    const planToolCalls = result.steps
      .flatMap((step) => step.toolCalls)
      .filter((call) => call.toolName === "readPlan").length;
    console.error(`plan tool calls: ${planToolCalls} (readPlan)`);
  }

  console.log(JSON.stringify({ ...review, overall, pass }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
