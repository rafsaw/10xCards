# S-02: Atomic Save to Deck (north star) — Implementation Plan

## Overview

Close the AI capture loop. A logged-in user looks at the persisted draft batch on `/generate` (from S-01), marks accept or reject on each candidate (default: accept), and confirms once. The confirm triggers an **atomic** finalize: accepted drafts flip `status='draft' → 'saved'` and get an initial `next_due_at = now()` (entering the SR lifecycle); rejected drafts are hard-deleted. The whole batch resolves all-or-nothing in a single Postgres transaction — never a half-saved state. After success the user lands back on an empty `/generate`, ready to paste the next passage.

This slice is the **validation milestone for the PRD Primary Success Criterion** and satisfies PRD FR-006 (accept saves to library) and FR-007 (reject discards with no save). It builds entirely on F-01's schema/RLS and S-01's draft-persistence + React-island patterns; no new env, no new dependencies.

## Current State Analysis

- **Drafts already persist and render read-only.** `src/pages/generate.astro:18-30` server-fetches the caller's `status='draft'` rows via the SSR client; lines `59-87` render them as a static `<ul>` with a single "Discard all drafts" native form posting to `POST /api/generations/discard` (`src/pages/api/generations/discard.ts`). There are **no per-card actions and no save path** — that is exactly what S-02 adds.
- **Schema is ready; no table migration needed.** `public.cards` (`supabase/migrations/20260527150510_cards_and_account_deletion.sql`) has `status text check (status in ('draft','saved'))`, `next_due_at timestamptz` (nullable), `interval_days`/`repetition_count` (default 0), `last_reviewed_at`. Promote = set `status='saved'` + a concrete `next_due_at`. The only new DB object is a transaction function (Phase 1).
- **RLS is the security boundary and is enforced at the DB.** F-01 policies `cards_update_own` (`USING` + `WITH CHECK` `(select auth.uid()) = user_id`) and `cards_delete_own` (`USING (select auth.uid()) = user_id`) confine every write to the caller's rows. The F-01 plan §Critical Details warns that `service_role` bypasses RLS — so the finalize path must run through the SSR client (which carries the user's JWT), never the service key.
- **S-04 depends on a concrete due-date.** The roadmap S-04 review query is `status='saved' AND next_due_at <= now()`. A saved card left with `next_due_at = NULL` would never surface in review — so S-02 **must** set `next_due_at` to a real timestamp on promote.
- **Established patterns to reuse.** React island + controlled state + `fetch` + `window.location.assign('/generate')` on success (`src/components/generate/PasteAndGenerateForm.tsx:39-84`); the `json()` helper + `context.locals.user` 401 check + SSR-client 503 check in the endpoints (`src/pages/api/generations.ts:10-69`); the `.overrideTypes<...>()` typing trick for untyped Supabase results (`generate.astro:24`); F-01's remote-push migration + impersonation-SQL verification workflow.
- **No test runner** (`AGENTS.md` §Testing). Verification is `npm run lint`, `npm run build`, `npx astro sync`, hand-run SQL in Supabase Studio, and manual route checks on `/generate`.

## Desired End State

After this change lands:

- `/generate` renders the draft batch through a React island `DraftReviewList`. Each candidate shows front/back plus a Keep/Discard toggle (default **Keep**). A live summary reads "N to save · M to discard". A "Discard all drafts" escape hatch (existing endpoint) remains.
- Clicking **Save to deck** opens a confirm: "Save N to your deck and permanently discard M? This can't be undone." On confirm, the island POSTs `{ accept: id[], reject: id[] }` to `POST /api/generations/save`.
- The endpoint calls `supabase.rpc('finalize_drafts', { p_accept_ids, p_reject_ids })` through the SSR client. The function, in one transaction, promotes the caller's matching drafts to `status='saved'` with `next_due_at = now()` and deletes the caller's matching rejected drafts — then returns `{ saved_count, discarded_count }`. Either both happen or neither does.
- On success the island calls `window.location.assign('/generate')`; with drafts gone the page shows the empty paste form again (the loop is closed; the user can paste another passage). On failure an inline banner appears and the drafts are untouched (transaction rolled back), so the user can retry.
- Cross-user isolation holds end-to-end via two layers: the endpoint's completeness guard rejects a body containing any id outside the caller's own draft set (`400 incomplete_selection`) before the rpc runs, and even if that were bypassed the function's invoker-rights RLS `USING` predicate filters another user's rows out so the UPDATE/DELETE touch **nothing**. Verified against the live remote DB with the two F-01 test users.
- `npm run lint`, `npm run build`, `npx astro sync` pass. The loop *paste → generate → review → save* works end-to-end on `https://10x-cards.rafsaw.workers.dev`.

### Key Discoveries

- A PostgREST `rpc()` call to a `SECURITY INVOKER` plpgsql function runs as the `authenticated` role with the caller's JWT, so `auth.uid()` resolves correctly **inside** the function and RLS applies to its UPDATE/DELETE. This is what makes a single-round-trip atomic finalize both transactional and RLS-safe — no `service_role`, no app-side transaction juggling.
- A function body executes in one implicit transaction: any raised exception rolls back every statement in it. That is the "albo wszystko, albo nic" guarantee the roadmap names, for free.
- A `status='draft'` predicate in both the UPDATE and DELETE makes the operation idempotent under concurrency (two browser tabs / double-submit): already-saved cards won't be re-touched and already-deleted ids simply match nothing. This closes Open Roadmap Question #3's race concern without locks or idempotency keys.
- `next_due_at = now()` is the minimal correct initial state: `interval_days`/`repetition_count` keep their `0` defaults and `last_reviewed_at` stays `NULL`; the `cards_set_updated_at` trigger refreshes `updated_at` on the UPDATE. S-04 owns the actual interval math.

## What We're NOT Doing

- **No spaced-repetition formula.** S-02 only sets `next_due_at = now()` so cards are reviewable. Interval/ease logic is S-04 (roadmap defers it to `/10x-research`).
- **No editing of candidates before saving.** PRD §Non-Goals explicitly forbids it — candidates are accept/reject only; refinement is post-save via S-03's edit surface (FR-011).
- **No three-state / "skip for later".** Save resolves the entire current batch; zero drafts remain afterward (that is the "close the loop" outcome). Default per card is Keep.
- **No per-card immediate actions.** One batch confirm, per the roadmap's atomic framing — not Tinder-style per-card requests.
- **No undo of discarded candidates.** FR-007 is a hard delete; the confirm dialog is the only guard.
- **No library / browse / review UI.** Viewing saved cards is S-03; reviewing them is S-04. After save there is intentionally no link to a library yet.
- **No changes to generation** (`/api/generations`), the paste form, the env schema, `config-status.ts`, the middleware, or `dashboard.astro`. `/generate` is already in `PROTECTED_ROUTES`; the new endpoint does its own 401 check.
- **No generated Supabase types.** Continue hand-typing / casting the `rpc` result, consistent with the rest of the codebase.
- **No new dependencies.**

## Implementation Approach

Four phases mirroring S-01's shape. Phase 1 lands the DB function (the atomicity contract) and proves it on remote before any app code leans on it. Phase 2 adds the thin endpoint that calls the function through the RLS-scoped SSR client. Phase 3 builds the interactive review island and swaps it into `/generate`. Phase 4 is the production gate where the closed loop and RLS isolation are observed live.

The endpoint (Phase 2) and island (Phase 3) are sequenced so the endpoint can be curl-tested before the UI depends on it, but they could split across sessions.

## Critical Implementation Details

- **The finalize function must be `SECURITY INVOKER` (not `DEFINER`).** Invoker rights mean RLS evaluates `auth.uid()` as the caller, so the UPDATE/DELETE only ever touch the caller's rows — passing another user's id is a silent no-op, not a leak. A `DEFINER` function would run as the owner and bypass RLS, re-opening the ship-blocking guardrail. Pair it with `set search_path = ''` (Supabase linter requirement) and schema-qualify every reference (`public.cards`).
- **Atomicity comes from the function being one transaction.** Do the UPDATE then the DELETE; if either raises, Postgres rolls back the whole call. No `BEGIN/COMMIT` needed inside plpgsql — the function call is the transaction boundary.
- **Guard both statements with `status = 'draft'`.** This prevents re-promoting an already-saved card, prevents a stale tab from deleting a card that was already saved, and makes a double-submit harmless (second call matches zero rows). Report the *actual* affected counts from `GET DIAGNOSTICS`, not the input array lengths.
- **`next_due_at` must be a concrete timestamp.** Set it to `now()`. Leaving it `NULL` would exclude the card from S-04's `next_due_at <= now()` review query — a silent bug surfacing two slices later.
- **Migration filename must follow `YYYYMMDDHHMMSS_<name>.sql`.** The CLI orders by filename and silently skips malformed names. Generate the prefix with `Get-Date -Format "yyyyMMddHHmmss"` (PowerShell).
- **Typing the `rpc` result.** Without generated types, `supabase.rpc(...)` is loosely typed; define a local `FinalizeResult` interface and cast (or use `.overrideTypes`) so lint stays `any`-free.

## Phase 1: Atomic finalize DB function + migration

### Overview

Author one migration adding a `public.finalize_drafts(uuid[], uuid[])` plpgsql function (invoker-rights, granted to `authenticated`) that promotes accepted drafts and deletes rejected ones in a single transaction, returning the affected counts. Push to the linked remote project. Verify on remote — via impersonation SQL — that it is atomic, sets the schedule correctly, and is confined by RLS.

### Changes Required:

#### 1. Migration: finalize function

**File**: `supabase/migrations/<YYYYMMDDHHMMSS>_finalize_drafts_fn.sql` (new)

**Intent**: Add the transaction function S-02's endpoint calls. One file, schema + grant together, so a future reader sees the whole contract (including its RLS posture) in one place.

**Contract**:
- `create function public.finalize_drafts(p_accept_ids uuid[], p_reject_ids uuid[]) returns table (saved_count integer, discarded_count integer)`.
- `language plpgsql`, `security invoker`, `set search_path = ''`.
- Body: `UPDATE public.cards SET status='saved', next_due_at=now() WHERE id = any(p_accept_ids) AND status='draft';` capture `GET DIAGNOSTICS saved_count = ROW_COUNT`; then `DELETE FROM public.cards WHERE id = any(p_reject_ids) AND status='draft';` capture `discarded_count`; `RETURN QUERY SELECT saved_count, discarded_count;`.
- `grant execute on function public.finalize_drafts(uuid[], uuid[]) to authenticated;`
- RLS is NOT re-declared here — the existing `cards_update_own` / `cards_delete_own` policies apply because the function is invoker-rights.

The full body is non-obvious (invoker + empty search_path + diagnostics), so it is pinned here:

```sql
create function public.finalize_drafts(p_accept_ids uuid[], p_reject_ids uuid[])
returns table (saved_count integer, discarded_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.cards
    set status = 'saved', next_due_at = now()
    where id = any(p_accept_ids) and status = 'draft';
  get diagnostics saved_count = row_count;

  delete from public.cards
    where id = any(p_reject_ids) and status = 'draft';
  get diagnostics discarded_count = row_count;

  return query select saved_count, discarded_count;
end;
$$;

grant execute on function public.finalize_drafts(uuid[], uuid[]) to authenticated;
```

#### 2. Push migration to remote

**Intent**: Apply the function to the production Supabase project (same remote-only workflow as F-01 — no local stack).

**Contract**: `supabase db push` from the project root against the linked remote; confirm the new filename is listed and applied.

#### 3. Verification SQL artifact

**File**: `context/changes/atomic-save-to-deck/verify-finalize.sql` (new)

**Intent**: A self-contained, re-runnable script proving atomicity + RLS confinement on remote, mirroring F-01's `verify-rls.sql`. Reuses the two existing F-01 test users (`rls-test-a@example.invalid`, `rls-test-b@example.invalid`) whose UUIDs are recorded in `context/changes/cards-schema-and-rls/verify-rls.sql`.

**Contract**: Header records the two UUIDs (filled in, no placeholders). Sequenced blocks, each with its expected result as an inline comment, using Studio's role/UID impersonation (fallback: direct psql on port 5432 with `SET LOCAL role / request.jwt.claims`, per F-01 plan §Precondition):
1. **Setup (`service_role`)**: insert 3 drafts for user-A (capture their ids) and 2 drafts for user-B.
2. **Happy path (as user-A)**: `select * from public.finalize_drafts(array[<A_draft1>]::uuid[], array[<A_draft2>]::uuid[]);` → expect `saved_count=1, discarded_count=1`. Then assert A_draft1 is now `status='saved'` with `next_due_at` non-null, A_draft2 is gone, A_draft3 still `draft`.
3. **RLS confinement (as user-A)**: call `finalize_drafts(array[<B_draft1>]::uuid[], array[<B_draft2>]::uuid[])` → expect `saved_count=0, discarded_count=0`; assert both of B's drafts are untouched (`select status from public.cards where id in (B_draft1,B_draft2)` still `draft`).
4. **Idempotency (as user-A)**: re-run block 2's call → expect `0, 0` (A_draft1 already saved, A_draft2 already deleted — `status='draft'` guard matches nothing).
5. **Cleanup (`service_role`)**: delete all fixture rows for both users (`delete from public.cards where user_id in (<A>, <B>)`); leave the two auth users in place. Assert `select count(*) from public.cards where user_id in (<A>, <B>)` = 0 — scoped to the fixtures, never a global table count.

### Success Criteria:

#### Automated Verification:

- `supabase db push` returns exit 0 and prints the new migration filename.
- `supabase migration list --linked` shows the migration applied on remote.
- `verify-finalize.sql` is committed with real UUIDs (no `<...>` placeholders remain: `grep -c '<' verify-finalize.sql` returns `0`).
- `npm run lint` and `npm run build` still pass (no incidental breakage).

#### Manual Verification:

- In remote Studio, `public.finalize_drafts` exists with `security invoker` and `EXECUTE` granted to `authenticated`.
- Every block in `verify-finalize.sql` produces its documented result when run with the correct role/UID: happy path returns `1,1` and leaves the expected post-state; the cross-user call returns `0,0` and leaves user-B's drafts untouched; the idempotent re-run returns `0,0`.
- After the cleanup block, `select count(*) from public.cards where user_id in (<A>, <B>);` as `service_role` returns `0` (no fixture residue for the two test users). Do **not** assert a global `count(*) = 0` — the remote DB already holds S-01/F-01 rows and, after Phase 4, real saved cards; a global zero would falsely fail or invite deleting everyone's data.

**Implementation Note**: After Phase 1's verification passes, pause for manual confirmation that the function is atomic and RLS-confined on remote before proceeding to Phase 2 (which depends on it).

---

## Phase 2: Save endpoint

### Overview

Land `POST /api/generations/save`: auth check → validate `{ accept, reject }` id arrays → call `finalize_drafts` through the SSR client → return `{ saved, discarded }`. Thin orchestration; the atomicity lives in the DB function.

### Changes Required:

#### 1. Save endpoint

**File**: `src/pages/api/generations/save.ts` (new)

**Intent**: The HTTP surface for the atomic finalize. Matches the conventions in `src/pages/api/generations.ts` (the `json()` helper, `context.locals.user` 401, SSR-client 503).

**Contract**:
- `export const POST: APIRoute = async (context) => { ... }`.
- If `context.locals.user` is null → `401` `{ error: "unauthorized", message: "Login required." }`.
- Open `createClient(context.request.headers, context.cookies)`; if null → `503` `{ error: "supabase_unconfigured" }`.
- Parse JSON body; on failure → `400` `{ error: "bad_request" }`.
- Expect `{ accept: string[], reject: string[] }`. Validate both are arrays of strings; coerce missing to `[]`. Reject (→ `400` `{ error: "invalid_selection" }`) if either is not an array, if any element is not a non-empty string, or if `accept.length + reject.length` exceeds a defensive cap (e.g. `100`, comfortably above realistic batch sizes — note drafts are **not** capped at 10; see Performance Considerations).
- **Completeness guard (enforces "resolve the entire batch" server-side).** Before the rpc, fetch the caller's current draft ids: `supabase.from("cards").select("id").eq("status","draft")` (RLS scopes this to `auth.uid()`; no explicit `user_id` filter needed, matching `discard.ts`). Then require that the submitted selection resolves exactly that set:
  - `accept` and `reject` must be **disjoint** (no id in both).
  - The union `accept ∪ reject` must equal the fetched draft-id set (same membership, ignoring order) — every current draft is decided, and no id outside the caller's drafts is submitted.
  - If either check fails → `400` `{ error: "incomplete_selection", message: "Your draft list changed. Refresh and review again." }`. This blocks partial/crafted bodies from leaving orphan drafts and guarantees the "zero drafts remain afterward" end state even for non-UI callers. (The select also makes a stale tab — drafts appended elsewhere after page-load — fail closed with a refresh prompt rather than silently half-resolving.)
- Call `supabase.rpc("finalize_drafts", { p_accept_ids: accept, p_reject_ids: reject })`. Type the result via a local `interface FinalizeResult { saved_count: number; discarded_count: number }` and cast/`overrideTypes` (no `any`).
- On error → `500` `{ error: "db_error", message: "Could not save your selection." }`.
- On success → `200` `{ saved: row.saved_count, discarded: row.discarded_count }` (read the single returned row; default to `0/0` if the array is empty).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (typed `rpc` result, no unused imports, no `any`).
- `npm run build` passes.
- `npx astro sync` runs cleanly.

#### Manual Verification:

- With a valid session cookie and a selection covering **all** of the caller's current drafts (e.g. exactly two drafts exist): `curl -X POST -H 'Content-Type: application/json' -d '{"accept":["<id1>"],"reject":["<id2>"]}' http://localhost:4321/api/generations/save` returns `200` `{saved:1,discarded:1}`; Studio shows id1 now `status='saved'` with `next_due_at` set, id2 gone.
- Same `curl` without a session cookie returns `401` and changes nothing in DB.
- A body with a non-array `accept` returns `400` `invalid_selection`.
- A body that decides only **some** of the caller's drafts (e.g. one of three) returns `400` `incomplete_selection` and changes nothing (completeness guard).
- Passing another user's draft id (with user-A's session) returns `400` `incomplete_selection` — the id is not in user-A's fetched draft set, so the union check fails before the rpc — and leaves that row untouched. (Even if the guard were bypassed, RLS in the function would make it a no-op; the guard fails first.)
- A saved card from this flow shows `status='saved'`, `next_due_at` ≈ now, `interval_days=0`, `repetition_count=0`, `last_reviewed_at IS NULL`.

**Implementation Note**: This is the codebase's first `supabase.rpc()` call — during build, confirm PostgREST returns a single row for the `returns table (...)` shape (read `data?.[0]`, default `0/0`) and that the param keys `p_accept_ids` / `p_reject_ids` exactly match the migration signature; capture the working curl in Progress 2.4. After Phase 2's verification passes, pause for manual confirmation that the endpoint round-trips correctly (including the cross-user `incomplete_selection` rejection) before proceeding to Phase 3.

---

## Phase 3: Draft-review island + wire-in

### Overview

Replace the static draft list on `/generate` with an interactive React island that carries per-card Keep/Discard state (default Keep), shows a live save/discard summary, gates Save behind a confirm dialog, and POSTs the selection to `/api/generations/save`. Keep the "Discard all drafts" escape hatch.

### Changes Required:

#### 1. DraftReviewList island

**File**: `src/components/generate/DraftReviewList.tsx` (new)

**Intent**: The curation surface — the product wedge. Per-card accept/reject with immediate visual feedback, a batch confirm, and the atomic save call. Reuses the visual language and `fetch` + `assign('/generate')` flow of `PasteAndGenerateForm.tsx`.

**Contract**:
- Default export `DraftReviewList`, props `{ drafts: { id: string; front: string; back: string }[] }`.
- State: `decisions: Record<string, "accept" | "reject">` initialized with every draft id → `"accept"`; `submitting: boolean`; `error: { code: string; message: string } | null`.
- Derived: `acceptCount` / `rejectCount` from `decisions`.
- Each draft row: front (prominent) + back (muted), and a toggle to flip between Keep and Discard. A `"reject"` row is visually de-emphasized (dimmed / strike) so the pending discard is obvious. Toggling updates `decisions[id]`.
- A header/summary line: "N to save · M to discard".
- **Save to deck** button (disabled while `submitting`): on click, `window.confirm(\`Save ${acceptCount} to your deck and permanently discard ${rejectCount}? This can't be undone.\`)`; if confirmed, set `submitting`, build `accept`/`reject` id arrays from `decisions`, `fetch("/api/generations/save", { method:"POST", headers:{'Content-Type':'application/json'}, body: JSON.stringify({ accept, reject }) })`. Because `decisions` is initialized with every draft id, the built `accept`/`reject` arrays always cover the full batch, so the endpoint's completeness guard passes by construction in the normal flow. On `response.ok` → `window.location.assign("/generate")`. On non-OK → parse `{error,message}` (defensive try/catch, fallback-message map like `PasteAndGenerateForm`), set banner, clear `submitting`; include an `incomplete_selection` entry whose message prompts a refresh (it fires only if the draft set changed in another tab after load). On thrown fetch → `network_error` banner.
- **Discard all drafts**: a native `<form method="POST" action="/api/generations/discard">` with an `onSubmit` confirm (`Discard all ${drafts.length} drafts? This cannot be undone.`) — preserves the existing no-JS bulk-discard path; the server redirect to `/generate` works natively.
- Error banner shape matches `PasteAndGenerateForm` (red, `CircleAlert` icon, `error.message`).

#### 2. Wire the island into /generate

**File**: `src/pages/generate.astro`

**Intent**: Swap the static `drafts.length > 0` section (the header + discard form + `<ul>`) for the island, passing the server-fetched drafts as props. The server fetch (lines 18-30) is unchanged — it remains the authoritative source; the island just makes the rendered batch interactive.

**Contract**: Import `DraftReviewList`; replace the `{ drafts.length > 0 && (<section>…</section>) }` block (`generate.astro:59-87`) with `{ drafts.length > 0 && <DraftReviewList client:load drafts={drafts} /> }`. The island renders its own section wrapper, header/summary, list, Save button, and the discard-all form. The paste-form section (lines 89-92) and the Supabase/loadError banners are untouched.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (React Hooks + react-compiler rules satisfied; no `any`).
- `npm run build` passes.
- `npx astro sync` runs cleanly (island picked up by typegen).

#### Manual Verification:

- With a fresh draft batch, `/generate` shows each candidate with a Keep/Discard toggle, all defaulting to Keep; the summary reads "N to save · 0 to discard".
- Toggling a card to Discard updates its visual state and the summary counts.
- Clicking Save to deck shows the confirm dialog with the correct N/M; cancelling it leaves the batch unchanged.
- Confirming Save reloads `/generate` to the empty paste form; Studio shows the accepted cards as `status='saved'` (with `next_due_at` set) and the rejected ones gone.
- Saving a batch with everything kept saves all and discards none; saving with everything toggled to Discard saves none and removes all (and the page returns to empty).
- A forced endpoint failure (temporarily break the rpc name) shows the inline error banner and leaves the drafts intact (transaction rolled back) — clicking Save again works after the fix.
- "Discard all drafts" with its confirm wipes the batch and returns to an empty `/generate`.
- Renders correctly on Chrome plus one other browser (PRD §NFR).

**Implementation Note**: After Phase 3's verification passes, pause for manual confirmation that the full review → save loop is observably working on `npm run dev`, including one rolled-back failure, before proceeding to Phase 4.

---

## Phase 4: End-to-end manual verification on production

### Overview

Deploy and walk the closed loop on `https://10x-cards.rafsaw.workers.dev`, completing the PRD US-01 accept/reject half and confirming RLS still isolates two users.

### Changes Required:

#### 1. Deploy

**Where**: Push to `main` triggers Cloudflare auto-deploy (per roadmap §Baseline). No new secrets — S-02 adds no env.

**Contract**: `git push origin main` after Phase 3's commit; confirm the build is green in the Cloudflare dashboard. Fix forward on failure.

### Success Criteria:

#### Automated Verification:

- Production build succeeds (Cloudflare dashboard build log green).

#### Manual Verification:

- As `rls-test-a@example.invalid`: paste → generate a batch → toggle a couple to Discard → Save to deck. Land on empty `/generate`. (Saved cards live in DB with `status='saved'`; no library UI yet, so verify in Studio.)
- As `rls-test-b@example.invalid` (incognito): generate a batch; confirm user-A's in-flight/saved rows are never visible; save B's batch; confirm B's saves are isolated from A.
- Atomicity spot-check: in Studio, confirm there is no row left as `status='draft'` for a user who completed a Save (the batch fully resolved); and no accepted card is missing.
- RLS belt-and-braces: confirm via Studio that neither user's save/discard touched the other's rows.
- Take a screenshot of the review → save flow for the PR description.

**Implementation Note**: This is the gate where PRD US-01 (accept/reject + save half) and FR-006/007 are observably true on production — and the north star (PRD Primary Success Criterion validation milestone) is reached. Mark the change `status: implemented`. It is natural to `/10x-archive` S-01 and S-02 together now that the loop is closed.

---

## Testing Strategy

### Unit Tests

None. No test runner is configured (`AGENTS.md` §Testing), and the unit surface is thin: the function is SQL, the endpoint is auth/RLS/rpc orchestration, the island is state plumbing. The phase verification blocks substitute.

### Integration Tests

The manual blocks are the integration tests: Phase 1's `verify-finalize.sql` exercises the DB layer (function + RLS) on the same remote production reads from; Phase 2 curls the endpoint against a live session; Phase 3 walks the UI on `npm run dev`; Phase 4 re-walks it on production under two identities.

### Manual Testing Steps

1. Phase 1: run every block of `verify-finalize.sql` in remote Studio; confirm each matches its inline expected result.
2. Phase 2: curl `/api/generations/save` (valid session, no session, bad body, cross-user id); cross-check rows in Studio.
3. Phase 3: walk the review → confirm → save loop on `npm run dev`, including a deliberately-failed (rolled-back) save.
4. Phase 4: re-walk on production as user-A and user-B; confirm isolation and full batch resolution in Studio.

## Performance Considerations

The finalize is one round-trip to a single function doing two indexed writes (`cards_user_id_status_idx` covers the `(user_id, status)` scope; the `id = any(...)` predicates hit the PK). **Batch size is not bounded at 10.** S-01 caps each *generate* at 10 candidates but *appends* them to the caller's existing drafts (`generations.ts` inserts without clearing), and `generate.astro` loads **all** of the caller's `status='draft'` rows with no `.limit()`. So the review surface — and the `accept`/`reject` arrays — cover every pending draft (usually ≤10, but >10 after multiple generates before a save); the "N to save · M to discard" summary reflects that full set. The endpoint's defensive 100-id cap is sized for this. Bounding draft accumulation (e.g. blocking generate while drafts exist) is a separate product decision, out of S-02 scope. At PRD target scale (`users: small`, `qps: low`) no further tuning is warranted.

## Migration Notes

Forward-only: the migration only `CREATE`s a function — nothing to clobber, no backfill. Rollback = `drop function public.finalize_drafts(uuid[], uuid[]);` plus reverting the app commits; any cards already promoted to `saved` are valid library rows and are intentionally kept. Per F-01's workflow, if a function bug surfaces in Phase 1 verification, fix forward with a new migration rather than editing the applied file.

## References

- Change seed: `context/changes/atomic-save-to-deck/change.md`
- Roadmap source: `context/foundation/roadmap.md` (S-02, §Slices; Open Roadmap Question #3 on atomicity)
- PRD: `context/foundation/prd.md` US-01, FR-006, FR-007, §Business Logic (initial due-date on accept), §Guardrails (cross-user leakage ship-blocking)
- F-01 schema + RLS: `supabase/migrations/20260527150510_cards_and_account_deletion.sql`, `context/changes/cards-schema-and-rls/plan.md`, `context/changes/cards-schema-and-rls/verify-rls.sql` (test-user UUIDs + impersonation pattern)
- S-01 draft persistence + patterns: `context/changes/first-gated-generation/plan.md`, `src/pages/generate.astro`, `src/components/generate/PasteAndGenerateForm.tsx`, `src/pages/api/generations.ts`, `src/pages/api/generations/discard.ts`
- SSR Supabase client: `src/lib/supabase.ts:5-24`
- Lesson honored (route placement): `context/foundation/lessons.md` — S-02 keeps the action on the existing dedicated `/generate` route; no new page, `/dashboard` not further loaded.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Atomic finalize DB function + migration

#### Automated

- [ ] 1.1 `supabase db push` returns exit 0 and prints the new migration filename
- [ ] 1.2 `supabase migration list --linked` shows the migration applied on remote
- [ ] 1.3 `verify-finalize.sql` committed with real UUIDs (no `<...>` placeholders remain)
- [ ] 1.4 `npm run lint` and `npm run build` still pass

#### Manual

- [ ] 1.5 `public.finalize_drafts` exists in Studio with `security invoker` and `EXECUTE` granted to `authenticated`
- [ ] 1.6 Every block in `verify-finalize.sql` matches its expected result (happy path `1,1` + correct post-state; cross-user `0,0` with B untouched; idempotent re-run `0,0`)
- [ ] 1.7 After cleanup, `select count(*) from public.cards where user_id in (<A>, <B>);` as `service_role` returns 0 (fixture-scoped, not a global count)

### Phase 2: Save endpoint

#### Automated

- [ ] 2.1 `npm run lint` passes
- [ ] 2.2 `npm run build` passes
- [ ] 2.3 `npx astro sync` runs cleanly

#### Manual

- [ ] 2.4 `curl POST /api/generations/save` with a valid session + a selection covering all current drafts returns 200 `{saved,discarded}`; Studio confirms the promote + delete
- [ ] 2.5 Same `curl` without a session returns 401 and changes nothing
- [ ] 2.6 A non-array `accept` returns 400 `invalid_selection`
- [ ] 2.7 A selection covering only some of the caller's drafts returns 400 `incomplete_selection` and changes nothing
- [ ] 2.8 Passing another user's draft id returns 400 `incomplete_selection` and leaves that row untouched
- [ ] 2.9 A saved card shows `status='saved'`, `next_due_at`≈now, `interval_days=0`, `repetition_count=0`, `last_reviewed_at` NULL

### Phase 3: Draft-review island + wire-in

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 `npm run build` passes
- [ ] 3.3 `npx astro sync` runs cleanly

#### Manual

- [ ] 3.4 Draft batch renders with per-card Keep/Discard toggles defaulting to Keep; summary reads "N to save · 0 to discard"
- [ ] 3.5 Toggling a card to Discard updates its visual state and the summary counts
- [ ] 3.6 Save to deck shows the confirm with correct N/M; cancel leaves the batch unchanged
- [ ] 3.7 Confirming Save reloads to an empty `/generate`; Studio shows accepted=saved (next_due_at set), rejected gone
- [ ] 3.8 All-kept saves everything; all-discarded removes everything and returns to empty
- [ ] 3.9 A forced endpoint failure shows the error banner and leaves drafts intact (rolled back); retry works
- [ ] 3.10 "Discard all drafts" with confirm wipes the batch and returns to empty `/generate`
- [ ] 3.11 Renders correctly on Chrome and at least one other browser

### Phase 4: End-to-end manual verification on production

#### Automated

- [ ] 4.1 Production build succeeds after `git push origin main` (Cloudflare build log green)

#### Manual

- [ ] 4.2 User-A on live site completes paste → generate → review → Save and lands on empty `/generate`
- [ ] 4.3 User-B (incognito) never sees user-A's rows; B's saves are isolated
- [ ] 4.4 Atomicity spot-check in Studio: a completed Save leaves no `status='draft'` residue and no missing accepted card
- [ ] 4.5 RLS belt-and-braces: neither user's save/discard touched the other's rows
- [ ] 4.6 Screenshot of the review → save flow captured for the PR description
