# Run: screen migration — /dashboard to Paper

Source doc: .ai/specs/2026-08-26-screen-migration-dashboard.md

## 🎯 Goal

Migrate `src/pages/dashboard.astro` — the screen every login lands on, and the last
legacy signed-in product screen — from the `bg-cosmic` glass recipe to Paper, and
re-derive its two-tier "what should I do now?" hierarchy out of Paper's own vocabulary
(position, type size, text colour, control weight) rather than glass, gradient and
panel-as-elevation, which three of Paper's eight principles forbid.

## Scope

- New page-local components `src/components/dashboard/DashboardLead.astro` and
  `DashboardNote.astro` carrying the two recipes.
- `src/pages/dashboard.astro` rewritten above the frontmatter fence only — Paper frame,
  `PageHeader`, `Notice`, `Button asChild`, the two new components; all eleven legacy
  class `const`s deleted.
- New source-level guard test `src/components/dashboard/dashboard-paper.test.ts`.

## Non-goals

- No change to `src/lib/dashboard-state.ts` or its unit tests (frozen byte-for-byte).
- No change to the three count queries, the `Promise.all`, the `try`/`catch`, or the
  "never render a zero after a failed query" rule.
- No change under `tests/e2e/` — the suite must pass unmodified.
- `bg-cosmic` removed from `dashboard.astro` and nowhere else; `global.css`,
  `Layout.astro`, `Welcome.astro` and the three auth pages keep it (next increment).
- No new `src/components/ui/` primitive; no `Section`, no `EmptyState`, no `client:` island.

## Risks

- The both-waiting state is the regression risk: with no card and no filled control on
  the note, the two tiers rest on position, size, colour and control weight alone. It is
  checked first at the walkthrough, and in greyscale (AC14).
- `max-w-3xl` → `max-w-content` (66ch) is a visible desktop layout change — a recorded
  decision (spec Q2), called out in the PR body.
- `<Button asChild>` with the filled default variant is this repo's first use; verified
  at the first call site before the other three depend on it, with a recorded fallback.
- The `read-only` state loses one `<h2>` outline entry (spec Q1); copy is preserved and
  the state gains `role="status"` / `aria-live="polite"` it never had.

## Implementation Plan

### Phase 1 — The two components

1.1 `DashboardLead.astro` — `Props { label, statement }`, `space-y-3` section, `text-meta`
    `<h2>`, `text-title font-sans` `<p>`, `flex flex-wrap items-center gap-3` action slot.
1.2 `DashboardNote.astro` — `Props { label }`, `border-border space-y-1 border-t pt-4`
    section, the same `text-meta` `<h2>`, a `text-muted-foreground text-sm` `<p>` slot.

### Phase 2 — The page

2.1 Page frame: imports, Paper wrapper, `max-w-content` container, `PageHeader`, the PR #31
    note replacing the tier comment; delete `headingClass`.
2.2 `review-waiting` lead + verify the filled `Button asChild` class merge.
2.3 `Also waiting` note.
2.4 `drafts-waiting`, `caught-up`, `new-account` leads.
2.5 `Your library` note; delete the three `aside*` `const`s.
2.6 `read-only` through `Notice variant="warning"` with its title and the `action` conditional.
2.7 `not-configured` and `error` through `Notice variant="error"`; delete the last `const`s.

### Phase 3 — The guard and the gate

3.1 `dashboard-paper.test.ts` — every source-level acceptance criterion plus the frozen
    data-layer block.
3.2 Prove the guard red on a deliberate break, then revert.
3.3 Full validation gate (`typecheck`, `lint`, `build`, `test`) plus the frozen-diff checks.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The two components

- [x] 1.1 DashboardLead.astro — 198c2a8
- [x] 1.2 DashboardNote.astro — 198c2a8

### Phase 2: The page

- [ ] 2.1 Page frame, imports, PageHeader, PR #31 note
- [ ] 2.2 review-waiting lead and the Button asChild check
- [ ] 2.3 Also waiting note
- [ ] 2.4 drafts-waiting, caught-up and new-account leads
- [ ] 2.5 Your library note
- [ ] 2.6 read-only Notice
- [ ] 2.7 not-configured and error Notices

### Phase 3: The guard and the gate

- [ ] 3.1 dashboard-paper.test.ts
- [ ] 3.2 Deliberate-break proof
- [ ] 3.3 Full validation gate
