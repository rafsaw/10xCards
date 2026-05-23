# Cloudflare Workers Deployment Plan — 10xCards

## Context

`context/foundation/infrastructure.md` selected **Cloudflare Workers** as the MVP
deployment platform (5/5 on the agent-friendly criteria; runner-up Render).
The project is already correctly scaffolded for it — `@astrojs/cloudflare` v13.5
adapter, `output: "server"`, `wrangler.jsonc` with `nodejs_compat` and a recent
`compatibility_date`. **No code or adapter changes are needed.** What is missing
is the *operational* path to production:

- No Supabase project exists yet (auth is wired but unconfigured).
- No production secrets are set anywhere.
- No `deploy` script; no automated deploy pipeline.
- The Worker still carries the starter name `10x-astro-starter`.

This plan ships the first production deploy and wires **Cloudflare native Git
integration (Workers Builds)** so every push to `main` auto-deploys. GitHub
Actions is deliberately *not* used (the existing `.github/workflows/ci.yml`
only triggers on `master` and stays inert — left untouched). OpenRouter secrets
are skipped: a repo-wide search found **zero** AI/OpenRouter code, so they are
genuinely not required for this deploy.

**Decisions locked in (from clarifying questions):**
- Supabase: **create a new project**.
- Worker name: **rename to `10x-cards`** before the first deploy.

**Strategy:** one manual `wrangler deploy` first (creates the Worker, lets us
set secrets and verify cleanly), *then* attach Cloudflare Git integration to the
existing Worker. This gives a clean human-gated checkpoint before automation.

**Owner legend:** **Human** = account/dashboard/secret-entry actions (per
`infrastructure.md` approval boundary). **Agent** = scriptable, auditable
commands safe to run unattended.

---

## Phase 0 — Tooling & account prerequisites

**Goal:** Local toolchain authenticated and a Cloudflare account ready.
**Depends on:** nothing.

- [ ] **(Human)** Have a Cloudflare account (free plan is sufficient for this MVP).
- [ ] **(Agent)** Confirm Node version matches `.nvmrc` — `node -v` → expect `v22.14.0`.
- [ ] **(Agent)** Install dependencies — `npm install`.
- [ ] **(Human)** Authenticate Wrangler (interactive OAuth) — `npx wrangler login`.
- [ ] **(Agent)** Confirm auth + CLI version — `npx wrangler whoami` and `npx wrangler --version` (expect v4.x).
- [ ] **(Agent)** Confirm the GitHub remote exists — `git remote -v` → `origin = github.com/rafsaw/10xCards.git` (needed for Phase 5).

**Validation:** `wrangler whoami` prints the account email/ID; `node -v` is 22.14.0.
**Rollback:** None — read-only/setup only. If `wrangler login` fails, re-run; nothing was mutated.

---

## Phase 1 — Supabase project provisioning

**Goal:** A live Supabase project with auth enabled and credentials in hand.
**Depends on:** Phase 0.

- [ ] **(Human)** Create a new Supabase project (pick a region close to the user base / Cloudflare edge).
- [ ] **(Human)** From **Project Settings → API**, copy the **Project URL** and the **anon public key**.
- [ ] **(Human)** Under **Authentication → Providers**, confirm **Email** is enabled.
- [ ] **(Human)** Decide email-confirmation behaviour. The app redirects signup to `/auth/confirm-email`, so **"Confirm email" ON** is consistent with the current flow.
- [ ] **(Human)** Leave Site URL / redirect URLs for now — wired in Phase 4 once the Worker URL exists.

**Validation:** The Supabase dashboard shows the project as "Active"; URL and anon key are recorded in a secure local note (not the repo).
**Rollback:** Pausing or deleting the project in the dashboard fully reverts this phase. **Human-only** per the approval boundary.

> The app uses the **anon** key with Supabase RLS, not the service-role key —
> keep the service-role key out of the Worker entirely.

---

## Phase 2 — Local configuration & build verification

**Goal:** Rename the Worker, add a deploy script, run locally against Supabase, and prove the build is green before touching production.
**Depends on:** Phase 1.

- [ ] **(Agent)** Rename the Worker in `wrangler.jsonc`: `"name": "10x-astro-starter"` → `"name": "10x-cards"`. This sets the production URL `10x-cards.<subdomain>.workers.dev` and must happen **before** the first deploy to avoid an orphaned Worker.
- [ ] **(Agent)** Add a deploy script to `package.json` `scripts`: `"deploy": "astro build && wrangler deploy"`.
- [ ] **(Human)** Create a git-ignored `.env` (template already in `.env.example`) with the real values:
  ```
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_KEY=<anon-public-key>
  ```
  `.env` is already in `.gitignore`. `src/lib/supabase.ts` reads these via `astro:env/server`, which resolves from `.env` during local dev.
- [ ] **(Optional, Agent)** Fix the stale contract in `context/foundation/tech-stack.md`: `deployment_target: cloudflare-pages` → `cloudflare-workers`. The Astro 6 adapter is Workers-only; the stale value risks an agent running `wrangler pages deploy` (wrong command set). *Note: `context/` is normally protected — this is a one-line factual correction; confirm before editing or skip.*
- [ ] **(Agent)** Production build — `npm run build`. Must succeed.
- [ ] **(Agent)** Check the build output size — Astro + React 19 + Supabase client should sit well under the **1MB compressed** free-plan ceiling; note the figure as a baseline.
- [ ] **(Human/Agent)** Local smoke test — `npm run dev`, then exercise `/auth/signup`, `/auth/signin`, `/dashboard` (redirects when logged out), `/auth/signout`.

**Validation:** `npm run build` exits 0; local auth flow works end-to-end against the real Supabase project; no "Supabase is not configured" message.
**Rollback:** All changes are local file edits — `git restore wrangler.jsonc package.json` reverts them. `.env` is untracked; delete it to revert. Nothing reached production.

---

## Phase 3 — First production deploy (manual)

**Goal:** Create the `10x-cards` Worker in production and load its secrets.
**Depends on:** Phase 2 (green build).

- [ ] **(Agent)** Deploy — `npx wrangler deploy` (or `npm run deploy`). This **creates** the Worker `10x-cards` and prints the live `https://10x-cards.<subdomain>.workers.dev` URL. Record that URL.
- [ ] **(Human)** Set the production secret — `npx wrangler secret put SUPABASE_URL` (paste the Supabase Project URL when prompted).
- [ ] **(Human)** Set the production secret — `npx wrangler secret put SUPABASE_KEY` (paste the anon public key when prompted).
- [ ] **(Agent)** Confirm both secrets are registered — `npx wrangler secret list` (lists names only, never values).

**Validation:** `wrangler deployments list` shows one deployment; `wrangler secret list` shows `SUPABASE_URL` and `SUPABASE_KEY`. Opening the URL renders the home page without the "Supabase not configured" banner.
**Rollback:**
- Bad code: `npx wrangler rollback` (reverts to the previous version in seconds) — **Agent**, to a known-good version only.
- Full teardown: deleting the Worker in the dashboard is **Human-only**.
- Note: `wrangler secret put` itself publishes a new Worker version with the secret — no extra redeploy needed.

> Secrets live **only** in Workers Secrets — never on `process.env`, never in
> `wrangler.jsonc`, never committed. `wrangler deploy` does not clear secrets,
> so they survive every later Git-integration deploy.

---

## Phase 4 — Supabase auth wiring & production verification

**Goal:** Point Supabase auth at the live URL and verify the full auth flow in production.
**Depends on:** Phase 3 (Worker URL known).

- [ ] **(Human)** In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://10x-cards.<subdomain>.workers.dev`.
- [ ] **(Human)** Add `https://10x-cards.<subdomain>.workers.dev/**` to **Redirect URLs** (covers email-confirmation callbacks).
- [ ] **(Agent)** Stream live logs during the test — `npx wrangler tail --format json` (in a separate terminal).
- [ ] **(Human)** Production smoke test on the live URL:
  - Sign up → confirm the redirect to `/auth/confirm-email` and that the confirmation email arrives.
  - Confirm the email, then sign in.
  - Visit `/dashboard` while authenticated → loads; sign out → `/dashboard` redirects to `/auth/signin`.

**Validation:** A real account can sign up, confirm, sign in, reach `/dashboard`, and sign out on the production URL. `wrangler tail` shows no unhandled errors.
**Rollback:** Auth misbehaving is almost always a Supabase URL-config issue (fix in the dashboard, no redeploy). For a code regression, `npx wrangler rollback`. `wrangler tail` samples under load — for a hard-to-catch failure, enable **Workers Logs** (observability is already `enabled` in `wrangler.jsonc`) and inspect retained logs in the dashboard.

---

## Phase 5 — Cloudflare Git integration (Workers Builds)

**Goal:** Every push to `main` auto-builds and auto-deploys via Cloudflare — no GitHub Actions.
**Depends on:** Phase 4 (a verified, healthy production Worker).

- [ ] **(Human)** Ensure `main` is pushed to `github.com/rafsaw/10xCards` and up to date (`git push origin main`).
- [ ] **(Human)** In the Cloudflare dashboard: **Workers & Pages → `10x-cards` → Settings → Builds → Connect to Git**.
- [ ] **(Human)** Authorize the **Cloudflare GitHub app** for the `rafsaw/10xCards` repository (grant the minimum repo scope).
- [ ] **(Human)** Configure the build:
  - **Production branch:** `main`
  - **Build command:** `npm run build`
  - **Deploy command:** `npx wrangler deploy` (default)
  - **Root directory:** `/`
  - Node version is taken from `.nvmrc` (`22.14.0`) automatically.
- [ ] **(Human/Agent)** Trigger a verification deploy — push a trivial commit to `main` (e.g. a README touch) and watch the build in **Workers → `10x-cards` → Builds**.

**Validation:** The dashboard shows a build triggered by the commit, it succeeds, and `npx wrangler deployments list` shows a new version whose source is the Git integration. The live URL still serves the app and auth still works.
**Rollback:**
- Disable auto-deploy: **Settings → Builds → Disconnect** (reverts to manual `wrangler deploy`).
- Bad deploy: `npx wrangler rollback` or **Deployments → Rollback** in the dashboard.
- Secrets set in Phase 3 persist across Git-integration deploys — no re-entry needed.

> Pushes to non-`main` branches produce **preview** versions (a separate
> `*.workers.dev` preview URL) without promoting to production — useful for
> reviewing a branch before merge.

---

## Phase 6 — Operations baseline & rollback drill

**Goal:** Confirm the operational loop works *before* it's needed in an incident.
**Depends on:** Phase 5.

- [ ] **(Agent)** List deploy history — `npx wrangler deployments list` (the version audit trail).
- [ ] **(Agent)** Rollback drill — note the current version ID, run `npx wrangler rollback`, confirm the site still serves, then redeploy current (`npm run deploy`) to return to head.
- [ ] **(Agent)** Confirm retained logging — `observability.enabled` is already `true` in `wrangler.jsonc`; verify **Workers Logs** are queryable in the dashboard (don't rely on sampled `wrangler tail` for incident triage).
- [ ] **(Agent)** Confirm the agent ops loop is unattended-safe: `wrangler deploy`, `wrangler versions upload`, `wrangler tail`, `wrangler deployments list`, `wrangler rollback` (to a known-good version).

**Validation:** A rollback completes in seconds and the site stays up throughout; Workers Logs show recent requests.
**Rollback:** N/A — this phase *is* the rollback rehearsal.

> **Caveat:** `wrangler rollback` reverts **Worker code only**. It does **not**
> roll back Supabase schema migrations — a deploy that ran a migration needs a
> hand-written down-migration. Keep dropping/altering the Supabase DB and
> rotating its keys **human-only**.

---

## Critical files

| File | Change |
|---|---|
| `wrangler.jsonc` | `name`: `10x-astro-starter` → `10x-cards` (Phase 2) |
| `package.json` | Add `"deploy": "astro build && wrangler deploy"` to `scripts` (Phase 2) |
| `.env` | **Create locally** (git-ignored) with real `SUPABASE_URL` / `SUPABASE_KEY` (Phase 2) |
| `context/foundation/tech-stack.md` | *Optional* one-line contract fix: `cloudflare-pages` → `cloudflare-workers` (Phase 2) |

No changes to `astro.config.mjs`, `src/`, or `.github/workflows/` — already correct or intentionally untouched. Production secrets live in **Workers Secrets** (set via `wrangler secret put`), never in tracked files.

## Already correct — no action needed

- `astro.config.mjs` — `cloudflare()` adapter, `output: "server"`, `astro:env` schema for the Supabase vars.
- `wrangler.jsonc` — `nodejs_compat` flag, `compatibility_date` 2026-05-08, `ASSETS` binding, `observability.enabled`.
- `.gitignore` — already excludes `.env`, `.dev.vars`, `.wrangler/`, `dist/`.
- `.nvmrc` — `22.14.0`, consumed automatically by Workers Builds.

## End-to-end verification

After Phase 5, the deploy pipeline is verified by:

1. **Build gate:** `npm run lint` and `npm run build` pass locally (per `CLAUDE.md`).
2. **Production auth:** sign up → confirm email → sign in → `/dashboard` → sign out, all on `https://10x-cards.<subdomain>.workers.dev`.
3. **Auto-deploy:** a commit pushed to `main` appears as a successful build in the Cloudflare dashboard and as a new version in `wrangler deployments list`, with no GitHub Actions run involved.
4. **Rollback:** `wrangler rollback` reverts to the prior version within seconds without downtime (Phase 6 drill).
5. **Logs:** `wrangler tail` streams live requests; Workers Logs retain them for triage.

## Out of scope (deferred)

- OpenRouter / AI secrets — no AI code exists in the repo yet; add `OPENROUTER_API_KEY` via `wrangler secret put` when that feature lands.
- GitHub Actions CI — `.github/workflows/ci.yml` stays inert (triggers on `master`, branch is `main`); revisit if a pre-deploy test gate is wanted later.
- Custom domain — `*.workers.dev` is fine for the MVP.
- Supabase schema/migrations, multi-region HA, Docker — not part of this deploy.
