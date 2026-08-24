# Execution plan — Paper UI primitives

**Date:** 2026-08-24
**Slug:** `paper-ui-primitives`
**Branch:** `feat/paper-ui-primitives`
**Base:** `main`
**Engine:** om-auto-create-pr (steps: 13, --loop: no)
**Source doc:** `.ai/specs/briefs/2026-08-24-paper-ui-primitives.md`

## 🎯 Goal

Build the three page primitives whose contract is already proven by duplication —
`Notice`, `EmptyState`, `PageHeader` — in Paper's visual language with an accessibility
contract each, give them their one safe production consumer (`Banner.astro` adopts the
semantic surface tokens), correct the `Button` focus indicator, and introduce
`--radius-paper` as a transitional token nothing legacy reads. No screen is migrated,
no `Card`/`Field`, no proving route.

## Scope

- `src/styles/global.css` — add `--radius-paper: 0.375rem` to the plain `@theme` block.
- `src/styles/tokens.test.ts` — extend with the radius-fact assertions (criteria 4/5).
- `src/components/ui/Notice.tsx` — new.
- `src/components/ui/EmptyState.tsx` — new.
- `src/components/ui/PageHeader.tsx` — new.
- `src/components/ui/primitives.test.ts` — new. Source-level assertions: Notice's
  role/aria-live mapping, no colour literal / shadow / blur / bg-cosmic / gradient in
  `src/components/ui/`, `rounded-paper` usage confined to `src/components/ui/`, no
  `src/pages/dev` proving route.
- `src/components/Banner.astro` — its `<style>` block's nine hex literals become
  `var(--info*)` / `var(--warning*)` / `var(--destructive*)`.
- `src/components/ui/button.tsx` — two class changes: base ring loses its `/50` alpha,
  `destructive` variant's own ring override is removed.

### Non-goals (explicitly not touched)

- No file under `src/components/{auth,generate,library,review,settings}/` or any
  `.astro` page changes shape or layout.
- `bg-cosmic` stays everywhere it is applied today.
- No `Card`, no `Field`, no `auth/FormField.tsx` edit.
- No proving/demo route (`src/pages/dev/**`).
- No dark-mode work, no `--radius` change, no `Button` redesign beyond the two
  focus classes.

## Risks

- The three new primitives ship with no real consumer yet (only source-level tests
  cover them) — visual/interaction proof waits for the screen-migration increment, as
  the brief records explicitly.
- The corrected focus ring is unmeasured against a Paper background; criterion 7 is
  a manual Tab-through on the current cosmic screens, not an assertion.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Radius token

- [ ] 1.1 Add `--radius-paper` to the plain `@theme` block in `global.css`
- [ ] 1.2 Extend `tokens.test.ts` to assert `--radius` stays `0.625rem` and `--radius-paper` is `0.375rem`

### Phase 2: `Notice` primitive

- [ ] 2.1 Create `src/components/ui/Notice.tsx` with variant surfaces, role/aria-live mapping, lucide icons
- [ ] 2.2 Add source-level test asserting the role/aria-live mapping per variant

### Phase 3: `EmptyState` primitive

- [ ] 3.1 Create `src/components/ui/EmptyState.tsx`, lifted in shape from `DoneCard`

### Phase 4: `PageHeader` primitive

- [ ] 4.1 Create `src/components/ui/PageHeader.tsx`

### Phase 5: `Banner.astro` token adoption

- [ ] 5.1 Replace the nine hex literals in `Banner.astro`'s `<style>` with the semantic surface/role tokens
- [ ] 5.2 Add a test asserting no hex/`rgb()`/`oklch()` literal remains in `Banner.astro`

### Phase 6: `Button` focus correction

- [ ] 6.1 Edit `button.tsx`: drop the `/50` alpha on the base ring, remove the `destructive` variant's own ring override
- [ ] 6.2 Add a test asserting the two focus classes on `button.tsx`'s variant strings

### Phase 7: Primitive-wide source rules

- [ ] 7.1 Add a test asserting no colour literal/`shadow-*`/`backdrop-blur-*`/`bg-cosmic`/gradient in `src/components/ui/`
- [ ] 7.2 Add a test asserting the 58 `rounded-(md|lg|xl)` occurrences are unchanged and `rounded-paper` appears only under `src/components/ui/`
- [ ] 7.3 Add a test asserting no `src/pages/dev/**` proving route exists
