-- S-04: review-session schema support (additive, non-breaking).
-- See context/changes/srs-review-session/plan.md (Phase 1) for the full contract.
--
-- Two items F-01 deferred to S-04:
--   1. A partial index backing the due-card query
--      (status='saved' and next_due_at <= now()), ordered by next_due_at.
--   2. The check (interval_days >= 0) flagged by F-01's impl-review (obs. F3)
--      before S-04 writes interval_days. Trivially satisfied today
--      (all saved cards sit at interval_days = 0) and by Leitner (intervals
--      are always positive).

create index cards_due_idx on public.cards (user_id, next_due_at) where status = 'saved';

alter table public.cards add constraint cards_interval_days_nonneg check (interval_days >= 0);
