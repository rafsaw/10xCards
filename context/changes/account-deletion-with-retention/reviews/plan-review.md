<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Account Deletion with 30-Day Retention

- **Plan**: context/changes/account-deletion-with-retention/plan.md
- **Mode**: Deep
- **Date**: 2026-06-02
- **Verdict**: REVISE
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

13/13 paths ✓ (all plan-referenced files exist), symbols ✓ (7 mutating handlers
confirmed: cards POST, cards/[id] PATCH+DELETE, generations POST, generations/save
POST, generations/discard POST, reviews POST; `account_deletion_requests` schema +
cascade confirmed at migration 20260527150510:55-80; `App.Locals` location confirmed
at src/env.d.ts), brief↔plan ✓. Progress↔Phase: well-formed — one `## Progress`
heading, all phases and success-criteria bullets mapped to `- [ ]` items.

## Findings

### F1 — Raw `DELETE FROM auth.users` rests on an unverified Supabase privilege

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Sweep function; Migration Notes
- **Detail**: The deletion mechanism is a postgres-owned `SECURITY DEFINER` function running `DELETE FROM auth.users`. Verified against current Supabase: `auth.users` is owned by `supabase_auth_admin` (a "read-only managed" schema); the migration role `postgres` is NOT a superuser and does NOT own that table; and you cannot make a function owned by `supabase_auth_admin` (can't grant that role membership on managed Supabase). Whether `postgres` has DELETE on `auth.users` is genuinely uncertain — it empirically works in the SQL Editor (runs as postgres), so a postgres-owned definer function likely inherits the same rights, but Supabase's *supported* deletion path is the Auth Admin API (`auth.admin.deleteUser`, service_role). The plan says "owned by a role permitted to delete from auth.users" and "verify the cascade, don't assume" but (a) never names HOW to guarantee that ownership and (b) its only documented fallback covers "pg_cron unavailable," not "postgres can't delete auth.users" — so a Phase 1 test failure dead-ends with no Plan B. CONFIRMED-fine and not at risk: pg_cron availability, the `revoke execute from public/anon/authenticated` (cron runs as postgres = the scheduling role, so the revoke is safe), and the auth-schema child-table cascades (sessions/identities/refresh_tokens/one_time_tokens/mfa_factors). Note: this app has no Supabase Storage usage, so the storage-object-ownership delete blocker does not apply here.
- **Fix A ⭐ Recommended**: Keep raw DELETE, add a privilege gate + documented fallback
  - Strength: Proves the cheapest path first (likely works as postgres); preserves the plan's "no service_role secret in the app" decision driver; Phase-1-first sequencing already isolates the risk — just give it an exit.
  - Tradeoff: The fallback (pg_cron → pg_net → Edge Function → `auth.admin.deleteUser`) is a different architecture that may need its own mini-plan if triggered.
  - Confidence: MED — raw DELETE probably works, but unverified until the Phase 1 test runs on the real project.
  - Blind spot: Edge-Function fallback's own auth/secret wiring is unscoped.
- **Fix B**: Switch Phase 1 to the supported Edge Function path now
  - Strength: Supabase-supported; no privilege gamble; deterministic.
  - Tradeoff: Adds a service_role secret + Edge Function the plan deliberately avoided; more moving parts.
  - Confidence: HIGH — this is the documented mechanism.
  - Blind spot: Reintroduces a secret the team chose to keep out.
- **Decision**: PENDING

### F2 — SECURITY DEFINER function has no pinned search_path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Sweep function Contract (plan.md:78)
- **Detail**: The function Contract specifies `security definer` but no `set search_path`. Supabase's DB linter flags unpinned search_path on SECURITY DEFINER functions as a security footgun (search-path hijacking). Easy now, annoying to retrofit.
- **Fix**: Add `set search_path = ''` to the function definition and fully-qualify all object names (`auth.users`, `public.account_deletion_requests`). Clears the linter warning.
- **Decision**: PENDING

### F3 — FR-018 "cancel by logging back in" read as an explicit Cancel button

- **Severity**: 📝 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Plan "What We're NOT Doing"; Phase 3 banner/cancel
- **Detail**: PRD FR-018 and §Access Control say the user cancels "by logging back in, which restores read-write." The plan interprets this as: user stays logged in (read-only) and clicks an explicit Cancel button — re-login does NOT itself cancel. Defensible and documented (reconciled with FR-017's "log in → read-only"), arguably safer (deliberate, not accidental). But a stakeholder reading FR-018 literally might expect re-authentication alone to restore read-write; the PRD text is internally tense on this exact point, so the divergence deserves explicit sign-off rather than a silent implementer decision.
- **Fix**: Confirm the interpretation with the PRD owner and record the chosen reading in plan.md + change.md. (Plan already documents the decision — this is a confirmation, not a rewrite.)
- **Decision**: PENDING

### F4 — "Eight handlers total" — there are seven

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details; Phase 2 #4 (plan.md:137)
- **Detail**: Plan says "Eight handlers total (two in cards/[id].ts)." Verified count is seven: cards.ts POST, cards/[id].ts PATCH+DELETE, generations.ts POST, generations/save.ts POST, generations/discard.ts POST, reviews.ts POST. An implementer could hunt for a nonexistent 8th handler.
- **Fix**: Change "Eight handlers" → "Seven handlers (POST + PATCH + DELETE + POST×4)".
- **Decision**: PENDING

### F5 — Middleware retention lookup fails open on DB error

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 #1 — Retention state in middleware
- **Detail**: Contract defaults isReadOnly to false "when no user/row." A transient select error returns `{data:null}` → no row → isReadOnly=false → a pending-deletion user can write during the error window. Minor, but it's a read-only guard quietly failing open.
- **Fix**: Decide fail-open vs fail-closed explicitly. If a pending user writing during a blip is unacceptable, treat a query error as read-only (fail-closed); otherwise document the accepted risk.
- **Decision**: PENDING
