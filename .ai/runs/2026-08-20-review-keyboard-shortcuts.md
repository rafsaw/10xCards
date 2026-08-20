# Execution plan — Review session keyboard shortcuts

**Date:** 2026-08-20
**Slug:** `review-keyboard-shortcuts`
**Branch:** `feat/review-keyboard-shortcuts`
**Base:** `main`
**Engine:** om-auto-create-pr (steps: 6, --loop: no)
**Source doc:** `.ai/specs/briefs/2026-08-20-review-keyboard-shortcuts.md`

## 🎯 Goal

Let a user drive the whole Review Session card loop from the keyboard — `Space` reveals the
answer, `1` rates the card **Wrong**, `2` rates it **Right** — reusing the existing review
submission path so scheduling, persistence, and the duplicate-submission lock are untouched.

## Scope

In scope:

- A new pure module that decides which shortcut action (if any) a keystroke maps to, given the
  session state (`revealed`, `submitting`) and the event's origin. Pure so it is unit-testable
  under the repo's hermetic `environment: "node"` Vitest setup, which has no DOM and no React
  Testing Library.
- A single `document`-level `keydown` listener in `src/components/review/ReviewSession.tsx`
  that dispatches into the **existing** `handleRate` / reveal state — no second rating path.
- A small always-visible shortcut hint in the session UI, plus `aria-keyshortcuts` on the
  three affected buttons.
- Unit tests for the resolver and a Playwright E2E spec that exercises the real keyboard flow
  against the real `/api/reviews` endpoint.

### Non-goals (explicitly not touched)

- The Leitner scheduler (`src/lib/leitner.ts`) and `/api/reviews` — no behavior change, no new
  parameters, no new response fields.
- Database schema, migrations, or RLS policies.
- Keyboard customization / remapping, or any global (outside `/review`) shortcut.
- Redesigning the Review Session layout beyond adding the hint line.
- Adding React Testing Library / jsdom to the toolchain — the resolver is extracted precisely
  so no new test dependency is needed.
- `.claude/settings.local.json` and local QA credentials.

## Design decisions

1. **Pure resolver, thin component.** `src/lib/review-shortcuts.ts` exports
   `resolveReviewShortcut(context) -> "reveal" | "rate-wrong" | "rate-right" | null`. All of the
   brief's acceptance criteria are decidable inside that function, so they get pinned by fast
   unit tests instead of a DOM harness the repo does not have.
2. **Reuse, never duplicate, the submission path.** The keydown handler calls the same
   `handleRate(rating)` the buttons call, so the `lockRef` re-entrancy guard, the `submitting`
   state, error handling, and index advancement stay single-sourced (brief: "Keyboard actions
   must use the existing review submission flow").
3. **Three layers of duplicate-submission defense** (AC5/AC6): the resolver returns `null` when
   `submitting` is true *or* when the event is an auto-repeat (`event.repeat`, i.e. a held key),
   and `handleRate`'s existing synchronous `lockRef` still blocks a same-frame second call.
4. **Hook ordering.** `ReviewSession` early-returns for the load-error / empty / finished states.
   The `useEffect` must run unconditionally, so the current card is derived *before* those
   returns (`card: DueCard | null`) and the effect no-ops when there is no active card.
5. **Do not hijack keys the browser already handles.** The resolver ignores keystrokes carrying
   a modifier, keystrokes originating in a text-entry element, and — for `Space` only —
   keystrokes on an element the browser natively activates with Space (a focused button/link),
   so tabbing to "Restart" and pressing Space still means "restart", not "reveal".

## Implementation Plan

### Phase 1: Shortcut resolution logic

- **1.1** Add `src/lib/review-shortcuts.ts`: the `ReviewShortcutAction` type, the
  `ReviewShortcutContext` input, target classifiers (`isTextEntryTarget`,
  `isSpaceActivatedTarget`) that work on a structural shape so they need no DOM, and the pure
  `resolveReviewShortcut`.
- **1.2** Add `src/lib/review-shortcuts.test.ts` — one test per acceptance criterion that is
  decidable at this layer (AC1, AC2, AC3, AC4, AC6) plus the guard cases (auto-repeat,
  modifiers, text-entry origin, Space on a focused button, unrelated keys).

### Phase 2: Wire the shortcuts into the Review Session

- **2.1** `src/components/review/ReviewSession.tsx`: hoist the active-card derivation above the
  early returns, add the `document` `keydown` effect that dispatches reveal / `handleRate`, and
  guard `handleRate` against a null card.
- **2.2** Add the visible shortcut hint (AC7) and `aria-keyshortcuts` on the Reveal / Wrong /
  Right buttons.

### Phase 3: End-to-end coverage and the validation gate

- **3.1** Add `tests/e2e/review-keyboard-shortcuts.spec.ts` following `tests/e2e/seed.spec.ts`:
  seed one due card, assert `1`/`2` before reveal submit nothing, `Space` reveals, `2` fires
  exactly one `POST /api/reviews` with `applied: true`, and clean the card up afterwards.
- **3.2** Run the full validation gate (`npm run typecheck`, `npm run lint`, `npm run build`,
  `npm test`) and record the results.

## Risks

- **Double-activation of `Space`** when focus sits on a native button. Mitigated by the
  `isSpaceActivatedTarget` guard plus `preventDefault()`; covered by unit tests.
- **Duplicate POSTs from a held-down `1`/`2`.** Mitigated by the `event.repeat` guard, the
  `submitting` check in the resolver, and the pre-existing `lockRef`; asserted in the E2E spec
  by counting `/api/reviews` requests.
- **Hook-ordering regression** — adding a hook to a component with early returns is the classic
  way to break the rules of hooks. Mitigated by deriving the card before every early return;
  `npm run lint` (react-hooks rules are enabled) is the check.
- **E2E spec cannot run in CI** — `.github/workflows/ci.yml` runs only `lint` + `build`, and the
  Playwright suite needs live Supabase credentials. The spec is verified locally; if the local
  environment is unavailable that is disclosed in the PR summary rather than silently skipped.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Shortcut resolution logic

- [ ] 1.1 Add the pure `review-shortcuts` resolver module
- [ ] 1.2 Add unit tests covering the acceptance criteria and guard cases

### Phase 2: Wire the shortcuts into the Review Session

- [ ] 2.1 Attach the keydown effect and reuse the existing submission path
- [ ] 2.2 Add the visible shortcut hint and `aria-keyshortcuts`

### Phase 3: End-to-end coverage and the validation gate

- [ ] 3.1 Add the Playwright keyboard-shortcuts E2E spec
- [ ] 3.2 Run the full validation gate
