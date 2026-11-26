import { describe, expect, it } from "vitest";
import { schedule, type Rating, type Sm2State } from "@/lib/sm2";

// Oracle discipline: every expected number below is worked out by hand from the
// published SM-2 algorithm (Woźniak, 1990) as restated in the spec (#76):
//   I(1) = 1, I(2) = 6, I(n) = I(n-1) * EF, rounded UP to whole days, no ceiling;
//   EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))  =>  hard -0.14, good 0, easy +0.10;
//   a failure (Again) restarts the repetitions without changing EF.
// Nothing here is read off sm2.ts.

const NOW = Date.UTC(2026, 0, 15, 12, 0, 0); // 2026-01-15T12:00:00.000Z
const DAY = 86_400_000;

function state(overrides: Partial<Sm2State> = {}): Sm2State {
  return { repetition: 0, efactor: 2.5, interval_days: 0, ...overrides };
}

describe("schedule — the fixed ladder", () => {
  it("gives a never-reviewed Card a first interval of 1 day", () => {
    expect(schedule(state(), "good", NOW)).toEqual({
      repetition: 1,
      efactor: 2.5,
      interval_days: 1,
      next_due_at: new Date(NOW + 1 * DAY).toISOString(),
      last_reviewed_at: new Date(NOW).toISOString(),
    });
  });

  it("gives the second repetition the fixed 6 days, whatever the ease factor", () => {
    expect(schedule(state({ repetition: 1, interval_days: 1, efactor: 1.9 }), "good", NOW)).toMatchObject({
      repetition: 2,
      interval_days: 6,
      next_due_at: new Date(NOW + 6 * DAY).toISOString(),
    });
  });
});

describe("schedule — I(n) = I(n-1) * EF, rounded up to whole days", () => {
  // Worked by hand at EF 2.50: 6 -> 15 -> 37.5 -> 95 -> 237.5, each rounded up.
  const ladder: { from: number; expected: number }[] = [
    { from: 6, expected: 15 }, // 6 * 2.5 = 15 exactly
    { from: 15, expected: 38 }, // 37.5 rounds up, not to 37 or 38-by-rounding-half
    { from: 38, expected: 95 }, // 95 exactly
    { from: 95, expected: 238 }, // 237.5 rounds up
  ];

  it.each(ladder)("stretches a $from-day interval to $expected days at EF 2.50", ({ from, expected }) => {
    expect(schedule(state({ repetition: 3, interval_days: from }), "good", NOW)).toMatchObject({
      repetition: 4,
      interval_days: expected,
      next_due_at: new Date(NOW + expected * DAY).toISOString(),
    });
  });

  // 6 * 2.36 = 14.16: rounding up gives 15, rounding to nearest would give 14.
  it("rounds a fractional interval up rather than to the nearest day", () => {
    expect(schedule(state({ repetition: 2, interval_days: 6, efactor: 2.36 }), "good", NOW)).toMatchObject({
      interval_days: 15,
    });
  });

  it("stretches by the ease factor the Card arrived with, before this rating moves it", () => {
    // Published order: the interval for this repetition uses the item's current
    // EF (step 3); EF is only modified afterwards (step 5). 6 * 2.50 = 15, not
    // 6 * 2.60 = 15.6 -> 16, even though Easy raises EF to 2.60.
    expect(schedule(state({ repetition: 2, interval_days: 6, efactor: 2.5 }), "easy", NOW)).toMatchObject({
      interval_days: 15,
      efactor: 2.6,
    });
  });
});

describe("schedule — ease factor deltas, exact to two decimals", () => {
  // From the neutral 2.50 start: hard -0.14, good 0, easy +0.10.
  const deltas: { rating: Rating; expected: number }[] = [
    { rating: "hard", expected: 2.36 },
    { rating: "good", expected: 2.5 },
    { rating: "easy", expected: 2.6 },
  ];

  it.each(deltas)("moves EF 2.50 to $expected on $rating", ({ rating, expected }) => {
    expect(schedule(state({ repetition: 2, interval_days: 6 }), rating, NOW).efactor).toBe(expected);
  });

  it("keeps the ease factor at two decimals over a run of ratings", () => {
    // 2.50 -hard-> 2.36 -hard-> 2.22 -easy-> 2.32 -hard-> 2.18
    let efactor = 2.5;
    for (const rating of ["hard", "hard", "easy", "hard"] as Rating[]) {
      efactor = schedule(state({ repetition: 3, interval_days: 10, efactor }), rating, NOW).efactor;
    }
    expect(efactor).toBe(2.18);
  });
});

describe("schedule — the 1.30 ease factor floor", () => {
  it("stops a run of Hard ratings at 1.30 and never returns a value below it", () => {
    // 2.50 falls by 0.14 a time: 2.36, 2.22, 2.08, 1.94, 1.80, 1.66, 1.52, 1.38,
    // then 1.24 — which is below the floor, so the floor is what comes back.
    const expected = [2.36, 2.22, 2.08, 1.94, 1.8, 1.66, 1.52, 1.38, 1.3, 1.3, 1.3, 1.3];
    const seen: number[] = [];
    let efactor = 2.5;
    for (const _step of expected) {
      efactor = schedule(state({ repetition: 3, interval_days: 10, efactor }), "hard", NOW).efactor;
      seen.push(efactor);
    }
    expect(seen).toEqual(expected);
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(1.3);
  });

  it("holds an already-floored Card at 1.30 on Hard", () => {
    expect(schedule(state({ repetition: 4, interval_days: 20, efactor: 1.3 }), "hard", NOW).efactor).toBe(1.3);
  });
});

describe("schedule — the Again (failure) branch", () => {
  it("restarts a mature Card tomorrow, at repetition 0, with its ease factor untouched", () => {
    expect(schedule(state({ repetition: 7, interval_days: 240, efactor: 1.86 }), "again", NOW)).toEqual({
      repetition: 0,
      efactor: 1.86,
      interval_days: 1,
      next_due_at: new Date(NOW + 1 * DAY).toISOString(),
      last_reviewed_at: new Date(NOW).toISOString(),
    });
  });

  it("leaves a floored ease factor exactly at the floor rather than touching it", () => {
    expect(schedule(state({ repetition: 3, interval_days: 30, efactor: 1.3 }), "again", NOW).efactor).toBe(1.3);
  });

  it("resets to 0, so the next success gives 1 day and the one after 6", () => {
    const lapsed = schedule(state({ repetition: 5, interval_days: 95 }), "again", NOW);
    expect(lapsed.repetition).toBe(0);

    const first = schedule({ ...lapsed, repetition: lapsed.repetition }, "good", NOW);
    expect(first).toMatchObject({ repetition: 1, interval_days: 1 });

    const second = schedule(first, "good", NOW);
    expect(second).toMatchObject({ repetition: 2, interval_days: 6 });
  });
});

describe("schedule — the injected clock", () => {
  const ratings: Rating[] = ["again", "hard", "good", "easy"];

  it.each(ratings)("fixes both timestamps off the injected now for %s", (rating) => {
    const result = schedule(state({ repetition: 3, interval_days: 10 }), rating, NOW);
    expect(result.last_reviewed_at).toBe("2026-01-15T12:00:00.000Z");
    expect(result.next_due_at).toBe(new Date(NOW + result.interval_days * DAY).toISOString());
  });

  it("keeps the same time of day when the interval crosses a month boundary", () => {
    const lateJanuary = Date.UTC(2026, 0, 25, 7, 30, 0);
    expect(schedule(state({ repetition: 1, interval_days: 1 }), "good", lateJanuary)).toMatchObject({
      interval_days: 6,
      next_due_at: "2026-01-31T07:30:00.000Z",
      last_reviewed_at: "2026-01-25T07:30:00.000Z",
    });
  });
});

describe("schedule — no ceiling on the interval", () => {
  it("keeps growing past the old 30-day cap over a run of Good ratings", () => {
    // From a never-reviewed Card at EF 2.50, worked by hand:
    // 1, 6, 15, 37.5->38, 95, 237.5->238, 595, 1487.5->1488.
    const expected = [1, 6, 15, 38, 95, 238, 595, 1488];
    const seen: number[] = [];
    let current = state();
    for (const _step of expected) {
      const next = schedule(current, "good", NOW);
      seen.push(next.interval_days);
      current = { repetition: next.repetition, efactor: next.efactor, interval_days: next.interval_days };
    }
    expect(seen).toEqual(expected);
  });

  it("does not add a spurious day when the stretched interval is a whole number", () => {
    // 180 * 1.35 = 243 days exactly; binary floating point computes the product
    // as 243.00000000000003, which must not round up to 244.
    expect(schedule(state({ repetition: 5, interval_days: 180, efactor: 1.35 }), "good", NOW)).toMatchObject({
      interval_days: 243,
    });
  });
});
