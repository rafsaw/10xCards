# Observability Seam + Sentry — Plan Brief

> Full plan: `context/changes/observability-sentry/plan.md`
> Source of truth (audit, doubles as frame + research): `context/foundation/swallowed-exceptions-audit.md`

## What & Why

The app has **no logging or telemetry at all**, so a copy-pasted error-body
`try/catch` **swallows its caught exception entirely** — a non-JSON error body
vanishes with zero observability, leaving only a generic user message. We
introduce one `reportError` seam, prove it via a test-driven bugfix on a single
specimen, and **kill the copy-paste convention** by extracting one shared parser.
Sentry is the seam's eventual production transport — fully specified but deferred.

## Starting Point

Six components carry a byte-identical inner swallow
(`} catch { /* non-JSON error body — keep the generic message */ }`). The
specimen, `CardRow.parseError`, is already an extracted pure async function — the
cleanest unit-under-test. Server-side routes are clean. Vitest is configured;
`openrouter.test.ts` is the fetch-stub harness model.

## Desired End State

`src/lib/parse-error.ts` holds the one `parseErrorBody` every site calls; its
`catch` reports through `src/lib/observability.ts`'s `reportError` instead of
discarding. All six inner-swallow sites route through it — no inlined swallow
remains. A permanent test guards both the behavioral contract and the
non-JSON-body regression. Forced errors are now visible in dev via `console.error`.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Specimen | `CardRow.parseError` | Already a pure fn — zero-React, cleanest TDB walkthrough | Audit (DEC-2) |
| Phase C scope | Extract early: one shared `parseErrorBody`, tested once | Kills the copy-paste convention; other sites migrate as covered refactors | Audit (DEC-1) |
| Swallow shape in scope | Inner `parseError`-body only | Outer network catches are a separate concern | Plan |
| DraftReviewList | Include (6th site) | Same inner pattern though unlisted — eliminate the convention, not preserve counts | Plan |
| Seam shape | `reportError(err, context?)`, `console.error` in dev / no-op | Minimal contract; makes the invisible visible; trivial to spy on | Plan |
| Sentry reach | Plan all 4 phases; execute A–C now, D deferred | Lands the lesson's core (TDB) without blocking on a DSN/account | Plan |
| Seam birth | Created by Phase B's RED test, not Phase A | Strict TDD — no production seam ahead of a failing test | Audit/Plan |

## Scope

**In scope:** Extract `parseErrorBody`; create `reportError` seam; TDB the swallow
on the specimen; migrate 6 inner sites; characterization + regression tests.

**Out of scope:** Outer network-error catches (incl. CancelDeletionButton);
server-side routes; executing Sentry wiring; any logging framework.

## Architecture / Approach

`parseErrorBody` (in `src/lib`) is the single error-body parser; its `catch` calls
`reportError` (in `src/lib/observability.ts`) — the one seam, `console.error` in
dev, no-op otherwise, with Sentry slotting into that branch at Phase D. Six
components consume `parseErrorBody` and apply their own `FALLBACK_MESSAGES`. Tests
stub `fetch` and mock the seam.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| A. Extract & characterize | `parseErrorBody` extracted; correct behavior pinned (`/10x-implement`) | Accidentally pre-building the seam/RED test, breaking TDD discipline |
| B. TDB the swallow | RED births the seam → GREEN one-line fix → REFACTOR (`/10x-tdd`) | RED must fail for the *right* reason (swallow), not a test artifact |
| C. Kill the convention | 5 remaining sites migrated to the shared helper (`/10x-tdd`+`/10x-implement`) | Per-site `FALLBACK_MESSAGES` divergence regressing a message |
| D. Bind Sentry (deferred) | Env-gated `reportError` → Sentry at the edge (later `/10x-implement`) | Workers runtime may rule out the Node-oriented Astro SDK |

**Prerequisites:** None for A–C (Vitest in place). Phase D needs a Sentry
project + DSN secret and Context7 SDK research.
**Estimated effort:** ~2–3 sessions for A–C; Phase D a separate short session.

## Open Risks & Assumptions

- Each component's `FALLBACK_MESSAGES` map differs; the helper must return raw
  `{ code, message }` and let each site apply its own fallback (no message regression).
- `ReviewSession` has a slightly different error shape (`finally` block,
  `FALLBACK_MESSAGES.network_error`) — migration must preserve it.
- Phase D's exact Sentry SDK for Astro-on-Cloudflare-Workers is unresolved by
  design; resolve via Context7 at execution.

## Success Criteria (Summary)

- A forced non-JSON error is now **observable** (logged via the seam) instead of
  silently swallowed — across all six surfaces.
- No inlined swallow / `keep the generic message` comment remains in
  `src/components/**`; one shared parser, one regression test.
- User-facing error messages and happy paths are unchanged; `npm test`, `lint`,
  `typecheck`, `build` all green.
