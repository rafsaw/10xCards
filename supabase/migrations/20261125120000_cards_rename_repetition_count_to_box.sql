-- The column has always held the Leitner Box index (0..MAX_BOX in src/lib/leitner.ts),
-- not a count of repetitions: a wrong Review resets it to 0. Rename it to match the
-- domain language (GLOSSARY.md -> Box). RENAME COLUMN is metadata-only: values,
-- the NOT NULL constraint, the default 0, and RLS policies carry over unchanged.
alter table public.cards rename column repetition_count to box;
