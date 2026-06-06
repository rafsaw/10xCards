# Observability Seam + Sentry — Fix the Swallowed-Exception Convention

## Overview

The codebase has no logging or telemetry at all. As a result, a copy-pasted
`try/catch` that parses an error-response body **swallows the caught exception
entirely** — a non-JSON error body (or any throw inside the parse) vanishes with
zero observability, leaving only a generic user message. This plan makes that
invisible failure **observable** by introducing a single `reportError` seam,
proves it via a test-driven bugfix on one specimen, then **kills the convention**
by extracting one shared parser that all sites call. Sentry is the seam's eventual
production implementation, fully specified as Phase D but executed later.

This change is the executable promotion of the M3L5 audit
(`context/foundation/swallowed-exceptions-audit.md`), which is the source of
truth for the findings, the Phase A–D sequence, and the two locked decisions.

## Current State Analysis

- **No observability anywhere** — no `console.error`, no logger, no Sentry. The
  audit's headline: the literal "logs but doesn't surface" anti-pattern cannot
  exist because nothing logs; what exists is the harsher cousin — **full swallow**.
- **The inner swallow** (`} catch { /* non-JSON error body — keep the generic
  message */ }`) is byte-identical across **six** components (the audit named 4 +
  origin; grep also found `DraftReviewList.tsx`, unlisted):
  - `src/components/library/CardRow.tsx:36` — **specimen**; already an extracted,
    module-scope pure async fn `parseError(response): Promise<RowError>`.
  - `src/components/library/CreateCardForm.tsx:56` — inlined in handler.
  - `src/components/generate/DraftReviewList.tsx:94` — inlined in handler.
  - `src/components/generate/PasteAndGenerateForm.tsx:75` — inlined; the origin.
  - `src/components/review/ReviewSession.tsx:140` — inlined.
  - `src/components/settings/DeleteAccountButton.tsx:51` — inlined.
- **Server side is clean** — every API-route catch surfaces a typed error
  response or rethrows (audit "Server side — clean ✓"). Out of scope.
- **Test harness exists and fits.** Vitest is configured (`vitest.config.ts`,
  `npm test` → `vitest run`). `src/lib/openrouter.test.ts` is the model: it stubs
  global `fetch` with `Partial<Response>` fakes (`json: () => Promise.resolve(…)`)
  and follows strict "oracle discipline" (hand-authored fixtures, never lift the
  expected value from the code under test). A `Response` whose `.json()` *rejects*
  reproduces the swallow in three lines.
- **`src/lib/` is the home** for shared helpers (`openrouter.ts`, `leitner.ts`,
  `account-retention.ts`, …) — the natural location for both `parse-error.ts` and
  `observability.ts`.

### Key Discoveries

- Specimen is already a pure function (`CardRow.tsx:25-40`) — the cleanest
  possible unit-under-test; no React render needed (DEC-2).
- `openrouter.test.ts:14-32` — the exact fetch-stub pattern to reuse for the
  characterization and RED tests.
- The non-JSON path is the *only* part of `parseError` that is buggy; the
  valid-JSON and missing-field paths are already correct (so Phase A can pin them
  as a safety net without touching the bug).
- `npm run typecheck` is `astro sync && astro check`; CI does not gate `main`
  (AGENTS.md) — local lint/build/test is the only gate.

## Desired End State

- `src/lib/parse-error.ts` exports `parseErrorBody(response)` — the single parser
  every inner error-body site calls. Its `catch` reports the swallowed exception
  through the seam instead of discarding it.
- `src/lib/observability.ts` exports `reportError(err, context?)` — the one seam;
  `console.error` in dev, no-op otherwise, swappable for Sentry at the edge.
- All six inner-swallow sites route through `parseErrorBody`; none has an inlined
  swallow left. The copy-paste convention is gone.
- `src/lib/parse-error.test.ts` permanently guards both the behavioral contract
  (valid JSON → `code`/`message`; missing → fallback) and the regression
  (non-JSON body ⇒ `reportError` called).
- **Verify:** `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` all
  green; manual check of `/library`, `/generate`, `/review`, `/settings` shows
  unchanged user-facing behavior, and a forced non-JSON error logs via the seam
  in dev.
- Phase D (Sentry wiring) is fully written below but intentionally **not executed**
  in this change.

## What We're NOT Doing

- **Not** touching the **outer network-error catches** (`} catch {
  setError(network_error) }` at CardRow:82/:102, CreateCardForm:61,
  DraftReviewList:99, PasteAndGenerateForm:80, ReviewSession:144,
  DeleteAccountButton:56, CancelDeletionButton:23). Explicitly out of scope — a
  separate concern (they catch fetch/JS throws, not JSON-parse throws, and are not
  covered by `parseErrorBody`). `CancelDeletionButton` therefore drops out
  entirely (it has no inner parse body).
- **Not** touching server-side API routes (already clean).
- **Not** executing Phase D — no Sentry account, DSN, deploy config, or SDK
  install in this change. Phase D is specified for a later `/10x-implement`.
- **Not** building a logging framework — the seam is a single function.
- **Not** retroactively TDD-ing existing-correct behavior (Phase A is
  characterization + refactor, run via `/10x-implement`; `/10x-tdd` refuses it).

## Implementation Approach

Spine: **extract & pin → red→green the swallow (seam born by the RED test) →
generalize by migration → (deferred) bind Sentry.** The specimen graduates *into*
the shared helper, so the one TDB rep in Phase B is simultaneously the fix for all
six sites once Phase C migrates them. Strict TDD discipline: no production seam is
written ahead of the failing test — Phase A only extracts existing code and pins
existing behavior; the seam (`observability.ts`) does not exist until Phase B's RED
test references it and GREEN creates the minimal version.

## Critical Implementation Details

- **Seam-birth ordering (Phase A vs B).** Phase A must NOT create
  `observability.ts` and must NOT add the non-JSON test — doing either pre-empts
  Phase B's RED and breaks the "no production code ahead of a failing test"
  discipline that is the lesson. Phase A extracts `parseErrorBody` (a
  behavior-preserving move of existing code) and tests only the already-correct
  paths.
- **Oracle discipline (all tests).** Mirror `openrouter.test.ts`: every fixture is
  hand-authored with a known shape; never derive an expected value from
  `parseErrorBody` itself. The non-JSON fixture is a `Response` whose `.json()`
  returns a rejected promise.
- **Behavior preservation in migration (Phase C).** `parseErrorBody` must return
  the same `{ code, message }` shape each inlined site currently computes,
  including each site's `FALLBACK_MESSAGES` lookup. The fallback map differs per
  component — the helper returns the raw `{ code, message }` and each call site
  keeps applying its own `FALLBACK_MESSAGES[code]`, so no message regresses.

## Phase 1: Phase A — Extract & characterize the specimen

### Overview

Make the specimen importable and pin its correct behavior as a safety net, without
introducing the seam or the bug's test. Driven by `/10x-implement` (refactor +
retroactive characterization tests — `/10x-tdd` refuses existing code).

### Changes Required

#### 1. Extract the shared parser

**File**: `src/lib/parse-error.ts` (new)

**Intent**: Move the byte-identical parse body out of `CardRow.tsx` into a single
pure helper, so it can be unit-tested and (in Phase C) reused everywhere. Pure
move — no behavior change, the swallow stays intact for now (it's Phase B's job).

**Contract**: `export async function parseErrorBody(response: Response):
Promise<{ code: string; message: string }>`. Returns `code: "unknown"` /
`message: ""`-or-generic defaults when fields are absent, matching the current
`CardRow.parseError` logic. The `} catch { /* non-JSON */ }` block is preserved
verbatim at this step.

#### 2. Point the specimen at the helper

**File**: `src/components/library/CardRow.tsx`

**Intent**: CardRow becomes the first consumer of `parseErrorBody`; delete its
local `parseError` body and call the helper, applying CardRow's existing
`FALLBACK_MESSAGES` to the returned `{ code, message }`. Behavior-preserving.

**Contract**: `parseError` either disappears (call site uses `parseErrorBody`
directly) or becomes a thin wrapper that applies `FALLBACK_MESSAGES`. No change to
`RowError` consumption or the two `handleSave`/`handleDelete` call sites' visible
behavior.

#### 3. Characterization tests (GREEN — pin what already works)

**File**: `src/lib/parse-error.test.ts` (new)

**Intent**: Lock the already-correct behavior as a regression net before any
bug-fixing: a valid JSON error body yields its `code`/`message`; missing or
wrong-typed fields fall back to defaults. Deliberately **omit** the non-JSON case
— that is Phase B's RED.

**Contract**: Vitest suite using the `openrouter.test.ts` fetch-stub pattern
(`Partial<Response>` with `json: () => Promise.resolve(fixture)`). Cases: full
valid body; missing `message`; missing `error`; non-string fields. No reference to
`reportError` (it must not exist yet).

### Success Criteria

#### Automated Verification

- Characterization tests pass: `npm test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification

- `/library` edit + delete still show the correct error message on a failing
  request (behavior unchanged after extraction).
- No new console output appears (seam not introduced yet).

**Implementation Note**: After completing this phase and all automated
verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Phase B — Test-driven bugfix the swallow (specimen)

### Overview

The core M3L5 moment: make the invisible swallow executable (RED), fix it
minimally (GREEN), tidy under green (REFACTOR). Driven by `/10x-tdd`. The RED test
**births the seam** — it references a not-yet-existing `reportError`, so it fails
both because the `catch` swallows and because the module is absent; GREEN creates
the minimal seam.

### Changes Required

#### 1. RED — expose the swallow

**File**: `src/lib/parse-error.test.ts`

**Intent**: Add the failing test that proves the bug: a `Response` whose `.json()`
rejects (non-JSON body) must cause `reportError` to be called with the thrown
error. It fails today because the bare `catch` discards the exception.

**Contract**: New case stubbing `json: () => Promise.reject(new SyntaxError(...))`;
`vi.mock("@/lib/observability")` (or spy on its `reportError`); assert
`reportError` was called once with the thrown error and a context object. Test is
RED — `@/lib/observability` does not exist and `parseErrorBody` does not call it.

#### 2. GREEN — minimal seam + capture

**File**: `src/lib/observability.ts` (new)

**Intent**: Create the smallest `reportError` that satisfies the RED test — the
single observability call site that replaces five-plus inline discards.

**Contract**: `export function reportError(err: unknown, context?: { where: string;
[key: string]: unknown }): void`. Dev (`import.meta.env.DEV`) → `console.error`;
otherwise no-op (Sentry slots in here at Phase D). No SDK, no env beyond the dev
flag.

**File**: `src/lib/parse-error.ts`

**Intent**: Replace the swallow with capture-and-report — the one-line fix that is
the whole point of the exercise.

**Contract**: `} catch {` → `} catch (err) { reportError(err, { where:
"parseErrorBody" }); }`. The generic fallback `{ code, message }` is still
returned (user-facing behavior unchanged); the exception is now observable.

#### 3. REFACTOR — tidy under green

**File**: `src/lib/observability.ts`, `src/lib/parse-error.ts`

**Intent**: With the test holding the line, finalize the context payload shape and
the dev/no-op branch (naming, comments) so a future Sentry event is actionable.

**Contract**: Context stays `{ where: string; [key: string]: unknown }`; document
that Phase D injects the Sentry transport here. No behavior change; test stays
green.

### Success Criteria

#### Automated Verification

- RED test fails for the right reason before the fix (observed during `/10x-tdd`),
  then the full suite passes: `npm test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`

#### Manual Verification

- In dev, forcing a non-JSON error body on a `/library` edit/delete prints a
  `console.error` via the seam (previously silent).
- The user still sees the same generic error message (no UX regression).

**Implementation Note**: After completing this phase and all automated
verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Phase C — Kill the convention (migrate the other 5 sites)

### Overview

Generalize the fix by routing the remaining five inner-swallow sites through
`parseErrorBody`, deleting their inlined catches. Each migration is a
behavior-preserving refactor; the swallow is fixed at each **by construction**
(covered by Phase B's shared test), so no per-component RED harness is needed.
Driven by `/10x-tdd` for any helper additions and `/10x-implement` for the
mechanical migrations.

### Changes Required

#### 1. Migrate the five inlined sites

**Files**:
- `src/components/library/CreateCardForm.tsx` (replace `:53-58` inline parse)
- `src/components/generate/DraftReviewList.tsx` (replace `:90-96` inline parse)
- `src/components/generate/PasteAndGenerateForm.tsx` (replace `:65-77` inline parse)
- `src/components/review/ReviewSession.tsx` (replace `:135-142` inline parse)
- `src/components/settings/DeleteAccountButton.tsx` (replace `:47-53` inline parse)

**Intent**: Delete each component's inlined `let code/message … try { … } catch
{ /* non-JSON */ }` block and call `parseErrorBody(response)` instead, then apply
that component's own `FALLBACK_MESSAGES[code]` to the returned `{ code, message }`.
Removes the duplicated swallow everywhere it was copied.

**Contract**: Each site ends with `const { code, message } = await
parseErrorBody(response); setError({ code, message: message ||
FALLBACK_MESSAGES[code] })` (adapting to each component's error-state shape, e.g.
`ReviewSession`'s `FALLBACK_MESSAGES.network_error` usage and `finally` block). No
change to outer network catches. No change to each component's `FALLBACK_MESSAGES`
map.

#### 2. Helper test covers the shared behavior once

**File**: `src/lib/parse-error.test.ts`

**Intent**: Confirm the existing suite is the single regression guard for all six
sites; add a case only if a migrated site exercises a parse branch not already
covered.

**Contract**: No new per-component test files. The Phase A/B suite is authoritative.

### Success Criteria

#### Automated Verification

- Full suite passes: `npm test`
- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build passes: `npm run build`
- No inlined `/* non-JSON error body — keep the generic message */` comment
  remains in `src/components/**` (the convention is gone): grep returns nothing.

#### Manual Verification

- Each affected surface shows the correct error message on a failing request:
  `/library` (create), `/generate` (paste + draft review), `/review`, `/settings`
  (delete account).
- In dev, a forced non-JSON error on each surface logs via the seam.
- No visual or flow regressions on the happy paths.

**Implementation Note**: After completing this phase and all automated
verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Phase D — Bind the seam to Sentry (documented; deferred)

### Overview

**Specified now, executed in a later `/10x-implement`** once a Sentry project/DSN
exists. Wires `reportError` to Sentry at the Astro / Cloudflare Workers edge,
env-gated and off in tests. Pull current SDK setup via Context7 at execution time
(Sentry-for-Astro / Workers setup changes often). No code lands in this change.

### Changes Required (for the future implementer)

#### 1. Inject the Sentry transport into the seam

**File**: `src/lib/observability.ts`

**Intent**: Replace the no-op branch of `reportError` with a Sentry capture when a
DSN is configured, keeping `console.error` in dev and no-op when unconfigured.

**Contract**: `reportError(err, context)` calls `Sentry.captureException(err, {
extra: context })` when the DSN env var is present; signature unchanged so no call
site changes. Env var read via `astro:env` / Workers binding, never hardcoded.

#### 2. Initialize Sentry at the edge

**File**: Astro/Workers init (e.g. `src/middleware.ts` or a Workers entry as the
current SDK docs dictate)

**Intent**: One-time Sentry init gated on the DSN secret; disabled in dev/test.

**Contract**: DSN sourced from Cloudflare secret + GitHub repo secret (per
AGENTS.md security guidance); init is a no-op without the secret. Exact SDK
(`@sentry/astro` vs `@sentry/cloudflare`) resolved via Context7 — the Workers
runtime may rule out the Node-oriented integration.

### Success Criteria

#### Automated Verification

- Tests still green and **still mock the seam** (Sentry never runs in CI):
  `npm test`
- Type checking passes: `npm run typecheck`
- Build passes: `npm run build`

#### Manual Verification

- With a real DSN configured, a forced error reaches the Sentry project.
- With no DSN (dev/test), `reportError` stays `console.error`/no-op — nothing sent.

**Implementation Note**: This phase is deferred. Do not execute until a Sentry DSN
is provisioned; track it as a follow-up `/10x-implement observability-sentry phase
4`.

---

## Testing Strategy

### Unit Tests

- `parseErrorBody`: valid JSON → `code`/`message`; missing `error`; missing
  `message`; wrong-typed fields → fallback (Phase A).
- `parseErrorBody`: non-JSON body (`.json()` rejects) ⇒ `reportError` called with
  the thrown error + context (Phase B, the regression guard).
- All fixtures hand-authored (oracle discipline), fetch stubbed per
  `openrouter.test.ts`.

### Integration Tests

- None added. Existing API-route integration tests are unaffected (server side
  untouched).

### Manual Testing Steps

1. Trigger a failing request on `/library` edit, `/library` create, `/generate`
   paste, `/generate` draft review, `/review`, `/settings` delete — confirm the
   correct user-facing message still appears.
2. In dev, force a non-JSON error body (e.g. stub an HTML 500) and confirm a
   `console.error` from the seam appears for each surface.
3. Confirm happy paths are unchanged.

## Performance Considerations

Negligible — one extra function call per error path; the seam is `console.error`
or no-op. No hot-path impact.

## Migration Notes

Pure code refactor; no data or schema migration. The only behavioral delta is the
intended one: previously-swallowed exceptions now reach `reportError`.

## References

- Audit / source of truth: `context/foundation/swallowed-exceptions-audit.md`
- Change identity + locked decisions: `context/changes/observability-sentry/change.md`
- Test-harness model: `src/lib/openrouter.test.ts:14-40`
- Specimen: `src/components/library/CardRow.tsx:25-40`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step
> lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Phase A — Extract & characterize the specimen

#### Automated

- [x] 1.1 Characterization tests pass: `npm test` — 8833953
- [x] 1.2 Type checking passes: `npm run typecheck` — 8833953
- [x] 1.3 Linting passes: `npm run lint` — 8833953
- [x] 1.4 Build passes: `npm run build` — 8833953

#### Manual

- [x] 1.5 `/library` edit + delete still show correct error message (behavior unchanged) — 8833953
- [x] 1.6 No new console output appears (seam not introduced yet) — 8833953

### Phase 2: Phase B — Test-driven bugfix the swallow (specimen)

#### Automated

- [x] 2.1 RED test fails for the right reason, then full suite passes: `npm test` — f6c8e6b
- [x] 2.2 Type checking passes: `npm run typecheck` — f6c8e6b
- [x] 2.3 Linting passes: `npm run lint` — f6c8e6b
- [x] 2.4 Build passes: `npm run build` — f6c8e6b

#### Manual

- [x] 2.5 Dev: forced non-JSON error on `/library` edit/delete prints `console.error` via the seam — f6c8e6b
- [x] 2.6 User still sees the same generic error message (no UX regression) — f6c8e6b

### Phase 3: Phase C — Kill the convention (migrate the other 5 sites)

#### Automated

- [x] 3.1 Full suite passes: `npm test` — 5bd0917
- [x] 3.2 Type checking passes: `npm run typecheck` — 5bd0917
- [x] 3.3 Linting passes: `npm run lint` — 5bd0917
- [x] 3.4 Build passes: `npm run build` — 5bd0917
- [x] 3.5 No `/* non-JSON error body — keep the generic message */` comment remains in `src/components/**` — 5bd0917

#### Manual

- [ ] 3.6 Correct error message on failing request across `/library` create, `/generate` paste + draft, `/review`, `/settings` delete
- [ ] 3.7 Dev: forced non-JSON error logs via the seam on each surface
- [ ] 3.8 No regressions on happy paths

### Phase 4: Phase D — Bind the seam to Sentry (documented; deferred)

#### Automated

- [ ] 4.1 Tests green and still mock the seam: `npm test`
- [ ] 4.2 Type checking passes: `npm run typecheck`
- [ ] 4.3 Build passes: `npm run build`

#### Manual

- [ ] 4.4 With a real DSN, a forced error reaches the Sentry project
- [ ] 4.5 With no DSN, `reportError` stays `console.error`/no-op — nothing sent
