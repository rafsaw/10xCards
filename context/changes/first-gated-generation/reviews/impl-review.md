<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First Gated Generation (S-01)

- **Plan**: context/changes/first-gated-generation/plan.md
- **Scope**: Phases 1–4 of 4 (full plan)
- **Date**: 2026-05-28
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Scope note

The implementation faithfully follows the on-disk plan (`plan.md` — the "drafts-in-DB" S-01
slice). Files persist generated cards directly as `status='draft'` rows; there is no
candidate-review / save-endpoint / rate-limiter / `generations` table layer, because the plan
explicitly defers all of those (`plan.md` §"What We're NOT Doing"). The real files reviewed:
`src/lib/openrouter.ts`, `src/pages/api/generations.ts`, `src/pages/api/generations/discard.ts`,
`src/pages/generate.astro`, `src/components/generate/PasteAndGenerateForm.tsx`,
`src/middleware.ts`, `src/lib/config-status.ts`, `src/pages/dashboard.astro`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated success criteria re-run this session: `npx astro sync` (exit 0), `npm run lint`
(exit 0), `npm run build` (exit 0). Manual criteria are checked in the plan's Progress section
with per-phase commit references (3dabd75 / 9de9f62 / c1ad6be / 85a6f0d).

## Findings

### F1 — OpenRouter error body leaked to client

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/generations.ts:59
- **Detail**: On `ai_provider_error`, the 502 response returns `detail: err.detail`, which is the
  first 500 chars of the raw OpenRouter error body (`src/lib/openrouter.ts:89`). This leaks
  provider-side internals (model names, config hints, provider error text) to the browser. The
  API key itself is not exposed, but the detail string serves no client purpose and the client
  already has a friendly `FALLBACK_MESSAGES` map keyed by `error` code.
- **Fix**: Drop `detail` from the client response; `console.error(err.detail)` server-side for
  observability instead.
- **Decision**: PENDING

### F2 — Discard endpoint returns raw JSON to a form POST on error

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/generations/discard.ts:24-25
- **Detail**: `discard.ts` is invoked by a native HTML `<form method="POST">`
  (`generate.astro:64-75`) and `context.redirect("/generate")` on success — but on a DB error it
  returns a JSON body (`{ error: "db_error", ... }`), which the browser renders as a raw JSON
  page instead of a user-facing error. This matches the plan contract (`plan.md:247` says
  "On error, returns 500"), so it is plan-adherent; it is only a UX wart on the (rare) error
  path. The auth form endpoints redirect-with-`?error=` instead.
- **Fix**: On error, `context.redirect("/generate?error=discard_failed")` and surface the message
  on the page, matching the auth form-POST pattern.
- **Decision**: PENDING

### F3 — Draft SELECT relies solely on RLS (no explicit user_id filter)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/pages/generate.astro:19-24
- **Detail**: The draft list query filters only `.eq("status", "draft")` and depends entirely on
  the `cards_select_own` RLS policy for per-user scoping. This is correct (the SSR client carries
  the user JWT, anon key is RLS-constrained) and is what the plan intends (`plan.md:289` — "RLS
  scopes this to the caller automatically"). It is the one read that does not belt-and-suspenders
  the `user_id` predicate the insert (`generations.ts:72`) and delete (`discard.ts:22`) both do.
- **Fix**: Add `.eq("user_id", Astro.locals.user.id)` for defense-in-depth and consistency with
  the other two queries. (`generate.astro` would need to read `Astro.locals.user`, which the
  middleware guarantees on this protected route.)
- **Decision**: PENDING

### F4 — No rate limiting on the paid AI endpoint (accepted per plan)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/pages/api/generations.ts (whole handler)
- **Detail**: Any authenticated user can POST `/api/generations` in a loop, each call making a
  real (paid) OpenRouter request with up to 8000 chars in. There is no throttle. This is an
  explicit, documented decision — `plan.md:51`: "No rate limiting on the endpoint beyond
  OpenRouter's natural per-key limits. Solo dogfood scale." So it is in-scope as an accepted risk,
  not drift. Recorded so it is not forgotten when the app moves beyond single-user dogfooding.
- **Fix**: None now (accepted). Revisit (per-user window throttle) before opening to more users.
- **Decision**: PENDING

### F5 — Minor cleanups in the form island and endpoints

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/generate/PasteAndGenerateForm.tsx:39,78; src/pages/api/generations.ts:10-15 + discard.ts:4-9
- **Detail**: Three small items, none blocking (lint + build are green):
  (a) `handleSubmit(e: React.SubmitEvent<HTMLFormElement>)` — `React.SubmitEvent` is non-standard
  (the conventional type is `React.FormEvent`); it is copied verbatim from `SignInForm.tsx:36`, so
  it is a pre-existing project convention and compiles cleanly.
  (b) Line 78 `message || FALLBACK_MESSAGES[code]` is dead — `message` is always truthy (defaulted
  at line 66, only overwritten by a truthy value at line 73), so `FALLBACK_MESSAGES` is never used
  as a fallback.
  (c) The `json()` helper is duplicated identically in `generations.ts` and `discard.ts`.
- **Fix**: Optional tidy-up — switch to `React.FormEvent`, wire `FALLBACK_MESSAGES` as the real
  fallback (or delete it), and hoist `json()` to `src/lib/`.
- **Decision**: PENDING
