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

## Prerequisites (one-time setup)

**Goal:** Everything you do **once per machine + once per cloud account** before any phase runs. Phases 0–6 assume this section is complete. Do this checklist once; never again on this hardware.

> **Hard rule:** The **remote Supabase project is mandatory** — production runs against it, and the live Worker has no way to talk to a local DB. Running Supabase locally via Docker (described in section D below) is a **development convenience for parity / offline work**, never a substitute for the cloud project provisioned in Phase 1.

### A. Wrangler CLI — install & verify

Wrangler is the Cloudflare Workers CLI. It is the **only** tool that mutates the Worker from this machine.

- **Install path used by this plan:** **repo-pinned via `npm install`**. `wrangler@4.x` is already in `package.json` `devDependencies`, so every command uses `npx wrangler …`. No global install is needed; this also keeps the local version in lockstep with what Workers Builds runs in CI.
- **Optional global install** (shorter commands, but you become responsible for keeping it pinned to v4): `npm install -g wrangler@4`. Verify with `wrangler --version`.
- **Windows 11 specifics:**
  - Node `22.14.0` (matches `.nvmrc`). Easiest installer on Windows: **`fnm`** (`winget install Schniz.fnm`) or **`nvm-windows`** (<https://github.com/coreybutler/nvm-windows>). The macOS-style `nvm` script does not work on Windows.
  - Run all `wrangler` commands from **PowerShell**, not legacy `cmd.exe`. The Wrangler OAuth flow opens your default browser; on Windows 11 confirm the **"Open with"** dialog targets a real browser (Edge / Chrome / Firefox), not an app like VS Code or Notepad.
  - Wrangler writes its credentials to `%USERPROFILE%\.wrangler\config\default.toml`. Antivirus / Controlled Folder Access can block this write — if `wrangler login` reports `EPERM` or `EACCES`, allow the file in Windows Security → Virus & threat protection → Controlled folder access.
  - PowerShell session env vars use `$env:NAME = "value"`; persistent ones use `setx NAME "value"` (new sessions only). The bash `export` syntax does not work.
- **Verification:** `node -v` → `v22.14.0`; `npx wrangler --version` → `4.x`.

### B. Cloudflare account

- Free plan is enough for this MVP. Sign up at <https://dash.cloudflare.com/sign-up> and **verify the email** — `wrangler login` silently fails against an unverified account.
- Note the **Account ID** from **Workers & Pages → Overview** (right sidebar). Useful for CI tokens and dashboard search; not required for OAuth login.
- Recommended: enable **2FA** on the account before the first production deploy.
- Detailed phase actions: see **Phase 0a / 0c**.

### C. Supabase cloud project (required — production DB)

- Sign up at <https://supabase.com/dashboard/sign-up> (GitHub OAuth recommended).
- Free tier limits to know up front: 500 MB DB, 50 K monthly active auth users, ~3–4 auth emails/hour via the shared SMTP relay, and **projects auto-pause after ~1 week of inactivity** (one-click resume).
- You will create a project named `10x-cards`, pick a region near your users, save the DB password to a password manager (shown once), and copy the **Project URL** + **anon public key**.
- The `service_role` key is **never copied into this project** — keep it in the dashboard only. The Worker uses the anon key plus Row-Level Security.
- Detailed phase actions: see **Phase 1a – 1d**.

### D. Supabase local development (optional — Docker on Windows 11)

Local Supabase is run via the **Supabase CLI**, which spins up the full stack (Postgres, GoTrue auth, PostgREST, Realtime, Storage, Studio UI) in **Docker containers**. Use it when you want offline dev, faster auth iteration, or schema experimentation without burning the cloud project's quotas.

> Even with local Supabase running, **the cloud project from section C still has to exist** — production deploys read its URL + anon key from Workers Secrets (Phase 3). The local stack is for `npm run dev` only.

**Windows 11 requirements:**

- **Docker Desktop for Windows** (<https://docs.docker.com/desktop/install/windows-install/>), running on the **WSL2 backend** (the default since Docker Desktop 4.x). Hyper-V backend is deprecated and slower for this workload.
- **WSL2** itself: `wsl --install` from an elevated PowerShell, then `wsl --set-default-version 2`. A Linux distro is **not strictly required** — Docker Desktop ships its own `docker-desktop` WSL distro — but having Ubuntu installed (`wsl --install -d Ubuntu`) helps when you need a Linux shell to debug containers.
- **Virtualization** must be enabled in BIOS/UEFI (search "Virtualization" or "SVM" / "Intel VT-x" in firmware settings). On Windows 11, also ensure the **Virtual Machine Platform** and **Windows Subsystem for Linux** optional features are enabled — `Get-WindowsOptionalFeature -Online | Where-Object FeatureName -match "VirtualMachinePlatform|Microsoft-Windows-Subsystem-Linux"`.
- **Resources:** allocate Docker Desktop at least **4 CPUs and 8 GB RAM** (Settings → Resources). The Supabase stack runs ~10 containers; less than 8 GB causes flaky timeouts on `supabase start`.
- **Disk:** ~5 GB free for images + volumes. Docker Desktop stores them under `%LOCALAPPDATA%\Docker\wsl\` by default.
- **Ports:** `supabase start` binds **54321** (API), **54322** (Postgres), **54323** (Studio), **54324** (Inbucket — local SMTP catcher). Make sure nothing else on the host claims them — `Get-NetTCPConnection -LocalPort 54321,54322,54323,54324 -ErrorAction SilentlyContinue` should return nothing.
- **Windows Defender Firewall:** the first `supabase start` triggers a "Allow Docker?" prompt — pick **Private networks**; do **not** check Public.

**Install the Supabase CLI on Windows 11:**

- **Scoop** (recommended on Windows): `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`.
- Or **direct download**: grab the latest `supabase_windows_amd64.tar.gz` from <https://github.com/supabase/cli/releases>, extract `supabase.exe` to a folder on `PATH`.
- `npm i -g supabase` is **not** supported (the CLI is a Go binary, the npm package is deprecated).
- Verify: `supabase --version`.

**Bring the local stack up (only when you want it):**

- From the repo root: `supabase start`. First run pulls images (~2 GB, takes 5–10 minutes on a normal connection). Subsequent runs take ~30 seconds.
- The command prints local credentials — copy `API URL` (`http://127.0.0.1:54321`) and `anon key` into a separate `.env.local` (or temporarily into `.env`) **only when developing against the local stack**. Keep the cloud `.env` values handy to swap back.
- Stop the stack with `supabase stop` (containers keep state in a Docker volume) or `supabase stop --no-backup` (wipes the volume).

**This plan does not require the local stack.** Skip section D entirely if you are happy to do all development against the cloud project from section C.

### Prerequisites checklist — current status

> **Last validated:** 2026-05-23. Re-run the verification commands below if more than a few days have passed.

**Required (blocks Phase 0–1):**

- [x] **Cloudflare account configured** _(Human)_ — `rafsaw@gmail.com`, Account ID `3219bb947bb836ced74794f8a0fc0b34`. Verified via `npx wrangler whoami`.
- [x] **Wrangler CLI configured** _(Human + Agent)_ — `wrangler 4.90.0` installed (repo `devDependency`), OAuth logged in with scopes `workers (write)`, `workers_scripts (write)`, `pages (write)`, `d1 (write)`, `secrets_store (write)`. Verified via `npx wrangler --version` + `npx wrangler whoami`.
- [x] **GitHub CLI configured** _(Human)_ — `gh 2.92.0` installed and authenticated as `rafsaw` (HTTPS, scopes `gist`, `read:org`, `repo`). Repo remote `origin = https://github.com/rafsaw/10xCards.git` is wired. Verified via `gh auth status` + `git remote -v`.
- [x] **`npm install` run** _(Agent)_ — `node_modules/` present in repo.
- [x] **Node version — drift accepted** _(Agent)_ — local is **v24.15.0**, `.nvmrc` pins **22.14.0**. User decision 2026-05-23: **accept the drift, do not switch locally**. See the bold note below for what this means and when to revisit.
- [x] **Supabase account configured** _(Human)_ — confirmed by user 2026-05-23. Project creation itself happens in Phase 1.

**Optional (blocks nothing — only needed for local-stack dev in section D):**

- [ ] **Docker Desktop installed** _(Optional, Human)_ — not on PATH. Skip unless you want offline Supabase via `supabase start`.
- [ ] **Supabase CLI installed** _(Optional, Human)_ — `supabase --version` fails. Skip unless running the local stack.

> ## ⚠️ Node version drift — accepted (read before Phase 2)
>
> **Local Node is `v24.15.0`. `.nvmrc` is `22.14.0`. They are intentionally different.**
>
> - **Why local stays on 24.15.0:** the user already runs Node 24 system-wide and chose not to add a per-project switch. `fnm` is installed (`fnm 1.39.0`) — switching is available at any time with `fnm use 22.14.0` from the repo root.
> - **Why `.nvmrc` stays on 22.14.0:** Cloudflare **Workers Builds** reads `.nvmrc` and runs `npm run build` on that version. Changing `.nvmrc` to 24 would push the production build off the Workers runtime's officially-supported Node line (currently 22 via `nodejs_compat`). **Do not edit `.nvmrc`.**
> - **What this risks:** a build that works on `node v24` locally but fails (or behaves differently) on `node v22` in CI. Most Astro + React + Supabase code is unaffected; the danger lives in: native modules with engine constraints, newer V8 APIs, and `package.json` `"engines"` checks.
> - **Mitigation when running Phase 2 locally:** if `npm run build` exits 0 locally but Cloudflare Workers Builds fails in Phase 5, the **first** thing to try is `fnm use 22.14.0 && npm install && npm run build` — reproducing CI exactly.
> - **Revisit if:** a CI build fails for an engine reason, a new dependency declares `"engines": { "node": ">=24" }`, or the Cloudflare Workers runtime bumps to a Node 24-based `compatibility_date`. At that point either bump `.nvmrc` to match the runtime or commit to `fnm use 22.14.0` per-project.

**What still needs to be done:**

1. (Optional) Install Docker Desktop if you want offline Supabase via `npx supabase start`. _Note: the Supabase CLI itself is already in `devDependencies` (`supabase@^2.23.4`), so no separate install is needed once Docker is running._

You are clear to proceed to **Phase 0**.

**Re-verification commands** (run anytime to refresh the board):

```powershell
npx wrangler whoami        # Cloudflare + Wrangler
gh auth status             # GitHub CLI
node -v                    # Should match .nvmrc (22.14.0)
npx wrangler --version     # Should be 4.x
git remote -v              # origin = github.com/rafsaw/10xCards.git
```

**Validation:** Each required box is checkable independently. Failing any of them blocks Phase 0–1; failing the optional ones blocks nothing.
**Rollback:** All one-time setup is reversible — `npx wrangler logout`, `gh auth logout`, `scoop uninstall supabase`, "Pause project" in the Supabase dashboard, account deletion in either provider. Account deletion is **Human-only**.

---

## Phase 0 — Tooling & account prerequisites

**Goal:** Local toolchain authenticated and a Cloudflare account ready.
**Depends on:** nothing.

### 0a — Cloudflare account

- [ ] **(Human)** Sign up at <https://dash.cloudflare.com/sign-up> (free plan is sufficient for this MVP). Verify the email before continuing — `wrangler login` will silently fail against an unverified account.
- [ ] **(Human)** Note the **Account ID** from the dashboard → **Workers & Pages → Overview** (right-hand sidebar). Not required for `wrangler login` (OAuth selects it), but useful for CI tokens and the Account-ID column in Cloudflare logs.
- [ ] **(Human, optional)** Enable 2FA on the account before the first production deploy — Cloudflare lets you set deploy-blocking policies once 2FA is on.

### 0b — Local toolchain

- [ ] **(Agent)** Confirm Node version matches `.nvmrc` — `node -v` → expect `v22.14.0`. If mismatched, install via `nvm install` / `fnm use` (Windows: `nvm-windows` or `fnm`).
- [ ] **(Agent)** Install dependencies — `npm install`. This pulls `wrangler` v4.x as a devDependency (see `package.json`), so **no global install is needed** — every command in this plan uses `npx wrangler`.
- [ ] **(Agent, optional)** Confirm the pinned CLI version — `npx wrangler --version` (expect v4.x). If you prefer a global install for shorter commands: `npm install -g wrangler@4` — but the repo-pinned version is the source of truth for CI parity.

### 0c — Wrangler authentication

Two supported auth paths. **OAuth is the default for interactive humans; API tokens are for CI and headless agents.** For this plan, OAuth is used in Phase 3 and a token is **not required** because Workers Builds (Phase 5) uses the Cloudflare GitHub app, not a token.

- [ ] **(Human)** Authenticate Wrangler interactively — `npx wrangler login`. This opens a browser, prompts for the standard OAuth scopes (Workers Scripts, Workers KV, Workers Routes, Account/User read), and writes credentials to `%USERPROFILE%\.wrangler\config\default.toml` on Windows. Closing the browser before approving will leave Wrangler unauthenticated — re-run.
- [ ] **(Agent)** Confirm auth — `npx wrangler whoami` → must print the account email and the account ID you noted in 0a. If it prints `You are not authenticated`, OAuth did not complete; re-run `wrangler login`.
- [ ] **(Human, only if going headless)** Create an API token at **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"** template. Scope it to **this account only** and **this Worker's zone only** once the Worker exists. Export it as `CLOUDFLARE_API_TOKEN` (PowerShell: `$env:CLOUDFLARE_API_TOKEN = "<token>"`) for the current session; persist with `setx CLOUDFLARE_API_TOKEN "<token>"` if needed. **Do not commit the token, do not put it in `.env`, do not put it in `wrangler.jsonc`.**

### 0d — Repo wiring

- [ ] **(Agent)** Confirm the GitHub remote exists — `git remote -v` → `origin = github.com/rafsaw/10xCards.git` (needed for Phase 5's Git integration). If missing, add it before Phase 5.
- [ ] **(Agent)** Confirm `.dev.vars` is ignored — `git check-ignore .dev.vars` → must print `.dev.vars`. (It is, via `.gitignore`; this is a guard against accidentally tracking the file later.)

**Validation:** `npx wrangler whoami` prints the account email + ID; `node -v` is `v22.14.0`; `npx wrangler --version` is v4.x; `git remote -v` shows the GitHub origin.
**Rollback:** None — read-only/setup only. If `wrangler login` fails, re-run; nothing was mutated. To fully de-authenticate, `npx wrangler logout` removes the local credentials file.

---

## Phase 1 — Supabase project provisioning

**Goal:** A live Supabase project with auth enabled and credentials in hand.
**Depends on:** Phase 0.

### 1a — Account & organization

- [ ] **(Human)** Sign up at <https://supabase.com/dashboard/sign-up> (GitHub OAuth recommended — single sign-on with the same identity that will own the repo). Free plan is sufficient for this MVP (500 MB DB, 50 K monthly active auth users, projects auto-pause after 1 week of inactivity).
- [ ] **(Human)** Create or pick an **Organization** — the project lives under an org, not a user. For a personal MVP, the default org Supabase creates on signup is fine.

### 1b — Project creation

- [ ] **(Human)** **Dashboard → New project** and fill in:
  - **Name:** `10x-cards` (or `10xcards-prod` if you want to keep room for a future staging project in the same org).
  - **Database password:** generate a strong one. **Save it in a password manager immediately** — Supabase shows it once, and you'll need it for direct DB access / migrations later. Not required for the Worker (the Worker uses the anon key, not the DB password).
  - **Region:** pick the one closest to your users. Cloudflare Workers runs at the edge, but every Supabase request still hits a single region, so the Supabase region is the latency floor. Europe → `eu-central-1` (Frankfurt) or `eu-west-1` (Ireland). Adjust to your audience.
  - **Pricing plan:** Free tier.
- [ ] **(Human)** Wait until the project status flips from **Setting up project…** to **Active** (typically 1–2 minutes). The API endpoints return 502 until provisioning finishes.

### 1c — Credentials capture

- [ ] **(Human)** Open **Project Settings → API** (left sidebar → cog icon → API).
- [ ] **(Human)** Copy and record (in a password manager / secure note — **not** in the repo, **not** in chat):
  - **Project URL** → `https://<ref>.supabase.co` — this becomes `SUPABASE_URL`.
  - **Project API keys → `anon` `public`** — this becomes `SUPABASE_KEY`. Safe to ship to the browser; gated by Row-Level Security.
  - **Do not copy** the `service_role` key. It bypasses RLS and must never reach the Worker or the client. If you ever expose it, rotate it via **Settings → API → Reset service role secret** immediately.

### 1d — Auth provider configuration

- [ ] **(Human)** **Authentication → Providers → Email** — confirm it is **enabled** (it is by default). Disable any provider the app does not use; smaller attack surface.
- [ ] **(Human)** Decide email-confirmation behaviour. The app's signup flow redirects to `/auth/confirm-email`, so **"Confirm email" = ON** is the consistent choice. Setting it OFF would let users sign in immediately without verifying their address — fine for a private dev environment, wrong for anything public.
- [ ] **(Human)** Note the SMTP setup. On the free tier Supabase ships a **shared SMTP relay** with a hard limit of **~3–4 emails per hour per project** — enough for the Phase 4 smoke test, not enough for real users. **Authentication → Emails → SMTP Settings** is where you'd wire a custom SMTP provider (Resend, Postmark, SES) when traffic grows; not required for this deploy.
- [ ] **(Human)** Leave **Authentication → URL Configuration** (Site URL, Redirect URLs) untouched for now — they need the live Worker URL and are wired in Phase 4.

### 1e — Database & RLS posture

- [ ] **(Human, informational)** The `auth.users` table is managed by Supabase and has RLS enforced by default. No schema work is in scope for this deploy (per the *Out of scope* section). When you add app tables in a later phase, **every table must have RLS enabled before it ships** — the anon key trusts RLS to do the gating.

**Validation:** The Supabase dashboard shows the project as **Active**; `SUPABASE_URL` and the anon `SUPABASE_KEY` are recorded in a secure local note (not the repo, not in chat); the `service_role` key has been seen but not copied anywhere persistent.
**Rollback:** **Settings → General → Pause project** suspends the project (free-tier resume is one click). **Settings → General → Delete project** removes it permanently. Both are **Human-only** per the approval boundary. Rotating the anon key (**Settings → API → Reset anon key**) invalidates current sessions and requires re-running `wrangler secret put SUPABASE_KEY` in Phase 3.

> The app uses the **anon** key with Supabase RLS, not the service-role key —
> keep the service-role key out of the Worker entirely. If you ever paste it
> into `wrangler secret put` by accident, rotate it in the Supabase dashboard
> before doing anything else.

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
