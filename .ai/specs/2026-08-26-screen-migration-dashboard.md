# Screen migration: `/dashboard` to Paper, and its two tiers re-derived without glass

**Status:** ready to plan
**Source brief:** `.ai/specs/briefs/2026-08-26-screen-migration-dashboard.md` (Increment 8 — Strategy C, screen migration, last one)
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Follows:** Increment 7, `/library` (`288c44e`, PR #40)

## 📝 TLDR

Migrate `src/pages/dashboard.astro` — the screen every login lands on, and the last legacy
signed-in product screen — from the `bg-cosmic` glass recipe to Paper, and rebuild its load-bearing
two-tier "what should I do now?" hierarchy out of Paper's own vocabulary. Paper has no glass, no
gradient and no panel-as-elevation, so the tiers are re-derived from four non-colour cues: position,
type size, text colour and control weight. Tier 1 becomes a **lead** — a `text-meta` uppercase
eyebrow over a `text-title` statement at full `--foreground`, plus the page's single filled
`Button`. Tier 2 becomes hairline-separated **notes** — the same quiet eyebrow, a `text-sm
text-muted-foreground` body, an underlined text link and nothing else.

Two new page-local components carry those recipes (`DashboardLead.astro`, `DashboardNote.astro`);
`PageHeader` and `Notice` are reused for the header and for the read-only, load-error and
not-configured states. **No data behaviour moves:** `src/lib/dashboard-state.ts` and its unit tests
are frozen byte-for-byte, as are the three count queries, the `Promise.all`, the `try`/`catch` and
the "never render a zero after a failed query" rule. `tests/e2e/` must pass **unmodified**.

`bg-cosmic` is removed from `dashboard.astro` and **from nowhere else** — the utility itself, the
`Layout.astro` `<body>` class, `Welcome.astro` and the three auth pages are the next increment.

## 📝 Resolved gate decisions

The four Open Questions raised on the skeleton are resolved as follows. They are recorded here so
they are decisions of record, not drift discovered at review.

**Q1 — the read-only heading: `Notice title`.** `read-only` renders
`<Notice variant="warning" title="Your account is read-only">` with the existing deletion-pending
sentence as the body. Both user-visible strings survive verbatim. The `<h2>` does not: `Notice`
renders its title as `<p class="font-bold">` (`Notice.tsx:44`), so the document outline loses one
entry on this one state. That is accepted, and **AC9 is therefore scoped to user-visible copy, not
to identical HTML structure** — the whole increment rewrites structure by definition. The
alternatives were dropping the string (matches `/library` and `/generate`, but deletes copy this
increment promised not to touch) and an eyebrow `<h2>` above the `Notice` (keeps the outline, costs
a third recipe on a page that otherwise has two). Preserving the copy at the cost of one outline
entry is the smaller loss, and `Notice` supplies the `role="status"` / `aria-live="polite"` the bare
paragraph never had, which is a net accessibility gain on this state.

`Notice` varies both attributes by variant — `role = variant === "error" ? "alert" : "status"` and
the matching `aria-live` at `Notice.tsx:31–32` — so AC7's `role="status"` on the warning and AC8's
`role="alert"` / `aria-live="assertive"` on the error are satisfied by the same component with no
prop and no fork. Verified against the shipped source; recorded here so it is not re-raised.

**Q2 — the measure: `max-w-content` (66ch).** The page joins `/generate`, `/review` and `/settings`
rather than `/library`. `/library` kept `max-w-3xl` because its rows carry trailing actions and do
not read as prose (Increment 7's recorded Q3b exception); `/dashboard` is three short sentences and
some links, which is exactly the reading column `--container-content` (`global.css:251`) exists for.
This is a **visible desktop layout change** and is flagged as such for review.

**Q3 — the eyebrow: plain `text-meta`, no `font-medium`.** The recipe is copied verbatim from the
shipped evidence at `ReviewSession.tsx:205` — `text-meta text-muted-foreground tracking-wide
uppercase` — with sans substituted for serif on the statement below it. No weight is added ahead of
the walkthrough. If the eyebrow reads as a stray caption once seen unbounded, `font-medium` plus
more space below it is the recorded fallback (**never** a surface fill or a shadow, which principles
1 and 4 forbid). Taking that fallback is a one-line change to the two components — **and it amends
AC4 and the matching guard assertion in the same commit**, both of which currently require the
weight's absence. The escape hatch and the criterion move together; neither is left contradicting the
other, and the PR records which way it went.

**Q4 — the guard test: `src/components/dashboard/dashboard-paper.test.ts`.** It follows Increment
7's `library-paper.test.ts` and sits beside the two new components it also guards, rather than
guarding a page from `src/pages/`. It reads `dashboard.astro` by relative path like its predecessors
do.

## 📝 Problem Statement

Measured on `main` at `aa9bc2c`, over `src/` only:

| Screen           | Status              | Legacy colour utilities                  |
| ---------------- | ------------------- | ---------------------------------------- |
| `/settings`      | Paper (Increment 4) | 0                                        |
| `/generate`      | Paper (Increment 5) | 0                                        |
| `/review`        | Paper (Increment 6) | 0                                        |
| `/library`       | Paper (Increment 7) | 0                                        |
| **`/dashboard`** | **legacy**          | **15 palette-scale; 20 pattern matches** |

`/dashboard` is the last legacy signed-in product screen, and the one every login lands on. Its
270-line source hoists eleven class strings into `const`s at lines 92–113, which is why its legacy
footprint looks small in a grep: `text-blue-100` ×3, `from-blue-500` ×2, `to-purple-500` ×2,
`from-blue-200`, `to-purple-200`, `text-red-300`, `border-red-500`, `bg-red-900`, `border-white/20`,
`border-white/10`, `bg-white/10`, plus `bg-cosmic`, `backdrop-blur-xl`, `rounded-2xl` and
`bg-gradient-to-r` ×2.

**The hierarchy those utilities build is product behaviour, not decoration.** The comment at
`dashboard.astro:84–91` records why: the UX review of PR #31 found every section rendering at an
identical 20px/600 heading inside an identical card, with a 30 %-opacity gradient on one button as
the only cue that anything outranked anything else — so `Next up` did not read as the answer to the
question the screen exists to answer. The fix shipped then was **exactly one section per state as a
card with the gradient action, and everything else quiet text**:

| Tier                                      | Legacy expression                                                                                                                                                                                           | Lines   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **Tier 1** — the answer to "what now?"    | `rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl` card, `text-xl font-semibold` heading, `text-blue-100/80` body, link filled with `bg-gradient-to-r from-blue-500/30 to-purple-500/30` | 95–99   |
| **Tier 2** — the reminder and the context | no card, `px-6` to align with the card's inner text, `text-base font-semibold` heading, `text-sm text-blue-100/70` body, underlined `text-blue-100/80` link                                                 | 106–110 |

Three of Paper's eight principles delete the cues that expression is built from: principle 1 bans
`backdrop-blur-*` and any gradient background or fill, principle 3 bans gradient-filled text,
principle 4 bans a bordered panel read as elevation. **A token swap cannot carry this screen
across** — the hierarchy has to be re-derived, and that derivation is the whole of this increment.

Two secondary defects come along for free. The `not-configured` and `error` states render through a
bespoke red `noticeClass` (`dashboard.astro:113`) — a bare `<p>` with no `role` and no `aria-live`,
announced to nobody. The `read-only` state is likewise a bare paragraph. All three states are the
ones where announcement matters most.

## 📝 Proposed Solution

A presentation-layer migration of one page plus two new page-local components, with the data layer
explicitly fenced. Everything that decides _what happens_ is untouched; everything that decides
_what it looks like_ is rewritten against the Paper tokens and the shipped primitives.

### The hierarchy: three candidates, one built

**A — a hairline `Section` per tier, tier 1 first. Rejected.** `Section` renders its `<h2>` at
`text-title font-semibold` (20px), the largest step on the page below the `<h1>`. Two `Section`s
means two 20px semibold headings — the PR #31 finding, reproduced in Paper. Worse, a tier-1 body at
`Section`'s `text-sm text-muted-foreground` description size would leave the _heading_ outweighing
the _sentence that states what is due_, against principle 3.

**B — one filled `Button` and nothing else. Rejected.** Principle 5 already gives the page exactly
one filled button, so the button alone separates one block from two, not three blocks from each
other. It leaves `Also waiting` and `Your library` indistinguishable, and it does nothing at all in
the two states that legitimately have no primary action (`read-only`, `error`).

**C — content-first lead, hairline notes below. Built.** Tier 1 becomes a _statement_ that is the
largest and highest-contrast text on the page, labelled by a small uppercase eyebrow and followed by
one filled `Button`. Tier 2 becomes hairline-separated notes whose headings use the same quiet
eyebrow, whose bodies are small and muted, and whose only control is an underlined text link.

**Decisive trade-off.** C is the only option that separates the tiers with _four_ independent,
non-colour cues — position, type size, text colour, control weight — so the hierarchy survives
greyscale, a high-contrast setting, and dark mode being applied later. It costs one thing:
`Section`, the primitive four other screens use, does not appear on `/dashboard` at all. That is a
deliberate, recorded departure of the same kind `/review` already made ("No `Section` wrapper here,
deliberately diverging from /generate", `review.astro:38–42`).

### The recipe is already shipped

`ReviewSession.tsx:205–206` renders precisely this label/statement pair for a flashcard's front
face:

```tsx
<p className="text-meta text-muted-foreground tracking-wide uppercase">Front</p>
<p className="text-foreground text-title mt-1 font-serif break-words">{card.front}</p>
```

`/dashboard` reuses it with **one** change: sans, not serif. `--font-serif` carries card content and
prose; a dashboard sentence is system chrome reporting a count, not card content, and
`global.css:224–225` splits the two families on exactly that line. Everything else is copied
verbatim.

**Why an eyebrow rather than a normal `<h2>`:** the headings (`Next up`, `Also waiting`, `Your
library`) label blocks whose _content_ is one short sentence. Rendering the label bigger than the
sentence is the inversion principle 3 names. Demoting the label visually does not demote it
structurally — it stays an `<h2>`, so the document outline and screen-reader navigation are
unchanged from today on every state except `read-only` (see Q1).

### Two rejections recorded so they are not re-proposed at review

**`new-account` uses the lead, not `EmptyState`.** `EmptyState` is the obvious reach — `/review`
already renders "All caught up!" through it — and it is wrong here twice over. First, `/dashboard`
is never empty in the sense `EmptyState` means: it always answers "what now?", and on a brand-new
account that answer is the strongest call to action in the product. `EmptyState` renders it centred
with the body at `text-sm text-muted-foreground`, demoted below every other state's statement.
Second, it puts a third recipe on a page that otherwise has two.

**No new registry primitive.** `DashboardLead` and `DashboardNote` have exactly one consumer page
and no second screen wants either, so they stay under `src/components/dashboard/` and are _not_
promoted to `src/components/ui/` — the same call Increment 7 made for `LibrarySearch.astro`. Both
are `.astro` rather than `.tsx` because neither takes a React node in a prop; the split established
by `LibrarySearch.astro` versus `LibraryEmpty.tsx` decides that.

## 📝 Architecture

Three files change or appear; nothing else in `src/` is touched.

### 1. Page frame — `src/pages/dashboard.astro`

The frontmatter above line 84 is **unchanged**: the `createClient` call, the three counts, the
`Promise.all`, the `try`/`catch`, `resolveDashboardState`, and `libraryText`. Lines 84–113 — the
comment block and all eleven class `const`s — are deleted; the comment's _reasoning_ is preserved in
a shorter note that points at this spec, since the two-tier requirement it records still holds and
its new expression is what changed.

|                 | Before                                                          | After                                            |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| Outer wrapper   | `bg-cosmic min-h-screen p-4`                                    | `bg-background text-foreground min-h-screen p-4` |
| Inner container | `mx-auto max-w-3xl space-y-6 py-8`                              | `max-w-content mx-auto space-y-6 py-8`           |
| Header          | `<header><h1 class:list={headingClass}>Dashboard</h1></header>` | `<PageHeader title="Dashboard" />`               |

`space-y-6` is kept as-is — it matches `/generate` and `/review`, the other single-region pages.
`PageHeader` no longer owns a width clause (deleted in Increment 7), so the page's own
`max-w-content mx-auto` governs both header and body, and their left edges align.

**The accessible name `Dashboard` must survive verbatim.** It is the `<h1>` every sibling page pairs
with its nav item, `Topbar.astro:9` uses the same word, and `auth.setup.ts:67` loads the route as a
post-sign-in smoke check.

### 2. `src/components/dashboard/DashboardLead.astro` (new)

```astro
---
interface Props {
  label: string;
  statement: string;
}
const { label, statement } = Astro.props;
---

<section class="space-y-3">
  <h2 class="text-meta text-muted-foreground font-sans tracking-wide uppercase">{label}</h2>
  <p class="text-foreground text-title font-sans">{statement}</p>
  <div class="flex flex-wrap items-center gap-3"><slot /></div>
</section>
```

It is the first thing under the header and carries **no top hairline** — that absence is what says
"this is not one of a list of sections". Actions go in the default slot, so a caller passes a filled
`Button` plus an underlined link without the component knowing about either. Four call sites, one
file: the duplication principle 8 objects to, extracted; one consumer page, so not promoted.

### 3. `src/components/dashboard/DashboardNote.astro` (new)

```astro
---
interface Props {
  label: string;
}
const { label } = Astro.props;
---

<section class="border-border space-y-1 border-t pt-4">
  <h2 class="text-meta text-muted-foreground font-sans tracking-wide uppercase">{label}</h2>
  <p class="text-muted-foreground text-sm"><slot /></p>
</section>
```

Body and link go in the slot. **The hairline is what separates a note from the lead**, and it is the
only separator on the page — principle 4, one border token, no shadow anywhere.

The legacy `px-6` alignment hack (`dashboard.astro:104–106`, "matches the card's inner padding, so a
subordinate section's text starts on the same left edge as the primary card's text") is **deleted**.
It existed only because tier 1 was a padded card; with no card, every block already starts on the
same left edge.

### 4. Reused primitives and shipped recipes

| Need                               | Recipe                                                   | Evidence                                             |
| ---------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Page title                         | `<PageHeader title="Dashboard" />`                       | `PageHeader.tsx`; `library.astro:93`                 |
| Filled action                      | `<Button asChild><a href="…">…</a></Button>`             | `LibraryEmpty.tsx:17` ships `asChild` over an anchor |
| Text link                          | `class="text-link text-sm underline underline-offset-4"` | `library.astro:119`, `LibrarySearch.astro:28`        |
| Read-only / error / not-configured | `<Notice variant="warning" \| "error">`                  | `library.astro:95,102`; `Notice.tsx`                 |

The link recipe is underlined so a link is identifiable without colour (WCAG 2.2 §1.4.1). Every
action on this page navigates, so every one is an `<a href>` and never a `<button>`.

**`Button asChild` with the default (filled) variant is this repo's first use** — `LibraryEmpty`
ships it only with `variant="outline"`. The mechanism is variant-agnostic (`button.tsx:44` picks a
Radix `Slot` before `buttonVariants` is evaluated at line 47), so no failure is expected; it is
verified in Phase 2 Step 5 before four call sites rely on it. If the class merge misbehaves, the
fallback is to wrap the anchor rather than restyle the button.

One recorded wart: `buttonVariants`' `default` variant carries `shadow-xs` (`button.tsx:14`).
Principle 4 bans shadow as an elevation cue, and the shipped guard tests assert `shadow-[a-z]` is
absent from _migrated_ files — `button.tsx` is not in any migrated-file list, has always been
excluded, and this increment does not change that. It is noted so it is not mistaken for something
this increment introduced. Removing it belongs with the primitives sweep, not here.

## 📝 UI/UX

The page keeps its DOM order, its state machine and every string it renders today. Structure: page
frame → at most one lead or notice → zero or more notes.

### The four leads

| State            | `label`                 | `statement`                                                                                                                        | Slot                                                                                                 |
| ---------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `review-waiting` | `Next up`               | `dueSentence(state.dueCount)`                                                                                                      | filled `Start review session` → `/review`                                                            |
| `drafts-waiting` | `Next up`               | `draftsWaitingSentence(state.draftCount)`                                                                                          | filled `Check generated cards` → `/generate`                                                         |
| `caught-up`      | `All caught up`         | `Nothing is due right now. Cards come back when their interval is up.`                                                             | filled `Generate more cards` → `/generate`                                                           |
| `new-account`    | `Start your first deck` | `You have no cards yet. Paste a passage and 10xCards drafts question-and-answer cards for you to review before anything is saved.` | filled `Create your first cards` → `/generate`, then underlined `Or add a card by hand` → `/library` |

### The two notes

- **`Also waiting`** — inside `review-waiting` only, only when `state.alsoWaitingDrafts !== null`.
  Body `alsoWaitingSentence(state.alsoWaitingDrafts)`, then
  `<a href="/generate" class="text-link text-sm underline underline-offset-4">Check generated cards</a>`.
- **`Your library`** — whenever `libraryText !== null`. Body `{libraryText}` followed by the
  same-recipe `Browse library` link, inline in the sentence exactly as today.

### The three notice states

- **`read-only`** — `<Notice variant="warning" title="Your account is read-only">` with the existing
  sentence as the body ("While deletion is pending you can browse your cards, but you can't review,
  generate, or edit them. Cancel the deletion in the banner above to continue."). Principle 6 assigns
  `warning` to "pending-or-read-only", and `/library`, `/generate` and `/review` all already render
  this account state through `Notice variant="warning"`. The existing conditional stays: when the
  library note below does not render (`libraryText === null`), `Browse library` is passed as the
  `Notice`'s `action`; when it does render, the link is not repeated.
- **`not-configured`** — `<Notice variant="error">Supabase is not configured — your dashboard cannot
be loaded.</Notice>`.
- **`error`** — `<Notice variant="error">We couldn't load your dashboard right now. Try refreshing
the page.</Notice>`, then the three links (`Start review session` → `/review`, `Generate cards` →
  `/generate`, `Browse library` → `/library`), each in the text-link recipe, in a
  `flex flex-wrap items-center gap-3` row. The glass `<section>` wrapper is deleted; the message
  still precedes the links in DOM order, so it is read before the choices it qualifies, and **none of
  the three is a filled button** — no count survived the failure, so nothing outranks anything else.

### The one filled button

Across every state the page renders **at most one** `<Button>` with the default (filled) variant,
and it is always the lead's action. Principle 5 is satisfied by construction, and it is what makes
the lead legible as the answer to "what now?" even to someone who reads no headings.

### The ten states

`D` = due, `F` = drafts, `L` = library. Copy is unchanged from `main` throughout.

| State           | Trigger                        | What the user sees                                                                                                                                                                                     |
| --------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Review waiting  | `D > 0`, `F = 0`               | Eyebrow `Next up`; `12 cards are due for review.` at `text-title`; one filled `Start review session`                                                                                                   |
| Both waiting    | `D > 0`, `F > 0`               | The same lead, then a hairline note `Also waiting` with an underlined `Check generated cards` — never two peers                                                                                        |
| Drafts waiting  | `D = 0`, `F > 0`               | Eyebrow `Next up`; the drafts sentence; one filled `Check generated cards`                                                                                                                             |
| All caught up   | `D = 0`, `F = 0`, `L > 0`      | Eyebrow `All caught up`; the interval sentence; one filled `Generate more cards`; library note below                                                                                                   |
| New account     | `D = 0`, `F = 0`, `L = 0`      | Eyebrow `Start your first deck`; the product explanation at `text-title`; filled `Create your first cards` plus underlined `Or add a card by hand`. No note renders; no count of zero appears anywhere |
| Library context | `L > 0`, with any of the above | Hairline note `Your library` with an inline underlined `Browse library`. Context, not an action                                                                                                        |
| Read-only       | `Astro.locals.isReadOnly`      | `Notice variant="warning"` titled `Your account is read-only`; library note still shown when `L > 0`; no review, generate or draft action anywhere                                                     |
| Load error      | any count query errors/throws  | `Notice variant="error"` then three underlined links                                                                                                                                                   |
| Not configured  | `createClient(...)` → `null`   | `Notice variant="error"`. An operator problem, not a user one                                                                                                                                          |
| Loading         | —                              | **None, deliberately.** Server-rendered; all three counts resolve before the first byte. No skeleton, no spinner, no `client:` island                                                                  |

## 📝 Edge Cases & Failure Scenarios

| Scenario                                         | Behaviour                                                                                                                      | Unchanged from `main`?                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A count query returns `{ error }`                | `loadError = true`; no numeric count renders anywhere; `Notice variant="error"` + three links                                  | Yes — logic frozen                                                                                                                                           |
| Transport failure throws (DNS/TLS/dropped conn.) | `catch` sets `loadError`; same as above, never a 500                                                                           | Yes                                                                                                                                                          |
| `createClient` returns `null`                    | `not-configured` `Notice variant="error"`                                                                                      | Yes                                                                                                                                                          |
| Read-only **and** `L > 0`                        | `Notice` without an `action`; `Your library` note carries the only `Browse library`                                            | Yes — conditional preserved                                                                                                                                  |
| Read-only **and** `L = 0`                        | `Notice` with `Browse library` as its `action`                                                                                 | Yes                                                                                                                                                          |
| Both-waiting at 390 px                           | Lead's `flex flex-wrap` wraps; note's hairline spans the container; no horizontal scroll                                       | New markup. `mobile-nav.spec.ts` automates the scroll check for whatever state its seeded user is in; the other nine states are AC11's manual pass (step 13) |
| A very long statement                            | `text-title` sans wraps inside `max-w-content`; no `break-words` needed — every statement is generated prose, never user input | New                                                                                                                                                          |
| Eyebrow reads as a stray caption unbounded       | Fallback: `font-medium` + more space below. **Never** a surface fill or shadow                                                 | Q3                                                                                                                                                           |

## 📝 Risks & Impact Review

**Blast radius.** One route, three files under `src/`. No API, no schema, no migration, no
config-format change, no public contract. `BACKWARD_COMPATIBILITY.md` surfaces are untouched.

**The specific regression risk of this increment** is the both-waiting state — the busiest one, and
the exact state PR #31's finding was about. With no card and no filled control on the note, the two
tiers rest entirely on position, size, colour and control weight. **It is the state to check first
at the walkthrough**, and AC14 checks it in greyscale, where three of those four cues must still
carry it.

**The visible layout change** is `max-w-3xl` → `max-w-content` (66ch). It is a decision (Q2), not
drift, and is called out in the PR body so it is reviewed as one.

**The accepted structural loss** is one `<h2>` on the `read-only` state (Q1). Copy is preserved; the
outline entry is not; the state gains `role="status"` / `aria-live="polite"` it never had.

**Rollback.** Revert the commit. Nothing persists, nothing migrates, no data is written, and
`dashboard-state.ts` never moved — the previous rendering returns whole.

**Regression net.** `tests/e2e/mobile-nav.spec.ts` navigates to `/dashboard` in three places
(lines 29, 38, 94–96) and asserts no horizontal scroll at every viewport in its width matrix, plus
`Sign out` staying in view at the 640–680 px handoff widths. `tests/e2e/auth.setup.ts:67` loads
`/dashboard` as one of three post-sign-in smoke routes. Both must pass **unmodified** —
`git diff origin/main -- tests/` empty — so they are a genuine net rather than something this change
rewrites.

**Testability.** There is no jsdom/RTL harness in this repo, so acceptance is enforced by a
source-level guard test in the manner of `settings.test.ts`, `generate.test.ts` and
`library-paper.test.ts`, plus a manual walkthrough of all ten states for everything a regex cannot
see. Reaching every state needs seeded data: due cards, drafts, an empty account, and an account
pending deletion.

## ✅ Acceptance criteria

1. `dashboard.astro`, `DashboardLead.astro` and `DashboardNote.astro` contain none of `bg-cosmic`,
   `backdrop-blur`, `rounded-2xl`, `bg-gradient-to-`, `text-white`, or any Tailwind palette-scale
   colour utility (`blue-*`, `purple-*`, `red-*`, `amber-*`, `white/N`, `black/N`), and no hex,
   `rgb()` or `oklch()` literal.
2. `/dashboard` carries `bg-background text-foreground min-h-screen` and the body's `bg-cosmic`
   gradient is nowhere visible behind it, matching the four migrated screens.
3. Across the whole repository, `bg-cosmic` still exists in `global.css` and is still applied by
   `Layout.astro`, `Welcome.astro` and the three auth pages — this increment removes it from
   `dashboard.astro` and nowhere else.
4. In any state that renders a lead, the statement is `text-title` at `--foreground`, its `<h2>`
   label is `text-meta` at `--muted-foreground` with no `font-medium`, and no other text on the page
   is larger than the statement except the `<h1>`.
5. In the both-waiting state, exactly one filled `Button` is present (`Start review session`),
   `Also waiting` renders below the lead separated by a hairline with no surface fill, and its only
   control is an underlined text link.
6. In any of the ten states, at most one element carries the default (filled) `Button` variant, and
   every action on the page is an `<a href>` and not a `<button>` — including on step 4's fallback
   path. Guarded by two source assertions, not one: no literal `<button` element, **and** every
   `<Button` occurrence carrying `asChild` (step 10).
7. In the read-only state, `Your account is read-only` and the deletion-pending sentence both render
   through `Notice variant="warning"` (as `title` and body) with `role="status"`, no review, generate
   or draft action is present, and `Browse library` is reachable exactly once.
8. In the load-error state, no numeric count appears anywhere, the message renders through
   `Notice variant="error"` with `role="alert"` and `aria-live="assertive"`, it precedes the three
   links in DOM order, and all three links work.
9. `git diff origin/main -- src/lib/dashboard-state.ts src/lib/dashboard-state.test.ts` is empty, and
   **every user-visible sentence** on the page is byte-identical to what `main` renders for the same
   state. _(Copy, not markup — the HTML structure is rewritten by design; per Q1 the read-only
   heading survives as `Notice title` rather than as an `<h2>`.)_
10. `DashboardLead.astro` has four call sites in `dashboard.astro` (`review-waiting`,
    `drafts-waiting`, `caught-up`, `new-account`), `DashboardNote.astro` has two, and
    `dashboard.astro` declares none of the eleven legacy class `const`s from lines 92–113.
11. In each of the ten states at 390 px, 640 px and 680 px,
    `document.documentElement.scrollWidth` does not exceed `clientWidth`, and the page contains no
    `client:` island and no skeleton or spinner markup. _The `client:`/skeleton half is guarded by
    step 10; the scroll half is automated by `mobile-nav.spec.ts` for one state only (the suite is
    frozen unmodified per AC12) and checked by hand for the rest at step 13._
12. With `tests/e2e/` unmodified (`git diff origin/main -- tests/` empty), `npm run test:e2e` passes
    in full, including all three `/dashboard` cases in `mobile-nav.spec.ts` and the smoke load in
    `auth.setup.ts`.
13. `npm run typecheck`, `npm run lint`, `npm run build` and `npm test` all pass, and the new guard
    test has been shown to fail on a deliberate break before being accepted.
14. Rendered in greyscale, the both-waiting state's lead is still identifiable as the primary action
    without any colour information — concretely: its statement is visibly the largest text below the
    `<h1>`, its action is the only filled control on the page, and the note below it is separated by
    a visible hairline. All three are legible with the display's colour filter on. _Subjective by
    construction; step 13 records the judgement and the screenshot in the PR._
15. `/dashboard` renders no `Section` and no `EmptyState`, and this increment adds no file under
    `src/components/ui/`.
16. `dashboard.astro` still records, in a comment, that the two-tier requirement from the PR #31 UX
    review holds and that its expression now lives in `DashboardLead` / `DashboardNote`, pointing at
    this spec — the reasoning at lines 84–91 survives its expression being replaced.

## 📋 Phasing

Each phase leaves the application working and is independently revertable.

- **Phase 1 — The two components.** `DashboardLead.astro` and `DashboardNote.astro` ship with no
  consumer. `/dashboard` is unchanged and still legacy. Shippable, inert.
- **Phase 2 — The page.** `dashboard.astro` moves to Paper and adopts both components plus
  `PageHeader` and `Notice`. The screen is fully Paper; every signed-in route now paints its own
  Paper ground. Shippable.
- **Phase 3 — The guard and the walkthrough.** `dashboard-paper.test.ts`, its deliberate-break proof,
  the full validation gate, `npm run test:e2e`, and the ten-state manual walkthrough.

## 📋 Implementation Plan

### Phase 1 — The two components

1. Create `src/components/dashboard/DashboardLead.astro` exactly as specified in **Architecture**:
   `Props { label: string; statement: string }`, the `space-y-3` `<section>`, the `text-meta` `<h2>`,
   the `text-title font-sans` `<p>`, and the `flex flex-wrap items-center gap-3` action row holding a
   default `<slot />`.
   _Testable:_ `npm run typecheck` passes; no `client:` directive anywhere in the file.
2. Create `src/components/dashboard/DashboardNote.astro`: `Props { label: string }`, the
   `border-border space-y-1 border-t pt-4` `<section>`, the same `text-meta` `<h2>`, and a
   `text-muted-foreground text-sm` `<p>` wrapping a default `<slot />`.
   _Testable:_ `npm run typecheck`, `npm run lint`, `npm run build` all pass with the components
   unconsumed.

### Phase 2 — The page

3. Page frame, imports, and the frame's own `const`s. Add the imports (`DashboardLead`,
   `DashboardNote`, `PageHeader`, `Notice`, `Button`); replace the outer wrapper with
   `bg-background text-foreground min-h-screen p-4`, the inner container with
   `max-w-content mx-auto space-y-6 py-8`, and `<header>` + the gradient `<h1>` with
   `<PageHeader title="Dashboard" />`; delete `headingClass` — the only `const` this step orphans.
   Replace the lines 84–91 tier comment with a short note that the two-tier requirement from PR #31
   still holds and that its expression now lives in `DashboardLead` / `DashboardNote`, pointing at
   this spec. Leave everything above line 84, and the other ten `const`s, untouched.
   _Testable:_ `npm run typecheck` and `npm run build` pass — **the page still renders**, in a mixed
   state: a Paper frame around legacy glass sections. `auth.setup.ts`'s smoke load and
   `getByRole("heading", { name: "Dashboard" })` still resolve; AC2, AC16 and the Q2 measure are
   visible in the browser.
   _Each of steps 4–10 deletes the `const`s its own state was the last consumer of, so the page
   typechecks, builds and renders after every step._
4. `review-waiting`: the tier-1 `<section>` → `<DashboardLead label="Next up"
statement={dueSentence(state.dueCount)}>` wrapping
   `<Button asChild><a href="/review">Start review session</a></Button>`. **Verify the filled
   `asChild` class merge here, before the other three call sites depend on it** (Architecture,
   `Button asChild`); if it misbehaves, wrap the anchor in a `<span>` carrying `buttonVariants()`
   rather than restyling the button — the fallback must still render an `<a href>` and no
   `<button>`, so AC6 holds either way. Record the outcome in the PR.
   _Testable:_ the rendered anchor carries `bg-primary text-primary-foreground`; the link navigates
   to `/review`.
5. `review-waiting`'s `Also waiting` block → `<DashboardNote label="Also waiting">` holding
   `alsoWaitingSentence(state.alsoWaitingDrafts)` and the text-link `Check generated cards`. Delete
   the `px-6` alignment hack and the `asideClass` / `asideHeadingClass` / `asideBodyClass` `const`s
   once the `Your library` block is the only remaining consumer (step 7 finishes them).
   _Testable:_ seed both counts `> 0`; AC5 — one filled button, one hairline, one underlined link;
   the page still builds and renders.
6. `drafts-waiting`, `caught-up` and `new-account` → `DashboardLead` per the **UI/UX** table, copy
   unchanged, `new-account` carrying the filled `Create your first cards` plus the underlined
   `Or add a card by hand` in the same slot. Delete `sectionClass`, `sectionHeadingClass`,
   `bodyClass` and `primaryLinkClass` — this step is their last consumer outside `read-only` and
   `error`, which steps 8–9 take.
   _Testable:_ each state reachable with seeded data; AC4 and AC6 hold in all three; build green.
7. The `Your library` block → `<DashboardNote label="Your library">` with `{libraryText}` and the
   inline `Browse library` link, rendered whenever `libraryText !== null`. The three `aside*`
   `const`s are now unreferenced; delete them.
   _Testable:_ AC5's hairline and AC6's link-not-button, in every state that has a library.
8. `read-only` → `<Notice variant="warning" title="Your account is read-only">` with the existing
   sentence as the body, keeping the `libraryText === null` conditional that passes `Browse library`
   as the `action`.
   _Testable:_ toggle `isReadOnly` with `L = 0` and with `L > 0`; AC7 — `role="status"`, both strings
   present, `Browse library` reachable exactly once.
9. `not-configured` and `error` → `Notice variant="error"`, the error state keeping its three
   text-links in a `flex flex-wrap items-center gap-3` row after the message and deleting the glass
   `<section>` wrapper. Delete the last `const`s — `noticeClass`, `textLinkClass`, `actionsClass` —
   so none of the eleven survives (AC10).
   _Testable:_ force each state; AC8 — `role="alert"`, `aria-live="assertive"`, message before
   links, no count rendered; `npm run lint` reports no unused binding.

### Phase 3 — The guard and the walkthrough

10. Create `src/components/dashboard/dashboard-paper.test.ts` following `library-paper.test.ts`:
    read `dashboard.astro`, `DashboardLead.astro` and `DashboardNote.astro` as text and assert the
    source-level criteria — AC1's legacy-utility, palette-scale and colour-literal bans across all
    three files; AC2's `bg-background text-foreground min-h-screen`; AC3's `bg-cosmic` survival in
    `global.css`, `Layout.astro`, `Welcome.astro` and the three auth pages; AC4's lead recipe with
    **no `font-medium`** on the eyebrow (Q3); AC10's four `<DashboardLead` and two `<DashboardNote`
    call sites and the absence of all eleven legacy `const` names; AC11's absence of `client:`;
    AC15's absence of `Section` and `EmptyState`; AC16's PR #31 note; the `max-w-content` measure
    (Q2); and Q1's `title="Your account is read-only"` on the warning `Notice`.

    **AC6 needs two assertions, not one**, because `<Button asChild>` renders an anchor while the
    _source_ still reads `<Button`: assert (a) no literal `<button` element in any of the three
    files, and (b) **every** `<Button` occurrence in `dashboard.astro` carries `asChild` — a
    `<Button>` without it renders a real `<button>` and a bare "zero `<button` elements" regex would
    pass for the wrong reason. Also assert at most one `<Button` per state branch.

    Close with a "the data layer is frozen" block asserting the three count queries, the
    `Promise.all`, the `try`/`catch`, the `head: true` flags and the `resolveDashboardState` call
    survive verbatim.
    _Testable:_ `npm test`.

11. Prove the guard: break one asserted property deliberately (e.g. restore `bg-cosmic` on the
    wrapper, or drop `asChild` from one `<Button>`), confirm `npm test` goes red, revert. Record the
    red run in the PR body.
    _Testable:_ AC13.
12. Run the validation gate — `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` — then
    `npm run test:e2e` with `git diff origin/main -- tests/` empty, and confirm
    `git diff origin/main -- src/lib/dashboard-state.ts src/lib/dashboard-state.test.ts` is empty.
    _Testable:_ AC9, AC12, AC13.
13. Manual walkthrough of all ten states at 390 px, 640 px, 680 px and desktop, **both-waiting
    first** — including the AC11 scroll check run by hand in the console
    (`document.documentElement.scrollWidth <= clientWidth`) for each state × width, a greyscale pass
    on both-waiting (AC14), and `/generate` and `/review` open side by side to judge the 66 ch
    measure and the unbounded eyebrow.

    **If the Q3 fallback is taken** — the eyebrow reads as a stray caption and gains `font-medium` —
    then AC4's "no `font-medium`" and step 10's matching guard assertion are **amended in the same
    commit**, both to require it. The fallback and the criterion move together; neither is left
    contradicting the other, and the PR records which way it went.
    _Testable:_ AC4, AC5, AC11, AC14 — all by observation, and recorded state-by-state in the PR body
    as the evidence for the four criteria no regex can reach.

14. PR body: record the walkthrough evidence from step 13, the red run from step 11, and call out the
    three reviewable decisions by name — the measure dropping to 66 ch (Q2), the read-only `<h2>`
    becoming a `Notice title` (Q1), and `Section` deliberately absent from this screen — with the
    recorded resolution if a reviewer prefers consistency on the last: give `Section` an optional
    quiet-heading variant in a later increment, **not** two `text-title` headings back on this page.
    _Testable:_ the PR body contains a line for each; this is the hand-off record, not a code change.

## 📋 Later — explicitly not this increment

Deleting the `bg-cosmic` utility from `global.css`, removing `class="bg-cosmic"` from
`Layout.astro`'s `<body>`, and migrating `Welcome.astro` and the three auth pages, in the commit that
removes the last `text-white` — the condition at `global.css:317–323`. Then `--radius` becoming
`0.375rem` with `rounded-paper` deleted; `Field` adopting `PasteAndGenerateForm` and then the auth
form family; `shadow-xs` leaving `buttonVariants`' default variant; the unused `ui/LibBadge.astro`
deleted or given a consumer; dark mode, whose entry condition is zero hardcoded colours in `src/`.

**Not doing, at all:** any change to `dashboard-state.ts` or its unit tests; any query, `Promise.all`,
error-handling or row-level-security change; a new registry primitive; `EmptyState` or `Section` on
this page; a `client:` island; any change to the `<h1>` text, to `Topbar.astro` or to `Layout.astro`;
any new dashboard content — no charts, streaks, scores or study statistics, which the original
dashboard brief ruled out and this increment does not reopen; dark mode.

## 📋 Carried open questions

- **Practice or cram mode on the caught-up state** remains the open product question carried from the
  original dashboard brief and from Increment 6. Unrelated to this increment, whose copy does not
  foreclose it.
- **Whether the `<h1>` stays `Dashboard`** is tied to the product-identity work, not to this
  increment. Unchanged here.
