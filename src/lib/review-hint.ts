import { schedule, type Rating, type Sm2State } from "@/lib/sm2";

// The text of /review's one hint line (#82), a pure function of the Card's
// scheduler state and the rating being inspected. It lives here rather than
// inline in ReviewSession.tsx so #82's AC "the interval shown matches what the
// server would schedule for that rating" is unit-testable at a mature Card
// state: the E2E spec can only reach a never-reviewed Card, where SM-2 gives
// every rating 1 day and a hint miswired to one fixed rating would still pass.

// Display names for the hint line. The buttons keep their own literal labels in
// the JSX: review-paper.test.ts asserts each label inside its own <Button>
// block, beside that button's variant and digit hint, and a map lookup there
// would defeat those per-button guards. So these four strings are deliberately
// a second spelling of the row's labels, and review-paper.test.ts pins the two
// lists to the same four names so they cannot drift apart.
const RATING_LABELS: Record<Rating, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

export function ratingHint(state: Sm2State, rating: Rating): string {
  // The real scheduler's answer, not a second copy of the arithmetic: the same
  // pure function POST /api/reviews runs server-side, fed the state the card
  // echoed back, for the one rating being inspected. `now` is pinned to 0
  // because only `interval_days` is read, which keeps this (and the render that
  // calls it) a pure function of its inputs.
  return `${RATING_LABELS[rating]} → back in ${schedule(state, rating, 0).interval_days} d`;
}
