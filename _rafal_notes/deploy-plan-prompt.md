Let's plan Cloudflare integration and deployment according to @context/foundation/tech-stack.md.

IMPORTANT:
This is planning mode only.
Do NOT modify files.
Do NOT implement anything yet.

Create a stateful phased deployment plan similar to an operational runbook.

Requirements:

1. Build a PHASE-BASED deployment plan with explicit numbered phases.

Each phase must contain:
- objective
- owner (Agent / Human)
- exact commands
- validation step
- rollback note
- completion checkbox

2. Add a dedicated PREREQUISITES section for a completely NEW project.

Include exact step-by-step instructions for:

A. Cloudflare account setup
- creating free account
- email verification
- dashboard access verification

B. Wrangler CLI setup
- install / npx usage
- login
- whoami verification
- note about permissions / least privilege

C. GitHub CLI setup
- install
- login
- auth verification

D. Supabase REMOTE setup
- create project
- get project URL
- get anon/publishable key
- explain why NOT service_role

E. Supabase LOCAL setup (optional)
- explain Docker dependency
- docker verification
- npx supabase start
- local credentials output

3. Deployment assumptions:
- Cloudflare native deployment
- NO GitHub Actions
- auto deploy via Cloudflare git integration later
- remote Supabase for MVP
- optional local Supabase only

4. Deployment execution phases should resemble lesson flow:

Phase 0 — prerequisite verification
Phase 1 — framework/runtime adaptation for Cloudflare
Phase 2 — Wrangler configuration
Phase 3 — local build validation
Phase 4 — environment variables / secrets setup
Phase 5 — first deployment
Phase 6 — production verification
Phase 7 — optional Git integration for auto deploy

5. IMPORTANT:
The plan must be stateful and resumable.
If interrupted, we must know exactly which phase was completed.

6. Output format:
Markdown deployment runbook suitable for:
context/deployment/deploy-plan.md

Do NOT execute.
Only generate the plan.