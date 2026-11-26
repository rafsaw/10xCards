# SM-2 for the review schedule

Reviews are scheduled with SM-2 (Woźniak, 1990), written in-house as one pure function
rather than taken from a library. We chose it because graded ratings make per-Card
adaptivity usable, which is the whole point of the change, and because SM-2 has no
parameters to tune, so it gives adaptivity without inviting a tuning project.

The algorithm itself — state, grades, interval formulas and the two readings we had to
settle — is restated in [docs/sm2-algorithm.md](../sm2-algorithm.md), which is also the
oracle the tests are worked out from.

**The rating's effect on the ease factor lands before the interval is stretched**, so a
Card's new interval uses the ease factor the rating just produced. This departs from the
published step numbering, deliberately: we want "Hard lengthens less than Good" to be true
of the interval the reviewer is actually given, not only of the one after it. The price is
the first accepted weakness below.

**The stretch is computed in hundredths of an ease-factor point**, because binary floating
point would otherwise add a day the arithmetic does not call for. Recorded because it
reads like an accident; the mechanics are a comment in `src/lib/sm2.ts`.

## Considered Options

- **Leitner Boxes — used and abandoned.** This was the shipped schedule: a right Review
  moved a Card up one Box, a wrong Review sent it back to Box 0, each Box carrying a fixed
  interval. It was chosen for being the simplest thing to build and explain, and it
  rejected SM-2 for one reason only — with binary rating the ease factor would barely
  move, so the adaptivity would go unused. Graded ratings retire that objection, which is
  why the decision is reopened here rather than reversed on taste. Keeping Boxes and only
  widening the rating was also rejected: it delivers graded ratings with zero adaptivity,
  six fixed intervals for every Card and every user, which is the limitation this change
  exists to remove.
- **FSRS**: rejected, because it costs about six new columns and has no closed-form
  interval in FSRS-7, while its payoff is per-user weight tuning, which is out of scope and
  whose optimiser cannot run on Workers anyway; seeding it would also force a choice
  between discarding existing progress and fabricating a memory state.
- **The `supermemo` npm package**: rejected, because it updates the ease factor on a failed
  Review, which this model forbids. At roughly thirty lines of arithmetic, the dependency
  would mostly buy someone else's bug.

## Consequences

**One deliberate deviation from the published algorithm.** SM-2 says to repeat a session
until every Card scores at least 4; we drop that rule, and an Again Card returns tomorrow
instead. A single-pass review screen cannot loop a session, and we would rather deviate
once, visibly, than build a house variant.

**Three accepted weaknesses**, recorded so nobody "fixes" them without knowing they were
chosen:

- **Hard always lengthens an interval**, just less than Good. Hard is a pass, so the
  repetition advances, and with the ease factor floored at 1.3 the interval cannot shrink.
  The one-line fix — Hard does not advance the repetition — was rejected because a second
  deviation would make this "an SM-2-like scheduler of ours", eroding the honesty of
  having chosen it over Leitner Boxes with four ratings.
- **One lapse on a mature Card destroys the whole interval.** A Card held for a year drops
  to 1 day on a single Again.
- **The 30-day Box cap is gone with no replacement ceiling**, which is the intent, not an
  oversight. The only implicit ceilings are the `interval_days` column type and the
  JavaScript `Date` range, and both are unreachable and loud rather than silent: every
  Review pushes `next_due_at` further into the future and the endpoint only accepts due
  Cards. A sanity cap was rejected because it would turn a pathological Card into a 500 for
  no benefit.

**No review history is stored.** See [ADR 0003](./0003-no-review-history.md).
