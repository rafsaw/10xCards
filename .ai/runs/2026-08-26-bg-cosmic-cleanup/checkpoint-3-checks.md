# Checkpoint 3 — Phase 3 complete, and the first checkpoint with UI evidence

**Fired:** 2026-08-26T15:55:00Z — Phase 3 closed (3 Steps).
**Steps covered:** 3.1 … 3.3
**Commit range:** `4715010` … `c7aaada`

## Touched areas

`src/layouts/Layout.astro` (the `<body>` class), `src/styles/global.css` (the `@utility` block and the
`--radius-paper` removal condition), the deleted `src/components/ui/LibBadge.astro`, and
`src/components/ui/primitives.test.ts` (radius ledger 29 → 28, header comment).

**`bg-cosmic` no longer exists anywhere in `src/` outside test regexes.** This is the state the whole
increment was sequenced around.

## Checks run

| Check | Result | Notes |
|---|---|---|
| `npm run typecheck` | ✅ pass | 0 errors. |
| `npm run lint` | ✅ pass | 0 errors; 29 pre-existing warnings. |
| `npm run build` | ✅ pass | Green after each deletion — the proof nothing imported `LibBadge.astro`. |
| `npm test` | ✅ pass | 364 passed, 1 skipped. |
| `src/styles/tokens.test.ts` | ✅ pass **unmodified** | 44 tests; `--radius` is still `0.625rem`. That is AC12 — the Q3 deferral enforced rather than claimed. |
| Browser walk — 9 routes × 2 viewports | ✅ pass | 20 rows, 0 problems. See below. |

## Browser walk

Driven by `ui-walk.mjs` (kept in the run folder) against the dev server at
`http://127.0.0.1:4321`, signed in through the **real sign-in form** with the ephemeral QA user that
`.ai/scripts/test-env-up.ps1` mints. Results: `checkpoint-3-artifacts/ui-walk-results.json`;
18 screenshots alongside it.

For every one of the nine routes, at 390px and at 1280px:

- **`<body>` computed background is `oklch(0.985 0.004 85)` and `background-image` is `none`.** The
  paper ground, with no gradient anywhere — AC3's rendered half, which a source grep cannot settle.
- **`document.documentElement.scrollWidth` equals the viewport width exactly** — 390/390 and
  1280/1280 on all nine. That is AC9, measured rather than eyeballed.
- **No element carries a legacy glass class** (`bg-cosmic`, `backdrop-blur`, `bg-gradient-to-`,
  `rounded-2xl`, `text-white`).
- Every `h1` is intact: 10xCards, Sign in, Sign up, Registration successful, Dashboard, Generate
  cards, Review session, Card library, Settings.
- **A signed-in visitor at `/` still lands on `/dashboard`** at both widths — AC5.

Signing in worked through `getByLabel("Email", { exact: true })`,
`getByLabel("Password", { exact: true })` and `getByRole("button", { name: "Sign in" })` — the three
locators `tests/e2e/auth.setup.ts` uses. That is direct evidence for AC11 ahead of the E2E run at the
final gate.

### A false positive worth recording

The walk's first version searched `page.content()` for the legacy class names and reported all five
on all nine routes. All five were false:

- `bg-cosmic` appeared only inside dev-server file paths, because this run's **worktree directory is
  itself named** `bg-cosmic-cleanup-20260826-144808`.
- `.backdrop-blur`, `.text-white`, `.rounded-2xl` and `.bg-gradient-to-` appeared as **CSS rule
  definitions** in the served stylesheet. Tailwind's dev build scans the whole project — including
  this run's own markdown and the test files that quote those names — so it generates the rules even
  though nothing uses them.

The check now walks the live DOM and asks whether any *element* carries the class, which is the
question that was meant. Recorded because the same trap is waiting for the next person who greps
served HTML.

## Environment note

The dev server died mid-walk with Vite's `The file does not exist at ".../node_modules/.vite/deps_ssr/
chunk-*.js"` — the stale optimised-dep cache a fresh worktree hits. Restarting the environment cleared
it. Not a defect in the change; recorded so the next resumed session recognises it in one read.
