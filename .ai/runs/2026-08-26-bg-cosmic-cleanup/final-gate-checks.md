# Final gate — every Tasks row `done`

**Fired:** 2026-08-26T16:15:00Z, after Step 4.4 closed Phase 4.
**Range:** `1d4b574` (run folder) … `4e47268` (Increment 10 follow-up recorded).
**Subsumes** the checkpoint that would otherwise have fired at the end of Phase 4.

## Full validation gate — every command in `validation.commands`, in order

| Command | Result | Detail |
|---|---|---|
| `npm run typecheck` | ✅ pass | 0 errors, 0 warnings, 5 hints across 118 files. |
| `npm run lint` | ✅ pass | **0 errors**, 29 warnings — every warning pre-existing on `main` and none in a file this run touched. |
| `npm run build` | ✅ pass | Server built; the `@astrojs/sitemap` `site`-option warning is pre-existing. |
| `npm test` | ✅ pass | **605 passed, 1 skipped** across 23 files (up from 364/20 at the run's start — the three new guard files add 242 assertions). |

Raw output: `final-gate-artifacts/validation-gate.log`.

## Full integration suite

`npm run test:integration` — **8 passed across 3 files**, including the R2 cross-user isolation
tests that exercise real RLS against the remote Supabase project.

**One flake, disclosed rather than buried.** The first run reported 1 file failed with 4 tests
skipped. Three consecutive re-runs were fully green (`final-gate-artifacts/integration-report-summary.log`).
The first run overlapped the dev server this run had left up for the browser walk; nothing in this
diff touches an API route, a query, a policy or the middleware, so there is no mechanism by which it
could affect these tests. Recorded because a reviewer deserves to know a re-run happened.

## End-to-end suite — AC11

`npm run test:e2e` — **14 passed**, including `[setup] tests\e2e\auth.setup.ts › authenticate`.

`tests/` is **untouched by this diff** (`git status --short tests/` is empty), so this is AC11 met on
its own terms: the fixture passes unmodified. It locates by `getByLabel("Email", { exact: true })`,
`getByLabel("Password", { exact: true })` and `getByRole("button", { name: "Sign in" })`, and the
`exact: true` guard still matters because `PasswordToggle`'s `aria-label` is unchanged.

The `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` line printed *after* `14 passed` is
libuv teardown noise on Windows, not a test result.

## The deliberate-break proof — AC13

Restored `class="bg-cosmic"` on `<body>` **and** re-added the `@utility bg-cosmic` block to
`global.css`, then ran `npm test`:

```
FAIL src/colour-sweep.test.ts > src/ ships no hardcoded colour — the dark-mode entry condition
     > layouts/Layout.astro does not reference the deleted bg-cosmic utility
AssertionError: expected '---\nimport "../styles/global.css";\n…' not to match /\bbg-cosmic\b/
```

Test Files 1 failed | 22 passed (23). Both edits were reverted and the suite returns to
**23 files passed**. Full output: `final-gate-artifacts/deliberate-break.log`.

This is the assertion that matters most in the whole increment. Once the `@utility` is gone,
`class="bg-cosmic"` is a **silent no-op** — Tailwind emits nothing for an unknown class, so a
reintroduction would look fine in review and render wrong. The sweep is what converts that silence
into a failure.

## Design-system / style compliance pass

The repo has no separate design-system lint or `.ai/skills/` style skill; the design system is
enforced by the guard tests themselves (`tokens.test.ts`, `primitives.test.ts`, the per-screen
`*-paper.test.ts` files, and now `colour-sweep.test.ts`). All are green, so the pass is recorded as
**not applicable** rather than skipped — there is no tool to run.

## Acceptance criteria — where each one is settled

| AC | Verdict | Where |
|---|---|---|
| 1 — no `bg-cosmic` under `src/` | ✅ | `colour-sweep.test.ts`, per file. Scope decision below. |
| 2 — zero colour literals / palette utilities, enforced by a test | ✅ | `colour-sweep.test.ts` — 153 assertions over all 38 shipped files. |
| 3 — four screens carry no legacy surface utility, render ink-on-paper | ✅ | Source: `index.test.ts`, `auth-paper.test.ts`. Rendered: checkpoint-3 browser walk. |
| 4 — the gateway's exact shape | ✅ | `index.test.ts` (AC4 block) + `screenshot-landing-*.png`. |
| 5 — signed-in `/` still redirects | ✅ | `index.test.ts` + the browser walk, both viewports. |
| 6 — every auth screen composes `AuthCard` | ✅ | `auth-paper.test.ts` (AC6 block). |
| 7 — server errors render through `Notice` with `role="alert"` | ✅ | `auth-paper.test.ts` (AC7 block); `ServerError.tsx` deleted. |
| 8 — four credential fields declare `autocomplete` | ✅ | `auth-paper.test.ts` (AC8 block). |
| 9 — no horizontal overflow at 390px on nine routes | ✅ | Browser walk: `scrollWidth` **equals** viewport width on all nine, both widths. |
| 10 — three components deleted, nothing imports them | ✅ | Green `npm run build` after each deletion; `index.test.ts` AC10 block. |
| 11 — `auth.setup.ts` passes unmodified | ✅ | 14/14 E2E green, `tests/` untouched. |
| 12 — `tokens.test.ts` unmodified, `--radius` still `0.625rem` | ✅ | 44 tests green, file untouched by this diff. |
| 13 — restoring `bg-cosmic` turns the suite red | ✅ | Proof above, output recorded. |
| 14 — PR body names the scope additions, the ratio, the issue | ✅ | PR body + summary comment: `autocomplete`, the `global.css` comment amendment, 7.14:1, issue #47. |

## The one AC read narrowly, and why

AC1 says the search should return nothing — "not the utility, not the `<body>` class, **not a test
regex**". The spec's own Edge Cases table contradicts that final clause, keeping
`primitives.test.ts:75`'s negative assertion as "still meaningful as a regression guard against
reintroduction"; three other `*-paper.test.ts` files carry the same negative regex.

**Implemented as: zero `bg-cosmic` in non-test sources; negative assertions in `*.test.ts` retained.**
The more specific rule won. Deleting those regexes would remove precisely the guards that make
reintroduction fail — and the deliberate-break proof above is only possible because they exist.
Surfaced in the PR body so a reviewer can re-open it.
