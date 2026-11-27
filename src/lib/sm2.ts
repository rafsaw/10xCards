// SM-2 scheduler (Woźniak, 1990), written in-house. Pure function, edge-safe
// (Date / toISOString are V8 globals — no nodejs_compat dependency).
// See ADR 0002 and spec #76 for the decisions behind it.

const DAY_MS = 86_400_000;
export const EFACTOR_FLOOR = 1.3;

export type Rating = "again" | "hard" | "good" | "easy";

export interface Sm2State {
  repetition: number;
  efactor: number;
  interval_days: number;
}

export interface Sm2Schedule {
  repetition: number;
  efactor: number;
  interval_days: number;
  next_due_at: string;
  last_reviewed_at: string;
}

// EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)) for the SM-2 grades this app
// exposes: hard = q 3, good = q 4, easy = q 5. `q` survives only as provenance:
// the failure branch (Again) leaves EF untouched, so Again needs no grade.
const EFACTOR_DELTA: Record<Exclude<Rating, "again">, number> = {
  hard: -0.14,
  good: 0,
  easy: 0.1,
};

// I(n-1) * EF rounded up to whole days. The multiplication runs in hundredths
// of an ease-factor point so a product that is mathematically whole (180 * 1.35
// = 243) is not nudged over the integer by binary floating point and rounded up
// to a spurious extra day.
function stretch(intervalDays: number, efactor: number): number {
  return Math.ceil((intervalDays * Math.round(efactor * 100)) / 100);
}

// Every ease factor this module RETURNS goes through here: rounded to two
// decimals so the value is identical to what the numeric(4,2) column stores (the
// next Review echoes it back), and clamped at the floor so the column's CHECK
// stays off the normal path. Applied on the failure branch too, which does not
// change the factor but still must not hand back a value the column would
// reject or silently re-round.
function settleEfactor(efactor: number): number {
  return Math.max(EFACTOR_FLOOR, Math.round(efactor * 100) / 100);
}

export function schedule(state: Sm2State, rating: Rating, now: number = Date.now()): Sm2Schedule {
  // The failure branch: SM-2 step 6 — restart the repetitions from the
  // beginning without changing the ease factor. `repetition` goes back to 0, so
  // the next success gives 1 day and the one after 6.
  if (rating === "again") {
    return {
      repetition: 0,
      efactor: settleEfactor(state.efactor),
      interval_days: 1,
      next_due_at: new Date(now + DAY_MS).toISOString(),
      last_reviewed_at: new Date(now).toISOString(),
    };
  }

  const repetition = state.repetition + 1;
  const efactor = settleEfactor(state.efactor + EFACTOR_DELTA[rating]);
  // I(1) = 1 and I(2) = 6 are fixed; beyond that the stored interval is
  // stretched by the ease factor this rating just produced, and rounded up. The
  // grade therefore lands on *this* interval, which is what makes Hard lengthen
  // less than Good rather than only from the following Review on (spec #76).
  const interval = repetition === 1 ? 1 : repetition === 2 ? 6 : stretch(state.interval_days, efactor);
  return {
    repetition,
    efactor,
    interval_days: interval,
    next_due_at: new Date(now + interval * DAY_MS).toISOString(),
    last_reviewed_at: new Date(now).toISOString(),
  };
}
