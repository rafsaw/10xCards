# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v6 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                             |
| `/auth/signup`        | Email/password sign-up form                                             |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                     |
| `/dashboard`          | Example protected page (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

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

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

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

GitHub Actions runs lint + build on every push and PR to `master`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets in GitHub for the build step.

## License

MIT
