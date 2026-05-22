---
project: 10xCards
researched_at: 2026-05-22
recommended_platform: Cloudflare Workers
runner_up: Render
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19
  runtime: Cloudflare Workers (workerd)
---

## Recommendation

**Deploy on Cloudflare Workers.**

Cloudflare Workers scored a clean 5/5 against the agent-friendly criteria — first-class `wrangler` v4 CLI, fully serverless with no infrastructure to misconfigure, `llms.txt`/`llms-full.txt` agent-readable docs, a deterministic `wrangler deploy` / `wrangler rollback` API, and a catalog of managed MCP servers. The deciding weights are familiarity (the developer's stated comfort is Cloudflare) and the fact that `tech-stack.md` and `AGENTS.md` already commit the project to Cloudflare — switching would mean swapping the Astro adapter mid-build. The generous free tier (100k requests/day) comfortably absorbs this MVP's small-user, low-QPS profile, and the external Supabase + OpenRouter dependencies are plain outbound subrequests that don't strain the runtime.

## Platform Comparison

Hard filters applied first: the developer interview answered **No** to persistent connections, so no platform was dropped for being serverless-only. Astro is adapter-flexible (Node adapter for five platforms, the Cloudflare adapter for Workers), so no platform was dropped on runtime incompatibility — all six were scored.

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **5 Pass** |
| **Render** | Pass | Pass | Pass | Pass | Pass | **5 Pass** |
| **Railway** | Pass | Pass | Pass | Pass | Partial | 4 Pass / 1 Partial |
| **Vercel** | Pass | Pass | Pass | Pass | Partial | 4 Pass / 1 Partial |
| **Netlify** | Partial | Pass | Pass | Pass | Pass | 4 Pass / 1 Partial |
| **Fly.io** | Pass | Partial | Pass | Pass | Partial | 3 Pass / 2 Partial |

**Cloudflare Workers** — `wrangler` v4 covers the full operational loop (`deploy`, `rollback`, `tail`); workerd is fully serverless; Cloudflare publishes `llms.txt`/`llms-full.txt` and GitHub-hosted markdown docs; the deploy API is deterministic; ~17 managed MCP servers are connectable from Claude (per-server GA/beta status is unlabeled — treated as a soft signal). Caveats: `@astrojs/cloudflare` v13+ runs on `workerd` (not Node), so `nodejs_compat` is required and CommonJS/native-addon dependencies can break; the free plan caps the bundle at 1MB compressed.

**Render** — Runner-up at a clean 5/5. The Render CLI is GA (v2.18, May 2026), docs ship `llms.txt`/`llms-full.txt` plus installable agent skills, and the official MCP server has been GA since August 2025 (with the caveat that it cannot trigger deploys — those still go through CLI/git). The free tier spins down after 15 min idle, so a usable MVP needs the $7/mo Starter instance. No commercial-use restriction. It lost the top spot only on familiarity and the project's existing Cloudflare wiring.

**Railway** — Third. Scriptable container PaaS with a clean CLI (`railway up`, `railway logs`, `railway redeploy`), markdown docs, and $5/mo Hobby billing with no commercial restriction. Scored Partial on MCP only because the official Railway MCP server is documented as a "work in progress" with no GA designation. No built-in CDN/edge and single-region by default — acceptable given the single-region interview answer.

**Vercel** — 4 Pass / 1 Partial. Excellent Astro support and best-in-class DX, but the Vercel MCP is beta and read-only (Partial). Two real frictions for *this* stack: the Hobby tier is non-commercial-use only, forcing $20/mo Pro for a real product, and an open Astro 6 + Vercel SSR esbuild bug ([withastro/astro#16258](https://github.com/withastro/astro/issues/16258)) currently affects some builds. These knocked it off the podium under a cost-neutral, version-accurate read.

**Netlify** — 4 Pass / 1 Partial. Official MCP server is GA and Astro 6 is supported day one, but there is **no first-class CLI rollback** (rollback is a dashboard "Publish Deploy" action — a genuine agent-ops gap, scored Partial on CLI-first). New-account credit-based pricing has a hard cap that can *pause the live site* mid-month, and free-tier functions time out at 10s — risky for slow OpenRouter completions.

**Fly.io** — 3 Pass / 2 Partial. Strong `flyctl` CLI and persistent-process support, but that strength is irrelevant here (No to persistent connections). Scored Partial on Managed/Serverless because it requires a Dockerfile and machine sizing (more operational surface than pure serverless), and Partial on MCP because `fly mcp server` is experimental. No free tier.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Wins on a perfect criteria sweep plus two decisive weights: the developer's familiarity is Cloudflare, and the project is already committed to it in `tech-stack.md`/`AGENTS.md`. The `wrangler` CLI gives an agent the entire deploy/rollback/logs loop without a browser, the free tier swallows MVP traffic, and Cloudflare's `llms.txt` docs are the best agent-readable corpus of the six.

#### 2. Render

Equally clean 5/5 with a GA MCP server and installable agent skills — arguably the most "agent-native" of the six on paper. The gap versus the recommendation is purely contextual: it would require swapping the Astro adapter to `@astrojs/node`, the developer has no stated Render familiarity, and a usable instance costs $7/mo where Cloudflare's free tier suffices. A strong, low-regret fallback if Cloudflare's `workerd` Node-compat limitations become a recurring blocker.

#### 3. Railway

A scriptable container PaaS at $5/mo with no commercial-use restriction and managed databases on tap for future caching needs. The gap: MCP is still "work in progress", there's no edge CDN, and — like Render — it would require an adapter swap and offers no familiarity advantage. Third place is a genuine option here, not a ritual: it's the pick if the project later needs a long-lived process (background SR scheduling jobs) that Workers can't host.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **`nodejs_compat` is not full Node.** `@astrojs/cloudflare` v13+ runs on `workerd`, not Node. Dependencies using `fs`, `child_process`, native addons, or CommonJS-only packaging break at build or runtime — and the failure is discovered per-dependency, not upfront.
2. **1MB compressed bundle ceiling on the free plan.** Astro + React 19 + the Supabase client + an AI SDK can approach it; the project may be forced onto the $5 plan for *bundle size*, not traffic, via a cryptic deploy error.
3. **The adapter dropped Pages support.** `tech-stack.md` records `deployment_target: cloudflare-pages`, but the Astro-6-required adapter targets **Workers only**. Anyone following that contract literally picks the wrong deploy commands (Pages and Workers commands are not interchangeable).
4. **Non-standard env access.** Secrets are not on `process.env` — they arrive via `Astro.locals` / the `cloudflare:workers` import / `wrangler secret put`. Code assuming `process.env.SUPABASE_KEY` silently gets `undefined`, and `.dev.vars` vs Workers Secrets is a two-place split easy to desync.
5. **`wrangler tail` samples logs under load.** A failing AI-generation request may not appear in the live feed — retained logging needs Workers Logs / Logpush configured deliberately.

### Pre-Mortem — How This Could Fail

Six months in, the Cloudflare deploy is a quiet mess. It started fine — the starter scaffolded, `wrangler deploy` worked, the free tier swallowed the tiny traffic. The first crack: the team added a tokenizer helper for better card extraction that pulled a CommonJS native module; the build broke with an opaque `workerd` error and two after-hours evenings vanished bisecting `node_modules`. They pinned around it. Then bundle size crept past 1MB and deploys failed — they upgraded to the $5 plan, fine, but never noticed that limit was now load-bearing. The real damage: `tech-stack.md` said "cloudflare-pages", so an agent following the contract literally tried `wrangler pages deploy`, half-configured a Pages project, and split secrets across two surfaces. A Supabase key rotation updated one and not the other; AI generation 500'd for a day before anyone correlated it. Nothing was catastrophic — but each papercut cost an evening the 4-week budget couldn't spare.

### Unknown Unknowns

- **The adapter no longer supports Pages.** Most tutorials and the project's own `tech-stack.md` still say "Astro on Cloudflare Pages"; with Astro 6 + `@astrojs/cloudflare` v13+ that path is gone — it's Workers or nothing.
- **`wrangler` v4 flipped the local/remote default.** Commands that touch live state now default to `--local`; an agent expecting v3 behavior queries a local simulation and concludes production is healthy when it isn't.
- **Workers can't hold a Postgres connection pool** across invocations. Supabase access must route through the Supavisor pooler or the HTTP-based `supabase-js` client; otherwise bursty load exhausts connections and surfaces as random 500s rather than an obvious limit.
- **`wrangler tail` drops lines under traffic** — it samples, so it is not a reliable full audit trail for a failing request.
- **Free-plan bundle and request limits are silent until they bite** — no warning at 80% of the 1MB bundle or the 100k req/day; the deploy simply starts failing or requests start returning 429 mid-iteration.

## Operational Story

- **Preview deploys**: `npx wrangler versions upload` builds and uploads a version *without* promoting it, returning a preview URL on a `*.workers.dev` preview alias for review before going live. Wiring the Cloudflare Workers Builds GitHub integration additionally produces a per-commit preview URL on push. Preview URLs are public unless protected with Cloudflare Access; PRs from forks do not receive production secrets.
- **Secrets**: production secrets live in Workers Secrets, set with `npx wrangler secret put <NAME>` and readable only inside the Worker runtime (via `Astro.locals` / the `cloudflare:workers` import) — never on `process.env`, never committed. Local development uses a git-ignored `.dev.vars` file. CI deploys read a `CLOUDFLARE_API_TOKEN` stored as a GitHub repository secret. Rotation = re-run `wrangler secret put`, redeploy, and update `.dev.vars` in lockstep.
- **Rollback**: `npx wrangler rollback [version-id]` reverts all traffic to a prior version immediately (seconds to revert; `wrangler deployments list` shows the version history). Caveat: rollback reverts **Worker code only** — Supabase schema migrations do not roll back, so a deploy that ran a migration needs a hand-written down-migration.
- **Approval**: human-only — rotating the Supabase primary key/service-role key, altering or dropping the Supabase database, deleting the Worker project, and changing API-token scope. An agent may run unattended: `wrangler deploy`, `wrangler versions upload` (preview), `wrangler tail`, `wrangler deployments list`, and `wrangler rollback` *to a known-good version*.
- **Logs**: `npx wrangler tail --format json` streams live runtime logs (sampled under load — not a complete record); enable Workers Logs in the dashboard or Logpush for retained, queryable logs; `npx wrangler deployments list` gives the deploy/version audit trail.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| A CommonJS / native-addon dependency breaks the `workerd` build | Devil's advocate | M | M | Vet new deps for ESM + Web-standard APIs before adding; keep `nodejs_compat` set; pin known-good versions |
| Bundle exceeds the 1MB free-plan limit; deploys start failing | Devil's advocate / Pre-mortem | M | M | Watch build output size; treat the $5 paid plan as expected headroom, not a surprise; tree-shake and lazy-load heavy deps |
| Stale `cloudflare-pages` contract in `tech-stack.md` misleads an agent into `wrangler pages deploy` | Devil's advocate / Pre-mortem | M | H | Correct `tech-stack.md` `deployment_target` to `cloudflare-workers`; the Astro 6 adapter is Workers-only |
| Secrets desync between `.dev.vars` and Workers Secrets after a rotation | Pre-mortem | M | H | Treat rotation as a two-surface checklist; document it in the operational story; keep rotation a human-gated action |
| Supabase connection exhaustion under bursty load (Workers cannot pool) | Unknown unknowns | M | M | Route Supabase through the Supavisor pooler / use the HTTP-based `supabase-js` client; never open a per-request pool |
| `wrangler tail` samples logs — a failing AI request may not appear | Unknown unknowns / Devil's advocate | M | M | Configure Workers Logs / Logpush for retained logs before relying on them for incident triage |
| `wrangler` v4 defaults to `--local`; an agent misreads production health | Unknown unknowns | M | M | Standardize on explicit `--remote` for any command meant to inspect live production state |
| CPU-time cap hit when transforming large OpenRouter generations | Devil's advocate | L | M | Stream responses; keep generation parsing lightweight; avoid heavy synchronous JSON transforms in the Worker |
| Free-plan request/bundle limits bite silently mid-iteration | Unknown unknowns | L | M | Track usage in the Cloudflare dashboard; upgrade to the $5 plan proactively near limits |
| Per-server GA/beta status of Cloudflare MCP servers is unlabeled | Research finding | L | L | Use the `wrangler` CLI as the primary ops path for the MVP; treat MCP servers as optional convenience |

## Getting Started

The project is already scaffolded from the 10x Astro Starter with the Cloudflare adapter. These steps are version-accurate for Astro 6 + `@astrojs/cloudflare` v13+ + `wrangler` v4 — do not copy generic "Astro on Cloudflare Pages" tutorials, which describe a removed deploy path.

1. **Confirm the adapter targets Workers, not Pages.** Verify `@astrojs/cloudflare` is v13+ in `package.json`, that `astro.config.*` sets `output: 'server'` with the `cloudflare()` adapter, and that the project deploys as a **Worker** (`wrangler deploy`), not via `wrangler pages deploy`. Update `tech-stack.md`'s `deployment_target` from `cloudflare-pages` to `cloudflare-workers` to fix the stale contract.
2. **Confirm `wrangler` config.** Ensure `wrangler.jsonc`/`wrangler.toml` includes `compatibility_flags: ["nodejs_compat"]` and a recent `compatibility_date`. The Astro 6 dev server (`npm run dev`) already runs on `workerd` via Cloudflare's Vite plugin, so a separate `wrangler dev` is not needed for runtime fidelity.
3. **Set production secrets in Workers Secrets** (not in committed config): `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_KEY`, `npx wrangler secret put OPENROUTER_API_KEY`. Keep the local equivalents in a git-ignored `.dev.vars`.
4. **Deploy**: `npm run build` then `npx wrangler deploy` (or the project's `deploy` script). The command prints the live `*.workers.dev` URL.
5. **Verify**: open the URL, exercise `/auth/*` and a generation flow, and tail logs with `npx wrangler tail --format json`. Use `npx wrangler rollback` if the deploy misbehaves.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
