---
change_id: srs-review-session
type: external-research
source: Context7 (no library found) + algorithm spec synthesis
created: 2026-05-30
updated: 2026-05-30
question: What is the Leitner box algorithm spec needed to implement S-04, and is there a library for it?
---

# Leitner box spec for S-04

## Context7 result: nothing to fetch (this is the finding)

Three Context7 searches (`Leitner`, `leitner-box`, `spaced-repetition`) returned **no Leitner
library** — the only spaced-repetition packages it indexes are the FSRS family and SM-2
(`supermemo`, captured in [[supermemo-docs.md]]). This is not a gap to work around; it confirms
[[external-research.md]] and [[algorithm-decision.md]]: **Leitner is not a library — it is a
~15-line algorithm you hand-roll.** There is no `npm install` and no third-party doc, by design.
That zero-dependency property is exactly its advantage over SM-2 on the Workers edge runtime.

> Note for future agents: if you see "fetch Leitner docs via Context7", the answer is "there is
> nothing to fetch — it's hand-rolled." That absence is itself the decision-relevant fact.

## The algorithm (tailored to our schema)

Box index lives in the **existing `repetition_count` column** (0-indexed). No migration, no new
column, no dependency.

```ts
// Deliberately-simple Leitner scheduler. Pure function, edge-safe.
// Box index === cards.repetition_count. Interval per box, in days.
const BOX_INTERVALS_DAYS = [1, 2, 4, 7, 15, 30] as const; // 6 boxes; tune freely
const MAX_BOX = BOX_INTERVALS_DAYS.length - 1;

type Rating = "right" | "wrong";

interface Schedule {
  repetition_count: number; // new box
  interval_days: number;    // days until next due
  next_due_at: string;      // ISO timestamp
  last_reviewed_at: string; // ISO timestamp
}

function schedule(box: number, rating: Rating, now = Date.now()): Schedule {
  const nextBox = rating === "right" ? Math.min(box + 1, MAX_BOX) : 0; // wrong → reset
  const interval = BOX_INTERVALS_DAYS[nextBox];
  const nowIso = new Date(now).toISOString();
  return {
    repetition_count: nextBox,
    interval_days: interval,
    next_due_at: new Date(now + interval * 86_400_000).toISOString(),
    last_reviewed_at: nowIso,
  };
}
```

**Rules in one breath:** right → promote one box (capped at the top, where it stays
"graduated"); wrong → drop back to box 0. The box's fixed interval sets the next due date.

## Why it drops cleanly into the codebase

- **No schema delta.** Writes only `repetition_count`, `interval_days`, `next_due_at`,
  `last_reviewed_at` — all reserved by F-01 (see [[research.md]]). The `efactor` column and the
  `supermemo` dependency both vanish.
- **Consistent with S-02's initial state.** A freshly saved card is `repetition_count = 0`,
  `next_due_at = now()` → box 0, due immediately. First "right" → box 1 (2 days out); first
  "wrong" → stays box 0 (1 day out). No special-casing.
- **`check (interval_days >= 0)`** (the F-01 impl-review item) is trivially satisfied — intervals
  are always positive.

## The two queries S-04 needs

```sql
-- Due-card selection (the review session feed)
select * from public.cards
where status = 'saved' and next_due_at <= now()
order by next_due_at asc, last_reviewed_at asc nulls first  -- = Guardrails "oldest due first"
limit 1;                                                     -- one card at a time (US-02)
```

The `order by next_due_at asc` **is** the PRD Guardrails fallback ("oldest due-card first") — so
there is no separate fallback code path; the primary query already degrades to it. Backed by the
partial index F-01 deferred to S-04:

```sql
create index cards_due_idx on public.cards (user_id, next_due_at) where status = 'saved';
```

The per-rating write is a **single-row update** (`where id = ? and status = 'saved'`), so unlike
S-02's `finalize_drafts` it does **not** need an RPC — a plain user-scoped `supabase.update()`
suffices, and RLS keeps it owner-scoped (see [[research.md]] §2).

## Tuning knobs (decide in `/10x-plan`)

- **Box count / intervals.** `[1, 2, 4, 7, 15, 30]` is a sane default; could be Anki-like or pure
  `2^box`. More boxes = finer long-term spacing.
- **Box semantics for `interval_days`.** Stored value is informational (derivable from box), but
  writing it keeps the column meaningful and satisfies the `>= 0` check.
- **Graduation.** Cards at `MAX_BOX` repeat at the longest interval forever (no "retired" state) —
  matches "deliberately simple"; a retire/suspend state would be scope creep.

This is the Leitner counterpart to [[supermemo-docs.md]]; [[algorithm-decision.md]] recommends
Leitner for v1. Whichever `/10x-plan` confirms, the integration points in [[research.md]] are
identical.
