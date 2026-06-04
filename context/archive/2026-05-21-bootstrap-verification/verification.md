---
bootstrapped_at: 2026-05-21T17:23:31Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: 10x-cards
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

Verbatim copy of `context/foundation/tech-stack.md`:

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10x-cards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

**Why this stack** (verbatim from hand-off body):

A solo learner shipping a 4-week, after-hours flashcards MVP with email+password
auth, strict per-user data isolation, and AI-generated candidate cards needs a
battle-tested, agent-friendly starter that handles auth, database, and edge
deploy out of the box. 10x Astro Starter is the recommended default for
`(web, js)` and clears all four agent-friendly gates: Astro + React +
TypeScript give explicit, agent-readable contracts; Supabase covers email auth
and Postgres with Row-Level Security to enforce the ship-blocking cross-user
isolation guardrail; Cloudflare Pages keeps the small-scale deploy cheap and
fast. Bootstrapper confidence is `first-class` — expect mostly smooth
scaffolding with occasional manual steps. Auth and AI feature flags are set;
payments, realtime, and background jobs are out of scope per PRD non-goals. CI
runs on GitHub Actions with auto-deploy on merge, the standard shape for solo
projects.

## Pre-scaffold verification

| Signal       | Value                                                              | Severity | Notes                                                       |
| ------------ | ------------------------------------------------------------------ | -------- | ----------------------------------------------------------- |
| npm package  | not run                                                            | n/a      | cmd_template starts with `git clone`; no npm CLI to resolve |
| GitHub repo  | przeprogramowani/10x-astro-starter last pushed 2026-05-17T10:33:39Z | fresh    | from card `docs_url`; 4 days before bootstrap                |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 19 (18 moved silently, 1 sidelined as a `.scaffold` sibling)
**Conflicts (.scaffold siblings)**: CLAUDE.md.scaffold
**.gitignore handling**: append-merged — existing cwd lines kept in order, starter lines de-duped and appended under a `# from 10x-astro-starter` separator
**.bootstrap-scaffold cleanup**: deleted

Move detail:

- Moved silently into cwd: `.env.example`, `.github/`, `.husky/`, `.nvmrc`, `.prettierrc.json`, `.vscode/`, `astro.config.mjs`, `components.json`, `eslint.config.js`, `node_modules/`, `package.json`, `package-lock.json`, `public/`, `README.md`, `src/`, `supabase/`, `tsconfig.json`, `wrangler.jsonc`
- Sidelined (existing-wins): the starter's `CLAUDE.md` landed as `CLAUDE.md.scaffold` — your existing `CLAUDE.md` was kept untouched
- Append-merged: `.gitignore`
- Dropped: the cloned `.git/` (git-clone strategy deletes upstream history before move-up so it does not leak into your repo)
- `context/` was preserved verbatim — the starter shipped no `context/` directory, so nothing was dropped on that rule

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW (10 total; audit tool exit code 1 — informational only, not a halt)
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0 — the single HIGH finding is transitive; both direct findings are MODERATE
**Dependencies audited**: 895 total (449 prod, 316 dev, 131 optional)

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** 5.6.3–5.8.0 (transitive) — GHSA-77vg-94rm-hx3p, "Svelte devalue: DoS via sparse array deserialization" (CWE-770, CVSS 7.5). Fix available via `npm audit fix`.

#### MODERATE findings

- **@astrojs/check** `>=0.9.3` (direct) — flagged via `@astrojs/language-server`. Fix is `@astrojs/check@0.9.2` (semver-major downgrade).
- **wrangler** (direct) — flagged via `miniflare`. Fix available.
- **@astrojs/language-server** `>=2.14.0` (transitive) — via `volar-service-yaml`.
- **@cloudflare/vite-plugin** (transitive) — via `miniflare`, `wrangler`, `ws`. Fix available.
- **miniflare** (transitive) — via `ws`. Fix available.
- **volar-service-yaml** `<=0.0.70` (transitive) — via `yaml-language-server`.
- **ws** 8.0.0–8.20.0 (transitive) — GHSA-58qx-3vcg-4xpx, "ws: Uninitialized memory disclosure" (CWE-908, CVSS 4.4). Fix available.
- **yaml** 2.0.0–2.8.2 (transitive) — GHSA-48c2-rrv3-qjmp, "yaml vulnerable to Stack Overflow via deeply nested YAML collections" (CWE-674, CVSS 4.3).
- **yaml-language-server** (transitive) — via `yaml`.

#### LOW / INFO findings

None.

Note: most MODERATE findings cluster in the `@astrojs/check` / `yaml-language-server` dev-tooling chain and the Cloudflare `wrangler` / `miniflare` chain. `npm audit fix` resolves the HIGH and several MODERATE findings without breaking changes; `@astrojs/check` requires a semver-major change. Bootstrapper does not auto-fix — review and decide per your project's risk tolerance.

## Hints recorded but not acted on

| Hint                    | Value               |
| ----------------------- | ------------------- |
| bootstrapper_confidence | first-class         |
| quality_override        | false               |
| path_taken              | standard            |
| self_check_answers      | null                |
| team_size               | solo                |
| deployment_target       | cloudflare-pages    |
| ci_provider             | github-actions      |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                |
| has_payments            | false               |
| has_realtime            | false               |
| has_ai                  | true                |
| has_background_jobs     | false               |

These hints were read into the bootstrap run and logged for audit-trail completeness. v1 takes no automated action on them — CI/CD scaffolding, feature-flag-driven scaffold changes, and confidence-based compensation belong to a future M1L4 ("Memory Architecture") skill.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review the `CLAUDE.md.scaffold` sibling the conflict policy created and decide which version to keep (or merge the starter's content into your existing `CLAUDE.md`).
- Copy `.env.example` to `.env` and fill in `SUPABASE_URL` / `SUPABASE_KEY` before running `npm run dev`.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log. `npm audit fix` clears the HIGH finding and most MODERATE ones without breaking changes.
