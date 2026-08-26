# Execution plan — `/library` migration to Paper (Increment 7)

Source doc: `.ai/specs/2026-08-25-screen-migration-library.md`

## Goal

Migrate `/library` to the Paper design system, ship the deferred `Field` primitive, close the
`Card`-primitive deferral by recording its removal, and free `PageHeader` of its width clause —
without touching the page's data layer or any E2E spec.

## Scope

**Touched.** `src/components/ui/Field.tsx` (new), `src/components/ui/PageHeader.tsx` (one line),
`src/components/library/LibrarySearch.astro` (new), `src/pages/library.astro` (markup below `---`
only), `src/components/library/CreateCardForm.tsx`, `src/components/library/CardRow.tsx`,
`.uxproof/conventions.md` (principle 8), `src/components/library/library-paper.test.ts` (new),
`src/components/ui/primitives.test.ts` (extended).

**Non-goals.** Any API, query, or pagination-logic change; a `Card` primitive; `Field` error/icon/hint
slots; `auth/FormField.tsx`; `generate/PasteAndGenerateForm.tsx`; replacing `window.confirm`; any new
library feature; dark mode; removing the `bg-cosmic` utility itself. `tests/e2e/**` must stay byte
identical (AC4).

## Implementation Plan

### Phase 1 — The primitive and the width fix

Ship `Field` with its contract test, and delete `max-w-content mx-auto` from `PageHeader` (a provable
no-op — all three existing consumers already wrap it in that pair).

### Phase 2 — The two React islands

`CreateCardForm` and `CardRow` move to Paper and adopt `Field`, `Notice` and `Button`.

### Phase 3 — The page

`library.astro` and the new `LibrarySearch.astro`. The screen becomes fully Paper.

### Phase 4 — The record and the guard

The principle-8 edit and `library-paper.test.ts`, proven by a deliberate break, then the full gate.

## Risks

- The `PageHeader` edit could silently change `/settings`, `/generate`, `/review` — mitigated by the
  fact all three already wrap it, plus a guard assertion and a side-by-side walkthrough (AC11).
- `primitives.test.ts` pins `rounded-(md|lg|xl)` occurrences at 50; this increment changes that count
  and the constant must be updated with the reason recorded, never silently.
- Twenty `text-title` serif rows may read as a wall of text; the Paper-legal fallback is more vertical
  rhythm, never a smaller size, fill or shadow.
- An E2E locator could break; every asserted accessible name is guarded at source level and
  `git diff origin/main -- tests/` must stay empty.

## Progress

PR: #40

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The primitive and the width fix

- [x] 1.1 Create `src/components/ui/Field.tsx` per the Architecture contract — bc210fa
- [x] 1.2 Extend `primitives.test.ts` with `Field.tsx` and its contract criteria — bc210fa
- [x] 1.3 Delete `max-w-content mx-auto` from `PageHeader.tsx` and assert no `max-w-` survives — bc210fa

### Phase 2: The two React islands

- [x] 2.1 `CreateCardForm`: error paragraph becomes `Notice variant="error"` — 0992d0e
- [x] 2.2 `CreateCardForm`: both label/textarea blocks become `Field` — 0992d0e
- [x] 2.3 `CreateCardForm`: hand-rolled submit becomes `Button` — 0992d0e
- [x] 2.4 `CardRow`: error becomes `Notice`; both edit textareas become `Field` — 0992d0e
- [x] 2.5 `CardRow`: restyle the `<li>` surface and the front/back typography — 0992d0e
- [x] 2.6 `CardRow`: `Delete` becomes a ghost Button carrying `text-destructive` — 0992d0e

### Phase 3: The page

- [x] 3.1 Create `src/components/library/LibrarySearch.astro` — 315edb9
- [x] 3.2 `library.astro`: page frame, `PageHeader`, both errors through `Notice` — 315edb9
- [x] 3.3 `library.astro`: the create region becomes a `Section` — 315edb9
- [x] 3.4 `library.astro`: the saved-cards region's three branches — 315edb9
- [x] 3.5 `library.astro`: pagination links and disabled spans — 315edb9

### Phase 5: Review follow-ups (post-review, PR #40)

- [x] 5.1 Keep Delete's destructive tint through hover and keyboard focus — c267802
- [x] 5.2 Exercise AC12 explicitly and pin the saved-vs-draft surface distinction — 5573fa1

### Phase 4: The record and the guard

- [x] 4.1 Edit principle 8 in `.uxproof/conventions.md` — c48cbca
- [x] 4.2 Create `src/components/library/library-paper.test.ts` — c48cbca
- [x] 4.3 Prove the guard with a deliberate break, then revert — c48cbca
- [x] 4.4 Run the full validation gate and the E2E suite — c48cbca
