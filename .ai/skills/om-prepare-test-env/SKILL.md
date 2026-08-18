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
- **The requested port is a preference, not a fact.** Astro prints
  `Port 4321 is in use, trying another one...` and binds the next free one, so the
  script reads the bound port back from the app's own output (`Wait-BoundPort`).
  A pre-flight bind check is not a substitute: binding `127.0.0.1` succeeds while a
  dev server answers over `::1`, which once reported a busy port as free and left
  the health probe watching a port nothing served for 120 s.
- **Answering is not being usable.** Every env var is `optional: true` and
  `src/lib/supabase.ts` returns `null` without credentials, so an app with no `.env`
  serves HTTP 200 and only renders the `src/lib/config-status.ts` banner. The boot
  asserts that banner is absent and fails loudly instead of handing QA an app with
  authentication switched off.

## Environment state vs. committed state

The scripts are committed so every checkout inherits them. The per-run state they
write is gitignored: `.ai/qa/test-env.json`, `.ai/qa/test-env.env`,
`.ai/qa/test-env-build-cache.json`, `.ai/qa/test-env-app.*.log`,
`.ai/qa/test-env.lock/`.

## Browser provider — why this repo uses `playwright`, not `agent-browser`

`browser.provider` is `playwright`. Authenticated QA is verified end to end:
`node .ai/scripts/qa-login-check.mjs` bounces off `/dashboard` while anonymous,
signs in with the recorded credentials, asserts `/dashboard` renders **for that
user** (the email is on the page, so "a page rendered" cannot pass for "the session
is ours"), and captures a screenshot into `.ai/qa/artifacts_<runId>/`.

`agent-browser` was the original choice and does not work on this machine. Kept
here so nobody re-runs the same investigation:

What was established, by testing rather than assumption:

- `agent-browser doctor --json` passes completely (7 pass / 0 fail): Chrome
  152.0.7977.42 installed, headless launch + `about:blank` in 0.61 s, CDN reachable.
- `agent-browser --session <s> read https://example.com` **succeeds** and returns
  page text, so the CLI, its session daemons and outbound networking all work.
- `agent-browser --session <s> open http://127.0.0.1:4321/auth/signin` **hangs
  indefinitely** (killed at 600 s) or fails with `os error 10060` (connect timeout).
  The same URL returns HTTP 200 from `Invoke-WebRequest` and from `curl` in the
  same second.
- Not the cause, each checked and ruled out: the loopback family (the server now
  binds `127.0.0.1`, verified with `netstat`), proxy environment variables (all
  empty), and the Windows system proxy (`ProxyEnable=0`, no PAC URL).

**Root cause unknown, and deliberately not pursued further** — the repository
already drives Chromium against this exact server through Playwright, so switching
providers cost minutes where debugging had already cost far more. If you ever want
`agent-browser` back, start from the facts above rather than repeating them.

One operational note: a session daemon left behind by a killed run makes every
later command on that session id time out. `agent-browser doctor --json` lists
live daemons under `Daemons`; stop stray `agent-browser-win32-x64` processes before
retrying, and prefer a fresh session id per run.

## Authenticated QA — the ephemeral user

`.ai/scripts/qa-user.mjs` mints an **ephemeral** QA account when the environment
comes up and deletes it at teardown — the same shape `tests/e2e/auth.setup.ts`
uses, because this project is remote-only and GoTrue blocks public signup on test
domains, so the `service_role` admin API is the only way to create one.

It is a Node helper rather than PowerShell on purpose: it reuses
`@supabase/supabase-js`, which the repository already depends on, and keeps the
service-role key inside the Node process instead of a shell string.

Secrets discipline, which the scripts enforce rather than merely document:

- The password is **never printed**. The helper writes it straight into
  `.ai/qa/test-env.env` (gitignored); only the email and user id reach stdout.
- The descriptor carries a *reference* — `passwordEnv: TEST_QA_PASSWORD` — never a
  value. Consumers load the file into their shell and pass `$env:TEST_QA_PASSWORD`
  literally, so the value is expanded by the shell and never by an agent.
- Accounts are prefixed `qa-agent-`. Every boot sweeps leftovers older than 6 h, so
  a run killed between create and delete cannot silently accumulate accounts in the
  shared project.

Minting failure is loud but **not** fatal: the environment still serves the public
routes, and the descriptor's `notes` says QA is limited rather than leaving the
next reader to guess why login does not work.
