Tracking plan: .ai/runs/2026-08-25-screen-migration-review.md
Source doc: .ai/specs/2026-08-25-screen-migration-review.md
Status: complete

## 🎯 Goal

Migrate `/review` from the legacy `bg-cosmic` glass-card recipe to the decided Paper direction —
`PageHeader`, `Notice`, `EmptyState`, `Button`, and the Paper tokens — making the flashcard face the
only bordered surface and therefore the visual hero, giving `EmptyState` its first two real consumers,
deleting the duplicated local `DoneCard` it was extracted from, and resolving principle 6's unmet
"shape, not colour" requirement on the two rating buttons (`Wrong` → Secondary/outline, `Right` →
Primary/filled, both monochrome). No change to scheduling, shortcut logic, or the `/api/reviews`
contract.

## 📋 Scope

Files touched: `src/pages/review.astro`, `src/components/review/ReviewSession.tsx`, new
`src/components/review/review-paper.test.ts`, plus the spec document itself
(`.ai/specs/2026-08-25-screen-migration-review.md`, untracked on `main` — it ships on this PR since
there is no separate spec PR).

Non-goals: any other page; `src/lib/review-shortcuts.ts`, `src/lib/leitner.ts`,
`src/pages/api/reviews.ts`; a `Card` primitive; a `Field` primitive; practice/cram mode; dark mode;
the `bg-cosmic` utility or `Layout.astro`; the `button.tsx` `shadow-xs` or ≥44px touch-target fixes
(both filed as follow-ups); any modification to the two existing review E2E specs.

## Implementation Plan

### Phase 1: Screen migration — both files, ONE commit

The spec's Phasing section is explicit that the screen is the atomic unit: `review.astro`'s wrapper
supplies the ground colour and `ReviewSession.tsx` supplies `text-white` / `text-blue-100` on
everything inside it, so **no ordering of the two files produces a shippable intermediate**. Steps
1.1–1.4 are working-tree checkpoints, each with its own verification; they land as a single commit.

- 1.1 `review.astro`: wrapper `bg-cosmic` → `bg-background text-foreground`, `max-w-3xl` →
  `max-w-content`; gradient `<h1>` + `← Dashboard` link → `<PageHeader title="Review session" />`
  (accessible name preserved exactly); `isReadOnly` glass `<section>` → bare
  `<Notice variant="warning">` with no `Section` wrapper.
- 1.2 `ReviewSession.tsx`: delete the local `DoneCard`; load-error call site →
  `<Notice variant="error" title="Could not load your review session">`; empty call site →
  `EmptyState` (no action); complete call site → `EmptyState` + `Restart session`
  `Button variant="outline"`; drop `CircleAlert` if unused.
- 1.3 `ReviewSession.tsx`: session `<section>` → bare `space-y-4`; progress `<p>` →
  `text-meta text-muted-foreground`; restart control → `Button variant="ghost" size="sm"` keeping
  the accessible name `Restart`; rating error `<p>` → `<Notice variant="error">` (this is the
  a11y fix — `role="alert"` / `aria-live="assertive"`).
- 1.4 `ReviewSession.tsx`: card face → `border-border bg-card rounded-paper` with `text-meta`
  uppercase FRONT/BACK labels and **both** faces at `text-title font-serif break-words`; reveal
  button → `Button variant="default" className="w-full"`; rating buttons → `outline` / `default`
  tiers with every red/green class deleted including on the glyphs; `Kbd` → `text-meta` + Paper
  tokens; hint row → `text-meta text-muted-foreground` keeping the dimming logic and its comment.

### Phase 2: Make the acceptance criteria executable

- 2.1 Add `src/components/review/review-paper.test.ts` — source-level guard following the technique in
  `src/components/ui/primitives.test.ts` and `src/styles/tokens.test.ts` (this repo has no
  jsdom/RTL harness): no legacy utilities in either file (AC1); card faces carry `text-title`,
  `font-serif`, `break-words` and labels carry `text-meta` (AC2); rating error renders
  `Notice variant="error"` (AC5); `Wrong` is `outline`, `Right` is `default`, no `destructive` or
  `success` token on either button or glyph (AC6); `EmptyState` imported and `DoneCard` absent
  (AC7).
- 2.2 Full validation gate — `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` — plus
  `npm run test:e2e`, which per AC4/AC8 must pass with **zero modification** to
  `tests/e2e/review-keyboard-shortcuts.spec.ts` and `tests/e2e/review-persistence.spec.ts`.
- 2.3 Manual walkthrough and screenshot evidence for the clauses a text guard cannot check: viewport
  coverage (AC1 second clause), rendered size/contrast hierarchy (AC2 second clause), 200-char
  unbroken string at 390px (AC3), colour-removed distinguishability (AC6 second clause), and
  draft-row-vs-card-face surface contrast against `/generate` (AC9).

## Risks

- **The keyboard-shortcut layer is the freshest interaction code in the repo** (shipped six days
  before `/generate`). Mitigated structurally: the decision logic lives in the separately-tested pure
  `resolveReviewShortcut`, the double-submit guard is a ref rather than a `disabled` attribute, and
  both E2E suites locate purely by role/text/accessible-name. Every asserted name is preserved
  verbatim, so those suites are the regression net.
- **`text-meta` has never rendered anywhere in the shipped app** — this increment is its first use, in
  five places. Legibility is a walkthrough item, not a test item.
- **`--card` and `--background` both resolve to `var(--ink-05)`** by deliberate design
  (`global.css:108`), so the card face separates by hairline alone. This is principle 4's intent but
  is the assumption most likely to look wrong in the browser; changing `--card` is out of scope.
- **New visual asymmetry between the rating buttons** (filled `Right` vs outline `Wrong`) is a
  consequence of the direction's own principle 5, not a product judgement. If it reads as a
  recommendation, the escalation path is at the direction level — not a local revert to red/green.

## Progress

PR: #39

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Screen migration — both files, ONE commit

- [x] 1.1 `review.astro` — wrapper, `PageHeader`, read-only `Notice` — 9d9b042
- [x] 1.2 `ReviewSession.tsx` — three terminal states, delete `DoneCard` — 9d9b042
- [x] 1.3 `ReviewSession.tsx` — session container, progress row, restart `Button`, rating-error `Notice` — 9d9b042
- [x] 1.4 `ReviewSession.tsx` — card face, reveal button, rating-button tiers, `Kbd`, hint row — 9d9b042

### Phase 2: Make the acceptance criteria executable

- [x] 2.1 Add `src/components/review/review-paper.test.ts` source-level guard — f581a9e (22 assertions; deliberate-break check confirmed it bites)
- [x] 2.2 Full validation gate green, including `test:e2e` with both review specs unmodified — f581a9e (typecheck 0 errors, lint 0 errors / 29 pre-existing warnings, build complete, 256 passed + 1 skipped, 14/14 E2E passed, `git diff origin/main -- tests/` empty)
- [x] 2.3 Manual walkthrough and screenshot evidence for the non-greppable AC clauses — deferred to `om-auto-qa-pr` after this PR is ready, per the pattern the `/generate` increment used
