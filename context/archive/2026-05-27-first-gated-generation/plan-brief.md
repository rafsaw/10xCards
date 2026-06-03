# S-01: First Gated Generation — Plan Brief

> Full plan: `context/changes/first-gated-generation/plan.md`

## What & Why

Wire the *paste → AI → DB-persisted draft candidates → render list* loop so a logged-in user can paste a passage and immediately see AI-generated draft flashcards on their dashboard. This is the first half of PRD's primary loop (US-01); accept/reject finalization lands in S-02. Successful generations persist draft rows in the DB across refresh; failed-generation retry without re-pasting is handled by preserving the source text in the React island.

## Starting Point

F-01 is live on remote Supabase — `public.cards` exists with `status='draft'|'saved'` and RLS scoped to `auth.uid() = user_id` (`supabase/migrations/20260527150510_cards_and_account_deletion.sql`). Auth + middleware are wired (`src/middleware.ts`, `src/lib/supabase.ts`), but `/dashboard` is a placeholder, no card-facing API endpoints exist, and OpenRouter has never been called from this codebase (no env var, no client, no key in `.env.example`).

## Desired End State

A logged-in user navigates from the `/dashboard` hub to a dedicated `/generate` page, pastes a 200–8000 char passage, sees a spinner with an elapsed-time counter while a server-side OpenRouter call (JSON-mode, fast/cheap model) runs, then sees 3–10 draft cards listed on the page — all stored in `public.cards` under their own `user_id` via RLS. A "Discard all drafts" form clears the batch. Failures show an inline error banner and preserve the source text so clicking Generate again retries without re-pasting.

## Key Decisions Made

| Decision                        | Choice                                                                                              | Why (1 sentence)                                                                                                              | Source |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| LLM provider                    | OpenRouter via `fetch` (no SDK)                                                                     | Matches roadmap S-01 §Unknowns naming OpenRouter; trivial HTTP from Workers; zero SDK bloat.                                  | Plan   |
| Model selection                 | Env-var driven (`OPENROUTER_MODEL`)                                                                 | Swap without redeploy via Cloudflare secret; keeps the door open for experimentation without code edits.                      | Plan   |
| LLM output shape                | OpenRouter JSON-mode (`response_format: json_schema`, strict)                                       | Deterministic parseable shape; no Markdown-fence stripping; one try/catch.                                                    | Plan   |
| Candidate count                 | Model-decided in 3–10 range, server clamps to 10                                                    | PRD Business Logic: roughly one card per testable claim — passage density should drive count, not a fixed N.                  | Plan   |
| Input validation                | 200 ≤ source.length ≤ 8000 chars; reject empty/whitespace                                           | Approximates PRD AC (≥ 200 words → ≥ 1 candidate) with a cheap server check; upper bound caps LLM cost.                       | Plan   |
| In-flight UX                    | Single-shot POST + spinner with elapsed-time counter; form disabled                                 | Satisfies PRD NFR (continuous feedback > a couple seconds); no SSE/streaming infra on Workers required.                       | Plan   |
| Failure UX                      | Inline error banner; source text preserved; no auto-retry; user clicks Generate again to retry      | Satisfies FR-008 + PRD Guardrails; explicit user action prevents cost surprises from silent backoff loops.                    | Plan   |
| Dangling drafts policy          | Drafts persist; existing batch surfaced above paste form with a "Discard all drafts" form action    | Resolves roadmap S-01 §Unknowns; no cron/TTL infra needed; user has explicit control; new generations append (not replace).   | Plan   |
| Page layout                     | Dedicated `/generate` page owns paste form + draft list; `/dashboard` reduced to a hub linking to it | Keeps `/dashboard` from accreting S-01/S-02/S-03/S-04 surfaces into one crowded page; cleaner separation as the app grows.    | Plan (user-revised) |
| Post-submit move                | Endpoint returns JSON `{drafts}`; client calls `window.location.assign('/generate')` after 200     | Single source of truth: server-rendered draft list is authoritative; survives multi-tab; matches the auth `redirect` idiom.   | Plan   |

## Scope

**In scope:**
- New env vars: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (Astro env schema, `.env.example`, `.dev.vars`, Cloudflare secret, config-status banner)
- New helper `src/lib/openrouter.ts` (one async function, throws typed errors)
- New endpoints `POST /api/generations` and `POST /api/generations/discard`
- New page `src/pages/generate.astro`: server-fetched draft list + React form island + discard form
- `src/pages/dashboard.astro` reduced to a hub with a "Generate cards" link to `/generate`
- `"/generate"` added to `PROTECTED_ROUTES` in `src/middleware.ts`
- New React island `src/components/generate/PasteAndGenerateForm.tsx`
- Manual verification on `npm run dev` and on production with two test users

**Out of scope:**
- Per-card accept/reject (S-02)
- Initial `next_due_at` assignment for drafts (S-02 sets this at promote time)
- Editing front/back of drafts (PRD §Non-Goals)
- Streaming responses / SSE / background jobs
- Auto-retry on the server
- TTL/cron sweep of stale drafts
- Multi-model UX / model selector
- Atomic multi-row insert (S-02 makes this a hard requirement)
- New tests / test runner (none configured in repo)
- Supabase generated TypeScript types

## Architecture / Approach

```
Browser (React island)
   |
   |  POST /api/generations  { source }
   v
Astro API route (src/pages/api/generations.ts)
   |
   |  1. Auth check (context.locals.user)
   |  2. Input validation (200 ≤ len ≤ 8000)
   |  3. fetch → openrouter.ai/api/v1/chat/completions (json_schema, AbortController 60s)
   |  4. SSR Supabase client → INSERT cards (status='draft', user_id=auth.uid())
   |     (RLS policy cards_insert_own validates WITH CHECK)
   v
{drafts: [...]} → 200
   |
   v
window.location.assign('/generate') → server re-renders draft list
```

`/dashboard` is a hub that links to `/generate`; the paste form + draft list live only on `/generate` (added to `PROTECTED_ROUTES` in the middleware).

## Phases at a Glance

| Phase                                       | What it delivers                                                                              | Key risk                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1. Env + OpenRouter config plumbing         | Env vars wired through Astro/Wrangler/Cloudflare; missing-config banner extended for OpenRouter | Forgetting to set the production secret silently breaks generation on deploy — banner catches this.       |
| 2. Generation API endpoint                  | `POST /api/generations` + `POST /api/generations/discard` end-to-end                          | Model that doesn't support strict json_schema returns 400 from OpenRouter; surface as 502 with a hint.    |
| 3. Generate page + dashboard hub            | `/generate` hosts paste form + draft list + discard; `/dashboard` becomes a hub; `/generate` protected | React island + native form actions on the same page need clean separation; in-flight state vs. SSR drift. |
| 4. End-to-end manual verification           | Live walk on prod under two users; PRD AC and RLS isolation observably hold                   | Forgetting to revert a temporary force-fail of `OPENROUTER_MODEL` after the negative test on production.  |

**Prerequisites:** F-01 implemented (it is — `cards-schema-and-rls` status: implemented). A real OpenRouter API key obtained and added to `.dev.vars` + Cloudflare secrets before Phase 2 can be verified end-to-end.

**Estimated effort:** ~2 sessions across 4 phases. Phase 2 is the bulk of the work; Phases 1, 3, 4 are smaller and sequential.

## Open Risks & Assumptions

- **OpenRouter JSON-mode model availability:** the env-selected model must support `response_format: json_schema, strict: true` — canonically an OpenAI-model feature. Default is `openai/gpt-4o-mini`; Anthropic models may reject `response_format`, so they're not a safe default. Verify support on OpenRouter's models page before changing the default; an unsupported model returns 502 with a hint. Acceptable at dogfood scale.
- **Workers wall-clock budget under OpenRouter latency variance:** typical 5–15s; AbortController bounds at 60s. If OpenRouter routinely hits 30s+, UX degrades but no correctness issue.
- **Cost discipline depends on the 8000-char upper bound and the 10-candidate clamp.** No per-user rate limit beyond OpenRouter's natural per-key limits. Acceptable at dogfood scale; revisit if multi-user.
- **No atomic multi-row insert in this slice.** A `VALUES (...), (...)` insert is one statement in PostgREST but theoretically partial-fails are possible. S-02 makes atomicity a hard requirement; here we accept the risk.
- **No automatic cleanup of dangling drafts.** Solely user-action driven via "Discard all drafts". If S-02 doesn't land soon after S-01, users could accumulate draft batches indefinitely.

## Success Criteria (Summary)

- A logged-in user can paste a 200+ char passage on `/generate` and see 3–10 draft cards listed within ~20 seconds, on both `npm run dev` and on production.
- A failed generation preserves the source text and lets the user click Generate again to retry (FR-008).
- Two different users on production never see each other's drafts; RLS belt-and-braces holds end-to-end.
