# Execution plan — Dashboard "what now?"

**Date:** 2026-08-21
**Slug:** `dashboard-what-now`
**Branch:** `feat/dashboard-what-now`
**Base:** `main`
**Engine:** om-auto-create-pr (steps: 6, --loop: no)
**Source doc:** `.ai/specs/briefs/2026-08-21-dashboard-what-now.md`

## 🎯 Goal

Turn `/dashboard` from a welcome card that shows the signed-in e-mail into the screen that
answers *what should I do now?* — three server-side counts (cards due, drafts pending, saved
library size) resolved before the first byte, one priority rule picking the single primary
action, and markup for the seven states the brief enumerates.

## Scope

In scope — exactly the three files the brief's "Smallest coherent implementation scope" names:

- `src/lib/dashboard-state.ts` — **new.** One pure resolver, `resolveDashboardState(...)`,
  returning a discriminated union (`not-configured` / `error` / `read-only` / `review-waiting` /
  `drafts-waiting` / `caught-up` / `new-account`) plus the library-sentence flag. Follows the
  `src/lib/review-shortcuts.ts` precedent (`4a601cd`): a pure, unit-tested resolver whose page
  only translates the decision into markup.
- `src/lib/dashboard-state.test.ts` — **new.** The brief's state matrix case by case, including
  both singular boundaries.
- `src/pages/dashboard.astro` — **changed.** Three `head: true` count queries, one call into the
  resolver, markup per returned state.

### Autonomous decision recorded: copy helpers live in the resolver module

The brief says the resolver "contains the priority rule and nothing else", yet acceptance
criterion 8 requires that every sentence read in the singular at a count of one — a requirement
that is only testable without a browser if the pluralisation is a pure function. Resolution:
`resolveDashboardState` still contains only the priority rule, and four *separate* exported pure
helpers in the same module (`dueSentence`, `draftsWaitingSentence`, `alsoWaitingSentence`,
`librarySentence`) own the copy. No new file, no new component, and AC8 gets real coverage.

One string the brief does not spell out is derived here and flagged as such: the singular of the
"Also waiting" sentence. The brief gives the plural (`7 generated cards still need a
keep-or-discard decision.`) and forbids `card(s)`, so the singular is written
`1 generated card still needs a keep-or-discard decision.` (verb agreement `need` → `needs`).

### Autonomous decision recorded: all three counts run even in the read-only state

The read-only state suppresses the due and draft counts from the page, so two of the three
round-trips are unused for an account pending deletion. They are issued anyway: it keeps one
uniform query-and-error path instead of a second branch, the brief itself accepts
"three counts, three round-trips" as the cost, and pending-deletion is a rare transient state.

### Non-goals (explicitly not touched)

- `src/components/Topbar.astro`, `src/layouts/Layout.astro` — no changes of any kind.
- No API route under `src/pages/api/`, no migration, no schema change, no RPC.
- No new shared design-system component (`Card`, `Section`, `PageHeader`, `Stat`).
- No theme decision, no `.dark` class, no token migration, no theme toggle.
- No charts, streaks, scores, gamification or study statistics.
- No changes to Generate, Review, Library or Settings.
- No new `client:` island, no skeleton, no spinner — the page is server-rendered.
- `context/`, `.claude/settings.local.json`, secrets and QA credentials: untouched.
- No E2E spec in this PR (the brief marks one as a reasonable follow-up, not a merge gate).

## Security gate (runs first, by the brief's own instruction)

The brief's highest-consequence assumption is that RLS scopes the counts without an explicit
`user_id` filter — a count that ignored RLS would leak the *size* of another user's deck. It is
verified from the repository before a single query is written; the evidence is recorded in
Phase 1 below and reproduced in the PR summary comment.

## Implementation Plan

### Phase 1 — Security gate: confirm RLS scopes `cards` counts

Confirm, from migrations and application code in this repository (not from the fact that sibling
pages query the same way), that a `select ... count` on `public.cards` issued by the app's
client is restricted to the signed-in user. Record the file-and-line evidence in this plan. If
it cannot be confirmed, stop the run and report — do not write the queries.

### Phase 2 — The pure resolver and its tests

Write `src/lib/dashboard-state.ts` (priority rule + copy helpers) and
`src/lib/dashboard-state.test.ts` (the state matrix, the priority rule, both singular
boundaries, and the rule that a failed count never renders a zero). Tests are written from the
brief's acceptance criteria, never read back off the implementation.

### Phase 3 — The page

Rewrite `src/pages/dashboard.astro`: three `head: true` counts copying the shape at
`src/pages/library.astro:40`, one resolver call, and markup for the returned state — one `<h1>`,
`<h2>` section headings, every action an `<a href>`, counts in sentence text, error message
before the links it qualifies. Styling inherits the exact utility classes the sibling pages
already use; it introduces no new colour decision and extends no legacy recipe into a new
convention.

### Phase 4 — Full validation gate

Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` in order, all green.

## Risks

- **RLS is the single isolation layer** for these counts. Mitigated by the Phase 1 gate and by
  the existing static guard `test/no-service-role-in-src.test.ts`, which fails the suite if any
  `src/**` module ever reaches for a service_role key.
- **Copy drift.** Every user-visible string is transcribed from the brief; the one derived
  string is named above so a reviewer can overrule it.
- **Priority rule is a judgement call** (`[ASSUMPTION]` in the brief): due cards outrank drafts
  because reviews are time-sensitive and drafts are not. It lives in one pure function, so
  overturning it is a one-line change with a test.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Security gate

- [ ] 1.1 Verify from migrations and app code that RLS scopes `cards` SELECT/count to the signed-in user

### Phase 2: Resolver and tests

- [ ] 2.1 Add `src/lib/dashboard-state.ts` — priority rule and copy helpers
- [ ] 2.2 Add `src/lib/dashboard-state.test.ts` — the state matrix and both singular boundaries

### Phase 3: Page

- [ ] 3.1 Rewrite `src/pages/dashboard.astro` — three counts, one resolver call, per-state markup

### Phase 4: Validation

- [ ] 4.1 Run the full validation gate (typecheck, lint, build, test)
