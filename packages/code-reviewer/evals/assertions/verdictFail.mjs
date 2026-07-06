import { computeVerdict, reviewSchema } from "../../src/index.js";

/**
 * Deterministic Promptfoo assertion: prove the reviewer both returns a
 * schema-valid `Review` AND correctly **fails** the deliberately-flawed diff.
 *
 * It reuses the package's own contract (`reviewSchema` + `computeVerdict`) so the
 * eval exercises the real pass/fail rule rather than a re-declared one. Although
 * the provider already attaches a `verdict`, this assertion recomputes it from
 * `criteria` — that way it also re-runs the schema over the raw model output.
 *
 * Imports resolve from source (`../../src/index.js` → the sibling `.ts`) under
 * Promptfoo's TS loader, so no build step is required.
 *
 * @param {unknown} output - the provider's `output` (an already-parsed object).
 * @returns {{ pass: boolean, score: number, reason: string }} a Promptfoo GradingResult.
 */
export default function verdictFail(output) {
  const parsed = reviewSchema.safeParse(output);
  if (!parsed.success) {
    return {
      pass: false,
      score: 0,
      reason: `Output is not a schema-valid Review: ${parsed.error.message}`,
    };
  }

  const verdict = computeVerdict(parsed.data.criteria);
  const failedAsExpected = !verdict.pass;
  const overall = verdict.overall.toFixed(2);

  return {
    pass: failedAsExpected,
    score: failedAsExpected ? 1 : 0,
    reason: failedAsExpected
      ? `Schema-valid Review that correctly FAILED the flawed diff (overall ${overall}).`
      : `Schema-valid Review that wrongly PASSED the flawed diff (overall ${overall}); expected a fail.`,
  };
}
