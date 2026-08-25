# Execution plan — screen-migration-settings

Source doc: .ai/specs/briefs/2026-08-24-screen-migration-settings.md

## 🎯 Goal

Migrate `/settings` — Strategy C's first screen-migration increment — from the legacy
`bg-cosmic` glass-card recipe to the decided Paper direction: `PageHeader` for the heading,
`Notice` for the error and pending-deletion states, a hairline-separated danger zone instead
of a bordered box, and a page-level `bg-background` full-bleed wrapper that hides the still-
present `bg-cosmic` on `<body>`. Deletes the now-redundant inline "← Dashboard" link, since
Increment 3's shipped shell already provides that path. No other screen, no account-deletion
behavior, and no shared component beyond this screen's own call sites change.

## 📋 Scope

**Now:** `src/pages/settings.astro`, `src/components/settings/DeleteAccountButton.tsx`, one new
file `src/components/settings/RetentionNotice.tsx`, and `src/components/ui/primitives.test.ts`
(criterion 5's asserted count).

**Not doing:** any other page; `src/components/settings/CancelDeletionButton.tsx`'s own file;
account-deletion/cancel-deletion request logic; `Section`/`Card` extraction; dark mode;
`bg-cosmic` utility or `Layout.astro` removal. Full rationale: the spec's Scope and Route/
blast-radius map sections.

## Implementation Plan

Carried over verbatim from the spec's own `## Implementation Plan` section — see
`.ai/specs/briefs/2026-08-24-screen-migration-settings.md` for the full behavioral detail,
exact class strings, and acceptance criteria each Step must satisfy.

### Phase 1: Page shell — background, heading, danger-zone region

- [ ] 1.1 Replace `settings.astro`'s outer wrapper `bg-cosmic` with `bg-background text-foreground`
- [ ] 1.2 Replace the gradient `<h1>` + `← Dashboard` link with `<PageHeader title="Settings" />`
- [ ] 1.3 Restyle the "Signed in as" line to token classes, copy unchanged
- [ ] 1.4 Restyle the danger-zone box to a hairline-separated region, copy unchanged

### Phase 2: Notice adoption — error and retention states

- [ ] 2.1 `DeleteAccountButton.tsx`: replace the hand-rolled error `<p>` with `<Notice variant="error">`
- [ ] 2.2 Create `src/components/settings/RetentionNotice.tsx` (Notice + CancelDeletionButton, one island)
- [ ] 2.3 Wire `<RetentionNotice client:load formatted={formatted} />` into `settings.astro`'s isReadOnly branch
- [ ] 2.4 Confirm `CancelDeletionButton.tsx` untouched; file the standalone `text-red-700` follow-up

### Phase 3: Test parity and validation gate

- [ ] 3.1 Re-measure `rounded-(md|lg|xl)` across `src/` and update `primitives.test.ts` criterion 5
- [ ] 3.2 Full validation gate: typecheck, lint, build, test
- [ ] 3.3 Manual/QA check that no `bg-cosmic` gradient is visible on `/settings` in either state

## ⚠️ Risks

- The `Notice`+`CancelDeletionButton` composition inside one new React island
  (`RetentionNotice.tsx`) is the one genuinely new pattern this increment introduces — mitigated
  by keeping the whole composition inside plain React (no cross-Astro-boundary prop passing) and
  confirming it with `astro check` plus a manual render check.
- The `rounded-(md|lg|xl)` count assertion in `primitives.test.ts` is a source-level guard, not a
  build-time invariant — must be re-measured against the actual diff, not assumed at 61.
- `CancelDeletionButton.tsx` is shared with the sitewide `RetentionBanner`; the plan deliberately
  avoids editing that file to keep this increment's blast radius to `/settings` only.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Page shell — background, heading, danger-zone region

- [ ] 1.1 Replace `settings.astro`'s outer wrapper `bg-cosmic` with `bg-background text-foreground`
- [ ] 1.2 Replace the gradient `<h1>` + `← Dashboard` link with `<PageHeader title="Settings" />`
- [ ] 1.3 Restyle the "Signed in as" line to token classes
- [ ] 1.4 Restyle the danger-zone box to a hairline-separated region

### Phase 2: Notice adoption — error and retention states

- [ ] 2.1 `DeleteAccountButton.tsx` error state uses `Notice`
- [ ] 2.2 New `RetentionNotice.tsx`
- [ ] 2.3 Wire `RetentionNotice` into `settings.astro`
- [ ] 2.4 Confirm `CancelDeletionButton.tsx` untouched; file follow-up issue

### Phase 3: Test parity and validation gate

- [ ] 3.1 Update `primitives.test.ts` criterion 5 count
- [ ] 3.2 Full validation gate
- [ ] 3.3 Manual/QA no-cosmic-visible check
