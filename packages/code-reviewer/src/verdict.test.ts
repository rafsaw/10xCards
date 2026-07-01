import { describe, expect, it } from "vitest";

import type { Criteria } from "./schemas.js";
import { computeVerdict } from "./verdict.js";

/** Build a full `Criteria` object from a per-key score map (rationale unused). */
function makeCriteria(scores: Record<keyof Criteria, number>): Criteria {
  return {
    implementationCorrectness: { score: scores.implementationCorrectness, rationale: "" },
    idiomaticity: { score: scores.idiomaticity, rationale: "" },
    complexityMaintainability: { score: scores.complexityMaintainability, rationale: "" },
    testsRiskCoverage: { score: scores.testsRiskCoverage, rationale: "" },
    documentation: { score: scores.documentation, rationale: "" },
    securitySafety: { score: scores.securitySafety, rationale: "" },
  };
}

const allSixes: Record<keyof Criteria, number> = {
  implementationCorrectness: 6,
  idiomaticity: 6,
  complexityMaintainability: 6,
  testsRiskCoverage: 6,
  documentation: 6,
  securitySafety: 6,
};

describe("computeVerdict", () => {
  it("passes at the boundary when every criterion is exactly 6", () => {
    const result = computeVerdict(makeCriteria(allSixes));
    expect(result.pass).toBe(true);
    expect(result.overall).toBe(6);
  });

  it("passes with uniformly high scores", () => {
    const result = computeVerdict(
      makeCriteria({
        implementationCorrectness: 9,
        idiomaticity: 8,
        complexityMaintainability: 9,
        testsRiskCoverage: 8,
        documentation: 7,
        securitySafety: 9,
      }),
    );
    expect(result.pass).toBe(true);
  });

  it("fails when security is below the floor despite a high mean", () => {
    const result = computeVerdict(
      makeCriteria({
        implementationCorrectness: 10,
        idiomaticity: 10,
        complexityMaintainability: 10,
        testsRiskCoverage: 10,
        documentation: 10,
        securitySafety: 5,
      }),
    );
    expect(result.pass).toBe(false);
  });

  it("fails when implementation correctness is below the floor despite a high mean", () => {
    const result = computeVerdict(
      makeCriteria({
        implementationCorrectness: 5,
        idiomaticity: 10,
        complexityMaintainability: 10,
        testsRiskCoverage: 10,
        documentation: 10,
        securitySafety: 10,
      }),
    );
    expect(result.pass).toBe(false);
  });

  it("fails when the overall mean is below the threshold even with floors met", () => {
    const result = computeVerdict(
      makeCriteria({
        implementationCorrectness: 6,
        idiomaticity: 3,
        complexityMaintainability: 3,
        testsRiskCoverage: 3,
        documentation: 3,
        securitySafety: 6,
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.overall).toBeCloseTo(4);
  });
});
