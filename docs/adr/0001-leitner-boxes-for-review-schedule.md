# Leitner Boxes for the review schedule

Reviews are scheduled with Leitner Boxes: a right Review moves a Card up one Box, a wrong Review sends it back to Box 0, and each Box has a fixed interval that grows with the Box. We chose it because it was the simplest option to build and to explain. The interval values live in code and are tunable without a new decision.

## Considered Options

- **SM-2**: rejected, because with binary rating (right/wrong) its per-card easiness factor barely moves, so its adaptivity would go unused; it would also need an extra column and a new library.
- **FSRS**: rejected as too complex for v1.
- **Random shuffle (no spaced repetition)**: rejected in the PRD; spaced repetition is the core of the product.

## Consequences

This decision depends on binary rating. Adding graded ratings (e.g. again/hard/good/easy) is the trigger to revisit it.
