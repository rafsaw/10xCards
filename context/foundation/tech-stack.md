---
starter_id: 10x-astro-starter
package_manager: npm
project_name: 10x-cards
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
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
---

## Why this stack

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
