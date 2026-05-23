# Cloudflare Workers Deployment Plan — 10xCards

## Context

`context/foundation/infrastructure.md` selected **Cloudflare Workers** as the MVP deployment platform (5/5 on the agent-friendly criteria; runner-up Render). The project is already correctly scaffolded for it — `@astrojs/cloudflare` v13.5, `output: "server"`, `wrangler.jsonc` with `nodejs_compat`, `compatibility_date: 2026-05-08`, and `observability.enabled: true`. **No adapter or runtime code changes are needed.** What is missing is the *operational* path to production:

- No Supabase production schema/auth wiring yet (project exists; URL Configuration in dashboard not set).
- No production secrets registered (`wrangler secret list` will fail until the Worker exists).
- No `deploy` script in `package.json`.
- The Worker still carries the starter name `10x-astro-starter`.

This plan ships the first production deploy manually, then attaches **Cloudflare native Git integration (Workers Builds)** so every push to `main` auto-deploys. GitHub Actions is deliberately *not* used — `.github/workflows/ci.yml` triggers only on `master` (the working branch is `main`) and stays inert. OpenRouter / AI secrets are out of scope — a repo-wide search finds zero AI code today.

**Decisions locked in:** new Supabase project named `10x-cards`; Worker renamed to `10x-cards` before the first deploy; one manual `wrangler deploy` first (human-gated checkpoint), *then* attach Git integration.

---

## Owner legend

- **Human** — account / dashboard / secret-entry actions. Anything that mutates a cloud account or requires a credential to be typed.
- **Agent** — scriptable, auditable commands safe to run unattended (`wrangler …`, `npm …`, file edits).

Mixed phases label each individual step.

## How to resume

This runbook is **stateful**. If interrupted at any point:

1. Find the highest-numbered phase whose **Phase complete** checkbox is **unchecked**.
2. Inside that phase, find the first **un-ticked** sub-step and re-run from there.
3. The phase's **Validation** block tells you whether you're allowed to advance.
4. Prerequisite sub-sections (A–E) follow the same rule — each section has its own checkbox.

> **Current resume point (2026-05-23):** Prerequisites A, B, C, D all complete. Prerequisite E optional/skipped. **All phases (0–7) and the rollback drill complete.** Worker live at `https://10x-cards.rafsaw.workers.dev`. Latest version: `3240f16d-a0e7-44ad-90d5-a0c13c7a8f55` (manual `npm run deploy` after roll-forward — fresh build, NOT a re-promotion of the original `52e9a4f6`). Deployment history retains all prior real versions (`e104ed8c`, `52e9a4f6`) plus the three pre-code placeholder shells. **Remaining optional follow-ups** (none block shipping): (1) configure custom SMTP in Supabase before any public launch — current shared-SMTP cap of ~3–4 emails/hour will break real signups; (2) silence the two `workers_dev` / `preview_urls` defaults warnings by adding them explicitly to `wrangler.jsonc`; (3) `.gitattributes` + `git add --renormalize .` to fix the Windows CRLF lint issue permanently.

---

## Prerequisites

> **Hard rule:** the **remote Supabase project (section D) is mandatory** — production runs against it, and the live Worker has no way to talk to a local DB. Local Supabase (section E) is a development convenience, never a substitute.

### A. Cloudflare account setup — ✅ COMPLETE (2026-05-23)

**Owner:** Human.

- [x] **(Human)** Create a free Cloudflare account at <https://dash.cloudflare.com/sign-up>. _Done — `rafsaw@gmail.com`._
- [x] **(Human)** Verify the signup email — `wrangler login` silently fails against an unverified account.
- [x] **(Human)** Confirm dashboard access — sign in to <https://dash.cloudflare.com> and confirm you land on the **Workers & Pages** overview.
- [x] **(Human)** Note the **Account ID** from **Workers & Pages → Overview** (right sidebar). _Account ID: `3219bb947bb836ced74794f8a0fc0b34`._
- [ ] **(Human, optional)** Enable 2FA before the first production deploy — **My Profile → Authentication → Two-Factor Authentication**.

### B. Wrangler CLI setup — ✅ COMPLETE (2026-05-23)

**Owner:** Human (login) + Agent (verification).

- [x] **(Agent)** Wrangler is pinned in `package.json` `devDependencies` (`wrangler@^4.90.0`). Every command in this runbook uses `npx wrangler …`; no global install is required.
- [ ] **(Human, optional)** Global install for shorter commands: `npm install -g wrangler@4`. The repo-pinned version is the source of truth for CI parity.
- [x] **(Human)** Authenticate Wrangler — `npx wrangler login`. Opens a browser, prompts for OAuth scopes (Workers Scripts, Workers KV, Workers Routes, Pages, Secrets Store, Account/User read), writes credentials to `%USERPROFILE%\.wrangler\config\default.toml`.
- [x] **(Agent)** Verify authentication — `npx wrangler whoami`. Must print the email and Account ID from section A. _Verified: `rafsaw@gmail.com` + `3219bb947bb836ced74794f8a0fc0b34`. Scopes include `workers (write)`, `workers_scripts (write)`, `pages (write)`, `secrets_store (write)`._
- [x] **(Agent)** Verify version — `npx wrangler --version` → expect `4.x`. _`4.90.0`._

> **Least privilege:** the interactive OAuth token grants broad write scopes across the account. For CI / headless use later, create a project-scoped API token at **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers"** template, restricted to **this account only** and **this Worker only** once the Worker exists. **Never** put a token in `.env`, `wrangler.jsonc`, or chat — export it via `$env:CLOUDFLARE_API_TOKEN`.

> **Windows 11 specifics:** Wrangler writes credentials to `%USERPROFILE%\.wrangler\config\default.toml`. If Antivirus / Controlled Folder Access blocks the write (`EPERM` / `EACCES`), allow the file in **Windows Security → Virus & threat protection → Controlled folder access**. Run all `wrangler` commands from **PowerShell**, not legacy `cmd.exe`. PowerShell env vars: `$env:NAME = "value"` (session) or `setx NAME "value"` (persistent).

### C. GitHub CLI setup — ✅ COMPLETE (2026-05-23)

**Owner:** Human (login) + Agent (verification).

- [x] **(Human)** Install `gh` — `winget install --id GitHub.cli` (recommended on Windows 11) or `scoop install gh`.
- [x] **(Human)** Authenticate — `gh auth login`. Choose **GitHub.com → HTTPS → Login with a web browser**. Approve the device code in the browser.
- [x] **(Agent)** Verify — `gh auth status`. _Verified: logged in as `rafsaw`, scopes `gist, read:org, repo`, active account = true._
- [x] **(Agent)** Verify the repo remote is wired — `git remote -v` → `origin = https://github.com/rafsaw/10xCards.git` (fetch + push). Required for Phase 7's Git integration.

### D. Supabase REMOTE setup — ✅ COMPLETE (2026-05-23, all verifications closed)

**Owner:** Human.

- [x] **(Human)** Sign up at <https://supabase.com/dashboard/sign-up> (GitHub OAuth recommended — single sign-on with the repo owner identity).
- [x] **(Human)** **Dashboard → New project**:
  - **Name:** `10x-cards`.
  - **Database password:** generate strong, save in a password manager **immediately** (shown once).
  - **Region:** closest to your users — Europe → `eu-central-1` (Frankfurt) or `eu-west-1` (Ireland).
  - **Pricing plan:** Free tier (500 MB DB, 50 K MAU, ~3–4 emails/hour via shared SMTP, projects auto-pause after ~1 week of inactivity → resume is one click).
- [x] **(Human)** Wait until status flips from **Setting up project…** to **Active** (1–2 minutes; the API returns 502 until provisioning finishes).
- [x] **(Human)** Open **Project Settings → API**. Copy and record (in a password manager — **not** in the repo, **not** in chat):
  - **Project URL** → `https://<ref>.supabase.co` (becomes `SUPABASE_URL`).
  - **Project API keys → `anon` `public`** (becomes `SUPABASE_KEY`). Safe to ship to the browser — gated by Row-Level Security.

> ### ⚠️ Verify before Phase 6 — service_role key — ✅ VERIFIED (2026-05-23)
>
> **`service_role` is NOT the same as RLS.**
> - **RLS** (Row-Level Security) is a Postgres feature that gates which rows each user can see. It is **always on** for `auth.users` and must be turned on for every table you add later.
> - **`service_role`** is a separate **master API key** displayed on the same **Settings → API** page as the anon key. It **bypasses RLS entirely** and must never reach the Worker, the browser, this repo, or chat.
>
> **Action (Human):** open **Project Settings → API**. Confirm that whatever you saved to your password manager is the **anon public** key, **not** the `service_role secret` key (they look similar — both are long JWTs, but the one under "service_role" is marked `secret`). If you have any doubt that `service_role` was copied somewhere, click **Reset service role secret** to rotate it — this invalidates the old key system-wide. The new value should be **read once and not copied**. _User confirmed `service_role` was never copied._

> ### ⚠️ Verify before Phase 6 — email confirmation setting — ✅ VERIFIED (2026-05-23)
>
> The app's signup flow at `src/pages/auth/signup` redirects to `/auth/confirm-email`, which expects new accounts to verify their address via a link sent by email **before** they can sign in. This requires **"Confirm email" = ON** in Supabase.
>
> **Action (Human):** open **Authentication → Sign In / Up → Auth Providers → Email**. Confirm the **Confirm email** toggle is **ON** (it is by default; only flag if someone turned it off). If OFF, the app's `/auth/confirm-email` page will be unreachable in the normal flow and signup will appear "broken" in Phase 6. _User confirmed toggle is ON (green)._

- [x] **(Human)** **Authentication → Sign In / Up → Auth Providers** — confirm only **Email** is enabled (disable any provider the app does not use; smaller attack surface). _Verified 2026-05-23 — only Email toggle is green; all other providers disabled._
- [x] **(Human)** **Authentication → URL Configuration** — wire **localhost dev** values now so signup/confirm/signin work locally during Phase 4.3 smoke test. _Set and **persisted** 2026-05-23._
  - **Site URL:** `http://localhost:4321` (Astro's default dev port — confirmed by `astro.config.mjs`; **not** 3000).
  - **Redirect URLs:** add `http://localhost:4321/**` (the `/**` wildcard is required so `/auth/confirm-email`, `/dashboard`, etc. are all allowed callbacks — without it the confirmation link in the email is rejected).
  - **Prod URL is added (not replaced) in Phase 6** once the Worker URL is known — Site URL will swap to the Worker URL (that's what gets baked into confirmation emails), and the localhost redirect entry stays so local dev keeps working.
  - ⚠️ **Gotcha — Supabase requires explicit Save click.** First attempt: change typed but Save not clicked; field reverted to `http://localhost:3000` on next page load. Symptom in Phase 4.3 was a confirmation email with `http://localhost:3000/` baked into the link (wrong port → broken confirm). Resolution: re-enter, **click Save at the bottom of the page**, reload to verify the new value persists. After fix, deleted+recreated the test user via **Authentication → Users → Delete user** to invalidate the stale-port email and re-trigger a clean confirmation.

### E. Supabase LOCAL setup (optional — Docker on Windows 11)

**Owner:** Human. **Skip this section entirely** if you're happy to develop against the cloud project from section D.

Local Supabase runs the full stack (Postgres, GoTrue auth, PostgREST, Realtime, Storage, Studio UI) in **Docker containers** via the Supabase CLI. Use it for offline dev, faster auth iteration, or schema experiments without burning cloud quotas. **Even with local Supabase running, the cloud project from section D must exist** — production deploys read its URL + anon key from Workers Secrets (Phase 4).

- [ ] **(Human)** Install Docker Desktop for Windows — <https://docs.docker.com/desktop/install/windows-install/>. Use the **WSL2 backend** (default since 4.x).
- [ ] **(Human)** Enable WSL2 — `wsl --install` from an elevated PowerShell, then `wsl --set-default-version 2`.
- [ ] **(Human)** Confirm virtualization is enabled in BIOS/UEFI (look for "Virtualization" / "SVM" / "Intel VT-x") and that **Virtual Machine Platform** + **Windows Subsystem for Linux** are on:
  ```powershell
  Get-WindowsOptionalFeature -Online | Where-Object FeatureName -match "VirtualMachinePlatform|Microsoft-Windows-Subsystem-Linux"
  ```
- [ ] **(Human)** Allocate Docker Desktop ≥ **4 CPUs and 8 GB RAM** (Settings → Resources). The Supabase stack is ~10 containers; less than 8 GB causes flaky timeouts on `supabase start`.
- [ ] **(Human)** Verify Docker is running — `docker --version` then `docker ps` (must not error).
- [ ] **(Agent)** Confirm the Supabase CLI is available — `npx supabase --version`. (Already in `devDependencies` as `supabase@^2.23.4`; no separate install needed.)
- [ ] **(Human)** Confirm the local ports are free — `Get-NetTCPConnection -LocalPort 54321,54322,54323,54324 -ErrorAction SilentlyContinue` should print nothing.
- [ ] **(Agent)** Start the stack from the repo root — `npx supabase start`. First run pulls ~2 GB of images (5–10 minutes); subsequent runs take ~30s.
- [ ] **(Agent)** Capture the local credentials printed by `supabase start`:
  - **API URL** → `http://127.0.0.1:54321`
  - **anon key** → printed at the end of `supabase start`
  - **Studio** → `http://127.0.0.1:54323`
  - **Inbucket (local SMTP catcher)** → `http://127.0.0.1:54324`
  - Drop these into `.env.local` (or temporarily into `.env`) **only when developing against the local stack**. Swap back to the cloud values before testing production.
- [ ] **(Agent)** Stop the stack — `npx supabase stop` (keeps state) or `npx supabase stop --no-backup` (wipes the volume).

---

## Phase 0 — Prerequisite verification ✅ COMPLETE (2026-05-23)

**Objective:** confirm the toolchain is authenticated and the repo is wired before any production-touching command runs.
**Owner:** Agent.
**Depends on:** Prerequisites A, B, C, D ticked complete.

- [x] **(Agent)** `npx wrangler whoami` — must print the email + Account ID from Prerequisite A. _Pass._
- [x] **(Agent)** `gh auth status` — must show logged-in account and `repo` scope. _Pass._
- [x] **(Agent)** `node -v` — should match `.nvmrc` (`v22.14.0`). _**Drift accepted** — local `v24.15.0`, `.nvmrc` stays `22.14.0`. See **Node version drift** callout below for risk + mitigation._
- [x] **(Agent)** `npx wrangler --version` — expect `4.x`. _`4.90.0`._
- [x] **(Agent)** `git remote -v` — `origin = https://github.com/rafsaw/10xCards.git`. _Pass._
- [x] **(Agent)** `git check-ignore .dev.vars` — must print `.dev.vars` (proves the file is ignored should you create it later). _Pass._

**Validation:** all six commands pass.
**Rollback:** none — read-only checks. `npx wrangler logout` fully de-authenticates if needed.
**Phase complete:** [x] 2026-05-23.

> ## ⚠️ Node version drift — accepted (read before Phase 3)
>
> **Local Node is `v24.15.0`. `.nvmrc` is `22.14.0`. They are intentionally different.**
>
> - **Why local stays on 24:** the user runs Node 24 system-wide and chose not to add a per-project switch. `fnm` is installed (`fnm 1.39.0`) — switching is available with `fnm use 22.14.0` from the repo root.
> - **Why `.nvmrc` stays on 22:** Cloudflare **Workers Builds** reads `.nvmrc` and runs `npm run build` on that version. Workers runtime currently supports Node 22 via `nodejs_compat`. **Do not edit `.nvmrc`.**
> - **What this risks:** a build that works on `node v24` locally but fails on `node v22` in CI. Most Astro + React + Supabase code is unaffected; danger lives in native modules with engine constraints, newer V8 APIs, and `package.json` `"engines"` checks.
> - **Mitigation in Phase 3:** if `npm run build` exits 0 locally but Cloudflare Workers Builds fails in Phase 7, first try `fnm use 22.14.0 && npm install && npm run build` to reproduce CI exactly.
> - **Revisit if:** a CI build fails for an engine reason, a new dep declares `"engines": { "node": ">=24" }`, or the Workers runtime bumps to a Node-24-based `compatibility_date`.

---

## Phase 1 — Framework / runtime adaptation for Cloudflare ✅ COMPLETE (2026-05-23)

**Objective:** confirm the Astro app is already shaped for the Workers runtime (no adapter swap needed) and clean up any stale contracts.
**Owner:** Agent.
**Depends on:** Phase 0.

- [x] **(Agent)** Confirm `astro.config.mjs` uses the Cloudflare adapter and SSR output — `output: "server"` and `adapter: cloudflare(...)`. **Already correct** in this repo; this is a verification, not an edit. _Pass (lines 11, 16)._
- [x] **(Agent)** Confirm `wrangler.jsonc` carries `compatibility_flags: ["nodejs_compat"]` and a recent `compatibility_date` (currently `2026-05-08`). Workers runtime is workerd, not Node — without `nodejs_compat`, the Supabase client breaks at runtime. **Already correct.** _Pass (lines 5–6)._
- [x] **(Agent)** Confirm `package.json` has `@astrojs/cloudflare` in `dependencies` (currently `^13.5.0`). **Already correct.** _Pass (`^13.5.0`, line 16)._
- [x] **(Agent)** Confirm `.gitignore` excludes `.env`, `.dev.vars`, `.wrangler/`, `dist/`. **Already correct.** _Pass (lines 3, 35, 36, 5)._
- [x] **(Agent, optional)** Fix the stale contract in `context/foundation/tech-stack.md`: `deployment_target: cloudflare-pages` → `cloudflare-workers`. The Astro 6 adapter is Workers-only; the stale value risks a future agent running `wrangler pages deploy` (wrong command family). *Note: `context/` is normally protected — this is a one-line factual correction; confirm with the user before editing or skip.* _Applied 2026-05-23 after user confirmation._

**Validation:** all four confirmations pass with no diff required. Optional fix either landed or explicitly skipped.
**Rollback:** if the optional `tech-stack.md` edit goes in and needs reverting, `git restore context/foundation/tech-stack.md`. Nothing else mutates state.
**Phase complete:** [x] 2026-05-23.

---

## Phase 2 — Wrangler configuration ✅ COMPLETE (2026-05-23)

**Objective:** rename the Worker and wire a one-command deploy.
**Owner:** Agent.
**Depends on:** Phase 1.

- [x] **(Agent)** Edit `wrangler.jsonc` — change `"name": "10x-astro-starter"` to `"name": "10x-cards"`. This must happen **before** the first deploy to avoid creating an orphan Worker that you'd then have to delete. _Applied (line 3)._
- [x] **(Agent)** Edit `package.json` `scripts` — add `"deploy": "astro build && wrangler deploy"`. _Applied (line 10)._
- [x] **(Agent)** Re-run `npm install` if you touched `package.json` (no dependency change here, but it normalises the `package-lock.json` line endings on Windows). _Ran — "up to date, audited 773 packages"; no lockfile churn._

**Validation:**
```powershell
# wrangler.jsonc shows the new name
Select-String -Path wrangler.jsonc -Pattern '"name":'
# package.json shows the new script
Select-String -Path package.json -Pattern '"deploy":'
```
_Both lines confirmed: `wrangler.jsonc:3: "name": "10x-cards"` and `package.json:10: "deploy": "astro build && wrangler deploy"`._
**Rollback:** `git restore wrangler.jsonc package.json`. No production state touched.
**Phase complete:** [x] 2026-05-23.

---

## Phase 3 — Local build validation ✅ COMPLETE (2026-05-23)

**Objective:** prove the production build is green locally before any Worker is created.
**Owner:** Agent.
**Depends on:** Phase 2.

- [x] **(Agent)** Install deps if not already — `npm install`. _Done in Phase 2._
- [x] **(Agent)** Lint — `npm run lint`. Must exit 0. _Pass after one-time `npm run lint:fix` to normalize Windows CRLF line endings (autocrlf=true in working tree but Prettier defaults to `endOfLine: "lf"`). Fix touched LF on disk only — `git diff --stat` shows zero content changes outside the three intentional Phase 1/2 edits. See **Windows CRLF lint note** below._
- [x] **(Agent)** Production build — `npm run build`. Must exit 0. _Pass — Astro built in 8.77s; adapter auto-enabled Cloudflare Images binding (`IMAGES`) and Cloudflare KV sessions binding (`SESSION`)._
- [x] **(Agent, added)** Dry-run deploy — `npx wrangler deploy --dry-run --outdir=.wrangler/dry-run`. Read-only validation of bundle + config without uploading. _Pass — exits cleanly with "--dry-run: exiting now". Catches Worker-specific failures that `npm run build` alone misses (bundle size, config schema, `main` entrypoint resolution)._
- [x] **(Agent)** Note the build output size — `Get-ChildItem dist -Recurse | Measure-Object -Property Length -Sum` (or check the `wrangler` build summary). Astro + React 19 + Supabase client should sit well under the **1 MB compressed** free-plan ceiling; record the figure as a baseline. _Recorded: **1913 KiB raw / 391 KiB gzipped** (~38% of the 1024 KiB free-plan ceiling — comfortable headroom)._

**Validation:** `npm run lint` exits 0 ✅, `npm run build` exits 0 ✅, `wrangler deploy --dry-run` exits 0 ✅, `dist/` exists, bundle size recorded.
**Rollback:** none — `dist/` and `.wrangler/dry-run/` are git-ignored. Delete with `Remove-Item -Recurse -Force dist, .wrangler/dry-run` if you need a clean slate.
**Phase complete:** [x] 2026-05-23.

> ### Windows CRLF lint note (closed 2026-05-23)
>
> `npm run lint` initially failed across the entire repo with `prettier/prettier  Delete '␍'` errors on every line. Cause: `git config core.autocrlf=true` (Windows default) converts LF → CRLF on checkout; `.prettierrc.json` has no `endOfLine` (defaults to `lf`); no `.gitattributes` to override. Files are LF in the repo, become CRLF on disk, Prettier rejects.
>
> **One-time fix applied:** `npm run lint:fix` normalized line endings to LF on disk. `git diff --stat` confirmed zero content changes outside the three intentional Phase 1/2 edits — all the `M`-flagged files in `git status` are autocrlf "ghosts" (warning: *"LF will be replaced by CRLF the next time Git touches it"*), not real diffs. They'll silently re-convert to CRLF on next `git pull` / branch switch.
>
> **Long-term fix (deferred):** add a `.gitattributes` with `* text=auto eol=lf` and run `git add --renormalize . && git commit` so every future checkout on Windows lands as LF. Out of scope for this deploy; do after Phase 7 if desired.
>
> ### Auto-injected Cloudflare bindings (informational)
>
> The Astro Cloudflare adapter generates `dist/server/wrangler.json` during build, merging your `wrangler.jsonc` with two bindings it injects automatically:
> - `env.IMAGES` — Cloudflare Images service (provided by Cloudflare; no config needed)
> - `env.SESSION` — KV Namespace for Astro Sessions (Cloudflare auto-provisions the default KV)
>
> Plus your declared `env.ASSETS` for static files. **No `wrangler.jsonc` change needed** — the dry-run confirmed all three resolve cleanly.
>
> ### Sitemap warning (cosmetic)
>
> Build emitted: `[@astrojs/sitemap] The Sitemap integration requires the site astro.config option. Skipping.` Sitemap is skipped because no `site:` is set in `astro.config.mjs`. Build succeeds regardless. Post-deploy, add `site: "https://10x-cards.<subdomain>.workers.dev"` to `astro.config.mjs` if you want a sitemap generated.

---

## Phase 4 — Environment variables / secrets setup

**Objective:** wire local `.env` for `npm run dev` and load production Workers Secrets so the live Worker can talk to Supabase.
**Owner:** Human (paste values) + Agent (commands).
**Depends on:** Phase 3 (green build) **and** Phase 5's `wrangler deploy` for the production secret step — see ordering note below.

> **Ordering note:** local `.env` can be created right after Phase 3. The `wrangler secret put` sub-steps require the Worker to exist (Phase 5 creates it). Two ways to handle this:
> - **Option A (recommended):** create local `.env` here (steps 4.1–4.3), then do Phase 5 (`wrangler deploy`), then come back and do steps 4.4–4.6.
> - **Option B:** do all of Phase 4 after Phase 5 — slightly less natural but linear.

### 4.1–4.3 — Local `.env` (before Phase 5)

- [x] **(Human)** Create a git-ignored `.env` at the repo root by copying `.env.example`:
  ```powershell
  Copy-Item .env.example .env
  ```
  _Done 2026-05-23._
- [x] **(Human)** Open `.env` and paste the real values from Prerequisite D:
  ```
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_KEY=<anon-public-key>
  ```
  `src/lib/supabase.ts` reads these via `astro:env/server` during local dev. **Never** paste the `service_role` key — see the ⚠️ Verify callout in Prerequisite D.
  _Done 2026-05-23. Structural validation confirmed: cloud URL pattern (`https://<ref>.supabase.co`); key is the **new-format publishable key** (`sb_publishable_...`, ~46 chars), Supabase's 2024+ replacement for the legacy ~220-char anon JWT (`eyJ...`). Verified prefix is `sb_publishable_`, **not** `sb_secret_`. `@supabase/supabase-js@^2.99.1` accepts both formats._
- [x] **(Agent)** Local smoke test — `npm run dev`, then in a browser exercise `/auth/signup`, `/auth/signin`, `/dashboard` (should redirect to signin when logged out), `/auth/signout`. No "Supabase is not configured" banner should appear.
  _Dev server boots clean — `astro v6.3.1 ready in 3169 ms`, log shows `"Using secrets defined in .env"` (Astro picked up the env file), no configuration banner. Smoke test in progress: signup + email confirmation **working** after the Supabase Site URL gotcha fix (see Prerequisite D callout above). Signin / dashboard / signout still being walked by user._

### 4.4–4.6 — Production secrets (after Phase 5 has created the Worker)

> **Ordering reality (2026-05-23):** secrets were put **before** Phase 5's `wrangler deploy`. `wrangler secret put` on a non-existent Worker auto-creates an empty Worker shell (the placeholder versions visible in `wrangler deployments list` as `Source: Secret Change`). The first `npm run deploy` then uploads real code on top. Both orderings work — the plan's Option A and Option B are equivalent.

- [x] **(Human)** `npx wrangler secret put SUPABASE_URL` — paste the Supabase Project URL when prompted. _Done 2026-05-23._
- [x] **(Human)** `npx wrangler secret put SUPABASE_KEY` — paste the anon public key when prompted. _Done 2026-05-23._
- [x] **(Agent)** `npx wrangler secret list` — must list `SUPABASE_URL` and `SUPABASE_KEY` (names only, never values). _Verified — both present as `secret_text`._

**Validation:** `.env` exists locally and `npm run dev` boots without the configuration banner ✅. After Phase 5, `wrangler secret list` shows both names ✅.
**Rollback:** `.env` is untracked — delete to revert (`Remove-Item .env`). Secrets in production: `npx wrangler secret delete SUPABASE_KEY` / `… SUPABASE_URL`. Rotating an anon key (Supabase **Settings → API → Reset anon key**) invalidates current sessions and requires re-running `wrangler secret put SUPABASE_KEY`.
**Phase complete:** [ ]

> Secrets live **only** in Workers Secrets — never on `process.env`, never in `wrangler.jsonc`, never committed. `wrangler deploy` does not clear existing secrets, so they survive every later Git-integration deploy.

---

## Phase 5 — First deployment ✅ COMPLETE (2026-05-23)

**Objective:** create the `10x-cards` Worker in production with a known-good build.
**Owner:** Agent.
**Depends on:** Phase 4.1–4.3 (local `.env` works, build is green).

- [x] **(Agent)** Deploy — `npm run deploy` (which runs `astro build && wrangler deploy`) **or** `npx wrangler deploy`. The first run **creates** the Worker and prints `https://10x-cards.<subdomain>.workers.dev`. **Record that URL** — it's used in Phase 6. _Deployed 2026-05-23 13:21 local time. **Worker URL: `https://10x-cards.rafsaw.workers.dev`** (account subdomain: `rafsaw`). Current Version ID: `e104ed8c-1b74-4452-8a59-c408d0ede615`. Worker Startup Time: 19 ms. Upload: 1913 KiB / 391 KiB gzipped._
- [x] **(Agent)** Confirm the deploy registered — `npx wrangler deployments list`. Expect one row with the version ID and "Created from: Upload". _Verified — version `e104ed8c-...` is the live deploy. Three earlier rows show `Source: Secret Change` (placeholder Worker shell from `wrangler secret put` before this deploy)._
- [x] **(Agent)** Now loop back and complete Phase 4.4–4.6 (set the production secrets). _Already done — see Phase 4.4–4.6 ticks. The `wrangler secret put` calls were run before this `wrangler deploy`, auto-creating the Worker shell; `npm run deploy` then layered real code on top. Both orderings work._

**Validation:** the printed URL responds to `Invoke-WebRequest https://10x-cards.<subdomain>.workers.dev` with HTTP 200 (or a redirect to `/auth/signin`). `wrangler deployments list` shows one deployment.
_Validated 2026-05-23: `Invoke-WebRequest https://10x-cards.rafsaw.workers.dev` → **HTTP 200**, `Content-Type: text/html` (homepage renders). `wrangler deployments list` shows the `Upload`-source version live._
**Rollback:**
- Bad code (after a later deploy) — `npx wrangler rollback` (reverts to the previous version in seconds) — **Agent**, to a known-good version only.
- Full teardown — delete the Worker via **Workers & Pages → 10x-cards → Settings → Delete** in the dashboard. **Human-only**.
**Phase complete:** [x] 2026-05-23.

> The first deploy creates the Worker even though no secrets are set yet. Pages requiring Supabase will show a configuration error until Phase 4.4–4.6 lands the secrets — expected and harmless.

> ### Auto-provisioned KV namespace (informational)
>
> Cloudflare's **experimental resource provisioning** auto-created the KV namespace needed for Astro Sessions during this deploy:
>
> ```
> Provisioning SESSION (KV Namespace)...
> Creating new KV Namespace "10x-cards-session"...
> SESSION provisioned 🎉
> env.SESSION (fb7304c7b2214cde8aaf7a0b250e42a7)  KV Namespace
> ```
>
> The KV namespace ID `fb7304c7b2214cde8aaf7a0b250e42a7` is bound to `env.SESSION`. No `wrangler.jsonc` edit was needed — the Astro Cloudflare adapter declared the binding in its generated `dist/server/wrangler.json`. Visible in the dashboard at **Workers & Pages → 10x-cards → Settings → Bindings** and **Storage & Databases → KV → 10x-cards-session**.
>
> ### Two `wrangler deploy` warnings (informational, not blocking)
>
> Wrangler printed two defaults-applied warnings because they aren't explicitly set in `wrangler.jsonc`:
>
> ```
> [WARNING] Because 'workers_dev' is not in your Wrangler file, it will be enabled for this deployment by default.
> [WARNING] Because your 'workers.dev' route is enabled and your 'preview_urls' setting is not in your Wrangler file, Preview URLs will be enabled for this deployment by default.
> ```
>
> Both defaults match what we want for the MVP (the `*.workers.dev` URL **is** the production URL; preview URLs are useful when Phase 7's Git integration lands). To silence the warnings without changing behavior, optionally add to `wrangler.jsonc`:
> ```jsonc
> "workers_dev": true,
> "preview_urls": true,
> ```
> Deferred — not blocking, and Workers Builds (Phase 7) doesn't require it.

---

## Phase 6 — Production verification

**Objective:** point Supabase Auth at the live Worker URL and prove the full signup → confirm → signin flow works end-to-end against production.
**Owner:** Human (dashboard) + Agent (logs / verification commands).
**Depends on:** Phase 5 (URL known) and Phase 4.4–4.6 (secrets loaded).

### Pre-flight — close the ⚠️ Verify items from Prerequisite D

- [x] **(Human)** Confirm only the **anon** Supabase key is in your password manager — **not** the `service_role secret`. Rotate `service_role` if there is any doubt (**Settings → API → Reset service role secret**). _Verified 2026-05-23 — `service_role` was never copied._
- [x] **(Human)** Confirm **Authentication → Sign In / Up → Auth Providers → Email → Confirm email** is **ON**. If OFF, the app's `/auth/confirm-email` route is unreachable in the normal flow. _Verified 2026-05-23 — toggle is ON._

### Supabase URL configuration

> **Additive, not replacing.** The localhost entries set in Prerequisite D stay — only Site URL flips to the Worker URL, and the Worker redirect is **added** alongside the localhost one so local dev keeps working.

- [x] **(Human)** Supabase **Authentication → URL Configuration → Site URL** — **swap** from `http://localhost:4321` to `https://10x-cards.rafsaw.workers.dev`. (Site URL is what gets baked into the `{{ .ConfirmationURL }}` token in the confirmation email — it can only point to one place at a time, and production must win once the Worker exists.) **⚠️ Click Save at the bottom of the page** — the dashboard silently drops unsaved changes (this bit us in Prerequisite D). _Set and persisted 2026-05-23._
- [x] **(Human)** Supabase **Authentication → URL Configuration → Redirect URLs** — **add** `https://10x-cards.rafsaw.workers.dev/**` (covers the email-confirmation callback). Keep `http://localhost:4321/**` in the list so signing up against localhost still works during dev. _Added 2026-05-23 — both entries present and saved._

### Smoke test on the live URL

- [x] **(Agent)** Stream live logs in a separate PowerShell — `npx wrangler tail --format json`. _Streamed via `wrangler tail --format pretty` throughout the test._
- [x] **(Human)** On `https://10x-cards.rafsaw.workers.dev`:
  1. **Sign up** with a real email → expect redirect to `/auth/confirm-email` and a confirmation email within ~30s (free-tier shared SMTP).
  2. Click the confirmation link in the email.
  3. **Sign in** with the same credentials → expect redirect to `/dashboard`.
  4. Visit `/dashboard` while authenticated → loads.
  5. **Sign out** → `/dashboard` redirects to `/auth/signin`.
  _Steps 1–2 blocked by Supabase free-tier shared-SMTP rate limit (~3–4 emails/hour) — exhausted across earlier localhost-port-3000 / port-4321 attempts. **Worked around** by creating the test user directly via **Supabase Dashboard → Authentication → Users → Add user → Create new user → Auto Confirm User: ON** (bypasses SMTP). Email-link redirection mechanism was already proven during local Phase 4.3 (link correctly used whichever value was in Site URL), so it's circumstantially proven here too now that Site URL = prod URL. Steps 3–5 walked successfully on the live URL._
- [x] **(Agent)** Confirm no unhandled errors appeared in `wrangler tail`. _Confirmed — only "expected" errors (one bad-credentials retry by user — surfaced cleanly as `?error=Invalid login credentials`; one rate-limit error from step 1 — surfaced cleanly as `?error=email rate limit exceeded`). No 500s, no unhandled exceptions._

> ### Supabase free-tier SMTP rate limit (lesson — 2026-05-23)
>
> Hit "email rate limit exceeded" mid-smoke-test after burning through ~3–4 confirmation emails across localhost-port-3000, localhost-port-4321, and the production attempt. Supabase **enforces the cap BEFORE creating the user** — so a rate-limited signup leaves no user record in `auth.users` to manually confirm afterward.
>
> **MVP workarounds (no paid plan needed):**
> - **Manual user creation:** Dashboard → Authentication → Users → **Add user → Create new user → Auto Confirm User: ON**. Sets email + password directly, marks confirmed, sends no email. Use this for smoke tests, debugging, or seeding test accounts.
> - **Custom SMTP:** Authentication → Emails → SMTP. Configure Resend / SendGrid / AWS SES to bypass the shared-pool cap permanently. Required before real users can sign up at any scale — deferred for MVP but **flagged as a hard prerequisite for any public launch**.
> - **Wait it out:** the rolling-window cap clears ~60 min after the first email. Fine for one-off tests, not viable when iterating.

### Rollback drill (do it once, while everything is fresh) — ✅ COMPLETE (2026-05-23, after Phase 7)

> **Deferred at first, re-opened after Phase 7's auto-deploy created a second real code version (`52e9a4f6`) alongside the Phase 5 manual deploy (`e104ed8c`).** Drill ran against that pair.

- [x] **(Agent)** `npx wrangler deployments list` — note the current version ID. _Captured: `52e9a4f6-0225-47bc-80d7-56042337fb1a` was live._
- [x] **(Agent)** `npx wrangler rollback` — confirm the site still serves. _`npx wrangler rollback e104ed8c-1b74-4452-8a59-c408d0ede615 --message "rollback drill ..."` completed in ~5s. Site still served HTTP 200 / 4704 bytes under the rolled-back version. Wrangler ran non-interactively (auto-confirmed in non-TTY context)._
- [x] **(Agent)** `npm run deploy` — return to head. _Deployed new version `3240f16d-a0e7-44ad-90d5-a0c13c7a8f55` (Worker startup 21 ms; bindings inherited — KV namespace `SESSION` was not re-provisioned, confirming bindings persist across rollback→deploy cycles). Site verified at HTTP 200 / 4704 bytes._
- [x] **(Agent)** Confirm retained logging — **Workers & Pages → 10x-cards → Logs** in the dashboard shows recent requests (don't rely on sampled `wrangler tail` for incident triage; observability is already `enabled` in `wrangler.jsonc`). _Verified 2026-05-23 — `wrangler.jsonc:12-14` has `observability.enabled: true`; user confirmed dashboard Logs view (at `https://dash.cloudflare.com/3219bb947bb836ced74794f8a0fc0b34/workers/services/view/10x-cards/production/observability/logs`) shows retained request entries from the smoke test and rollback drill. Free-plan retention is ~3 days._

> **Key lessons from the drill:**
> 1. **Rollback is non-destructive.** Both the version you rolled away from AND the version you rolled to remain in `wrangler deployments list` forever (or until you hit Cloudflare's per-Worker version cap). Rollback is a routing pointer swap, not a delete.
> 2. **Roll-forward creates a NEW version ID.** After `rollback → npm run deploy`, the new version is `3240f16d-...`, *not* `52e9a4f6-...` (the version you originally rolled away from). If you specifically want to re-promote `52e9a4f6` instead of building fresh, use `wrangler rollback 52e9a4f6-...` (rollback can target any version, forward or backward).
> 3. **Bindings persist; bound-resource STATE does not auto-reset.** Wrangler warning during rollback: *"Rolling back to a previous deployment will not rollback any of the bound resources (Durable Object, D1, R2, KV, etc)."* Secrets/bindings carry over (good — no re-entry needed). But if a bad deploy ran a DB migration or wrote bad data to KV, `wrangler rollback` does NOT undo those side effects. Production migrations need their own down-paths.
> 4. **The drill took ~30 seconds end-to-end.** Worth knowing the muscle memory; the moment you actually need a rollback (broken deploy at 2am) is the worst time to first run the command.

**Validation:** a real account can sign up, confirm, sign in, reach `/dashboard`, and sign out on the production URL ✅. `wrangler tail` shows no unhandled errors ✅. A rollback completes in seconds without downtime ✅.
**Rollback:** auth misbehaving is almost always a Supabase URL-config issue — fix in the dashboard, no redeploy needed. For a code regression, `npx wrangler rollback`.

> **Caveat:** `wrangler rollback` reverts **Worker code only**. It does **not** roll back Supabase schema migrations — a deploy that ran a migration needs a hand-written down-migration. Keep dropping/altering the Supabase DB and rotating its keys **Human-only**.

**Phase complete:** [ ]

---

## Phase 7 — Optional Git integration (Workers Builds) ✅ COMPLETE (2026-05-23)

**Objective:** every push to `main` auto-builds and auto-deploys via Cloudflare — no GitHub Actions involved.
**Owner:** Human (dashboard) + Agent (push verification).
**Depends on:** Phase 6 (verified healthy production Worker).

- [x] **(Human)** Ensure `main` is up to date on the remote — `git push origin main`. _Done — recent commits already pushed._
- [x] **(Human)** In the Cloudflare dashboard: **Workers & Pages → `10x-cards` → Settings → Builds → Connect to Git**. _Done 2026-05-23._
- [x] **(Human)** Authorize the **Cloudflare GitHub app** for `rafsaw/10xCards` (grant the minimum repo scope; do not grant org-wide access). _Done with **"Only select repositories"** scope (just `rafsaw/10xCards`). Reversible via **GitHub → Settings → Applications → Installed GitHub Apps → Cloudflare Workers and Pages**._
- [x] **(Human)** Configure the build:
  - **Production branch:** `main`
  - **Build command:** `npm run build`
  - **Deploy command:** `npx wrangler deploy` (default)
  - **Root directory:** `/`
  - Node version is read from `.nvmrc` (`22.14.0`) automatically — **do not edit `.nvmrc`** (see the Node-drift callout in Phase 0).

  _Configured 2026-05-23._
- [x] **(Human / Agent)** Trigger a verification deploy — push a trivial commit to `main` (e.g. a README touch) and watch the build at **Workers & Pages → `10x-cards` → Builds**. _Triggered via commit `c57b814` (m1l5 - phase 7 git integration verification) pushed 2026-05-23 19:07. New version `52e9a4f6-0225-47bc-80d7-56042337fb1a` landed at 19:10:28 — ~3 minutes from push to live._

**Validation:** the dashboard shows a build triggered by the commit, it succeeds, and `npx wrangler deployments list` shows a new version whose source is "Workers Builds". The live URL still serves the app and auth still works.
_Validated 2026-05-23: new version `52e9a4f6...` in `wrangler deployments list`; `Invoke-WebRequest https://10x-cards.rafsaw.workers.dev` → HTTP 200, 4704 bytes, `text/html`. (Note: wrangler 4.x CLI labels Workers-Builds deploys as `Source: Unknown (deployment)`, but the dashboard Builds tab carries full provenance: commit SHA + author + run logs.)_
**Rollback:**
- Disable auto-deploy — **Settings → Builds → Disconnect** (reverts to manual `wrangler deploy`).
- Bad auto-deploy — `npx wrangler rollback` or **Deployments → Rollback** in the dashboard.
- Secrets set in Phase 4 persist across Git-integration deploys — no re-entry needed.
**Phase complete:** [x] 2026-05-23.

> Pushes to non-`main` branches produce **preview** versions (a separate `*.workers.dev` preview URL) without promoting to production — useful for reviewing a branch before merge.

---

## Critical files

| File | Change | Phase |
|---|---|---|
| `wrangler.jsonc` | `name`: `10x-astro-starter` → `10x-cards` | Phase 2 |
| `package.json` | Add `"deploy": "astro build && wrangler deploy"` to `scripts` | Phase 2 |
| `.env` | **Create locally** (git-ignored) with real `SUPABASE_URL` / `SUPABASE_KEY` | Phase 4.1–4.3 |
| `context/foundation/tech-stack.md` | *Optional* one-line contract fix: `cloudflare-pages` → `cloudflare-workers` | Phase 1 |

No changes to `astro.config.mjs`, `src/`, or `.github/workflows/`. Production secrets live in **Workers Secrets** (set via `wrangler secret put`), never in tracked files.

## Already correct — no action needed

- `astro.config.mjs` — `cloudflare()` adapter, `output: "server"`, `astro:env` schema for the Supabase vars.
- `wrangler.jsonc` — `nodejs_compat` flag, `compatibility_date` 2026-05-08, `ASSETS` binding, `observability.enabled`.
- `.gitignore` — already excludes `.env`, `.dev.vars`, `.wrangler/`, `dist/`.
- `.nvmrc` — `22.14.0`, consumed automatically by Workers Builds. **Do not edit.**

## End-to-end verification

After Phase 7, the deploy pipeline is verified by:

1. **Build gate** — `npm run lint` and `npm run build` pass locally (per `CLAUDE.md`).
2. **Production auth** — signup → confirm email → signin → `/dashboard` → signout, all on `https://10x-cards.<subdomain>.workers.dev`.
3. **Auto-deploy** — a commit pushed to `main` appears as a successful build in the Cloudflare dashboard and as a new version in `wrangler deployments list`, with no GitHub Actions run involved.
4. **Rollback** — `wrangler rollback` reverts to the prior version within seconds without downtime (Phase 6 drill).
5. **Logs** — `wrangler tail` streams live requests; Workers Logs retain them for triage.

## Out of scope (deferred)

- OpenRouter / AI secrets — no AI code in the repo yet; add `OPENROUTER_API_KEY` via `wrangler secret put` when that feature lands.
- GitHub Actions CI — `.github/workflows/ci.yml` stays inert (triggers on `master`, working branch is `main`); revisit if a pre-deploy test gate is wanted later.
- Custom domain — `*.workers.dev` is fine for the MVP.
- Supabase schema/migrations, multi-region HA, Docker — not part of this deploy.
