# Code review rules

Repo-local review rules for 10xCards. `om-code-review` (and therefore `om-auto-review-pr` and `om-review-prs`) reads this file automatically and applies it **in addition to** its built-in checklist. Human reviewers use the same list. Severities are the pipeline's: **blocker / major / minor / nit**; any blocker means request changes.

Stack the rules below are derived from: Astro 6 (`output: "server"`, Cloudflare adapter), React 19 islands, TypeScript, Tailwind 4, Supabase (Auth + Postgres with RLS), Vitest, Playwright.

## Review priorities, in order

1. **Data isolation between users** — this is a multi-tenant app where every row is owned by a user. A cross-user leak is the worst thing this codebase can ship.
2. **Auth and session correctness** — who is allowed to do what.
3. **Contract stability** — HTTP routes, response shapes, DB schema (see `BACKWARD_COMPATIBILITY.md`).
4. **Correctness of the change itself**, then maintainability. Formatting is Prettier's job, not the reviewer's.

Per `AGENTS.md`: do not approve a change only because tests pass — check whether the tests cover the actual risk.

## Repo-specific checks

### Data access and RLS (blocker)

- All application queries must go through the request-scoped client from `src/lib/supabase.ts` (`createClient(request.headers, cookies)`), which is built with the **anon** key and the caller's cookies so RLS applies. A `service_role` key anywhere under `src/` is a blocker — it bypasses every policy.
- Every new table needs `alter table … enable row level security` plus own-row policies for select/insert/update/delete, following the `cards_*_own` / `account_deletion_requests_*_own` pattern in `supabase/migrations/20260527150510_cards_and_account_deletion.sql`. A migration adding a user-owned table without them is a blocker.
- Handlers filter by `user_id` explicitly **in addition to** RLS (see `src/pages/api/cards.ts`). Keep that belt-and-braces pattern; removing the explicit filter "because RLS handles it" is a major finding.
- New `security definer` DB functions (the pattern used by `finalize_drafts`, `sweep_expired_account_deletions`) must scope every statement to the calling user themselves — RLS does not protect them.

### Auth guards (blocker)

- `src/middleware.ts` protects **page routes only**: `PROTECTED_ROUTES = ["/dashboard", "/generate", "/review", "/library", "/settings"]`. It does **not** cover `/api/*`. Every API handler must check `context.locals.user` itself and return 401 when absent. A new endpoint without that check is a blocker, even when the UI only calls it from a protected page.
- A new protected page must be added to `PROTECTED_ROUTES` in the same PR.

### Account retention / read-only state (blocker)

- Mutating endpoints must call `readOnlyGuard(context.locals)` (`src/lib/account-retention.ts`) before writing, and return its response when it is truthy. An account pending deletion is read-only; a new write path that skips the guard reopens the hole.
- The middleware's retention lookup **fails closed** (a DB error sets `isReadOnly = true`). Any change that turns that into fail-open is a blocker.

### Input validation (major)

- There is no schema-validation library in this project. Request bodies arrive as `unknown` and are narrowed by hand (`asNonEmptyString` in `src/pages/api/cards.ts` is the reference pattern). Reading a field straight off a parsed body without narrowing it — or casting with `as` — is a major finding.
- `await request.json()` must be wrapped in try/catch and answered with 400, not allowed to throw.

### API response shape (major)

- Responses use `{ error: "<snake_case_code>", message: "<human sentence>" }` with the status set explicitly. Established codes: `unauthorized` (401), `bad_request` / `invalid_card` (400), `supabase_unconfigured` (503), `db_error` (500). Introducing a new ad-hoc shape fragments the client; reuse or extend deliberately.
- Never return raw Supabase/Postgres error text to the client — it leaks schema detail. Log it, return a generic message.

### Configuration and secrets (blocker)

- Env vars are declared in `astro.config.mjs` under `env.schema` and read via `astro:env/server`. All are `optional: true`, so **code must survive missing configuration** — `createClient` returns `null` and callers answer 503. A new code path that assumes config is present will crash the Worker in an unconfigured environment.
- A new secret needs: an `envField` entry, an entry in `.env.example` (placeholder only), and a note that the real value goes into Cloudflare and GitHub secrets. Real `SUPABASE_URL` / `SUPABASE_KEY` / `OPENROUTER_API_KEY` values in the diff are a blocker.

### Cloudflare Workers runtime (major)

- The build targets workerd, not Node. Node built-ins (`fs`, `path`, `crypto` in its Node form), long-running timers, and libraries assuming a Node runtime break at deploy time, not at `npm run build`. Flag any new dependency that pulls one in.

### Database migrations (blocker)

- Migrations are forward-only files in `supabase/migrations/` named `<timestamp>_<description>.sql`. Check them against `BACKWARD_COMPATIBILITY.md`: a destructive statement (`drop column`, `drop table`, type narrowing, a new `not null` without a default and a backfill) against a table the deployed app reads is a blocker.
- A migration and the code that depends on it should be able to deploy in that order — the new column must be tolerated by the currently-deployed code.

### Tests (major)

- **CI does not run any test suite.** `.github/workflows/ci.yml` runs `astro sync` + `lint` + `build` only. A green CI badge is not evidence that tests pass; the reviewer must confirm the author ran the validation gate locally and, when the change touches Supabase behavior or the browser, the relevant extra suite.
- Unit/integration specs are colocated (`*.test.ts`, `*.integration.test.ts`); integration specs use the two-user fixture and scoped Supabase mock in `test/integration/`. A change to data-scoping logic with no cross-user integration test is a major finding — that fixture exists precisely to prove isolation.
- E2E specs live in `tests/e2e/` and follow the `/10x-e2e` rules: `getByRole`/`getByLabel`/`getByText` before `getByTestId`, never CSS/XPath, never `page.waitForTimeout()`, each test independent with its own setup and cleanup and unique ids. Violations are major — they are the failure modes that make a suite rot.

### Frontend (minor unless it breaks a11y or a hook rule)

- ESLint runs type-aware TS plus React Hooks, React Compiler, Astro, and jsx-a11y rules; a change that only passes because a rule was disabled inline needs a written justification in the PR.
- Interactive UI belongs in React islands under `src/components/`; primitives in `ui/`. Keep pages and layouts as `.astro`.
- Accessible names matter twice here: they are the product's a11y surface *and* what the E2E locators bind to.

### Documentation and process (minor)

- `context/` is the 10x-workflow source of truth; `context/archive/**` and `context/foundation/archive/**` are immutable. A PR that rewrites archived material is a blocker regardless of intent.
- Roadmap status in `context/foundation/roadmap.md` should move with the work it describes.

## Validation gate

The reviewer's gate is the configured one, run in order and green before sign-off:

`npm run typecheck` → `npm run lint` → `npm run build` → `npm test`

Any non-zero exit is a **blocker** finding, including a failure that predates the PR — if it fails on this branch it will fail for everyone.

Outside the gate, run deliberately when the change warrants it: `npm run test:integration` (needs Supabase credentials) and `npm run test:e2e` (needs the app running).

## Severity guide

| Severity | Use for | Action |
|---|---|---|
| **blocker** | Cross-user data leak, missing auth or read-only guard, missing RLS on a new table, secret in the diff, destructive migration, failing validation gate, breaking a surface listed in `BACKWARD_COMPATIBILITY.md` without the documented path | Must fix before merge |
| **major** | Unvalidated input, unhandled failure path, missing test for the actual risk, response-shape drift, Workers-incompatible dependency, E2E anti-pattern | Fix before merge unless explicitly deferred with a follow-up issue |
| **minor** | Maintainability, naming, duplication, docs drift | Fix now or file a follow-up |
| **nit** | Preference, style not covered by Prettier/ESLint | Optional |
