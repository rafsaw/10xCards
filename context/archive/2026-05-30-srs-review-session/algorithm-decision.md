---
change_id: srs-review-session
type: decision-analysis
source: synthesis of research.md + external-research.md + supermemo-docs.md
created: 2026-05-30
updated: 2026-05-30
question: For S-04 with binary right/wrong rating, which simple SR model is better — SM-2 or Leitner?
status: recommendation (resolve in /10x-plan, Open Question #1)
---

# SM-2 vs Leitner for S-04 (decision analysis)

Comparison grounded in this project's constraints (binary rating FR-014, "deliberately simple"
per PRD §Non-Goals, persisted next-due + numeric fields, edge-safe Workers, Guardrails fallback
"oldest due first"). Pairs with [[research.md]] (schema delta), `external-research.md` (library
survey), `supermemo-docs.md` (SM-2 API). FSRS family already ruled out for v1.

## How each behaves

- **Leitner boxes** — cards sit in numbered boxes with fixed intervals (box 1 = 1 day, then 2, 4,
  8, 16… ≈ `2^box` days). Right → promote one box. Wrong → reset to box 1. That's the whole
  algorithm.
- **SM-2** — tracks `interval`, `repetition`, `efactor` (easiness, init 2.5). First two correct
  reviews give fixed intervals (1 day, then 6); afterwards `interval = previous × efactor`, and
  `efactor` drifts based on the grade. Wrong resets `repetition` to 0.

## The decisive lens: we feed it *binary* input

FR-014 gives only right/wrong, collapsed to fixed grades (`right→4`, `wrong→2`). SM-2's main
edge over Leitner is per-card `efactor` adaptation based on *how hard* a recall was — but with a
fixed grade every time, **`efactor` barely moves and most of SM-2's intelligence is inert.**
Under binary input SM-2 degenerates toward "Leitner with multiplicative intervals." The only
surviving difference is interval *shape*: SM-2 grows intervals more smoothly/geometrically;
Leitner is coarser steps. Both are fine for an MVP.

## Scored against constraints

| Criterion | SM-2 (`supermemo` lib) | Leitner (hand-rolled ~15 lines) |
| --- | --- | --- |
| Schema impact | **+`efactor` column** (migration) | **Zero migration** — reuse `repetition_count` as box |
| Fits binary FR-014 | Works, adaptivity wasted | Native — binary *is* the model |
| "Deliberately simple" (Non-Goals) | Good | Best — literal floor of simple |
| New dependency | +1 dep (12.5KB, edge-safe) or inline | None |
| Interval quality | Smoother growth | Coarser, fine for MVP |
| Maps to F-01 fields | `interval`/`repetition` exact; +efactor | `repetition_count`=box; `interval_days` derived |
| Resume/debug clarity | Slightly opaque (efactor math) | Trivially inspectable |

## Recommendation: **Leitner for v1**

The less-obvious answer, chosen deliberately:

1. **Zero schema delta.** SM-2's extra cost (the `efactor` migration + `check` + numeric-vs-round
   question) buys adaptivity that binary input can't exercise — you'd store a number that stays
   near 2.5 forever.
2. **It *is* the binary model.** Right = promote, wrong = reset. No grade-collapse hack, no
   judgment call about whether `right` means 4 or 5.
3. **Matches the Guardrails fallback.** "Oldest due-card first" and box-based intervals share one
   mental model — no impedance mismatch.
4. **No new edge-runtime dependency** to vet.

**Choose SM-2 instead only if** rating is expected to become multi-grade (again/hard/good/easy)
soon — then `efactor` earns its keep and starting on SM-2 avoids a re-migration. But the PRD
parks multi-grade as a "v2 lever," and the real v2 destination is FSRS (`ts-fsrs`), not SM-2's
efactor — which weakens the forward-compat argument for SM-2 now.

**Caveat:** F-01 *named* SM-2 and the column names (`interval_days`, `repetition_count`) were
clearly chosen with it in mind — real ergonomic tidiness. But field-name fit shouldn't outweigh
"the algorithm's headline feature is dead weight under binary input."

## Net

- **v1:** Leitner — simplest, no migration, honest fit for binary rating.
- **v2:** SM-2 or (more likely) FSRS, once richer rating justifies the adaptivity.

This resolves [[research.md]] Open Question #1 pending confirmation in `/10x-plan`. If Leitner is
accepted, the `efactor` column and the SM-2 dependency both drop out of scope; the only schedule
write is `interval_days` (from box) + `next_due_at` + `last_reviewed_at`, plus the
`check (interval_days >= 0)` constraint and the partial due-query index still apply.
