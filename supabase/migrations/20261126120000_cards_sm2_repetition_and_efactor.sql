-- SM-2 replaces Leitner Boxes as the review schedule (see docs/adr/0002-sm2-for-review-schedule.md).
-- Two steps, and no data migration at all: no UPDATE, no backfill, and next_due_at
-- untouched by construction, so every existing Card stays due exactly when it was
-- already due and keeps its accumulated progress.
--
--   1. The Box index becomes SM-2's repetition number n. RENAME COLUMN is
--      metadata-only: values, the NOT NULL constraint, the default 0, the
--      cards_due_idx index and the RLS policies all carry over unchanged.
--      Seeding rule: repetition = box, as-is. From box 2 up this is identical to
--      box + 2 (both land on I x EF); below it nothing is lost (box 0 -> 1 day,
--      conservative and correct for a just-failed Card; box 1 -> 6 days, a jump up
--      from today's 4). Never-reviewed Cards need no special case: their first
--      Good gives repetition 1 -> 1 day.
--   2. efactor is SM-2's per-Card ease factor. numeric(4,2), not floating point:
--      the deltas (-0.14 / 0 / +0.10) are exact to two decimals from a 2.5 start.
--      `not null default 2.5` seeds every existing row for free. The 1.3 floor is
--      enforced in src/lib/sm2.ts; this CHECK is a safety net, not the logic.
--
-- interval_days keeps its type and its cards_interval_days_nonneg CHECK, with no
-- replacement for the 30-day Box cap. No new index: nothing queries repetition or
-- efactor selectively. Rollback is a new forward migration (rename back, drop
-- efactor), lossless precisely because the two names hold the same values.

alter table public.cards rename column box to repetition;

alter table public.cards
  add column efactor numeric(4,2) not null default 2.5
    constraint cards_efactor_floor check (efactor >= 1.3);
