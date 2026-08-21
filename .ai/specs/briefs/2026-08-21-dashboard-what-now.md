# Dashboard „what now?"

**Date:** 2026-08-21
**Status:** Proposed
**Type:** Product improvement (UI/UX modernization — strategy B, first increment)
**Origin:** `om-ux-shape` in Handoff mode
**Inputs:** `.ai/analysis/2026-08-21-ui-ux-review-phase2.md` (finding 2), `.ai/analysis/2026-08-21-ui-ux-redesign-strategy-phase3.md` (strategy B accepted), `.uxproof/`

## Intent

`/dashboard` stops being a welcome card and becomes the screen that tells a signed-in learner the state of their learning and what to do next, using data the app already queries elsewhere.

## Non-goals

- No charts, streaks, scores, gamification or study statistics.
- No API routes, no schema change, no RPC.
- No changes to `Topbar.astro` or `Layout.astro`.
- No new shared design-system component (`Card`, `Section`, `PageHeader`, `Stat`).
- No theme decision, no `.dark` class, no token migration.
- No changes to any flow the dashboard links into.

## Actor and trigger

A signed-in learner arriving at `/dashboard` — by the post-login redirect from `src/pages/index.astro:5`, by the `Dashboard` nav link, or by the `← Dashboard` link every other page carries.

**Reader assumption:** written for someone who was not in the conversation and does not know the design system. Every string below is the string the user reads.

## Problem

The screen a user lands on after every login shows their own e-mail address and the sentence „Use the navigation above to generate, review, or browse your cards." It carries no product data. At the moment of the Phase 2 browser walk the account had **12 unsaved drafts and cards due for review**, and the dashboard mentioned neither. The application already counts all three numbers — on other pages.

## Behavior

The page answers one question — _what should I do now?_ — and its layout follows the answer, not the data model. Three counts resolve on the server before the HTML is sent, then one rule decides which becomes the primary action.

### The priority rule: due cards outrank pending drafts

Reason, recorded so it can be argued with later: a review is time-sensitive — a card due today and reviewed in three days degrades the interval the whole product depends on. Drafts are not time-sensitive; they sit in `status=draft` indefinitely at no cost. So when both are waiting, review is the action and drafts are the reminder.

`[ASSUMPTION]` — reviewer judgment, falsifiable by the capture-loop test named in Phase 3.

### Sections, in DOM and visual order

1. **Page heading** — `<h1>Dashboard</h1>`. Kept as-is deliberately: every sibling page has an `<h1>` matching its nav item (`Generate cards`, `Card library`, `Review session`, `Settings`), and changing page identity belongs to the product-identity work (Phase 2, finding 10), not to this increment.
2. **Next up** — the single primary action. Always present except in the read-only and error states.
3. **Also waiting** — rendered _only_ when a second pending item exists. Never more than one.
4. **Your library** — one sentence of context plus a link. Not an action.

Nothing else. A section with nothing to say is not rendered; an empty section is worse than no section.

## State matrix

`D` = cards due now, `F` = drafts pending, `L` = saved cards in library.

| State               | Trigger                            | What the user sees                                                                                                                                                                                                                          | What they can do                                                                                    |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Review waiting**  | `D > 0`                            | `<h2>Next up</h2>` · `12 cards are due for review.` (singular: `1 card is due for review.`)                                                                                                                                                 | Primary link **`Start review session`** → `/review`                                                 |
| **Drafts waiting**  | `D = 0`, `F > 0`                   | `<h2>Next up</h2>` · `7 generated cards are waiting for your decision.` (singular: `1 generated card is waiting for your decision.`)                                                                                                        | Primary link **`Review drafts`** → `/generate`                                                      |
| **Both waiting**    | `D > 0`, `F > 0`                   | Review block as above, then `<h2>Also waiting</h2>` · `7 generated cards still need a keep-or-discard decision.`                                                                                                                            | Primary **`Start review session`** → `/review`; secondary link `Review drafts` → `/generate`        |
| **All caught up**   | `D = 0`, `F = 0`, `L > 0`          | `<h2>All caught up</h2>` · `Nothing is due right now. Cards come back when their interval is up.`                                                                                                                                           | `Generate more cards` → `/generate`; `Browse library` → `/library`                                  |
| **New account**     | `D = 0`, `F = 0`, `L = 0`          | `<h2>Start your first deck</h2>` · `You have no cards yet. Paste a passage and 10xCards drafts question-and-answer cards for you to review before anything is saved.`                                                                       | Primary **`Create your first cards`** → `/generate`; secondary `Or add a card by hand` → `/library` |
| **Library context** | `L > 0`, with any of the above     | `Your library holds 24 saved cards.` (singular: `1 saved card`)                                                                                                                                                                             | Link `Browse library` → `/library`                                                                  |
| **Read-only**       | `Astro.locals.isReadOnly`          | `<h2>Your account is read-only</h2>` · `While deletion is pending you can browse your cards, but you can't review, generate, or edit them. Cancel the deletion in the banner above to continue.` Library sentence still shown when `L > 0`. | Only `Browse library` → `/library`. No review, generate or draft actions rendered.                  |
| **Load error**      | any count query returns an error   | `<h1>Dashboard</h1>` unchanged · `We couldn't load your dashboard right now. Try refreshing the page.` followed by three plain links                                                                                                        | `Start review session`, `Generate cards`, `Browse library` — all still reachable                    |
| **Not configured**  | `createClient(...)` returns `null` | `Supabase is not configured — your dashboard cannot be loaded.` (same wording pattern as `library.astro` and `generate.astro`)                                                                                                              | Nothing; an operator problem, not a user one                                                        |
| **Loading**         | —                                  | **No loading state exists and none should be added.**                                                                                                                                                                                       | —                                                                                                   |

Three rows are decisions, not omissions:

**On loading.** `/dashboard` is server-rendered (`output: "server"`); all three counts resolve before the first byte reaches the browser. The perceived wait is browser navigation itself. Do not add a skeleton, spinner or `client:` island — if the counts ever feel slow, the fix is the query, not a placeholder.

**On the error row.** Never render zeros when a query failed. `0 cards are due for review` after a failed count is a lie that stops someone from studying; a message plus working links is worse-looking and safer. Mirrors the `loadError` flag pattern at `src/pages/library.astro:44`.

**On read-only.** The retention banner with its `Cancel deletion` control is already rendered globally by `Layout.astro`, so this section explains the restriction and points at it rather than duplicating the control. Counts for blocked actions are suppressed — `12 cards are due` next to a dead action is a tease.

## Data — existing patterns only, no API change

Three `head: true` counts in the page frontmatter, copying the shape already used at `src/pages/library.astro:40`:

```ts
const supabase = createClient(Astro.request.headers, Astro.cookies);
const nowIso = new Date().toISOString();

// due now — same predicate as src/pages/review.astro:14-17
.from("cards").select("id", { count: "exact", head: true })
  .eq("status", "saved").lte("next_due_at", nowIso)

// drafts pending — same predicate as src/pages/generate.astro
.from("cards").select("id", { count: "exact", head: true })
  .eq("status", "draft")

// library size — same predicate as src/pages/library.astro
.from("cards").select("id", { count: "exact", head: true })
  .eq("status", "saved")
```

No `user_id` filter: row-level security scopes every read to the signed-in user at the database level (foundation slice F-01), exactly as the three sibling pages already rely on. `head: true` means no rows cross the wire, only the count.

## Styling constraint

This increment introduces **no new colour decisions**. It reuses the exact surface, border and text utility classes the sibling pages already use, so that when the design system is unified later, the dashboard is restyled by the same single sweep as every other screen instead of becoming a second thing to migrate.

It must **not** extract a shared `Card`, `Section`, `PageHeader` or `Stat` component. Creating one now would freeze the inherited starter recipe into a house convention, which `.uxproof/conventions.md` explicitly forbids under _legacy starter styling — do not extend_. New markup uses layout, spacing and typography utilities only.

No theme toggle, no `.dark`, no token migration. `[PRODUCT]` — design contract, manual section.

## Accessibility and content requirements

- One `<h1>` per page; every section heading is an `<h2>`.
- Every action navigates, so every action is an `<a href>`, never a `<button>`. Styling one as a button is fine; changing its element is not.
- Counts live in sentence text. Never convey „12 due" through size, weight or colour alone.
- Singular and plural are both written above; no `card(s)`.
- The error message precedes the links in DOM order, so it is read before the choices it qualifies.
- No live region is needed anywhere: all content is present at page load.
- Copy is English, matching every existing product string. Noted but out of scope: the config-error banner in `Layout.astro` is Polish while the product is English — an inconsistency belonging to the identity work.

## Assumptions to confirm

- **Three counts, three round-trips** to remote Supabase on every dashboard load. Assumed acceptable because `library.astro` already performs one on every load. Folding them into a single grouped query is a later optimisation; it would be a data-layer change and is out of scope here.
- **RLS scopes counts without an explicit filter.** Assumed from F-01 and from the three sibling pages doing exactly this. Worth one deliberate check during implementation — a count that ignored RLS would leak the _size_ of another user's deck. **Highest-consequence item on this list; verify in the first phase, not the last.**
- **`next_due_at` is populated for every saved card**, including manually created ones, so „due" is meaningful for a user who never touched AI generation. Assumed from S-03 and S-04.
- **Drafts never expire**, so `F` can grow without bound and the sentence must read sensibly at 50+.

## Acceptance criteria

1. **Given** a signed-in user with 12 cards due and no drafts, **when** they open `/dashboard`, **then** the page states that 12 cards are due and offers `Start review session` linking to `/review`.
2. **Given** a signed-in user with 0 due and 7 drafts, **when** they open `/dashboard`, **then** the primary action is `Review drafts` linking to `/generate`, and no review action is offered.
3. **Given** a signed-in user with 12 due and 7 drafts, **when** they open `/dashboard`, **then** `Start review session` is the primary action and the drafts appear once under `Also waiting`, not as a competing primary action.
4. **Given** a signed-in user with saved cards but nothing due and no drafts, **when** they open `/dashboard`, **then** the page says nothing is due and offers `Generate more cards` and `Browse library`.
5. **Given** a brand-new account with no cards and no drafts, **when** they open `/dashboard`, **then** the page explains what the product does in one sentence and offers `Create your first cards`; no count of zero is displayed anywhere.
6. **Given** any count query fails, **when** the page renders, **then** no numeric count is shown, the message `We couldn't load your dashboard right now. Try refreshing the page.` is shown, and links to review, generate and library are still present and working.
7. **Given** an account pending deletion, **when** they open `/dashboard`, **then** the review, generate and draft actions are absent, the read-only explanation is shown, and `Browse library` still works.
8. **Given** exactly one due card, one draft, or one saved card, **when** the page renders, **then** every sentence reads in the singular.
9. **Given** any of the above, **when** the page is viewed at 390 px wide, **then** the document does not scroll horizontally.
10. **Given** the page renders successfully, **when** its HTML is inspected, **then** it contains no `client:` island and no skeleton or spinner markup.

## Smallest coherent implementation scope

Three files, one of them a test:

| File                              | Change                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/dashboard-state.ts`      | **new** — one pure function `resolveDashboardState({ configured, loadError, isReadOnly, dueCount, draftCount, libraryCount })` returning a discriminated union: `not-configured` / `error` / `read-only` / `review-waiting` / `drafts-waiting` / `caught-up` / `new-account`, plus the library-sentence flag. Contains the priority rule and nothing else. |
| `src/lib/dashboard-state.test.ts` | **new** — the state matrix above, case by case, including both singular boundaries.                                                                                                                                                                                                                                                                        |
| `src/pages/dashboard.astro`       | **changed** — three count queries, one call into the resolver, markup for the returned state.                                                                                                                                                                                                                                                              |

Why a separate resolver rather than inline logic: the repo already does exactly this, for exactly this reason. `src/lib/review-shortcuts.ts` is a pure, unit-tested resolver whose component only translates its decision into calls — the pattern shipped with the keyboard-shortcuts change (`4a601cd`). Following it keeps the seven-state matrix testable without a browser and keeps the page thin.

**Not in scope, deliberately:** no new component in `src/components/`, no route under `src/pages/api/`, no migration, no change to `Topbar.astro` or `Layout.astro`, no E2E spec required for merge — though one covering criteria 1 and 5 would be a reasonable follow-up under `tests/e2e/` using the existing unique-id seeding convention.

**Validation gate:** the repo standard — `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`.

## Open decisions

1. **The priority rule** — due before drafts. Stated with its reason so it can be overturned deliberately; the capture-loop test from Phase 3 is what would overturn it.
2. **Whether the caught-up state should offer a practice or cram mode.** A separate product question about the review model itself; this increment deliberately does not answer it and its copy does not foreclose it.
3. **Whether `<h1>` stays `Dashboard`.** Tied to product identity (Phase 2, finding 10) and to the shell work, not to this increment.

## Applied

AI necessity gate: not applicable — the dashboard uses no AI; the one sentence framing the generation feature in the new-account state follows the lead-with-the-benefit rule rather than naming the technology, and is currently the product's only first-contact framing. Human-AI checklist: not applicable for the same reason. Value metrics: task success — sessions started from the dashboard rather than the nav, with pending-draft backlog as the secondary signal. Design contract: loaded — 67 tokens, 15 components, 0 archetypes; no registry component fits; the legacy-styling rule is honoured by inheriting rather than extending. Quality rubric: passed.
