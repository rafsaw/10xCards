# Library tag filter (lesson tag, Phase 2)

Source doc: .ai/specs/2026-10-10-card-lesson-tag.md

## Goal

`/library` can filter saved cards by lesson tag or by "No tag", composed with the `q` search and pagination.

## Scope

- Shared filter builder used by the count and page queries (`status`/`q`/tag).
- URL contract `?tag=<exact>` / `?no_tag=1` (wins), carried by `buildHref` and the search form.
- Filter UI: All / No tag / each tag. **The tag list comes from saved cards only** (not `card_tags()`, which includes drafts) so a draft-only tag never appears as a filter that matches nothing.
- Unit tests for the builder and saved-tag list; E2E for the filter.

Non-goals: migration, write path, review changes, per-tag review, `q` matching tags.

## Risks

- `card_tags()` includes drafts (spec Q2) and is kept for autocomplete/canonicalization; the filter uses a separate saved-only query (RLS scopes to the owner, no migration needed).
- E2E shares the app DB: unique timestamp tags, cleanup deletes own cards.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Filter logic

- [ ] 1.1 Shared library filter builder + saved-only tag list, with unit tests
- [ ] 1.2 Wire filter into library.astro queries, buildHref and search form

### Phase 2: UI and E2E

- [ ] 2.1 Filter UI (All / No tag / each saved tag) and filtered empty state
- [ ] 2.2 E2E: filter by unique tag, "No tag" excludes it; draft-only tags not offered
