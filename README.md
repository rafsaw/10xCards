# 10xCards

AI-assisted spaced-repetition flashcards. Paste dense source material, let an LLM propose Q/A
candidates, accept or reject each one by hand, and review the accepted cards on a Leitner schedule.
The manual accept-or-reject step is deliberate: the AI drafts, the user decides what enters the deck.

Slice status and product context live in `context/foundation/roadmap.md` and
`context/foundation/prd.md`.

## Tech Stack

- [Astro](https://astro.build/) v6 — server-first rendering (`output: "server"`)
- [React](https://react.dev/) v19 — interactive islands
- [TypeScript](https://www.typescriptlang.org/) v5
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Supabase](https://supabase.com/) — Auth + Postgres with RLS
- [OpenRouter](https://openrouter.ai/) — LLM gateway for card generation
- [Cloudflare Workers](https://workers.cloudflare.com/) — edge deployment runtime
- [Sentry](https://sentry.io/) — error reporting (errors only)
- [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) — unit/integration and E2E tests

## Running the Project Locally

Requirements: Node.js `22.14.0` (see `.nvmrc`), npm, and [Docker](https://www.docker.com/)
(~7 GB RAM) for the local Supabase stack.

```bash
# 1. Clone and install
git clone https://github.com/rafsaw/10xCards.git
cd 10xCards
nvm use          # optional, if you use nvm
npm install

# 2. Environment files (both take the same set of variables)
cp .env.example .env
cp .env.example .dev.vars

# 3. Local Supabase — the first start pulls Docker images
#    and applies the migrations from supabase/migrations/
npx supabase start

# 4. Paste the values printed by the CLI into .env and .dev.vars:
#    SUPABASE_URL=http://127.0.0.1:54321
#    SUPABASE_KEY=<anon key>
#    plus OPENROUTER_API_KEY=<key from openrouter.ai> (card generation fails without it)

# 5. Dev server
npm run dev      # http://localhost:4321
```

Then sign up at `/auth/signup` and open `/generate`. If Supabase still requires email confirmation,
either turn it off (see [Email confirmation in local development](#email-confirmation-in-local-development))
or pick the message up from the local Inbucket at `http://localhost:54324`.

Stop the stack with `npx supabase stop`. Local Studio: `http://localhost:54323`.

Before committing, verify with `npm run lint`, `npm run build`, and `npm test` (plus
`npm run test:integration` / `npm run test:e2e` when you touch those layers) — CI runs only lint and
build.

## Available Scripts

- `npm run dev` — development server
- `npm run build` — production build for Cloudflare
- `npm run preview` — preview the production build
- `npm run deploy` — build and `wrangler deploy`
- `npm run lint` / `lint:fix` — type-aware ESLint
- `npm run typecheck` — `astro sync && astro check`
- `npm run format` — Prettier across the repo
- `npm test` / `test:watch` — Vitest unit tests
- `npm run test:integration` — Vitest integration suite (`vitest.integration.config.ts`)
- `npm run test:e2e` — Playwright E2E suite (starts `npm run dev` itself; set `E2E_PORT` to
  override the default port 4321 if something else on your machine already uses it)
- `npm run dep:check` / `dep:graph` — dependency-cruiser rules and Mermaid graph

## Project Structure

```md
.
├── src/
│ ├── pages/ # Routes
│ │ ├── api/ # API endpoints (auth, cards, generations, reviews, account)
│ │ ├── auth/ # signin / signup / confirm-email
│ │ └── *.astro # index, dashboard, generate, library, review, settings
│ ├── components/ # Astro & React components (auth, dashboard, generate,
│ │ # library, review, settings, ui primitives)
│ ├── layouts/ # Astro layouts
│ ├── lib/ # Supabase client, OpenRouter client, Leitner scheduling,
│ │ # retention, observability, helpers
│ ├── styles/ # global.css
│ └── middleware.ts # Route protection (PROTECTED_ROUTES)
├── supabase/ # Local Supabase config + migrations
├── test/ # Vitest setup + integration harness
├── tests/e2e/ # Playwright specs
├── context/ # Product/workflow source of truth (PRD, roadmap, plans)
├── wrangler.jsonc # Cloudflare Workers config
```

## Routes

| Route                 | Description                                   |
| --------------------- | --------------------------------------------- |
| `/`                   | Landing page                                  |
| `/auth/signin`        | Email/password sign-in                        |
| `/auth/signup`        | Email/password sign-up                        |
| `/auth/confirm-email` | Post-signup "check your inbox" page           |
| `/dashboard`          | Deck overview and entry points                |
| `/generate`           | Paste source text, review AI card candidates  |
| `/library`            | Browse, edit, and delete saved cards          |
| `/review`             | Spaced-repetition review session              |
| `/settings`           | Account settings, including account deletion  |

Everything except `/`, `/auth/*` requires authentication — see `PROTECTED_ROUTES` in
`src/middleware.ts`.

## Configuration

Environment variables are declared via Astro's `astro:env` schema (`astro.config.mjs`). All backend
variables are **server-only secrets** and are never exposed to the client; only `PUBLIC_SENTRY_DSN`
is a client variable.

| Variable             | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `SUPABASE_URL`       | Supabase project URL                                               |
| `SUPABASE_KEY`       | Supabase `anon` public key                                         |
| `OPENROUTER_API_KEY` | OpenRouter key used for AI card generation                         |
| `OPENROUTER_MODEL`   | Model id (default `openai/gpt-4o-mini`)                            |
| `PUBLIC_SENTRY_DSN`  | Browser Sentry DSN — **build time** (see [Deployment](#deployment)) |
| `SENTRY_DSN`         | Worker Sentry DSN — runtime secret                                 |
| `LINEAR_API_KEY`     | Optional, only for the `npm run sync:issues` dev hook              |

`.env` is read by Vite/Astro, `.dev.vars` by the Cloudflare `workerd` runtime — keep both in sync
locally. Never commit real values.

### Using a cloud Supabase project instead

Point the same two variables at a hosted project (dashboard → Settings → API) and apply
`supabase/migrations/` to it (`npx supabase db push`):

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip it:

1. Open the Supabase dashboard (or local Studio) for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL`, `SUPABASE_KEY`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODEL` as secrets in your
Cloudflare dashboard or via `npx wrangler secret put`.

### Sentry Configuration

Error reporting routes through the `reportError` seam (`src/lib/observability.ts`) to Sentry — errors
only, no tracing/logs/metrics. Two variables drive it, and **where you configure each one differs by
when it is read**. Both may hold the **same** DSN value (Sentry DSNs are publishable).

| Variable | Read when | Where to set it |
| --- | --- | --- |
| `PUBLIC_SENTRY_DSN` | **Build time** — inlined into the browser bundle by `astro build` (`sentry.client.config.ts`) | The **build environment**, e.g. `.env.production` locally or a CI build variable. **Not** a Cloudflare runtime var — it is baked into the client JS before the Worker ever runs. |
| `SENTRY_DSN` | **Runtime** — read per request by `withSentry` in the Worker (`sentry.server.config.ts`) | A **Cloudflare Worker secret**: `npx wrangler secret put SENTRY_DSN` (or the dashboard's Variables and Secrets). |

Leave both unset to disable Sentry (init becomes a no-op). After a production build you can confirm the
browser DSN was embedded with `grep -r "ingest" dist/client`.

> **Cloudflare gotcha — `PUBLIC_SENTRY_DSN` must be a _Build Variable_, not a Worker Secret.**
> It is consumed via `astro:env/client` and must be present during `npm run build`. Setting it only as a
> Worker Secret is too late — the value is needed at build time, before the Worker runs — and results in:
>
> - `PUBLIC_SENTRY_DSN === undefined` in the browser
> - `Sentry.init()` becoming a no-op
> - browser errors never reaching Sentry
>
> Add it under the Cloudflare project's **Build Variables**, then trigger a new build (Retry Build /
> Redeploy) for the change to take effect.

### Verifying Browser Sentry

If browser-side Sentry appears inactive:

1. Open DevTools Console.
2. Temporarily log `PUBLIC_SENTRY_DSN?.length` from `sentry.client.config.ts`.
3. Verify the value is defined after deployment.
4. If it is `undefined`, check Cloudflare Build Variables (not Worker Secrets).
5. Trigger a rebuild after updating the variable.

**Known issue (M3L5):** `PUBLIC_SENTRY_DSN` was configured as a Worker Secret instead of a Build
Variable, causing browser-side Sentry to silently disable itself.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs lint + build on every push and PR to `main`; the
test suites are **not** run in CI, so run them locally. Configure `SUPABASE_URL` and `SUPABASE_KEY`
as repository secrets for the build step. A separate workflow
(`.github/workflows/ai-code-review.yml`) posts an advisory AI review comment on PRs to `main` and
never blocks merge.

## License

MIT
