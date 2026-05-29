<!-- PLAN-REVIEW-REPORT -->
# Plan Review: S-01 First Gated Generation — Drafts in DB

- **Plan**: `context/changes/first-gated-generation/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-29
- **Verdict**: SOUND
- **Findings**: 0 critical · 2 warnings · 3 observations
- **Note**: Change is already `impl_reviewed` (Phases 1–4 complete). This review validates plan substance; `change.md` status was not regressed to `plan_reviewed`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

11/11 paths ✓, 6/6 symbols ✓ (`generateCandidateCards`, `OPENROUTER_*`, `PROTECTED_ROUTES`, `PasteAndGenerateForm`, `configStatuses`, `createClient`), brief↔plan ⚠️ (brief still says drafts appear "on their dashboard"). Progress↔Phase: 4/4 phases mapped; 32/32 criteria items present and checked. Code verification (post-build): endpoint, OpenRouter helper, and UI match plan contracts.

## Findings

### F1 — Desired "3–10 cards" vs JSON schema `minItems: 1`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Desired End State; Phase 2 §1 (`RESPONSE_SCHEMA`); openrouter system prompt
- **Detail**: Desired End State and manual criteria say the user sees 3–10 draft rows, and the system prompt asks for "between 3 and 10" cards. The strict schema allows `minItems: 1`, and the server only rejects an empty array. A compliant model could return 1–2 cards while all automated checks still pass. Implementation (`src/lib/openrouter.ts:31`, `117`) follows the schema, not the narrative minimum of 3.
- **Fix**: Raise schema `minItems` to `3` (and reject `< 3` after parse) so success criteria and schema agree; or soften Desired End State / Phase 3 manual checks to "1–10" if 1–2 cards are acceptable.
- **Decision**: PENDING

### F2 — Plan contract returns raw OpenRouter `detail` to the browser

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 §2 (`generations.ts` contract, line ~231)
- **Detail**: The plan specifies `502 { error: "ai_provider_error", detail }`. Shipped code follows that (`src/pages/api/generations.ts:59`), surfacing up to 500 chars of provider error body. The client already maps friendly messages by `error` code and ignores `detail` for display — but the field is still visible in DevTools. Impl-review F1 flagged the same gap.
- **Fix**: Change the plan contract to omit `detail` from the client JSON; log server-side instead. Align impl if still desired.
- **Decision**: PENDING

### F3 — Stale "dashboard gets paste form" in Current State Analysis

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis (line ~13)
- **Detail**: Still says "Net-new: paste form + draft list" on `/dashboard`, but the plan was user-revised to a `/generate` hub pattern (lessons.md documents why). Desired End State and Phase 3 are correct; this paragraph predates the revision and can mislead future readers or archive consumers.
- **Fix**: Rewrite the bullet to: dashboard stays a hub; paste form + draft list are net-new on `/generate`.
- **Decision**: PENDING

### F4 — Line 69 "partial-insert risk" contradicts line 54 atomic INSERT

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details (line ~69) vs What We're NOT Doing (line ~54)
- **Detail**: §What We're NOT Doing correctly states a single multi-row INSERT is atomic. Line 69 hedges with "accept partial-insert risk mid-statement," which Postgres does not do for one `INSERT … VALUES` statement. Implementation uses one bulk insert (`generations.ts:78`) — matches line 54.
- **Fix**: Delete the partial-insert sentence on line 69 or replace with a pointer to line 54.
- **Decision**: PENDING

### F5 — plan-brief still places drafts "on their dashboard"

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: `plan-brief.md` §Desired End State (line ~7)
- **Detail**: Brief opening still says users see drafts "on their dashboard." Full plan and implementation use `/dashboard` → `/generate`. Align brief with the hub + dedicated route decision.
- **Fix**: One sentence in brief: hub on dashboard, generation surface on `/generate`.
- **Decision**: PENDING
