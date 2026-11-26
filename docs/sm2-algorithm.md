# SM-2, as this app implements it

A restatement of SM-2 (Woźniak, 1990) with the two ambiguities this app had to resolve
settled explicitly. It exists so tests have an oracle: expected values are worked out
from this document by hand, **never read off `src/lib/sm2.ts`**. If this document and the
implementation disagree, the implementation is wrong until a new decision says otherwise.

For _why_ SM-2 and what we accept by choosing it, see [ADR 0002](./adr/0002-sm2-for-review-schedule.md).

## State

Each Card carries three values: `repetition` (n), `efactor` (EF) and `interval_days`.
A new Card starts at n = 0, EF = 2.5, interval 0.

## Ratings

The app exposes four ratings. Three are passes and map onto SM-2 grades; Again is the
failure branch and needs no grade, because failure leaves EF untouched.

| Rating | SM-2 grade q | Effect on EF |
| ------ | ------------ | ------------ |
| Again  | —            | unchanged    |
| Hard   | 3            | −0.14        |
| Good   | 4            | 0            |
| Easy   | 5            | +0.10        |

Those deltas are the published formula evaluated at q = 3, 4, 5:

```
EF' = EF + (0.1 − (5 − q) × (0.08 + (5 − q) × 0.02))
```

Hard and Easy are therefore asymmetric (−0.14 against +0.10). That is the shape of the
formula, not a choice. EF never falls below **1.3**; there is no ceiling.

## Intervals

```
I(1) = 1
I(2) = 6
I(n) = I(n−1) × EF,  rounded up to whole days
```

On a pass, n increments. On Again, **n resets to 0** (not 1) and the interval becomes
1 day, so the next pass gives 1 day and the one after 6.

### Resolved ambiguity 1: the rating lands before the stretch

`I(n)` uses the EF **that the rating just produced**, not the EF the Card arrived with.
The published step numbering reads the other way, and the two readings differ materially:
under the other one, Hard and Good yield an identical interval and Hard's effect appears
only at the _following_ Review.

Worked example — a mature Card at n = 2, EF = 2.50, interval 6 days:

| Rating | EF after | Interval            |
| ------ | -------- | ------------------- |
| Hard   | 2.36     | ceil(6 × 2.36) = 15 |
| Good   | 2.50     | ceil(6 × 2.50) = 15 |
| Easy   | 2.60     | ceil(6 × 2.60) = 16 |

Hard and Good tie here only because rounding up swallows the difference between 14.16 and
15.0. The gap is real further out: from a 100-day interval at EF 2.50, Hard gives 236 days
and Good 250.

### Resolved ambiguity 2: a mathematically whole product stays whole

`I × EF` is exact decimal arithmetic in two decimal places. From interval 180 at EF 1.35
the answer is **243 days, not 244** — 180 × 1.35 is exactly 243, so rounding up adds
nothing. (Binary floating point would make this 243.000…3; how the implementation avoids
that is a comment in `src/lib/sm2.ts`, not a property of the algorithm.)

## One deviation from the published algorithm

SM-2 repeats a session until every Card scores at least 4. This app does not loop a
session; an Again Card returns tomorrow instead. See ADR 0002.
