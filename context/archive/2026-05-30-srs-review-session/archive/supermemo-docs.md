---
change_id: srs-review-session
type: external-research
source: Context7 (/viendinhcom/supermemo)
created: 2026-05-30
updated: 2026-05-30
question: What is the supermemo (SM-2) API and how does it map onto S-04 (binary review + persisted next_due)?
---

# SuperMemo (SM-2) docs — `supermemo` by VienDinhCom

Library docs fetched via Context7 (`/viendinhcom/supermemo`) to back the S-04 scheduling
choice. Pairs with `external-research.md` (which names this lib as the primary pick). Pure
function, zero-dep → edge-safe on Cloudflare Workers (`nodejs_compat`), resolving the open
follow-up about Workers compatibility — it is plain arithmetic, no Node built-ins.

- Source: https://github.com/viendinhcom/supermemo (README)
- License: MIT · ~12.5KB · ~1.8K weekly downloads, since 2020
- Install: `npm install --save supermemo`

## Core API

```ts
import { supermemo, SuperMemoItem, SuperMemoGrade } from 'supermemo';

type SuperMemoItem  = { interval: number; repetition: number; efactor: number };
type SuperMemoGrade = 0 | 1 | 2 | 3 | 4 | 5;

function supermemo(item: SuperMemoItem, grade: SuperMemoGrade): SuperMemoItem;
```

**Item fields** (initial values for a fresh card):

| Field        | Initial | Meaning                                                        |
| ------------ | ------- | -------------------------------------------------------------- |
| `repetition` | `0`     | Number of continuous correct responses                         |
| `interval`   | `0`     | Inter-repetition interval after the repetitions (in days)      |
| `efactor`    | `2.5`   | Easiness factor — how easy the item is to memorize/retain      |

**Grades (`SuperMemoGrade`):**

| Grade | Meaning                                              |
| ----- | ---------------------------------------------------- |
| `5`   | Perfect response                                     |
| `4`   | Correct response after a hesitation                  |
| `3`   | Correct response recalled with serious difficulty    |
| `2`   | Incorrect response; correct one seemed easy to recall |
| `1`   | Incorrect response; the correct one remembered       |
| `0`   | Complete blackout                                    |

`supermemo(item, grade)` returns a **new** updated `SuperMemoItem` (immutable; reassign).

## Basic usage

```ts
let item: SuperMemoItem = { interval: 0, repetition: 0, efactor: 2.5 };

item = supermemo(item, 5); // perfect recall → interval/repetition advance
item = supermemo(item, 4); // correct after hesitation
```

## Persisting `next_due` across sessions (FR-015)

The README integrates dayjs, but the dep is not required — plain `Date` works and stays
edge-safe:

```ts
function review(card: SuperMemoItem, grade: SuperMemoGrade) {
  const { interval, repetition, efactor } = supermemo(card, grade);
  const nextDue = new Date(Date.now() + interval * 86_400_000).toISOString();
  return { interval, repetition, efactor, nextDue };
}
```

README's dayjs variant for reference:

```ts
const dueDate = dayjs(Date.now()).add(interval, 'day').toISOString();
```

**Schema delta on `cards`:** three numeric columns (`interval`, `repetition`, `efactor`)
plus the existing due-date field. Cross-check against F-01's reserved schedule fields via
internal `/10x-research` before `/10x-plan`.

## Binary FR-014 mapping (the one design decision)

SM-2 takes a 0–5 grade; S-04 review is binary right/wrong. Collapse it:

- **wrong → `grade = 2`** (or lower) → resets `repetition` to 0, interval back to ~1 day.
- **right → `grade = 4`** (clean "correct") → advances normally.

Using `2`/`4` rather than the extremes `0`/`5` keeps `efactor` from swinging too hard on a
binary signal. This is the only judgment call; the rest is the library's math.

## Fit with roadmap constraints

- ✅ Simple model, no over-engineering (PRD §Non-Goals) — real SM-2, not hand-rolled.
- ✅ Binary mapping is trivial (above).
- ✅ Output reduces to a date + 3 numeric fields (FR-015).
- ✅ Fallback "oldest due-card first" (PRD Guardrails) lives in the query layer, independent
  of this lib.
- ✅ Edge-safe on Workers — pure arithmetic, zero-dep.
