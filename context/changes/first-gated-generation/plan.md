# S-01: First Gated Generation — Drafts in DB — Implementation Plan

## Overview

Deliver the *paste → AI → draft candidates persisted in DB → render list* loop. A logged-in user pastes a passage on a dedicated `/generate` page (reached from the `/dashboard` hub), the server calls an OpenRouter chat-completions endpoint with a JSON-schema response format, the parsed cards land in `public.cards` as `status='draft'` rows owned by the authenticated user, and the page renders them above the paste form. Accept/reject finalization is explicitly out of scope — that closes in S-02.

This slice proves the loop end-to-end and satisfies PRD FR-004 (paste + trigger) and FR-005 (view candidates). FR-008 (retry without re-pasting) is satisfied on failed generations by preserving the pasted source in the React island after non-OK/network responses; successful generations persist as draft rows in DB, so generated candidates survive refresh.

## Current State Analysis

- **F-01 schema is live on remote Supabase** (`supabase/migrations/20260527150510_cards_and_account_deletion.sql`). `public.cards` has `front`, `back`, `status text default 'draft' check (status in ('draft','saved'))`, `next_due_at`, `interval_days`, `repetition_count`, `last_reviewed_at`, `created_at`, `updated_at`, and `user_id` FK to `auth.users(id) ON DELETE CASCADE`. Four RLS policies scoped to `(select auth.uid()) = user_id` cover SELECT/INSERT/UPDATE/DELETE for the `authenticated` role. The `cards_user_id_status_idx` covers `(user_id, status)` reads.
- **Auth + middleware in place** — `src/middleware.ts:6-25` populates `context.locals.user` from the `@supabase/ssr` session cookie; `/dashboard` is in `PROTECTED_ROUTES`. RLS sees `auth.uid()` correctly for any query made through `createClient(request.headers, cookies)` (`src/lib/supabase.ts:5-24`).
- **Dashboard is a placeholder** (`src/pages/dashboard.astro:7-26`) — just an authenticated greeting + sign-out form. Net-new: paste form + draft list.
- **No LLM wiring exists** — `astro.config.mjs:17-22` declares only `SUPABASE_URL` / `SUPABASE_KEY`; `.env.example` has only the same two; no OpenRouter client. The roadmap S-01 §Unknowns explicitly defers `OPENROUTER_API_KEY` until this slice.
- **No API endpoints for cards yet** — `src/pages/api/` contains only `auth/{signin,signup,signout}.ts`. Generation endpoint is net-new.
- **React 19 form-island pattern is established** in `src/components/auth/SignInForm.tsx:42-86` (controlled inputs + client-side validation + native form `POST` to an Astro API route + server returning `redirect` with `?error=`). The paste form will reuse this idiom but with a JSON-returning endpoint and explicit `fetch` so the in-flight spinner can render NFR-compliant continuous feedback.
- **No test runner** (per `AGENTS.md` §Testing Guidelines) — verification is `npm run lint`, `npm run build`, and manual checks of the affected routes (`/dashboard`, `/generate`).
- **Cloudflare Workers runtime** — `astro.config.mjs:16` uses `@astrojs/cloudflare`; `wrangler.jsonc:5-6` sets `nodejs_compat`. OpenRouter is called via `fetch` from the server handler (no SDK).

## Desired End State

After this change lands:

- `/dashboard` is a landing/hub page with a prominent "Generate cards" link (and the existing greeting + sign-out). It no longer hosts the paste form.
- A logged-in user opens `/generate`. If they have no drafts, they see a paste form with a textarea + "Generate" button. If they have drafts, the page shows the current draft batch above the paste form, with a "Discard all drafts" form action.
- Submitting non-empty text (≥ 200 chars, ≤ 8000 chars) triggers `POST /api/generations`. While the request is in flight (typical 5–20s), the React island shows a spinner with an elapsed-time counter ("Generating… 12s") and disables the textarea + button.
- On success, the endpoint has inserted 3–10 rows into `public.cards` with `status='draft'`, `user_id` = the authenticated user, `front` + `back` populated; the client navigates to `/generate` so the server-rendered draft list reflects the new batch.
- On failure (timeout, OpenRouter 5xx, parse error, empty array), the page renders an inline error banner. The textarea retains the pasted text, so clicking Generate again retries without re-pasting (FR-008).
- Direct attempts to call `POST /api/generations` without a session return 401 and never reach OpenRouter; cross-user reads remain impossible because the SSR Supabase client carries the caller's JWT.
- The "Discard all drafts" action issues `POST /api/generations/discard` which `DELETE`s every row where `user_id = me AND status = 'draft'` (the RLS scope makes the `user_id` predicate strictly belt-and-braces). On success the user is bounced back to `/generate`.
- `/generate` is protected: an unauthenticated request to it redirects to `/auth/signin` (added to `PROTECTED_ROUTES`).
- `npm run lint` and `npm run build` pass. The deployed app at `https://10x-cards.rafsaw.workers.dev` runs the full loop against the live OpenRouter key.

### Key Discoveries

- The existing SSR Supabase client (`src/lib/supabase.ts:5-24`) already returns `null` when env vars are missing — the new `/api/generations` endpoint can lean on the same null-check pattern used by the auth endpoints (`src/pages/api/auth/signin.ts:10-12`).
- `astro:env/server` (`src/env.d.ts` + `astro.config.mjs:17-22`) requires the env schema to be extended for any new secret read at runtime. `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` both need entries there or the call site won't typecheck.
- `config-status.ts:11-21` is the existing surface for "missing config → banner on every page". Extending it for OpenRouter prevents silent runtime failures when the key is unset (dogfood deploys without the secret will surface the same way Supabase already does).
- OpenRouter's structured-output support uses `response_format: { type: "json_schema", json_schema: {...} }`; **not every model supports it — it's canonically an OpenAI-model feature** (e.g. `openai/gpt-4o-mini`). Anthropic models route through tool-calling and may reject `response_format`, so the committed default is an OpenAI model; the env var lets us flip without a redeploy. Verify support on OpenRouter's models page before committing any new default.
- F-01 plan §"Critical Implementation Details" notes that `service_role` JWTs bypass RLS. The generation endpoint MUST use the SSR client (which inherits the user's session) — not the service-role key — so that even a buggy `user_id` value in the insert payload is blocked by RLS.
- `cards.next_due_at` is nullable per the F-01 schema (`next_due_at timestamptz`) and the F-01 plan §Contract says "drafts have no schedule". Inserts in this slice MUST leave it `NULL`; the `interval_days`/`repetition_count` defaults of `0` are correct for drafts.

## What We're NOT Doing

- No accept/reject UI per candidate, no atomic-save endpoint — that's S-02. The draft list in this slice is read-only display + "Discard all drafts" as a single bulk action.
- No `next_due_at` value set on drafts. Initial due-date assignment happens at promote-to-saved time in S-02.
- No editing of front/back inline. PRD §Non-Goals explicitly forbids "editing AI-generated candidates before saving" — candidates are accept/reject only (and refinement happens after save via FR-011's surface in S-03).
- No streaming responses, no SSE, no background-job/queue infrastructure. Single-shot `fetch` + spinner.
- No automatic server-side retry. Explicit user-click Generate-again retry only (cost discipline).
- No multi-model UX, no model selector. `OPENROUTER_MODEL` is set in env and that's it.
- No rate limiting on the endpoint beyond OpenRouter's natural per-key limits. Solo dogfood scale.
- No TTL / cron sweep of dangling drafts. Drafts persist forever unless the user clicks "Discard all drafts" or S-02 finalizes them.
- No regeneration of new drafts replacing existing ones. If drafts already exist, the paste form is still available but new generation appends to the batch. (Belt-and-braces: the page makes this obvious by showing the current count above the form.)
- No custom transaction management for the multi-row insert. PostgREST executes a single `INSERT ... VALUES` statement which is inherently atomic in Postgres. If any single candidate violates a DB constraint, the entire batch rolls back (no partial-inserts). The user will see a generic error and can retry.
- No Supabase generated TypeScript types — `cards.insert(...)` is typed by hand against the migration's contract. (Adding `supabase gen types` is a one-line option for a follow-up; intentionally deferred to keep this slice tight.)
- No new dependencies. OpenRouter is called via `fetch`; no SDK install.

## Implementation Approach

Four phases. Phase 1 sets up the env surface so the rest can typecheck and so deploys without the key surface clearly. Phase 2 lands the server endpoint (the hard part — OpenRouter integration, validation, RLS-scoped insert). Phase 3 builds the UI (new `/generate` page server-rendering the draft list + React form island, `/dashboard` reduced to a hub linking to it, `/generate` added to the middleware guard). Phase 4 is the end-to-end gate against the deployed app.

The endpoint and the React island are coupled tightly enough that they're sequenced (endpoint first so the form can be tested with real responses), but they could split across two sessions cleanly.

## Critical Implementation Details

- **OpenRouter `response_format` requires the model to support strict JSON schema.** The committed default `openai/gpt-4o-mini` is chosen specifically for this support. If the env-selected model doesn't support it, the call returns `400` with a body like `{"error": {"message": "model does not support json_schema..."}}`. Treat that as a configuration error (5xx-class to the client), not as a generation failure, so the user-facing message can hint at "ask the admin to change the model" rather than blaming the input.
- **The OpenRouter call must run on the server only.** The API key is `access: "secret"` in the Astro env schema; never expose it to the client. The client only ever sees `POST /api/generations` and the resulting drafts.
- **Use the SSR Supabase client, not `service_role`, for the insert.** The endpoint reads `context.locals.user` (set by middleware) and passes the request's `headers` + `cookies` to `createClient(...)`. The resulting client's queries carry the user's JWT, so `auth.uid()` evaluates correctly and the RLS `cards_insert_own` policy enforces `user_id = auth.uid()`. Setting `user_id` explicitly in the payload is still required (NOT NULL column); the RLS `WITH CHECK` then validates it matches.
- **Bulk insert via a single `supabase.from('cards').insert([...]).select()` call**, not a loop. Supabase coalesces this into one INSERT statement; per F-01 plan §Migration we accept partial-insert risk if Postgres aborts mid-statement (extremely rare for `VALUES (...), (...)` constructions).
- **Cloudflare Workers `fetch` to OpenRouter has no hard outbound timeout, but Workers do have a CPU-time and wall-clock budget.** The `astro:env`-driven endpoint should set an explicit `AbortController` with a 60-second timeout on the OpenRouter `fetch`; otherwise a hung connection ties up the request until Cloudflare kills it with a confusing edge error.
- **Always send `HTTP-Referer` and `X-Title` headers to OpenRouter.** OpenRouter uses them for attribution + cost dashboards; without them, requests work but the dashboard shows "unknown app". Send `HTTP-Referer: https://10x-cards.rafsaw.workers.dev` and `X-Title: 10xCards`.
- **JSON-schema response: define the candidate-card schema as a top-level `cards` array** with `front` (string, 1–500 chars) and `back` (string, 1–2000 chars) on each item. Constrain `cards` to `minItems: 1, maxItems: 10`. Pre-insert, the server clamps anything past 10 (defense-in-depth if a model ignores the schema) and rejects an empty array.
- **The paste form must do `e.preventDefault()` and call `fetch`, not native form submit.** A native submit cannot reconcile the in-flight spinner with the eventual response. Pattern: `onSubmit` runs `e.preventDefault()`, sets `submitting=true`, calls `fetch('/api/generations', {method:'POST', body: JSON.stringify({source})})`, on 200 calls `window.location.assign('/generate')`, on non-200 reads the JSON error and renders the banner.
- **`window.location.assign('/generate')` (not `reload()`) is the post-success move.** It triggers a full SSR pass that re-reads `cards` server-side; the React island is re-mounted clean. `reload()` would also work but `assign` matches the auth-endpoint redirect pattern and survives if we later move the form to a different page.

## Phase 1: Env + OpenRouter config plumbing

### Overview

Add OpenRouter env vars to the Astro env schema, `.env.example`, and the dev-vars surface. Extend `config-status.ts` so a missing key surfaces as a banner exactly like the existing Supabase one. No application logic depends on this phase yet; it's the safety net for Phase 2.

### Changes Required:

#### 1. Astro env schema

**File**: `astro.config.mjs`

**Intent**: Make `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` readable through `astro:env/server` with the same `secret` / `optional: true` posture used for Supabase. `optional: true` is required so `astro build` doesn't fail in environments without the key (CI / local pre-config); the runtime check in `config-status.ts` is where missing-config becomes user-visible.

**Contract**: Two new entries under `env.schema`:

- `OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true })`
- `OPENROUTER_MODEL: envField.string({ context: "server", access: "secret", optional: true })`

#### 2. `.env.example`

**File**: `.env.example`

**Intent**: Document the new required env vars next to the existing Supabase placeholders, so any developer onboarding to the project knows what to fill in.

**Contract**: Append two lines (placeholders, not real values):

```
OPENROUTER_API_KEY=###
OPENROUTER_MODEL=openai/gpt-4o-mini
```

`openai/gpt-4o-mini` is the default because OpenAI models are the canonical supporters of OpenRouter's strict `json_schema` `response_format`. **Before locking any default, confirm structured-output support for that exact model on OpenRouter's models page** — a model without it returns `400` on every call. Anthropic models route through tool-calling and may reject `response_format`, so they are not a safe default for this slice's JSON-mode approach.

#### 3. Local env file

**File**: `.env` (gitignored, dev-only)

**Intent**: `npm run dev` is `astro dev`, and `astro:env/server` loads from `.env` (Vite convention) — NOT `.dev.vars`, which only `wrangler dev`/preview consumes. The real key must be in `.env` for local generation to work. (`.env` already contains `OPENROUTER_API_KEY` + `OPENROUTER_MODEL`, so this prerequisite is effectively done; `.dev.vars` is optional and only relevant if running under `wrangler dev`.)

**Contract**: Ensure `.env` holds the two entries (mirroring `.env.example`'s shape). Manual setup, not committed. Optionally mirror into `.dev.vars` for `wrangler`-based local runs.

#### 4. Production secret

**Where**: Cloudflare dashboard for the deployed Worker.

**Intent**: Same key, but stored as a Cloudflare secret so the deployed app at `https://10x-cards.rafsaw.workers.dev` can call OpenRouter.

**Contract**: Run `npx wrangler secret put OPENROUTER_API_KEY` and `npx wrangler secret put OPENROUTER_MODEL` (or set via the dashboard). Manual step.

#### 5. Config-status banner

**File**: `src/lib/config-status.ts`

**Intent**: Extend `configStatuses` to surface a banner if either OpenRouter var is missing, mirroring the existing Supabase entry. Without this, a deploy missing the secret would silently fail at the first generation attempt with an opaque error.

**Contract**: Import `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` from `astro:env/server`. Add a third `ConfigStatus` entry:

- `name: "OpenRouter"`
- `configured: Boolean(OPENROUTER_API_KEY && OPENROUTER_MODEL)`
- `message: "OpenRouter nie jest skonfigurowany — generacja kart AI jest wyłączona."`
- `docsUrl`: link to OpenRouter docs (or omit if no obvious URL — the message is enough).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with the new env imports.
- `npm run build` passes (Astro doesn't complain about missing env vars at build time because both are `optional: true`).
- `npx astro sync` runs cleanly (regenerates env types).

#### Manual Verification:

- Visiting `/` with no `OPENROUTER_API_KEY` set in `.env` shows the OpenRouter missing-config banner in addition to (or instead of) the existing Supabase banner.
- After setting both env vars in `.env`, the banner disappears.
- `wrangler secret list` (or the Cloudflare dashboard) shows `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` as set for the production Worker.

**Implementation Note**: After Phase 1's verification passes, pause for manual confirmation that the env vars are set in both `.env` (local) and Cloudflare (production) before proceeding to Phase 2 (where the first real OpenRouter call will be made).

---

## Phase 2: Generation API endpoint

### Overview

Land `POST /api/generations`: validate input, call OpenRouter with JSON-mode, parse + clamp, INSERT a batch of `status='draft'` rows via the SSR Supabase client, return `{drafts: [...]}` to the client. Also land `POST /api/generations/discard` for the "Discard all drafts" path.

### Changes Required:

#### 1. OpenRouter client helper

**File**: `src/lib/openrouter.ts` (new file)

**Intent**: Single function encapsulating the OpenRouter call so the endpoint stays focused on HTTP/RLS/insert orchestration. Not a class, not a singleton — just one async function.

**Contract**: Export `async function generateCandidateCards(sourceText: string, opts: { apiKey: string; model: string; signal?: AbortSignal }): Promise<{ front: string; back: string }[]>`.

The function:

- POSTs to `https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer <apiKey>`, `Content-Type: application/json`, `HTTP-Referer: https://10x-cards.rafsaw.workers.dev`, `X-Title: 10xCards`.
- Body: `{ model, response_format: { type: "json_schema", json_schema: { name: "candidate_cards", strict: true, schema: {...} } }, messages: [ { role: "system", content: <prompt> }, { role: "user", content: sourceText } ] }`.
- The JSON schema: top-level object with one required field `cards` (array, `minItems: 1`, `maxItems: 10`); each item has required `front` (string, `minLength: 1`, `maxLength: 500`) and `back` (string, `minLength: 1`, `maxLength: 2000`). `additionalProperties: false` everywhere.
- The system prompt: a short Polish/English bilingual instruction (the project is bilingual per `config-status.ts`) along the lines of: "You receive a passage of source text. Produce between 3 and 10 question/answer flashcards covering its key testable claims. Each card has `front` (a question answerable from the passage) and `back` (the answer — one concept, ≤ 2 sentences). Return only the structured JSON; do not add prose."
- Throws `Error` subclasses with `.code` discriminator for the caller to map to HTTP status:
  - `openrouter_http_error` (non-2xx from OpenRouter — includes a message hint about model JSON-mode support)
  - `openrouter_parse_error` (response body not parseable / no `cards` key / empty array)
  - `openrouter_timeout` (AbortController fired)
- On success returns the validated, clamped-to-10 array.

**Contract** (snippet — included because the request shape is non-obvious enough to lock in):

```ts
const RESPONSE_SCHEMA = {
  name: "candidate_cards",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["cards"],
    properties: {
      cards: {
        type: "array",
        minItems: 1,
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["front", "back"],
          properties: {
            front: { type: "string", minLength: 1, maxLength: 500 },
            back:  { type: "string", minLength: 1, maxLength: 2000 },
          },
        },
      },
    },
  },
} as const;
```

#### 2. Generation endpoint

**File**: `src/pages/api/generations.ts` (new file)

**Intent**: Wire HTTP → auth check → input validation → OpenRouter call → DB insert → JSON response. Match the `auth/*.ts` endpoint conventions for the auth/cookies plumbing.

**Contract**:

- `export const POST: APIRoute = async (context) => { ... }`.
- Reads `context.locals.user`; if null, returns `401` with `{ error: "unauthorized", message: "Login required." }`.
- Reads `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` from `astro:env/server`; if either missing, returns `503` with `{ error: "ai_unconfigured", message: "AI generation is not configured." }`.
- Parses the request body as JSON; expects `{ source: string }`. On parse failure, returns `400` with `{ error: "bad_request" }`.
- Validates `source`: trim, then `length >= 200 && length <= 8000`. On failure, returns `400` with `{ error: "invalid_source", message: "Source text must be between 200 and 8000 characters." }`.
- Constructs an `AbortController` with a `60_000`ms timeout. Calls `generateCandidateCards(source, { apiKey, model, signal })`. Maps errors:
  - `openrouter_timeout` → `504` `{ error: "ai_timeout" }`
  - `openrouter_parse_error` → `502` `{ error: "ai_parse_error" }`
  - `openrouter_http_error` → `502` `{ error: "ai_provider_error", detail }`
- On success: opens the SSR Supabase client via `createClient(context.request.headers, context.cookies)`. If `null`, returns `503` `{ error: "supabase_unconfigured" }`. Builds the insert payload as `cards.map(c => ({ user_id: context.locals.user!.id, front: c.front, back: c.back, status: "draft" }))`. Calls `supabase.from("cards").insert(payload).select("id, front, back, created_at")`.
- If the insert returns an error, returns `500` `{ error: "db_error" }`. Otherwise returns `200` `{ drafts: data }`.

#### 3. Discard endpoint

**File**: `src/pages/api/generations/discard.ts` (new file)

**Intent**: Bulk-delete all of the caller's `status='draft'` rows. Belt-and-braces — RLS already restricts to `auth.uid() = user_id`, so the explicit `eq("user_id", ...)` is defensive duplication, not the security boundary.

**Contract**:

- `export const POST: APIRoute = async (context) => { ... }`.
- Reads `context.locals.user`; if null, returns `401`.
- Opens SSR Supabase client; if null, returns `503`.
- Calls `supabase.from("cards").delete().eq("user_id", context.locals.user.id).eq("status", "draft")`.
- On error, returns `500`. On success, redirects to `/generate` (`context.redirect("/generate")`) so the form action works without client-side JS.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (no unused imports, types align, no `any`).
- `npm run build` passes.
- `npx astro sync` runs cleanly.

#### Manual Verification:

- With env vars set, `curl -X POST -H 'Content-Type: application/json' -d '{"source":"<200+ char passage>"}' http://localhost:4321/api/generations` (with a valid session cookie pasted in) returns `200` and `{drafts: [...]}` with the same number of items as a fresh check in Supabase Studio shows new draft rows for that user.
- Same `curl` without a session cookie returns `401` and does NOT hit OpenRouter (verifiable by checking OpenRouter usage dashboard for no spurious calls).
- `curl` with `source` shorter than 200 chars returns `400` and does NOT hit OpenRouter.
- After temporarily setting `OPENROUTER_MODEL` to a known JSON-schema-incompatible model and retrying, the endpoint returns `502` with `ai_provider_error` and does NOT insert anything in DB.
- After clicking through the discard endpoint (via a one-off form), all the caller's draft rows are gone in Studio, and saved rows (status='saved') for the same user are still there.
- Inserted draft rows show `status='draft'`, `next_due_at IS NULL`, `interval_days=0`, `repetition_count=0` (defaults preserved).

**Implementation Note**: After Phase 2's verification passes, pause for manual confirmation that the endpoint round-trip is reliable on at least 3 different passages of varying length before proceeding to Phase 3.

---

## Phase 3: Generate page + dashboard hub

### Overview

Add a dedicated `/generate` page that owns the paste form + draft list, and turn `/dashboard` into a clean hub that links to it. `/generate` server-side fetches current drafts and renders them above a React paste-form island; the form hits `POST /api/generations` with a spinner + elapsed-time counter, shows an inline error banner with Retry, and a "Discard all drafts" form posts to `POST /api/generations/discard`. Keeping generation on its own route stops `/dashboard` from accreting S-01/S-02/S-03/S-04 surfaces into one crowded page.

### Changes Required:

#### 1. Generate page (new)

**File**: `src/pages/generate.astro` (new file)

**Intent**: The generation surface. Server-side, fetch the caller's drafts; pass them to a server-rendered list block; mount the React paste-form island below.

**Contract**: The `---` frontmatter:

- Imports `createClient` from `@/lib/supabase` and the new `PasteAndGenerateForm` component.
- Reads `Astro.locals.user`; the middleware guarantees non-null on `/generate` (it's added to `PROTECTED_ROUTES` — see change #4) but a defensive `if (!user) return Astro.redirect("/auth/signin")` is fine.
- Opens an SSR Supabase client; if `null`, server-renders an error block "Supabase not configured" and skips the data fetch.
- Calls `supabase.from("cards").select("id, front, back, created_at").eq("status", "draft").order("created_at", { ascending: false })`. RLS scopes this to the caller automatically.
- Passes `drafts` to the rendered template.

The template:

- Layout title "Generate cards".
- Header consistent with the existing gradient style; a back-link to `/dashboard`.
- If `drafts.length > 0`: a `<section>` titled `Current draft batch ({drafts.length})` with a server-rendered list of front/back pairs (one card per row, no per-card actions for now — that's S-02), and a `<form method="POST" action="/api/generations/discard">` with a single `<button>` "Discard all drafts" and a confirmation `onsubmit="return confirm('Discard all {count} drafts? This cannot be undone.')"`.
- A `<section>` titled `Generate new cards from text` that mounts the React island `<PasteAndGenerateForm client:load />`.

#### 2. Dashboard page (becomes a hub)

**File**: `src/pages/dashboard.astro`

**Intent**: Keep `/dashboard` as a landing/hub page. Remove the inline generation expectation; add a prominent "Generate cards" call-to-action linking to `/generate`. Retain the greeting and the sign-out form.

**Contract**: Keep the existing layout + greeting header. Replace the body's "this page is only for authenticated users" copy with a primary action: an `<a href="/generate">` styled as a button ("Generate cards from text"). Keep the existing `<form method="POST" action="/api/auth/signout">`. No data fetch on this page in this slice (later slices add library/review links here).

#### 3. PasteAndGenerateForm React island

**File**: `src/components/generate/PasteAndGenerateForm.tsx` (new file; creates new `src/components/generate/` folder)

**Intent**: The interactive surface. Textarea + Generate button + in-flight spinner with elapsed-time counter + inline error banner; retry is the same Generate action with the source text preserved. Reuses styles from `src/components/auth/`* for visual consistency but is independent of the auth components (no shared state).

**Contract**:

- Default export `PasteAndGenerateForm`, no props.
- Local state: `source: string`, `submitting: boolean`, `error: { code: string; message: string } | null`, `elapsedMs: number`.
- While `submitting`, a `setInterval(... , 1000)` ticks `elapsedMs` (cleanup on unmount and on completion).
- `onSubmit`:
  - `e.preventDefault()`.
  - Client-side guard: if `source.trim().length < 200`, set local error `{ code: "client_validation", message: "Please paste at least 200 characters of source text." }` and return.
  - Set `submitting=true`, `error=null`, `elapsedMs=0`.
  - `fetch("/api/generations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source }) })`.
  - On `response.ok`: `window.location.assign("/generate")` — full page reload, server re-fetches drafts authoritatively.
  - On non-OK: parse body as JSON (defensively wrap in try/catch), set `error` to the parsed `{ error, message }` (with a fallback message per `error` code), set `submitting=false`.
  - On thrown fetch error (network failure): set `error={ code: "network_error", message: "Network error — try again." }` and clear `submitting`.
- The Retry path is implicit: the user clicks Generate again. The textarea state is preserved across error → retry because we don't clear `source` on error.
- Visual:
  - Textarea: full-width, ~8 rows, `disabled={submitting}`, placeholder "Paste a passage (200–8000 characters)…"
  - Char counter below textarea showing `source.length / 8000`.
  - Submit button: shows "Generate" normally; while `submitting` shows a spinner icon + `Generating… {Math.floor(elapsedMs/1000)}s`. `disabled={submitting || source.trim().length < 200}`.
  - Error banner above the textarea when `error` is non-null, styled in red, with the `message` and a small icon. (Pattern: same shape as `src/components/auth/ServerError.tsx`.)

#### 4. Protect `/generate` in middleware

**File**: `src/middleware.ts`

**Intent**: The current guard only covers `/dashboard` (`PROTECTED_ROUTES = ["/dashboard"]`, `src/middleware.ts:4`). `/generate` reads and writes the caller's cards, so an unauthenticated visit must redirect to signin — the page must never render for an anonymous user.

**Contract**: Add `"/generate"` to the `PROTECTED_ROUTES` array. The existing `startsWith` check then redirects unauthenticated requests to `/auth/signin`. (The `/api/generations*` endpoints do their own `context.locals.user` null-check returning 401, so they don't need to be in `PROTECTED_ROUTES` — middleware redirects are for pages, JSON 401s are for the API.)

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (no unused imports; React hooks rules respected; `react-compiler` plugin happy with the form component).
- `npm run build` passes.
- `npx astro sync` runs cleanly (component picked up by typegen).

#### Manual Verification:

- `/dashboard` shows a "Generate cards" link that navigates to `/generate`.
- An unauthenticated request to `/generate` redirects to `/auth/signin`.
- Logged-in user visiting `/generate` with zero drafts sees the paste form only.
- Pasting < 200 chars and clicking Generate shows the client-side validation message; no network request fires (verify in DevTools Network tab).
- Pasting 200+ chars and clicking Generate disables the form, shows a spinner with a ticking counter, and on success reloads `/generate` with the new drafts listed above the form.
- A second generation appends to the draft list (count grows; older drafts still visible because the list sorts by `created_at DESC` — the new batch is on top).
- "Discard all drafts" with a confirm dialog wipes the entire draft list and lands the user back on an empty `/generate`.
- Force-failing the LLM (point `OPENROUTER_MODEL` at a non-existent model temporarily) shows the inline error banner; the textarea retains the pasted text; clicking Generate again re-runs without the user needing to re-paste — proving FR-008.
- The page renders correctly on Chrome, Firefox, Safari (Edge by extension) — per PRD §NFR.

**Implementation Note**: After Phase 3's verification passes, pause for manual confirmation that the full paste → drafts loop is observably working on `npm run dev`, including at least one deliberately-failed generation to verify the error/retry path, before proceeding to Phase 4.

---

## Phase 4: End-to-end manual verification on production

### Overview

Deploy, then walk the full PRD US-01 acceptance criteria (the generation+display half, since accept/reject is S-02) on the live site at `https://10x-cards.rafsaw.workers.dev`. Confirm RLS still holds by signing in as two different test users (the same `rls-test-a@example.invalid` / `rls-test-b@example.invalid` accounts F-01 created) and verifying that user A never sees user B's drafts.

### Changes Required:

#### 1. Set production secrets

**Where**: Cloudflare dashboard (or `wrangler secret put`).

**Intent**: Without `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` set on the deployed Worker, generation fails 503 — confirms Phase 1's banner appears correctly but blocks Phase 4 verification.

**Contract**: Both secrets must be set on the Worker prior to walking the acceptance criteria. Re-confirm in the dashboard or with `npx wrangler secret list`.

#### 2. Deploy

**Where**: Push to `main` triggers Cloudflare auto-deploy (per `context/foundation/roadmap.md` §Baseline).

**Intent**: Get Phase 1–3 onto production.

**Contract**: Run `git push origin main` (after Phase 3's commit) and confirm the deploy succeeds in the Cloudflare dashboard. If a build fails, fix forward — do not roll back to a half-state.

### Success Criteria:

#### Automated Verification:

- `npx wrangler secret list` (or the Cloudflare dashboard) shows both `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` as set on the production Worker.
- Production build succeeds (visible in Cloudflare dashboard build log).

#### Manual Verification:

- Sign in as `rls-test-a@example.invalid` on the live site. Visit `/dashboard`, click "Generate cards" to reach `/generate`. Paste a 200+ char passage. Confirm a draft batch appears.
- Sign in as `rls-test-b@example.invalid` (incognito window). Visit `/generate`. Confirm user A's drafts are NOT visible. Paste a different passage. Generate. Confirm only user B's drafts are visible.
- Sign back in as user A. Confirm A's original drafts are still there and B's are still not visible.
- Force-fail (briefly change `OPENROUTER_MODEL` in the Cloudflare dashboard to a non-existent model — be sure to revert) and confirm the deployed app shows the error banner with source text preserved (FR-008 on production).
- Discard all drafts as both users; verify each user's discard only deletes their own drafts (RLS belt-and-braces).
- Take a screenshot of a successful generation for the PR description.

**Implementation Note**: This is the gate where PRD US-01 (generation+display half) and FR-004/005/008 are observably true on production. Mark the change as `status: implemented` and queue `/10x-archive first-gated-generation` for after S-02 has also landed (it's natural to archive S-01 + S-02 together since S-02 finalizes the loop S-01 started).

---

## Testing Strategy

### Unit Tests

None. No test runner is configured (per `AGENTS.md` §Testing Guidelines), and the per-function unit-testing surface here is poor: the OpenRouter helper is mostly HTTP + JSON parsing, the endpoint is mostly auth/RLS/insert orchestration, the React island is mostly state plumbing. Manual verification in Phases 2/3/4 substitutes.

### Integration Tests

The manual verification blocks in Phases 2, 3, and 4 are the integration tests: Phase 2 hits the endpoint with curl + a live OpenRouter; Phase 3 walks the full UI loop on `npm run dev`; Phase 4 walks the same loop on production with two users.

### Manual Testing Steps

1. Phase 1 verified standalone (env config banner).
2. Phase 2: hit `/api/generations` and `/api/generations/discard` with curl; cross-check DB rows in Supabase Studio.
3. Phase 3: walk the full `/generate` UI on `npm run dev` (reached via the `/dashboard` hub link) — including the deliberately-failed retry path.
4. Phase 4: re-walk Phase 3 on the deployed site under two distinct user identities to confirm RLS still isolates.

## Performance Considerations

OpenRouter latency for a small JSON-mode response on a fast/cheap model is typically 5–15 seconds. The user is informed via the spinner + counter (PRD NFR). No caching of generations (each paste is unique by definition). The single `INSERT … VALUES (...), (...)` for up to 10 rows is fully covered by the existing `cards_user_id_status_idx` for the subsequent SELECT.

The Workers free plan caps CPU per request; OpenRouter time is I/O, not CPU, so it doesn't count toward that cap — but the 60-second `AbortController` is the safety belt for an unbounded hang.

## Migration Notes

No schema changes. F-01's `cards` table has the exact shape we need. The only "migration" is the env-schema addition in `astro.config.mjs` (Phase 1), which is forward-only and backward-compatible (both new fields are `optional: true`).

Rollback: revert the commit. No DB state lingers besides any drafts users may have created in the brief window before rollback — those remain harmless rows in `public.cards` with `status='draft'`.

## References

- Roadmap source: `context/foundation/roadmap.md` (S-01, §Slices)
- PRD: `context/foundation/prd.md` US-01, FR-004, FR-005, FR-008, §NFR (continuous feedback), §Business Logic (rule for transformation)
- F-01 schema + RLS: `supabase/migrations/20260527150510_cards_and_account_deletion.sql`, `context/changes/cards-schema-and-rls/plan.md`
- SSR Supabase client: `src/lib/supabase.ts:5-24`
- Middleware (`context.locals.user`): `src/middleware.ts:6-25`
- Auth-endpoint convention: `src/pages/api/auth/signin.ts`
- React form-island convention: `src/components/auth/SignInForm.tsx`
- Config-status banner pattern: `src/lib/config-status.ts:11-21`, `src/layouts/Layout.astro:22-37`
- Env schema: `astro.config.mjs:17-22`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append  `— <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Env + OpenRouter config plumbing

#### Automated

- [x] 1.1 `npm run lint` passes with the new env imports — 3dabd75
- [x] 1.2 `npm run build` passes — 3dabd75
- [x] 1.3 `npx astro sync` runs cleanly — 3dabd75

#### Manual

- [x] 1.4 Visiting `/` with `OPENROUTER_API_KEY` unset shows the OpenRouter missing-config banner — 3dabd75
- [x] 1.5 After setting both env vars locally, the OpenRouter banner disappears — 3dabd75
- [x] 1.6 `wrangler secret list` (or Cloudflare dashboard) shows `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` as set for the production Worker — 3dabd75

### Phase 2: Generation API endpoint

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 `npm run build` passes
- [x] 2.3 `npx astro sync` runs cleanly

#### Manual

- [x] 2.4 `curl POST /api/generations` with a valid session and a 200+ char source returns 200 and `{drafts:[...]}`; matching rows visible in Supabase Studio
- [x] 2.5 `curl POST /api/generations` without a session returns 401 and does not hit OpenRouter
- [x] 2.6 `curl POST /api/generations` with source < 200 chars returns 400 and does not hit OpenRouter
- [x] 2.7 Forcing `OPENROUTER_MODEL` to an incompatible model returns 502 `ai_provider_error` and inserts nothing
- [x] 2.8 `POST /api/generations/discard` removes only the caller's draft rows (status='draft'); saved rows untouched
- [x] 2.9 Inserted draft rows in Studio show `status='draft'`, `next_due_at IS NULL`, `interval_days=0`, `repetition_count=0`

### Phase 3: Generate page + dashboard hub

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 `npm run build` passes
- [ ] 3.3 `npx astro sync` runs cleanly

#### Manual

- [ ] 3.4 `/dashboard` shows a "Generate cards" link that navigates to `/generate`
- [ ] 3.5 Unauthenticated request to `/generate` redirects to `/auth/signin`
- [ ] 3.6 Logged-in user on `/generate` with zero drafts sees the paste form only
- [ ] 3.7 < 200 chars + Generate shows the client-side validation message; no network call fires
- [ ] 3.8 200+ chars + Generate disables the form, shows the spinner + ticking counter, reloads `/generate` to show new drafts on success
- [ ] 3.9 Second generation appends to the draft list (count grows, sort is newest-first)
- [ ] 3.10 "Discard all drafts" with confirm dialog wipes the draft list
- [ ] 3.11 Forcing a failure renders the inline error banner; textarea retains source text; clicking Generate again works without re-paste (FR-008)
- [ ] 3.12 Page renders correctly on Chrome and at least one other browser (Firefox or Safari)

### Phase 4: End-to-end manual verification on production

#### Automated

- [ ] 4.1 `wrangler secret list` (or Cloudflare dashboard) shows both OpenRouter secrets set on the production Worker
- [ ] 4.2 Production build succeeds after `git push origin main` (Cloudflare dashboard build log green)

#### Manual

- [ ] 4.3 User-A on live site reaches `/generate` via the dashboard hub and generates a draft batch successfully
- [ ] 4.4 User-B on live site (incognito) sees no drafts from user-A; generates their own batch
- [ ] 4.5 User-A re-checks; their drafts persist and user-B's are not visible
- [ ] 4.6 Forced failure on production shows the error banner with source text preserved
- [ ] 4.7 Discard on production removes only the caller's drafts (RLS belt-and-braces holds)
- [ ] 4.8 Screenshot of a successful generation captured for the PR description
