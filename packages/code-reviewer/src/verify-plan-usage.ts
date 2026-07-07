import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { buildReviewPrompt, createReviewAgent, defaultContextRoot, loadEnv } from "./index.js";

/**
 * Live plan-usage verifier — the change's final evidence artifact. Runs the
 * plan-aware reviewer over this branch's own code diff and asserts a `readPlan`
 * tool call actually fired, proving the reviewer consulted the plan rather than
 * scoring the diff blind. Read-only: no PR comments, labels, file writes, or
 * network beyond the single model call.
 *
 * Run with `npm run verify:plan`. Exits non-zero if no `readPlan` call occurred,
 * so a silent skip (the model jumping straight to the verdict) is caught. A bogus
 * `CHANGE_ID` degrades to a "no plan found" review and still exits 0 (diff-only) —
 * that graceful path lives in `readPlan` and is unit-tested; here `readPlan` still
 * fires (it just returns `found: false`), so the tool-call assertion holds.
 */

// A trimmed-empty env var (e.g. `CHANGE_ID=`) must fall through to the default, so
// check for `""`/undefined explicitly rather than `??` (which keeps the empty string).
const changeIdEnv = process.env.CHANGE_ID?.trim();
const CHANGE_ID = changeIdEnv === "" || changeIdEnv === undefined ? "m5l3-agent-read-plan-tool" : changeIdEnv;
const baseRefEnv = process.env.BASE_REF?.trim();
const BASE_REF = baseRefEnv === "" || baseRefEnv === undefined ? "main" : baseRefEnv;

/**
 * Capture the branch's own diff, scoped to `packages/code-reviewer` so the plan
 * is compared against the code — not the planning docs (F3) — and small enough to
 * review. Prefers `DIFF_FILE` when set; otherwise `git diff <base>...HEAD` (the
 * `...` form diffs from the merge-base, so commits landed on `base` don't leak in).
 */
function captureDiff(): string {
  const diffFile = process.env.DIFF_FILE;
  if (diffFile) return readFileSync(diffFile, "utf8");
  // `:/packages/code-reviewer` is a top-level (repo-root-anchored) magic pathspec, so
  // the scope is correct even though npm runs this with cwd = the package dir.
  return execFileSync("git", ["diff", `${BASE_REF}...HEAD`, "--", ":/packages/code-reviewer"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function main(): Promise<void> {
  loadEnv();
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set.");
    process.exitCode = 1;
    return;
  }

  const diff = captureDiff();
  if (!diff.trim()) {
    console.error(`No diff for packages/code-reviewer against ${BASE_REF}; nothing to review.`);
    process.exitCode = 1;
    return;
  }

  const contextRoot = defaultContextRoot();
  const agent = createReviewAgent(undefined, { changeId: CHANGE_ID, contextRoot });
  const result = await agent.generate({
    prompt: buildReviewPrompt(diff, { language: "typescript" }),
  });

  // Count `readPlan` calls across ALL steps. `result.toolCalls` reflects only the
  // last step — the structured-output generation, which makes no tool call — so a
  // `readPlan` fired in an earlier step would falsely read as 0. `result.steps`
  // aggregates every step. (Same reasoning as `ci.ts`.)
  const readPlanCalls = result.steps.flatMap((step) => step.toolCalls).filter((call) => call.toolName === "readPlan");

  console.log(`change id:           ${CHANGE_ID}`);
  console.log(`readPlan tool calls: ${readPlanCalls.length}`);
  console.log(`\nsummary:\n${result.output.summary}`);

  const pa = result.output.planAlignment;
  if (pa) {
    console.log(
      `\nplan alignment (planFound=${pa.planFound}): ` +
        `implemented=${pa.implemented.length} missing=${pa.missing.length} ` +
        `scopeDrift=${pa.scopeDrift.length} outOfPlan=${pa.outOfPlan.length}`,
    );
  }

  const findings = result.output.findings ?? [];
  if (findings.length > 0) {
    console.log(`\nfindings (${findings.length}):`);
    for (const f of findings) {
      console.log(`  [${f.severity}] ${f.title} — ${f.detail}`);
    }
  }

  if (readPlanCalls.length === 0) {
    console.error("\n✗ FAIL: the reviewer did not call `readPlan` — the plan was not consulted.");
    process.exitCode = 1;
    return;
  }
  console.log("\n✓ PASS: `readPlan` was called; the review compared the diff against the plan.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
