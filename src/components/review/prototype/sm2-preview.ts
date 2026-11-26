// PROTOTYPE — throwaway. Not production code, no tests, do not merge to main.
//
// Minimal SM-2 preview for issue #71's prototype: enough to put a real number on
// a rating button. Mirrors the algorithm decided in #72 (`src/lib/sm2.ts` does
// not exist yet), so the intervals on screen are the ones we would actually ship.
//
//   again -> failure branch: repetition = 0, interval = 1 day, EF untouched
//   hard / good / easy -> q = 3 / 4 / 5, dEF = -0.14 / 0 / +0.10
//   interval: n = 0 -> 1 d, n = 1 -> 6 d, n >= 2 -> round(prev interval * EF)
//
// EF is rounded to 2 decimals and clamped at 1.3 (the clamp #75 asks for).

export type Rating = "again" | "hard" | "good" | "easy";

export const RATINGS: Rating[] = ["again", "hard", "good", "easy"];

export interface CardState {
  repetition: number;
  efactor: number;
  interval_days: number;
}

const EF_DELTA: Record<Exclude<Rating, "again">, number> = {
  hard: -0.14,
  good: 0,
  easy: 0.1,
};

export function schedule(state: CardState, rating: Rating): CardState {
  if (rating === "again") {
    return { repetition: 0, interval_days: 1, efactor: state.efactor };
  }

  const efactor = Math.max(1.3, Math.round((state.efactor + EF_DELTA[rating]) * 100) / 100);
  const repetition = state.repetition + 1;
  const interval_days =
    repetition === 1 ? 1 : repetition === 2 ? 6 : Math.max(1, Math.round(state.interval_days * efactor));

  return { repetition, efactor, interval_days };
}

/** What every button would do to this card — the data an interval-showing button renders. */
export function previewAll(state: CardState): Record<Rating, CardState> {
  return {
    again: schedule(state, "again"),
    hard: schedule(state, "hard"),
    good: schedule(state, "good"),
    easy: schedule(state, "easy"),
  };
}

/** "6 d", "1 d", "3 mo" — short enough to sit inside a button label. */
export function formatInterval(days: number): string {
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  if (months < 18) return `${months} mo`;
  return `${Math.round(days / 365)} y`;
}

/** "Mon 2 Dec" — the absolute date, for variants that spell out the consequence. */
export function formatDueDate(days: number, now: number = Date.now()): string {
  return new Date(now + days * 86_400_000).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export const RATING_LABEL: Record<Rating, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};
