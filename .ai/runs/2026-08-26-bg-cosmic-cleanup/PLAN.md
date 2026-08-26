# Execution plan — global `bg-cosmic` cleanup (Increment 9)

**Slug:** `bg-cosmic-cleanup`
**Branch:** `feat/bg-cosmic-cleanup`
**Base:** `main`
**Engine:** `om-auto-create-pr-loop` (steps: 24 in the spec's breakdown, above the configured `loopStepThreshold` of 20)
**Source spec:** `.ai/specs/2026-08-26-bg-cosmic-cleanup.md`
**Source brief:** `.ai/specs/briefs/2026-08-26-bg-cosmic-cleanup.md`

## Tasks

> Authoritative status table. `Status` is one of `todo` or `done`. On landing a Step, flip `Status` to `done` and fill the `Commit` column with the short SHA. The first row whose `Status` is not `done` is the resume point for `om-auto-continue-pr-loop`. Step ids and `Exec` cells are immutable once the plan is committed — per-Step commits touch only `Status` and `Commit`.

| Phase | Step | Title | Exec | Status | Commit |
|-------|------|-------|------|--------|--------|
| 1 | 1.1 | Delete the `AC3 — SURVIVORS` block from `dashboard-paper.test.ts` | inline | done | 3221e86 |
| 1 | 1.2 | Retokenise `FormField.tsx` and add the `autocomplete` prop | inline | done | 74dd8f8 |
| 1 | 1.3 | Retokenise `PasswordToggle.tsx` | inline | done | 157512d |
| 1 | 1.4 | Retokenise `SubmitButton.tsx` | inline | done | c009633 |
| 1 | 1.5 | Delete `ServerError.tsx`; both call sites render `Notice variant="error"` | inline | done | 794d4ad |
| 1 | 1.6 | `SignUpForm.tsx` — retokenise the hint, add `autocomplete` to three fields | inline | done | a3a80b6 |
| 1 | 1.7 | `SignInForm.tsx` — add `autocomplete` to two fields | inline | done | 7000793 |
| 1 | 1.8 | `button.tsx` destructive variant → `text-destructive-foreground` (contrast measured) | inline | done | 9d03d6d |
| 1 | 1.9 | `CancelDeletionButton.tsx` — `text-red-700` → `text-destructive` | inline | done | 4f20032 |
| 1 | 1.9-ledger-fix | Re-baseline the radius ledger to 34 and apply prettier fixes | inline | done | d2db99c |
| 2 | 2.1 | Create `src/components/auth/AuthCard.astro` | inline | done | 595610e |
| 2 | 2.2 | `/auth/signin` composes `AuthCard`; footer retokenised | inline | done | 8e4c258 |
| 2 | 2.3 | `/auth/signup` composes `AuthCard`; footer retokenised | inline | done | 4cfc314 |
| 2 | 2.4 | `/auth/confirm-email` composes `AuthCard`; emoji → `aria-hidden` lucide icon | inline | done | 79ad0b9 |
| 2 | 2.5 | `index.astro` — the gateway, written inline | inline | done | 0812c88 |
| 2 | 2.6 | Delete `src/components/Welcome.astro` | inline | done | d0d088f |
| 2 | 2.6-ledger-fix | Re-baseline the radius ledger to 29 after Phase 2 | inline | done | c58f7a5 |
| 2 | 2.6-guard-fix | Repair the Paper-radius guard regex and apply prettier fixes | inline | done | 99a49f4 |
| 2 | 2.6-guard-fix-2 | Strip the stray byte the prefer-includes autofix carried into the guard | inline | done | e1aa628 |
| 3 | 3.1 | `Layout.astro` — remove `class="bg-cosmic"` from `<body>` | inline | done | 4715010 |
| 3 | 3.2 | `global.css` — delete the `@utility bg-cosmic` block; amend the `--radius-paper` condition | inline | done | bb1d252 |
| 3 | 3.3 | Delete `src/components/ui/LibBadge.astro` | inline | done | 07573eb |
| 4 | 4.1 | Write `src/pages/index.test.ts` — the landing guard | inline | done | e6ce159 |
| 4 | 4.2 | Write `src/components/auth/auth-paper.test.ts` — the auth-family guard | inline | done | 01f4e17 |
| 4 | 4.2-guard-fix | Repair the comment-stripper's whole-line pattern | inline | done | 1eedb9d |
| 4 | 4.2-guard-fix-3 | Exempt test files from the Paper-radius confinement guard | inline | done | fe65f27 |
| 4 | 4.3 | Add the repository-wide colour sweep test | inline | done | 6f568d0 |
| 4 | 4.4 | File the Increment 10 follow-up issue and record its number | inline | done | 4e47268 |
| 4 | 4.3-review-fix | Widen the colour sweep so bare white/black utilities fail | inline | done | pending |

## 🎯 Goal

Migrate the four screens Strategy C never touched — `/`, `/auth/signin`, `/auth/signup`,
`/auth/confirm-email` — plus the auth form family from the legacy glass recipe to Paper, replace the
starter's `Welcome.astro` marketing page with a minimal sign-in gateway, and then delete the
`bg-cosmic` utility, its `<body>` class, `ui/LibBadge.astro` and `auth/ServerError.tsx`. When it
lands, `src/`'s non-test sources contain zero hardcoded colours — the recorded entry condition for
the dark-mode increment.

## Scope

- `src/pages/index.astro`, `src/pages/auth/{signin,signup,confirm-email}.astro`
- `src/components/auth/{FormField,PasswordToggle,SubmitButton,SignInForm,SignUpForm}.tsx`, new `AuthCard.astro`
- `src/components/ui/button.tsx` (destructive variant only), `src/components/settings/CancelDeletionButton.tsx`
- `src/layouts/Layout.astro`, `src/styles/global.css`
- Deletions: `src/components/Welcome.astro`, `src/components/ui/LibBadge.astro`, `src/components/auth/ServerError.tsx`
- Tests: new `src/pages/index.test.ts`, new `src/components/auth/auth-paper.test.ts`, amended `src/components/dashboard/dashboard-paper.test.ts`

## Non-goals

- No auth logic, validation rule, route, API endpoint or middleware behaviour changes.
- `FormField` is **not** reconciled into `ui/Field.tsx` — that file's docstring records the decision and the two families genuinely differ.
- `--radius` does **not** flip to `0.375rem` here (spec Q3); `tokens.test.ts` must pass unmodified.
- No marketing landing page, no OAuth buttons, no "remember me", no password-strength meter.
- The typed email is still not preserved across a failed sign-in — a known gap, unchanged.

## Deviations from the spec's step ordering, and why

The spec's Implementation Plan lists the guard tests last (its steps 18–22). This engine requires
every Step to be exactly one commit that leaves the suite green, so two orderings are adjusted and
recorded here rather than silently:

1. **`AC3 — SURVIVORS` is deleted first (Step 1.1), not last (spec step 20).** That block asserts six
   files still contain `bg-cosmic`, and one of them (`Welcome.astro`) is deleted in Step 2.6, where
   `readFileSync` would throw rather than fail an assertion. Deleting the block up front is what keeps
   every intermediate commit green; its own test name already says "the next increment removes it".
2. **The new guard tests land after their subjects (Phase 4), not before.** The spec describes
   `index.test.ts` as "red before Phase 2 lands and green after" — true of the work as a whole, but a
   deliberately-red committed test violates the 1:1 green-commit rule. The red-then-green proof is
   performed and recorded at the final gate instead (spec step 22's deliberate-break step), which is
   where AC13's evidence belongs anyway.
3. **Spec steps 22–23 are not Steps.** The deliberate-break proof and the full validation gate are the
   final gate (skill step 9), recorded in `final-gate-checks.md` and surfaced in the PR body.

## Resolved ambiguity — AC1 versus the Edge Cases table

AC1 reads "a search for `bg-cosmic` under `src/` returns nothing — not the utility, not the `<body>`
class, **not a test regex**". The spec's own Edge Cases table contradicts that last clause, keeping
`primitives.test.ts:75`'s negative assertion ("harmless and still meaningful as a regression guard
against reintroduction"), and three other `*-paper.test.ts` files carry the same negative regex.

**Decision:** the more specific rule wins. Zero `bg-cosmic` in **non-test** sources under `src/`;
negative assertions in `*.test.ts` files stay, because deleting them would remove exactly the guards
that make reintroduction fail. Called out in the PR body so a reviewer can re-open it.

## Risks

- **`button.tsx`'s destructive variant** is the one shared primitive touched. `--destructive-foreground`
  resolves to `--white` (`#ffffff`) in the light theme — byte-identical rendering to today's
  `text-white` — so the swap is a naming correction, not a colour change. The ratio is measured and
  recorded at Step 1.8 regardless.
- **Reintroduction risk.** Once `@utility bg-cosmic` is gone, `class="bg-cosmic"` becomes a silent
  no-op. Steps 4.1–4.3's guards are what convert that silence into a failing test.
- **Spec inaccuracy noted:** the spec says `Topbar` "renders its signed-out branch from `Layout`".
  `Layout.astro:41` renders `Topbar` only when `user` is set, so the signed-out gateway simply has no
  `Topbar`. This changes nothing about the plan — the landing still must not import it — but the
  reviewer should not expect a signed-out `Topbar` on `/`.
- Rollback is a single `git revert` of the squashed commit; no data, no migration, no deploy ordering.

## External References

None — no `--skill-url` was passed.

## Implementation Plan

### Phase 1 — the auth family and the strays

- **1.1** Delete the `AC3 — SURVIVORS` `describe` block (lines 89–102) from
  `src/components/dashboard/dashboard-paper.test.ts`. See "Deviations" above.
- **1.2** `FormField.tsx`: label `text-blue-100/80` → `text-meta text-foreground`; input base
  `bg-white/10 … text-white placeholder-white/40` → `bg-background text-foreground
  placeholder:text-muted-foreground`; leading icon `text-white/40` → `text-muted-foreground`;
  resting border `border-white/20 focus:ring-purple-400` → `border-input focus:border-ring`; error
  border `border-red-400/60 focus:ring-red-400` → `border-destructive focus:border-destructive`;
  error text `text-red-300` → `text-destructive`. Add `autocomplete?: string`, forwarded as
  `autoComplete`.
- **1.3** `PasswordToggle.tsx`: `text-white/40 hover:text-white/70` → `text-muted-foreground
  hover:text-foreground`. `aria-label` values untouched.
- **1.4** `SubmitButton.tsx`: `className` keeps only `w-full`; spinner `border-white/30 border-t-white`
  → `border-muted border-t-foreground`.
- **1.5** Delete `ServerError.tsx`. `SignInForm.tsx:80` and `SignUpForm.tsx:127` become
  `{serverError && <Notice variant="error">{serverError}</Notice>}`; imports swapped.
- **1.6** `SignUpForm.tsx`: hint `text-blue-100/50` → `text-meta text-muted-foreground`; `autocomplete`
  = `email`, `new-password`, `new-password`.
- **1.7** `SignInForm.tsx`: `autocomplete` = `email`, `current-password`.
- **1.8** `button.tsx` destructive variant: `text-white` → `text-destructive-foreground`. Measure the
  ratio against `--destructive` first; if below 4.5:1, adjust the token in both `:root` and `.dark`
  rather than restoring `text-white`, and record the measurement.
- **1.9** `CancelDeletionButton.tsx:45`: `text-red-700` → `text-destructive`.

### Phase 2 — the four screens

- **2.1** `src/components/auth/AuthCard.astro` — `title` prop, default slot, the wrapper/card/`h1`
  recipe from the spec's UI/UX section verbatim. Page-local to `components/auth/` by decision.
- **2.2** `/auth/signin` → `<AuthCard title="Sign in">`; footer becomes
  `text-muted-foreground` + underlined `text-link`.
- **2.3** `/auth/signup` → `<AuthCard title="Sign up">`; mirrored footer.
- **2.4** `/auth/confirm-email` → `<AuthCard title={content.heading}>`; drop `content.emoji`; render
  `CircleCheck` (dev) / `Mail` (prod) `aria-hidden` at `text-muted-foreground size-8`.
- **2.5** `index.astro` — the redirect guard verbatim, then the gateway: house wrapper, `PageHeader`
  with title **10xCards** and the one-line description, and a `flex flex-col gap-3 sm:flex-row`
  control row of two `buttonVariants()` links. No island, no `Topbar` import, no decorative `svg`.
- **2.6** Delete `src/components/Welcome.astro`.

### Phase 3 — the deletions

- **3.1** `Layout.astro` — remove `class="bg-cosmic"` from `<body>`.
- **3.2** `global.css` — delete the `@utility bg-cosmic` block and its removal-condition comment;
  amend the `--radius-paper` comment so its trigger reads "when `bg-cosmic` is gone" (Q3).
- **3.3** Delete `src/components/ui/LibBadge.astro`.

### Phase 4 — guards and hand-off

- **4.1** `src/pages/index.test.ts` in the `settings.test.ts` idiom: no colour literal, no palette-scale
  utility, no `backdrop-blur`/`bg-gradient-`/`shadow-`/`bg-cosmic`; the wrapper carries
  `bg-background text-foreground min-h-screen`; exactly one bare `buttonVariants()` and one
  `buttonVariants({ variant: "outline" })`; the `/dashboard` redirect survives.
- **4.2** `src/components/auth/auth-paper.test.ts` in `dashboard-paper.test.ts`'s layout: a
  `MIGRATED_FILES` table over `AuthCard.astro`, the three auth pages and the five form components,
  plus an assertion that all four credential fields carry an `autocomplete` value.
- **4.3** The repository-wide sweep: walk every `.astro`/`.tsx` under `src/` outside `*.test.*` and
  fail on any palette-scale utility, `white/N`/`black/N` opacity utility, raw hex, `rgb()`, or the
  string `bg-cosmic`. This makes the dark-mode entry condition self-enforcing.
- **4.4** File the Increment 10 follow-up issue (`--radius` → `0.375rem`, `--radius-paper` and every
  `rounded-paper` deleted, `tokens.test.ts:352` amended) and record its number in this plan and in the
  spec's Follow-ups section. **Filed as issue #47**, carrying the Q3 reasoning, the two recorded
  `rounded-paper` consumers, and the two ledger traps this run lost time to.

## Verification

Final gate: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, plus
`npm run test:integration` and `npm run test:e2e`, the deliberate-break proof (AC13), and the manual
walkthrough of all nine routes at 390px and desktop width.
