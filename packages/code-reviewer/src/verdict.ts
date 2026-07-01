import type { Criteria } from "./schemas.js";

/**
 * Deterministic pass/fail derivation from the six 1–10 criteria scores. Kept in
 * its own module (pure, no I/O) so the threshold is unit-testable and the agent's
 * structured output stays free of derived state — the model scores, code judges.
 *
 * Advisory-MVP rule: pass requires a solid overall mean AND a hard floor on the
 * two riskiest dimensions (correctness, security), so a strong average can't mask
 * a critical failure in either.
 */

/** Minimum overall mean for a passing review. */
export const PASS_THRESHOLD = 6;
/** Minimum implementation-correctness score for a passing review. */
export const CORRECTNESS_FLOOR = 6;
/** Minimum security-and-safety score for a passing review. */
export const SECURITY_FLOOR = 6;

/** Outcome of the threshold check. */
export interface VerdictResult {
  /** True iff the change clears the mean threshold and both hard floors. */
  pass: boolean;
  /** Mean of the six criterion scores (unrounded). */
  overall: number;
}

/** Derive pass/fail from the six criteria scores. */
export function computeVerdict(criteria: Criteria): VerdictResult {
  const scores = [
    criteria.implementationCorrectness.score,
    criteria.idiomaticity.score,
    criteria.complexityMaintainability.score,
    criteria.testsRiskCoverage.score,
    criteria.documentation.score,
    criteria.securitySafety.score,
  ];
  const overall = scores.reduce((total, score) => total + score, 0) / scores.length;
  const pass =
    overall >= PASS_THRESHOLD &&
    criteria.implementationCorrectness.score >= CORRECTNESS_FLOOR &&
    criteria.securitySafety.score >= SECURITY_FLOOR;
  return { pass, overall };
}
