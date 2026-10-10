# Lesson tag on cards: set at generate/create, shown in library, filter, reveal-only in review

- Date: 2026-10-10
- Category: feature
- Priority signal: medium — provenance gap hits every card; no workaround beyond manual text prefixes
- Risk signal: medium — needs a DB migration; UI tests share the app's Supabase DB
- Routing: Next: om-auto-write-spec "Lesson tag on cards: set at generate/create, shown in library, filter, reveal-only in review — brief: .ai/specs/briefs/2026-10-10-card-lesson-tag.md"

## Problem

While taking a course, the user builds cards lesson by lesson. Looking at a card in the library, they cannot tell which lesson it came from. The need is provenance, not grouping: no per-lesson review sessions (mixing all due cards is the point of Leitner). The original idea (decks) was narrowed to a lesson tag after challenging "build nothing" and the real pain.

## Agreed direction

One optional text column `cards.tag` (at most one tag per card). Existing cards have no tag.

- **Setting:** at AI generation, one tag for the whole batch, stored on the drafts; it survives `finalize_drafts` unchanged (that function only changes status). Also settable at manual create and editable in card edit.
- **No duplicates:** the input suggests existing tags while typing (distinct tags of the user, datalist-style autocomplete). The server also canonicalizes on write: a tag matching an existing one ignoring case and surrounding whitespace is stored with the existing spelling ("lesson 5" becomes "Lesson 5").
- **Display:** tag shown on the card in the library; library tag filter, including a "No tag" option.
- **Review:** tag shown only after the answer is revealed, so it cannot hint at the answer. Review query and Leitner scheduling are untouched.
- **Migration:** a separate, reviewed PR; not applied as part of spec or implementation tasks without that review. Existing cards are throwaway test data: no backfill and no rollback design for existing rows.
- **Rejected:** decks (table, CRUD, ownership FK, delete semantics) — more machinery than provenance needs; doing nothing / text prefixes — works for search but not as a structured filter or reveal-only display.

## Resolved unknowns

| Question | Answer (from the conversation) |
|----------|--------------------------------|
| Decks or tag? | Tag; the pain is provenance only |
| Per-tag review sessions? | No; review mixes all due cards |
| Tags per card | At most one |
| Where set | Generation (whole batch), manual create, card edit |
| Case/duplicate handling | Autocomplete of existing tags plus server-side canonicalization ignoring case/whitespace; existing spelling wins |
| Maximum tag length | 40 characters |
| Empty tag | Means no tag |
| Suggestion UI | Datalist-style autocomplete |
| Fixing a typo | Edit each card; no bulk rename yet |
| Library filter | By tag, plus "No tag" |
| Review display | Only after the answer is revealed |
| Existing data | Throwaway; no backfill, no rollback design |
| Migration | Separate reviewed PR; never applied in this task |

## Non-goals

- Decks, deck management, hierarchy (course → lesson), multiple tags per card.
- Review scoped by tag, dashboard tag summary.
- Bulk retag or bulk rename.
- Backfill or rollback for existing rows.

## Affected areas (if known)

- `supabase/migrations/` — new migration adding nullable `cards.tag` (plus lookup index as the spec sees fit).
- `src/pages/api/cards.ts` and `src/pages/api/cards/[id].ts` — create/edit with tag canonicalization.
- Generation flow (`src/pages/generate.astro`, `src/pages/api/generations.ts`) — batch tag on drafts.
- `src/pages/library.astro` — tag display and filter.
- `src/pages/review.astro` and `src/components/review/` — tag shown after reveal.
