---
tag: M3L5
title: Swallowed-Exception Audit — catch blocks that log/discard without surfacing
date: 2026-06-06
---

# M3L5 — Swallowed-Exception Audit

**Tag:** `M3L5`

## Why this report exists (lesson context)

This report is the deliverable for **Module 3, Lesson 5**. The exercise asks us
to hunt for a specific error-handling anti-pattern: a `try/catch` where an
exception is caught and **logged (or silently discarded) but never pushed onward
as an error** — i.e. the failure is observed locally yet neither surfaced to the
caller/API response nor reported to any observability sink. Such blocks hide real
bugs: the app keeps running (or shows a vague message) while the actual cause
disappears.

The goal of the lesson is to (1) locate these blocks, (2) judge whether each one
is a defensible fallback or a genuine defect, and (3) decide on the "right" shape
— capture the exception, log/report it, **and** surface a useful error.

## Scope

Audited every `try/catch` and `.catch()` under `src/` (Astro routes, API
endpoints, React components, `src/lib`). Tests excluded.

## Headline finding

The anti-pattern **as literally stated does not exist**, for a structural reason:
**this codebase does no logging at all** — no `console.error`, no `logger`, no
Sentry/telemetry. So there is no place that "logs but doesn't push to the API."

What *does* exist is the closer cousin: catch blocks that **swallow the
exception entirely** — neither logged nor reported, with at most a generic
user-facing message surviving.

## Server side — clean ✓

Every API-route catch surfaces a proper error response or rethrows:

| Location | Behavior |
| --- | --- |
| `src/pages/api/generations.ts:34` | invalid JSON → `400 bad_request` |
| `src/pages/api/generations.ts:55` | typed `OpenRouterError` → `502/504`, else `throw err` |
| `src/pages/api/reviews.ts:34` | invalid JSON → `400 bad_request` |
| `src/pages/api/generations/save.ts:50` | invalid JSON → `400 bad_request` |
| `src/lib/openrouter.ts:77` | rethrows as typed `OpenRouterError` (timeout / http_error) |
| `src/lib/openrouter.ts:96`, `:108` | throws typed `openrouter_parse_error` |

No swallowed server errors.

## Client side — the swallow pattern 👀

### Inner catches — exception fully discarded (best lesson target)

These parse an error response body and discard the caught exception with only a
comment. The real error vanishes — not logged, not reported, only a generic
message survives:

- `src/components/library/CardRow.tsx:36`
- `src/components/settings/DeleteAccountButton.tsx:51`
- `src/components/review/ReviewSession.tsx:140`
- `src/components/library/CreateCardForm.tsx:56`

```ts
} catch {
  /* non-JSON error body — keep the generic message */
}
```

**Verdict:** *defensible intent* (fall back to a generic message when the body
isn't JSON) but it is the textbook shape of the anti-pattern: the exception is
caught and thrown away with zero observability.

### Outer catches — generic message surfaced, exception still unlogged

- `src/components/library/CardRow.tsx:82`, `:102`
- `src/components/settings/DeleteAccountButton.tsx:56`
- `src/components/settings/CancelDeletionButton.tsx:23`
- `src/components/review/ReviewSession.tsx:144`
- `src/components/library/CreateCardForm.tsx:61`

```ts
} catch {
  setError({ code: "network_error", message: "Network error — please try again." });
}
```

**Verdict:** these *do* surface a `network_error` to the user, but they **never
log the underlying exception**. A real network/JS error (CORS, a thrown
`TypeError`, etc.) reaches the user as "Network error — please try again" while
the actual cause is invisible to the developer.

## Recommendation

Pick one worked example for the lesson — `CardRow.tsx` is the clearest — and
refactor it into the correct shape:

1. **Capture** the caught exception (`catch (err)` instead of bare `catch`).
2. **Log/report** it (introduce a minimal logging seam — even `console.error`
   today, swappable for telemetry later).
3. **Surface** a useful, code-tagged error to the user (already done).

This turns "the error disappeared" into "the error is observable *and* the user
is informed," which is the lesson's takeaway.

## Origin & propagation (git archaeology)

A common assumption is that boilerplate like this comes from the framework
starter. **It does not.** The Astro starter scaffold (root commit `8d2f351`,
"Initial project setup") contains no such block — the comment string
`keep the generic message` is absent from that tree, and `CardRow.tsx` did not
exist yet. The pattern is **hand-written feature code authored during the
lessons**, and it spread by copy-paste as the app grew.

**First appearance:** commit `c1ad6be` — `feat(first-gated-generation): generate
page + dashboard hub (p3)`, 2026-05-28, author Rafal S (Claude co-authored). The
originating file was `src/components/generate/PasteAndGenerateForm.tsx`.

**Propagation trail** (each `feat(...)` commit copied the helper into its new
island):

| Date | Commit | Feature | File the pattern landed in |
| --- | --- | --- | --- |
| 2026-05-28 | `c1ad6be` | first-gated-generation | `PasteAndGenerateForm.tsx` (origin) |
| 2026-05-28+ | `758d6a9` | srs-review-session | `ReviewSession.tsx` |
| 2026-05-28+ | `183b17d` | atomic-save-to-deck | draft-review / save flow |
| 2026-06-01 | `665925b` | deck-edit-delete | `CardRow.tsx` |
| 2026-06-01+ | `cbcccca` | account-deletion-with-retention | `DeleteAccountButton.tsx`, `CreateCardForm.tsx` |

**Lesson takeaway:** the anti-pattern is a *project-grown convention*, not
inherited scaffolding. A single swallow written once (2026-05-28) replicated
across five+ components through copy-paste — which is exactly why catching it
early, and fixing the convention rather than one instance, matters.

## Next plan — test-driven bugfixing + Sentry (the M3L5 → fix sequence)

The follow-up exercise turns this audit into a fix, used to *learn
test-driven bugfixing* (TDB): for a known defect, first write the smallest
automated test that fails **because of the bug** (red), then make the minimal
change to pass (green), then keep the test forever as regression armor.

**The governing dependency:** a swallowed exception produces no observable
difference — the function returns the same generic message whether or not an
exception was thrown. So the bug is invisible to a *test* for the same reason
it's invisible in *production*: there is no observability seam. Therefore the
seam must exist **before** we can red-test the swallow, and Sentry (the seam's
implementation) comes **last**. Fixing testability and fixing observability are
the same act.

Two bug classes drive two test styles:

- **Behavioral bugs** — e.g. does `parseError` extract `code`/`message` from a
  valid JSON error body? Testable today (classic TDB).
- **Observability bugs** — the swallow itself. Only testable once the seam
  exists.

### Sequence

**Phase A — Make the invisible testable**

1. **Pick the specimen & pin what already works (GREEN characterization test).**
   Canonical site: `src/components/library/CardRow.tsx` → `parseError` (smallest
   self-contained helper). Write tests for behavior that is already correct
   (valid JSON body → extracts `code`/`message`; missing fields → fallback).
   Purpose: safety net, learn the Vitest harness, separate the behavioral
   contract (works) from the observability gap (broken).
2. **Design the observability seam (interface only, Sentry-agnostic).** Create
   `src/lib/observability.ts` exporting `reportError(err, context)`, initially a
   no-op / `console.error` in dev. No Sentry yet. The seam is the contract the
   failing test asserts against, and replaces five inline SDK calls with one
   call site (kills the propagation problem).

**Phase B — Core skill: test-driven bugfix**

3. **Expose the bug (RED).** Test: a non-JSON `Response` body ⇒ `reportError` is
   called with the thrown error. Run it; watch it fail *for the right reason*
   (the bare `catch` eats the exception). This is the central TDB moment — an
   invisible bug made executable.
4. **Fix it (GREEN).** Minimal diff: `} catch {` → `} catch (err) {
   reportError(err, { where: "parseError" }); }`. Test passes; bug provably fixed
   and permanently guarded.
5. **Refactor under green.** Tidy the context payload (route, operation, user id
   — whatever makes a Sentry event actionable), naming, etc., with the test
   holding the line.

**Phase C — Generalize: fix the convention, not one instance**

6. **Extract the shared parser, then migrate the other swallow sites to it**
   (`DEC-1` locked → extract early). Lift the Phase-B specimen into a shared
   `parseErrorBody` (in `src/lib`), unit-tested once for the swallow (non-JSON
   body ⇒ `reportError` called). Then point the remaining sites — origin
   `PasteAndGenerateForm.tsx`, `ReviewSession.tsx`, `DeleteAccountButton.tsx`,
   `CreateCardForm.tsx` — at it. Those migrations are behavior-preserving
   refactors covered by the helper's test (the swallow is fixed at each by
   construction), so they need no per-component RED harness; verify via
   lint/build + manual checks.

**Phase D — Bind the seam to Sentry (production wiring, last)**

7. **Wire `reportError` → Sentry at the edge** (Astro / Cloudflare Workers init),
   env-gated (DSN from secrets, off in tests). Tests still mock the seam — Sentry
   never runs in CI. Pull current Sentry-for-Astro/Workers setup docs via
   Context7 at this step (SDK setup changes often).
8. **Verify end-to-end.** `npm run lint` + `npm run build`; trigger a real error
   manually and confirm it reaches Sentry; confirm the full test suite is green.

**Spine in one line:** pin good behavior → build the seam → red→green the swallow
→ generalize → bind Sentry → verify. Sentry is step 7, not step 1, because it is
the *enabler* of testability, not the goal.

### Open decisions to lock before execution

- **Step 6 scope — LOCKED (`DEC-1`): extract early.** Phase B's specimen rep is
  the single by-hand red→green→refactor; Phase C then extracts a shared
  `parseErrorBody` helper and migrates all 5 sites to it (a test-covered
  refactor), tested once. *Rationale (re-argued past the old "2 by hand" lean):*
  Phase B already lands one complete TDB rep, so a second hand-rep would re-type a
  byte-identical diff on the hardest (inlined-in-component) site for ~zero new
  gain; "rule of three" is already satisfied by the audit, so the abstraction
  needs no manual de-risking; and 5 manual fixes would *preserve* the duplicated
  parsers — re-enacting the copy-paste convention this audit indicts. Extraction
  is the cure and makes the other four fixes a behavior-preserving refactor
  covered by the helper's unit test.
- **Step 1 specimen — LOCKED (`DEC-2`): `CardRow.parseError`.** Already an
  extracted, module-scope pure async fn `(Response) => Promise<RowError>` —
  testable with zero React, the cleanest TDB walkthrough. The origin
  `PasteAndGenerateForm.tsx` inlines the same logic in a component handler (needs
  render + fetch mock + event sim) and is still fixed in Phase C. **Synergy:** the
  specimen *graduates into* the shared `parseErrorBody` — same artifact, one test,
  whole convention killed.

### Execution vehicle — `/10x-tdd` (Module 3, Lesson 2)

The red→green→refactor heart of this plan is driven by the **`/10x-tdd`** skill,
which is purpose-built for test-first execution and explicitly lists *"bug fixes
(write the failing repro first)"* as a TDD'able case. It is designed to
**interleave with `/10x-implement`** for phases that can't be led by a failing
test — which is exactly the shape we have.

**Preconditions:**

1. **It drives `context/changes/<id>/plan.md`, not this report.** `/10x-tdd`
   resolves a change-id / plan path and stops if there is none. So this appendix
   must first be promoted into a real change folder:

   ```
   /10x-new observability-sentry   → scaffold change folder + change.md
   /10x-plan                       → turn the 8-step sequence into a phased plan.md
                                      (authoritative ## Progress section)
   /10x-tdd observability-sentry   → drive the TDD'able phases
   ```

2. **Test infra must already exist — it does.** Vitest is in place
   (`openrouter.test.ts`, `reviews.test.ts`, `cards.test.ts`). The skill's infra
   check will find it and proceed; it will not scaffold a runner.

**How the phases route through the skill's eligibility gate**
(implementation-absent **and** TDD'able):

| Plan step | `/10x-tdd` verdict | Why |
| --- | --- | --- |
| 1. Characterization test of existing `parseError` | ❌ refuses | behavior already exists → no retroactive tests; do by hand or `/10x-implement` |
| 2. Pre-build the seam | ⚠️ folds into step 3 | see note below |
| 3–5. RED→GREEN→REFACTOR the swallow | ✅ core TDD | "bug fixes: write the failing repro first" |
| 6. Generalize across the 5 sites | ✅ TDD | more behaviors / phases |
| 7. Wire seam → Sentry at the edge | ➡️ redirect to `/10x-implement` | wiring & infra: env setup, deploy config; also needs Context7 docs |
| 8. Verify lint/build/manual | — | becomes the phase-end manual gate |

**The skill sharpens the plan (strict TDD).** `/10x-tdd` forbids *building
production code ahead of a failing test*, so the standalone "design the seam
first" (step 2) is dropped as a separate phase: the **RED test in step 3 births
the seam** — it references `reportError(...)`, fails because the module/call does
not exist yet, and GREEN creates the *minimal* seam to satisfy it. More faithful
red→green, and it is the discipline being learned.

**Net:** `/10x-tdd` is the engine for Phases B–C (the red-green-refactor heart —
the whole point of M3L5), with `/10x-implement` picking up the Sentry edge-wiring
(Phase D) — the interleaving the skill is built for. The only prerequisite is
promoting this appendix into `context/changes/observability-sentry/` via
`/10x-new` → `/10x-plan`, phased so Phase B/C land as TDD and the Sentry wiring is
its own `/10x-implement` phase.

---

## Progress & status (living tracker)

Single at-a-glance view of where this work stands. Statuses: ✅ done · 🟡 in
progress · ⬜ to do. Update the Status cell as each item moves.

**Decision (settled):** this is a **single scoped change**, driven through the
`/10x-new → /10x-plan → /10x-tdd (+ /10x-implement)` chain — **not**
`/10x-test-plan` (that skill is a product-wide rollout orchestrator and defers
single-scope test work to `/10x-tdd`).

IDs are phase-prefixed so you can call a step directly (e.g. "let's do **B-1**").
`INV`=investigation, `DEC`=decision, `SET`=scaffold/setup, `A/B/C/D`=plan phases.

| ID | Step | Skill / action | Status |
| --- | --- | --- | --- |
| **Investigation & report** | | | |
| `INV-1` | Audit codebase for swallowed exceptions | manual grep/read | ✅ done |
| `INV-2` | Write M3L5 report (findings, server vs client) | this file | ✅ done |
| `INV-3` | Git archaeology — origin & propagation | `git log -G` | ✅ done |
| `INV-4` | Design the fix sequence (Phases A–D) | brainstorm | ✅ done |
| `INV-5` | Choose execution vehicle (`/10x-tdd` vs alternatives) | skill review | ✅ done |
| `INV-6` | Confirm flow: single-change chain, not `/10x-test-plan` | skill review | ✅ done |
| **Pre-execution decisions** | | | |
| `DEC-1` | Lock Step 6 scope → **extract early**: Phase B specimen is the one hand rep, then extract a shared `parseErrorBody` and migrate all 5 sites (test once). *(Shifted past the old "2 by hand" lean — see rationale below.)* | decision | ✅ done |
| `DEC-2` | Lock specimen → **`CardRow.parseError`** (already an extracted pure fn; origin still fixed in Phase C). | decision | ✅ done |
| **Scaffold the change** | | | |
| `SET-1` | Open change folder `observability-sentry` | `/10x-new` | ✅ done |
| `SET-2` | (optional) Ground the seam + 5 sites in code | `/10x-research` | ⏭️ skipped (audit already grounded; plan did targeted reads) |
| `SET-3` | Write the phased `plan.md` (Progress section) | `/10x-plan` | ✅ done |
| **Phase A — make the invisible testable** | | | |
| `A-1` | Characterization test of existing `parseError` (GREEN) | `/10x-implement` (TDD refuses existing code) | ✅ done (`8833953`) |
| **Phase B — test-driven bugfix the specimen** | | | |
| `B-1` | RED: non-JSON body ⇒ `reportError` called | `/10x-tdd` | ✅ done (`f6c8e6b`) |
| `B-2` | GREEN: `catch (err)` + minimal `reportError` seam | `/10x-tdd` | ✅ done (`f6c8e6b`) |
| `B-3` | REFACTOR: tidy context payload, stay green | `/10x-tdd` | ✅ done (`f6c8e6b`) |
| **Phase C — generalize (kill the convention)** | | | |
| `C-1` | Extract shared `parseErrorBody` (test once) + migrate the other 4 sites to it (behavior-preserving refactor) | `/10x-tdd` + `/10x-implement` | ✅ done (`5bd0917`) |
| **Phase D — bind the seam to Sentry** | | | |
| `D-1` | Wire `reportError` → Sentry at the edge (env-gated) | `/10x-implement` + Context7 docs | ✅ done (`403ce62`) |
| `D-2` | Verify: `npm run lint` + `npm run build` + manual Sentry hit | manual | ✅ done (`403ce62`) |

**Status:** ✅ **Shipped & archived.** All phases (A–D) landed; the change was
impl-reviewed and archived to
`context/archive/2026-06-06-observability-sentry/` (`chore(archive): close
observability-sentry`, `c6f15ae`). The swallowed-exception convention is gone:
all six inner sites route through `src/lib/parse-error.ts`, reporting via the
`src/lib/observability.ts` seam (Sentry-bound, env-gated). Open follow-ups
recorded in the change's `reviews/impl-review.md`: **F3** — the *outer*
network-error catches (audit §"Outer catches") remain unobserved, a deliberate
out-of-scope item for a future change.

> Note: once the change folder exists, `plan.md`'s own `## Progress` section
> becomes the authoritative execution tracker for items 12–18 (that's what
> `/10x-tdd` and `/10x-implement` read and check off). This table stays as the
> human-readable overview spanning investigation → shipping.
