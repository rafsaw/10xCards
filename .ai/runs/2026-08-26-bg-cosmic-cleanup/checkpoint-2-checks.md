# Checkpoint 2 — Phase 2 complete

**Fired:** 2026-08-26T15:20:00Z — Phase 2 closed with 9 Steps landed (≥3-Step phase close).
**Steps covered:** 2.1 … 2.6-guard-fix-2
**Commit range:** `595610e` … `59fc3b3`

## Touched areas

`src/components/auth/AuthCard.astro` (new), the three auth pages, `src/pages/index.astro`, the
deleted `src/components/Welcome.astro`, and `src/components/ui/primitives.test.ts` (the radius ledger
and the Paper-radius confinement guard).

Every screen is now Paper. `bg-cosmic` is still declared in `global.css` and still on `<body>`,
painting behind the per-page wrappers — Phase 3 is the only point at which it may leave.

## Checks run

| Check | Result | Notes |
|---|---|---|
| `npm run typecheck` | ✅ pass | 0 errors, 0 warnings, 5 hints. |
| `npm run lint` | ✅ pass | 0 errors; 29 warnings, all pre-existing. |
| `npm run build` | ✅ pass | Ran at Steps 2.4, 2.5 and 2.6; the green build at 2.6 is the proof nothing but `index.astro` imported `Welcome.astro`. |
| `npm test` | ✅ pass | 364 passed, 1 skipped, across 20 files. |
| Guard deliberate-break | ✅ pass | See "The guard that was green for the wrong reason" below. |
| Integration suite | ⏭️ deferred | Runs in full at the final gate. |
| UI screenshots | ⏭️ deferred to checkpoint 3 | `<body>` still carries `bg-cosmic`, so the app is not yet in its final visual state. Screenshots captured now would document a state that never ships. Checkpoint 3, immediately after Phase 3's deletions, captures the state that actually ships. |

## Decisions recorded at this checkpoint

- **`AuthCard.astro` needed a second home for the Paper radius.** `primitives.test.ts` confined
  `rounded-paper` to `src/components/ui/`, and the spec's `AuthCard` contract specifies it. Neither
  workaround was acceptable: promoting a three-consumer, one-folder component into the registry to
  satisfy a path check asserts a generality it does not have, and giving it the legacy radius instead
  contradicts the geometry it is being migrated to. The confinement is now an **explicit two-name
  allowlist** rather than a widened path prefix, so a third file reaching for the transitional token
  still fails — which is the invariant that was actually worth keeping. Increment 10 deletes
  `--radius-paper` and both usages together.
- **The radius ledger moved again, 34 → 29.** The four screens shed five legacy-scale radii with the
  glass recipe: `Welcome.astro`'s feature cards and pill, and the three auth pages' cards.

## The guard that was green for the wrong reason

Worth recording in full, because the failure mode is invisible in a passing suite.

Step 2.1 rewrote the Paper-radius confinement guard through a script that emitted a literal
backspace byte (`0x08`) where the regex needed a `\b` escape. The assertion became
`/rounded-paper\x08/`, which matches nothing — so it passed on every input, including inputs it was
written to reject. `npm test` was green and the guard was inert.

`npm run lint` is what surfaced it (`no-control-regex`), not the test run. The first repair restored
the escape in the regex, but eslint's `prefer-includes` autofix then rewrote the expression into
`.includes("rounded-paper\x08")`, carrying the same stray byte into the string form — where a word
boundary has no meaning anyway. The second repair replaced the comparison with a plain substring
check.

It is now **proven rather than asserted**: adding `rounded-paper` to `DashboardNote.astro` turns the
assertion red; removing it turns it green. Both repairs landed as appended Steps
(`2.6-guard-fix`, `2.6-guard-fix-2`) rather than as history rewrites of the commits that introduced
the problem.
