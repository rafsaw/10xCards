# Checkpoint 1 — Phase 1 complete

**Fired:** 2026-08-26T14:05:00Z — Phase 1 closed with 10 Steps landed (≥3-Step phase close).
**Steps covered:** 1.1 … 1.9-ledger-fix
**Commit range:** `3221e86` … `168c9e4`

## Touched areas

The auth form family (`FormField.tsx`, `PasswordToggle.tsx`, `SubmitButton.tsx`, `SignInForm.tsx`,
`SignUpForm.tsx`), the deleted `auth/ServerError.tsx`, the two strays (`ui/button.tsx`'s destructive
variant, `settings/CancelDeletionButton.tsx`), and two test files
(`dashboard/dashboard-paper.test.ts`, `ui/primitives.test.ts`).

No page has been migrated yet: `bg-cosmic` is still declared in `global.css`, still on `<body>`, and
still on the three auth pages and `Welcome.astro`. That is by design — Phase 3 is the only point at
which it may leave the codebase.

## Checks run

| Check | Result | Notes |
|---|---|---|
| `npm run typecheck` (`astro sync && astro check`) | ✅ pass | 0 errors, 0 warnings, 5 hints across 118 files. |
| `npm run lint` | ✅ pass | 0 errors, 29 warnings — all pre-existing, none in files this checkpoint touched. |
| `npm run build` | ✅ pass | Server built in 13.65s. The `@astrojs/sitemap` `site`-option warning is pre-existing on `main`. |
| `npm test` | ✅ pass | 363 passed, 1 skipped, 364 total. |
| Integration suite (`om-integration-tests`) | ⏭️ deferred | No page markup has changed yet, so there is nothing new for a browser to exercise. Runs in full at the final gate. |
| UI verification / screenshots | ⏭️ deferred | Same reason: Phase 1 changes only component internals that no migrated screen renders differently yet. The auth screens still paint the legacy glass until Phase 2. Recorded here and in `NOTIFY.md` per the checkpoint contract. |

## Environment note worth recording

`npm run typecheck` initially reported 10 errors, every one of them inside
`packages/code-reviewer` (`Cannot find module 'ai'`, implicit-`any` parameters) and none in `src/`.
That package is not an npm workspace, so a fresh worktree's root `npm ci` does not install its
dependencies. Running `npm ci` inside `packages/code-reviewer` cleared all ten. This is a worktree
setup artefact, not a defect introduced by this run, and it is recorded so the next resumed session
does not re-diagnose it.

## Decisions recorded at this checkpoint

- **`primitives.test.ts`'s radius ledger needed re-baselining (36 → 34).** It counts every
  `rounded-(md|lg|xl)` occurrence under `src/` against a per-increment baseline. Phase 1 removed two.
  The arithmetic is recorded in the comment above the assertion in the house style. Landed as the
  appended Step `1.9-ledger-fix` rather than folded silently into an earlier Step's commit.
- **That counter reads every file under `src/`, including the test file itself.** The first
  re-baseline attempt failed because the explanatory comment spelled the utility names out
  literally and so counted itself twice. The comment now says so, in place, for the next person.
- **`button.tsx`'s destructive contrast was measured, not assumed.** `--destructive` is
  `oklch(0.48 0.17 27)` → relative luminance `0.09707`; against `#ffffff` that is **7.14:1**, past
  4.5:1 (AA) and past 7:1 (AAA). Since `--destructive-foreground` resolves to `--white` in the light
  theme, the swap renders byte-identically to the `text-white` it replaces. No token adjustment was
  needed, so `global.css`'s `:root` and `.dark` blocks are untouched by this Step.
