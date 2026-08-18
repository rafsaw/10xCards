# Backward compatibility

What counts as a **protected contract surface** in 10xCards, what breaking one means, and the required path for changing it. `om-code-review` checks every touched surface against this file; implementing skills warn before shipping a violation.

## Context that sets the bar

10xCards is a single deployed web app (Cloudflare Workers) with a browser front end and no third-party API consumers. There is no published npm package (`packages/code-reviewer` is `private: true`) and no public CLI. So the compatibility risk here is **not** "someone else's client breaks" — it is:

1. **Deploy skew** — a Worker version and a database schema that disagree for the minutes between a migration and the deploy that needs it, or a browser holding a page from the previous deploy.
2. **The app's own coupling** — front-end code, tests, and the E2E suite that bind to routes, response shapes, and accessible names.

Rules below are calibrated to that. They are deliberately lighter than a public-API policy would be, and stricter about migrations than a single-tenant toy app would be.

## Protected surfaces

### 1. HTTP API routes and response shapes — protected

The full surface, all under `src/pages/api/`:

| Route | Methods |
|---|---|
| `/api/auth/signup`, `/api/auth/signin`, `/api/auth/signout` | POST |
| `/api/cards` | POST |
| `/api/cards/[id]` | PATCH, DELETE |
| `/api/generations` | POST |
| `/api/generations/save`, `/api/generations/discard` | POST |
| `/api/reviews` | POST |
| `/api/account/delete`, `/api/account/cancel` | POST |

**Breaking:** removing or renaming a route; removing a method; removing or renaming a field in a success response; changing a status code for an existing outcome; making a previously optional request field required; changing the `{ error, message }` envelope or repurposing an existing `error` code (`unauthorized`, `bad_request`, `invalid_card`, `supabase_unconfigured`, `db_error`).

**Not breaking:** adding a route or method; adding an optional request field; adding a field to a response; adding a new `error` code for a genuinely new outcome.

**Required path:** land the additive version first (new field or new route alongside the old), migrate every caller in `src/components/` and `src/pages/`, update the specs that assert the shape (`src/pages/api/*.test.ts`, `test/integration/`, `tests/e2e/`), and only then remove the old one — in a separate PR labeled `risk-high`. A single PR that changes a shape and its callers together is acceptable only when the change ships in one deploy and no in-flight browser session can call the old shape mid-flow.

### 2. Database schema and functions — protected, strictest

Tables `public.cards` and `public.account_deletion_requests`; functions `public.finalize_drafts(p_accept_ids uuid[], p_reject_ids uuid[])`, `public.sweep_expired_account_deletions()`, `public.set_updated_at()`. Migrations are forward-only files in `supabase/migrations/`.

**Breaking:** `drop table` / `drop column` / rename on anything the deployed Worker reads; narrowing a type or adding a `check` constraint that existing rows or existing writes can violate; adding `not null` without a default and a backfill; changing a function's signature or its return shape; weakening or dropping an RLS policy.

**Not breaking:** adding a table with RLS enabled and own-row policies; adding a nullable column or one with a default; adding an index; adding a new function.

**Required path — expand / migrate / contract, across at least two deploys:**

1. **Expand** — additive migration only. The currently deployed Worker must keep working against the new schema untouched.
2. **Migrate** — deploy code that writes and reads the new shape while tolerating the old, and backfill.
3. **Contract** — drop the old column/function in a later PR, once nothing reads it. Label it `risk-high` and say in the PR body which deploy made it safe.

A destructive statement and the code depending on it in the same PR is a blocker. RLS is part of the contract, not an implementation detail: a migration that touches policies must state, in the PR body, what cross-user isolation still holds — the integration suite's two-user fixture is how that gets proven.

### 3. User-visible URLs — protected

`/`, `/auth/signin`, `/auth/signup`, `/auth/confirm-email`, `/dashboard`, `/generate`, `/library`, `/review`, `/settings`.

**Breaking:** removing or renaming a path users may have bookmarked, or one referenced by Supabase Auth redirects (`/auth/confirm-email` in particular — it is reached from an emailed link, so an old link must keep landing somewhere sane).

**Required path:** keep a redirect from the old path for at least one release, update `PROTECTED_ROUTES` in `src/middleware.ts` in the same PR, and update the sitemap-facing links.

### 4. Configuration contract — protected

Env var names declared in `astro.config.mjs` under `env.schema`: `SUPABASE_URL`, `SUPABASE_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `PUBLIC_SENTRY_DSN`. Their mirrors: `.env.example`, `.dev.vars`, Cloudflare secrets, GitHub repository secrets.

**Breaking:** renaming a variable, or making a previously optional variable required — every deployment environment and every contributor's local setup breaks at once, and the failure appears at runtime in the Worker rather than at build time.

**Required path:** read the new name with a fallback to the old for one release; update `.env.example` and the README in the same PR; call out explicitly in the PR body that Cloudflare and GitHub secrets need updating before merge, because nothing in CI will catch it.

### 5. Internal contracts the codebase depends on — protected, lighter

- `App.Locals` in `src/env.d.ts` (`user`, `isReadOnly`, `retentionUntil`) — every page, island, and API handler reads it. Removing or repurposing a field is breaking; adding one is not. Astro types regenerate with `npx astro sync`.
- The `readOnlyGuard(locals)` contract in `src/lib/account-retention.ts` — a truthy return is a `Response` the caller must return. Changing that convention means auditing every mutating handler.
- The SRS scheduling rules in `src/lib/leitner.ts` — changing intervals or the promotion/demotion rules silently reschedules every existing user's cards. Not a type-level break, but the highest-impact behavior change in the app: treat it as `risk-high`, and say in the PR body what happens to cards already in flight.
- Accessible names and roles the E2E suite binds to — renaming a button label breaks `tests/e2e/` even though nothing type-checks it. Update the specs in the same PR.

## Not protected

Internal module layout, component structure, Tailwind classes, `src/lib/` helper signatures not listed above, test helpers, `packages/code-reviewer` (private, not published), and anything under `context/` — with the standing exception that `context/archive/**` and `context/foundation/archive/**` are immutable for reasons of record-keeping, not compatibility.

## When a break is genuinely the right call

Say so explicitly. Open the PR with `risk-high`, state in the body which surface breaks, why the migration path is not worth it, and what has to happen at deploy time (secret updated, migration applied first, cache purged). A documented, deliberate break is fine; an undocumented one is a blocker.
