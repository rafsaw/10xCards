---
name: om-prepare-test-env
description: Repo-local extension for 10xCards — the working command chain for bringing the test environment up, and the failures each step prevents.
---

# om-prepare-test-env — 10xCards local notes

Extends the installed skill; it does not replace it. Everything here was learned
by running the generated entrypoint against this repository.

## Invocation

The entrypoint is the **PowerShell** flavor (native Windows). Run it through an
explicit interpreter rather than dot-sourcing, so a restrictive execution policy
cannot block it — and never change the machine's policy to work around this:

```powershell
powershell -ExecutionPolicy Bypass -File .ai\scripts\test-env-up.ps1
powershell -ExecutionPolicy Bypass -File .ai\scripts\test-env-down.ps1
```

Flags pass straight through: `-Force` (restart a healthy env), `-ForceRebuild`
(ignore the build cache). POSIX-style `--force` / `--force-rebuild` are accepted
too.

## What this environment is, and is not

- The app is `npm run dev` (Astro) on port **4321** — the port
  `playwright.config.ts` expects, so the committed E2E suite attaches to the same
  server via `reuseExistingServer`.
- **There are no local backing services.** Supabase is remote and shared; the up
  script never starts, migrates, seeds, or tears it down, and the down script
  never touches it. Credentials come from `.env`, which Astro loads itself.
  Anything that would provision a database here is wrong for this repo.
- Measured timings: cold **90 s** (full `npm ci` + `astro sync` + boot), restart
  with a warm build cache **15 s**, attach to a running env **1 s**.

## Failures already baked into the script

- **Descriptor written with a BOM.** Windows PowerShell 5.1's `Set-Content
  -Encoding utf8` always emits a byte-order mark, and every consumer of
  `.ai/qa/test-env.json` is JS-based — `JSON.parse` throws on a leading BOM. All
  JSON writes go through the script's `Write-Utf8NoBom` helper. Do not "simplify"
  them back to `Set-Content`.
- **Killing only the parent leaves the server up.** `Start-Process npm.cmd`
  creates a `cmd` process that spawns node; stopping just the recorded PID orphans
  the listener, and the next run then "reuses" a server nobody owns. Teardown walks
  the process tree via `Win32_Process` / `ParentProcessId`.
- **The `$PID` name is reserved.** It is a read-only automatic variable in
  PowerShell; the app's process id is held in `$appPid`.

## Environment state vs. committed state

The scripts are committed so every checkout inherits them. The per-run state they
write is gitignored: `.ai/qa/test-env.json`, `.ai/qa/test-env.env`,
`.ai/qa/test-env-build-cache.json`, `.ai/qa/test-env-app.*.log`,
`.ai/qa/test-env.lock/`.

## Known gap — authenticated QA

The descriptor records **no credentials**. The committed Playwright suite mints
its own ephemeral user in `tests/e2e/auth.setup.ts` (service-role key from the
environment) and deletes it in `tests/e2e/global.teardown.ts`, so it does not need
one. Agent-driven browser QA reading this descriptor therefore reaches only the
unauthenticated routes — `/`, `/auth/signin`, `/auth/signup`. Driving
`/dashboard`, `/library`, `/generate`, `/review`, or `/settings` requires
provisioning a QA user and recording it as a `credentials` entry plus a
`credentialsFile`; that has not been done, deliberately, because it creates a real
user in the shared remote Supabase project.
