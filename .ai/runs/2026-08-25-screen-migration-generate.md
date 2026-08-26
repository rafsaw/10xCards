Tracking plan: .ai/runs/2026-08-25-screen-migration-generate.md
Source doc: .ai/specs/briefs/2026-08-25-screen-migration-generate.md
Status: complete

## 🎯 Goal

Migrate `/generate` from the legacy `bg-cosmic` glass-card recipe to the decided Paper direction —
`PageHeader`, `Notice`, and a new `Section` primitive extracted from `/settings`'s already-shipped
danger-zone markup — while giving principle 7's `--surface-draft` / `--surface-draft-border` tokens
their first real consumer and resolving the principle-5 tension between `Generate` and `Save changes`
(exactly one filled button per view). No change to generation/save request logic, `window.confirm()`
steps, or redirect targets.

## 📋 Scope

Files touched: `src/pages/generate.astro`, `src/components/generate/PasteAndGenerateForm.tsx`,
`src/components/generate/DraftReviewList.tsx`, new `src/components/ui/Section.tsx`,
`src/components/ui/primitives.test.ts`. Non-goals: any other page, `Card` primitive, new empty state,
dark mode, `bg-cosmic`/`Layout.astro` change, `button.tsx` `shadow-xs` fix (filed as a follow-up).

## Implementation Plan

### Phase 1: `Section` primitive

- 1.1 Create `src/components/ui/Section.tsx` per the spec's contract, lifted from `/settings`'s
      shipped danger-zone markup.
- 1.2 Add `"Section.tsx"` to `NEW_PRIMITIVES` in `src/components/ui/primitives.test.ts`.

### Phase 2: Page shell — background, heading, top-level notices

- 2.1 `generate.astro`: outer wrapper `bg-cosmic` → `bg-background text-foreground`, `max-w-3xl` →
      `max-w-content`.
- 2.2 Replace the gradient `<h1>` + back link with `<PageHeader title="Generate cards" />`.
- 2.3 Replace not-configured and loadError paragraphs with `<Notice variant="error">`.
- 2.4 Replace the isReadOnly branch with `<Section title="Generate new cards from text">` wrapping a
      bare `<Notice variant="warning">`.
- 2.5 Pass `primary={drafts.length === 0}` to `<PasteAndGenerateForm client:load />`.

### Phase 3: Form and draft-review islands

- 3.1 `PasteAndGenerateForm.tsx`: accept `primary` prop; wrap return value in `<Section title="Generate
      new cards from text">`; error `<p>` → `<Notice variant="error">` (drop `CircleAlert`); submit
      button → `<Button variant={primary ? "default" : "outline"}>`; textarea colour literals → tokens.
- 3.2 `DraftReviewList.tsx`: wrap return value in `<Section title description>`; error `<p>` →
      `<Notice variant="error">` (drop `CircleAlert`); submit button → `<Button variant="default">`;
      Keep/Discard/toggle literals → `success`/`destructive` tokens; per-row `<li>` →
      `surface-draft`/`surface-draft-border`.

### Phase 4: Test parity and validation gate

- 4.1 Run `grep -rnoE 'rounded-(md|lg|xl)\b' src/ | wc -l`, update `primitives.test.ts` criterion 5's
      asserted count to the real measured number.
- 4.2 Run full validation gate (`npm run typecheck`, `npm run lint`, `npm run build`, `npm test`); fix
      forward until green.
- 4.3 Manual/QA verification of no-drafts, drafts-pending, and isReadOnly states at desktop and 390px.

## Risks

- Principle-5 button-priority resolution (`Save changes` filled when drafts exist, `Generate` filled
  otherwise) is the spec's one product-adjacent judgment call — validated visually, not just by tests.
- Two assumptions about static `Section`+`Notice` composition in `.astro` (no hydration boundary) and
  inside `client:load` islands need `astro check` + real-render confirmation.

PR: #38

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: `Section` primitive

- [x] 1.1 Create `src/components/ui/Section.tsx` — 4876648
- [x] 1.2 Add `"Section.tsx"` to `NEW_PRIMITIVES` in `primitives.test.ts` — 4876648

### Phase 2: Page shell — background, heading, top-level notices

- [x] 2.1 Outer wrapper `bg-cosmic` → `bg-background text-foreground`, `max-w-3xl` → `max-w-content` — 55d1967
- [x] 2.2 `PageHeader` replaces gradient `<h1>` + back link — 55d1967
- [x] 2.3 Not-configured / loadError paragraphs → `Notice` — 55d1967
- [x] 2.4 isReadOnly branch → `Section` + bare warning `Notice` — 55d1967
- [x] 2.5 Pass `primary={drafts.length === 0}` to `PasteAndGenerateForm` — 55d1967

### Phase 3: Form and draft-review islands

- [x] 3.1 `PasteAndGenerateForm.tsx` — `Section`, `Notice`, `Button` variant, token colours — 55d1967
- [x] 3.2 `DraftReviewList.tsx` — `Section`, `Notice`, `Button`, success/destructive/surface-draft tokens — 55d1967

### Phase 4: Test parity and validation gate

- [x] 4.1 Re-measure and update `rounded-(md|lg|xl)` count in `primitives.test.ts` — ba23a37 (measured 54, matching the spec's prediction)
- [x] 4.2 Full validation gate green — typecheck 0 errors, lint 0 errors (29 pre-existing warnings), build succeeds, 206 passed / 1 skipped
- [ ] 4.3 Manual/QA verification of all states at desktop and 390px — deferred to `om-auto-qa-pr` after this PR is ready
