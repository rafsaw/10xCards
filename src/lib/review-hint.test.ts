import { describe, expect, it } from "vitest";
import { ratingHint } from "@/lib/review-hint";
import type { Sm2State } from "@/lib/sm2";

/**
 * #82 AC6: "The interval shown matches what the server would schedule for that
 * rating." The E2E spec proves the hint follows hover and focus, but it does so
 * on a never-reviewed Card, where SM-2 gives EVERY rating 1 day — so a hint
 * miswired to one fixed rating would pass there. This file closes that hole by
 * asserting the four hints at a MATURE state, where the four answers differ.
 *
 * Oracle discipline: the expected intervals below are worked out by hand from
 * docs/sm2-algorithm.md / spec #76, not read off the implementation. For
 * repetition 2, ease factor 2.50, interval 6 days, with the rating's delta
 * landing BEFORE the stretch (docs/sm2-algorithm.md):
 *   Hard  EF 2.50 - 0.14 = 2.36 -> ceil(6 x 2.36) = ceil(14.16) = 15
 *   Good  EF 2.50          = 2.50 -> ceil(6 x 2.50) = 15
 *   Easy  EF 2.50 + 0.10 = 2.60 -> ceil(6 x 2.60) = ceil(15.6)  = 16
 *   Again failure branch -> 1 (and the repetition resets)
 * docs/sm2-algorithm.md tabulates the same three numbers.
 */

/** A mature Card: two successful recalls behind it, sitting on the fixed I(2). */
const MATURE: Sm2State = { repetition: 2, efactor: 2.5, interval_days: 6 };

describe("ratingHint — what the hint line says about a rating", () => {
  const CASES: [rating: "again" | "hard" | "good" | "easy", expected: string][] = [
    ["again", "Again → back in 1 d"],
    ["hard", "Hard → back in 15 d"],
    ["good", "Good → back in 15 d"],
    ["easy", "Easy → back in 16 d"],
  ];

  it.each(CASES)("a mature card's %s hint reads %s", (rating, expected) => {
    expect(ratingHint(MATURE, rating)).toBe(expected);
  });

  it("the four hints are four different claims, not one answer repeated", () => {
    // The hole this file exists to close: on a never-reviewed card every rating
    // gives 1 d, so a hint wired to a single fixed rating is indistinguishable
    // from a correct one. At a mature state Easy must differ from Good, and
    // Again must differ from both.
    const hints = CASES.map(([rating]) => ratingHint(MATURE, rating));
    expect(new Set(hints).size).toBe(4);
  });

  it("names the rating the user is inspecting, so the line is readable alone", () => {
    for (const [rating, expected] of CASES) {
      const label = rating[0].toUpperCase() + rating.slice(1);
      expect(expected.startsWith(`${label} `)).toBe(true);
    }
  });

  it("a never-reviewed card's first success is one day, from I(1) = 1", () => {
    // The state the E2E spec actually exercises, kept here so the mature case
    // above is an addition to that coverage rather than a replacement.
    const fresh: Sm2State = { repetition: 0, efactor: 2.5, interval_days: 0 };
    expect(ratingHint(fresh, "good")).toBe("Good → back in 1 d");
  });
});
