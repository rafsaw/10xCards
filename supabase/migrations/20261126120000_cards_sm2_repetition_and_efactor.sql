-- SM-2 replaces Leitner Boxes as the review schedule; the decision, the seeding
-- rule and the rollback are in docs/adr/0002-sm2-for-review-schedule.md.

alter table public.cards rename column box to repetition;

alter table public.cards
  add column efactor numeric(4,2) not null default 2.5
    constraint cards_efactor_floor check (efactor >= 1.3);
