# Increment 8 — `/dashboard` migrated to Paper

**Status:** handoff, ready to plan
**Written:** 2026-08-26 · `om-ux-shape` (Handoff mode)
**Follows:** Increment 7, `/library`, merged as `288c44e` (PR #40)
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Strategy C order:** tokens → primitives → shell / mobile navigation → **screen migration (last one)** → remove `bg-cosmic`

---

## 📝 Handoff

**Intent.** Migrate `/dashboard` — the screen every login lands on — from the legacy `bg-cosmic` glass
recipe to Paper, and rebuild its two-tier "what should I do now?" hierarchy out of Paper's own
vocabulary. The legacy screen carries that hierarchy on a glass card plus a gradient-filled link
against bare text plus an underlined link. Paper has neither glass nor gradient, so the tiers have to
be re-derived from position, type size, text colour and control weight. That derivation is the whole
of this increment; the counts, the states and the routing do not move.

**Non-goals.** No other page. No change to `src/lib/dashboard-state.ts` — not the resolver, not the
guard order, not one sentence of its copy functions. No change to the three count queries, to
`Promise.all`, to the `try`/`catch`, to the "never render a zero after a failed query" rule, or to
the absence of a `user_id` filter. No `client:` island, no skeleton, no spinner. No new registry
primitive. No dark mode. **No removal of the `bg-cosmic` utility and no edit to `Layout.astro`'s
`<body>` class** — that is the next, separate increment, and this one only stops one more page from
applying it. No touching `Topbar.astro`, `Welcome.astro`, or the three auth pages.

**Actor and trigger.** The developer implementing Strategy C's seventh and last screen. The
user-facing trigger is a signed-in person landing on `/dashboard` from the post-login redirect
(`src/pages/index.astro:6`), from the `Dashboard` nav item (`Topbar.astro:9`), or by typing the URL.

---

## 📋 Why the hierarchy has to be re-derived, and what it becomes

### What the screen does today (measured on `main` at `aa9bc2c`)

`src/pages/dashboard.astro` is one file, 270 lines. Lines 92–113 hoist eleven class strings into
`const`s, which is why its legacy footprint looks small in a grep: **15 palette-scale colour
utilities** (`text-blue-100` ×3, `from-blue-500` ×2, `to-purple-500` ×2, `from-blue-200`,
`to-purple-200`, `text-red-300`, `border-red-500`, `bg-red-900`, `border-white/20`, `border-white/10`,
`bg-white/10`) plus `bg-cosmic`, `backdrop-blur-xl`, `rounded-2xl` and `bg-gradient-to-r` ×2 — **20
matches** of the pattern set the shipped guard tests use.

Those twenty are not evenly distributed. Eleven of them build exactly two things:

| Tier | Legacy expression | Lines |
|---|---|---|
| **Tier 1** — the answer to "what now?" | `rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl` card, `text-xl font-semibold` heading, `text-blue-100/80` body, and a link filled with `bg-gradient-to-r from-blue-500/30 to-purple-500/30` | 95–99 |
| **Tier 2** — the reminder and the context | no card, `px-6` to align with the card's inner text, `text-base font-semibold` heading, `text-sm text-blue-100/70` body, underlined `text-blue-100/80` link | 106–110 |

The comment at lines 84–91 records why the two tiers exist: the UX review of PR #31 found every
section rendering at an identical 20px/600 heading inside an identical card, with a 30%-opacity
gradient on one button as the only cue that anything outranked anything else — so `Next up` did not
read as the answer to the question the screen exists to answer. The fix was to make **exactly one
section per state a card with the gradient action** and everything else quiet text.

**So the hierarchy is load-bearing product behaviour, not decoration.** Three of Paper's eight
principles delete the cues it is currently built from: principle 1 bans `backdrop-blur-*` and any
gradient background or fill, principle 3 bans gradient-filled text, principle 4 bans a bordered
panel-as-elevation reading. A token swap cannot carry this screen across.

### The three candidate hierarchies, and the one to build

**A — a hairline `Section` per tier, tier 1 first.** Rejected. `Section` renders its `<h2>` at
`text-title font-semibold` (20px), which is the largest step on the page below the `<h1>`. Two
`Section`s means two 20px semibold headings — the exact PR #31 finding, reproduced in Paper. Worse,
a tier-1 body rendered at `Section`'s `text-sm text-muted-foreground` description size would leave the
*heading* outweighing the *sentence that states what is due*, against principle 3.

**B — one filled `Button` and nothing else.** Rejected. Principle 5 already gives the page exactly one
filled button, so the button alone cannot separate three blocks; it separates one block from two. It
also leaves `Also waiting` and `Your library` indistinguishable from each other, and it does nothing
at all in the two states that legitimately have no primary action (read-only, load error).

**C — content-first lead, hairline notes below. Recommended.** Rebuild tier 1 as a *statement* that is
the largest and highest-contrast text on the page, labelled by a small uppercase eyebrow, followed by
one filled `Button`. Rebuild tier 2 as hairline-separated notes whose own headings use the same quiet
eyebrow, whose bodies are small and muted, and whose only control is an underlined text link.

**Decisive trade-off.** C is the only option that separates the tiers with *four* independent,
non-colour cues — position, type size, text colour, control weight — so the hierarchy survives
greyscale, survives a high-contrast setting, and survives dark mode being applied later. It costs one
thing: `Section`, the primitive four other screens use, does not appear on `/dashboard` at all. That
is a deliberate, recorded departure of the same kind `/review` already made ("No `Section` wrapper
here, deliberately diverging from /generate", `review.astro:38–42`).

### The recipe C is built from is already shipped

This is not an invented treatment. `ReviewSession.tsx:205–206` renders precisely this label/statement
pair for a flashcard's front face:

```
<p className="text-meta text-muted-foreground tracking-wide uppercase">Front</p>
<p className="text-foreground text-title mt-1 font-serif break-words">{card.front}</p>
```

`/dashboard` reuses it with one change: **sans, not serif.** `--font-serif` carries card content and
prose; a dashboard sentence is system chrome reporting a count, not card content, and the token
layer's comment splits the two families on exactly that line. Everything else — the `text-meta`
uppercase eyebrow, the `text-title` statement at full `--foreground` contrast — is copied verbatim.

**Why an eyebrow rather than a normal `<h2>`:** the headings (`Next up`, `Also waiting`,
`Your library`) are labels for blocks whose *content* is one short sentence. Rendering the label
bigger than the sentence is the inversion principle 3 names. Demoting the label visually does not
demote it structurally — it stays an `<h2>`, so the document outline and screen-reader navigation are
unchanged from today.

---

## 📋 What is already true on `main` (measured at `aa9bc2c`, over `src/` only)

| Screen | Status | Legacy colour utilities |
|---|---|---|
| `/settings` | Paper (Increment 4) | 0 |
| `/generate` | Paper (Increment 5) | 0 |
| `/review` | Paper (Increment 6) | 0 |
| `/library` | Paper (Increment 7) | 0 |
| **`/dashboard`** | **legacy** | **15 palette-scale; 20 pattern matches in total** |

`bg-cosmic` is applied in six non-test files: `Layout.astro`'s `<body>`, `Welcome.astro`,
`auth/signin.astro`, `auth/signup.astro`, `auth/confirm-email.astro`, and `dashboard.astro`. **This
increment removes the last one on a signed-in product screen.** After it lands, every route behind
`PROTECTED_ROUTES` (`middleware.ts:4`) paints its own Paper ground, and what remains is the pre-auth
surface plus the `<body>` class — the next increment's subject, per the removal condition recorded at
`global.css:317–323`.

---

## 📋 Behavior

The page keeps its DOM order, its state machine and every string it renders today unless this
document says otherwise. Structure: page frame → at most one lead → zero or more notes.

### 1. Page frame

`dashboard.astro`'s outer wrapper becomes `bg-background text-foreground min-h-screen p-4`. The inner
container becomes `max-w-content mx-auto space-y-6 py-8`.

**The measure changes from `max-w-3xl` to `max-w-content` (66ch), and that is a deliberate,
reviewable layout change.** `/library` kept `max-w-3xl` because its rows carry trailing actions and do
not read as prose (Increment 7's recorded Q3b exception). `/dashboard` is the opposite case: three
short sentences and some links, which is the reading column the token exists for. It joins
`/generate`, `/review` and `/settings` rather than `/library`. `space-y-6` is kept as-is — it matches
`/generate` and `/review`, the other single-region pages.

The gradient `<h1>` and its bespoke `headingClass` are deleted and replaced by
`<PageHeader title="Dashboard" />`. **The accessible name `Dashboard` must survive verbatim** — it is
the h1 every sibling page pairs with its nav item, and `Topbar.astro:9` uses the same word.

### 2. The lead — `src/components/dashboard/DashboardLead.astro` (new, page-local)

Four of the ten states render a lead — `review-waiting`, `drafts-waiting`, `caught-up` and
`new-account`. It is the first thing under the header, it carries **no top hairline**
(that absence is what says "this is not one of a list of sections"), and it is built from three parts:

```
<section class="space-y-3">
  <h2 class="text-meta text-muted-foreground font-sans tracking-wide uppercase">{label}</h2>
  <p class="text-foreground text-title font-sans">{statement}</p>
  <div class="flex flex-wrap items-center gap-3"><slot /></div>
</section>
```

Props: `label`, `statement`. Actions go in the default slot, so a caller can pass a filled `Button`
plus an underlined link without the component knowing about either.

**Why a page-local component, not inline markup and not a registry primitive.** Four call sites in one
file is the duplication principle 8 objects to, so it is extracted. But it has exactly one consumer
page and no second screen wants it, so it is *not* promoted to `src/components/ui/` — the same call
Increment 7 made for `LibrarySearch.astro`. It is `.astro` rather than `.tsx` because it takes no
React node in a prop; the split established by `LibrarySearch.astro` versus `LibraryEmpty.tsx` decides
that.

The four leads, with copy unchanged from today (the read-only row is listed for completeness and is
not one of them):

| State | `label` | `statement` | Slot |
|---|---|---|---|
| `review-waiting` | `Next up` | `dueSentence(state.dueCount)` | filled `Start review session` → `/review` |
| `drafts-waiting` | `Next up` | `draftsWaitingSentence(state.draftCount)` | filled `Check generated cards` → `/generate` |
| `caught-up` | `All caught up` | `Nothing is due right now. Cards come back when their interval is up.` | filled `Generate more cards` → `/generate` |
| `new-account` | `Start your first deck` | `You have no cards yet. Paste a passage and 10xCards drafts question-and-answer cards for you to review before anything is saved.` | filled `Create your first cards` → `/generate`, then the underlined link `Or add a card by hand` → `/library` |
| `read-only` | — renders as a `Notice` instead, see below | — | — |

Filled actions are `<Button asChild><a href="…">…</a></Button>`, the recipe `LibraryEmpty.tsx` already
ships.

**`new-account` uses the lead, not `EmptyState` — considered and rejected.** `EmptyState` was the
obvious reach: `/review` already renders "All caught up!" through it. It is wrong here for two
reasons. First, `/dashboard` is never empty in the sense `EmptyState` means — it always answers "what
now?", and on a brand-new account that answer is the strongest call to action in the product.
`EmptyState` would render it centred, with the body at `text-sm text-muted-foreground`, demoted below
every other state's statement. Second, it would put a third recipe on a page that otherwise has two.
Recorded here so it is not re-proposed at review.

**`read-only` becomes a `Notice`, not a lead.** Today it is a glass card with a bespoke heading and
body. In Paper it is `<Notice variant="warning">` carrying the existing sentence verbatim:

> While deletion is pending you can browse your cards, but you can't review, generate, or edit them.
> Cancel the deletion in the banner above to continue.

This is not a downgrade, it is the house treatment: principle 6 assigns `warning` to
"pending-or-read-only", and `/library`, `/generate` and `/review` all already render this account
state through `Notice variant="warning"`. It also supplies the `role="status"` / `aria-live="polite"`
the bare paragraph never had. The existing conditional stays: when the library note below does not
render (`libraryText === null`), the `Browse library` link is passed as the `Notice`'s `action`; when
it does render, the link is not repeated.

### 3. The notes — `src/components/dashboard/DashboardNote.astro` (new, page-local)

Two blocks are subordinate by construction: `Also waiting` and `Your library`. Both render as:

```
<section class="border-border space-y-1 border-t pt-4">
  <h2 class="text-meta text-muted-foreground font-sans tracking-wide uppercase">{label}</h2>
  <p class="text-muted-foreground text-sm"><slot /></p>
</section>
```

Props: `label`. Body and link go in the slot.

The legacy `px-6` alignment hack (lines 104–106: "matches the card's inner padding, so a subordinate
section's text starts on the same left edge as the primary card's text") is **deleted**. It existed
only because tier 1 was a padded card; with no card, every block already starts on the same left edge.

- **`Also waiting`** — rendered only inside `review-waiting`, only when `state.alsoWaitingDrafts !== null`.
  Body `alsoWaitingSentence(state.alsoWaitingDrafts)`, then
  `<a href="/generate" class="text-link text-sm underline underline-offset-4">Check generated cards</a>`.
- **`Your library`** — rendered whenever `libraryText !== null`. Body `{libraryText}` followed by the
  same-recipe link `<a href="/library">Browse library</a>`, inline in the sentence exactly as today.

The link recipe `text-link text-sm underline underline-offset-4` is copied verbatim from
`library.astro:119` and `LibrarySearch.astro:28`. Underlined, so a link is identifiable without colour
(WCAG 2.2 §1.4.1).

**The hairline is what separates a note from the lead**, and it is the only separator on the page —
principle 4, one border token, no shadow anywhere.

### 4. The two operator and failure states

- **`not-configured`**: `<Notice variant="error">Supabase is not configured — your dashboard cannot be
  loaded.</Notice>`. Text unchanged; the bespoke red `noticeClass` at line 113 is deleted.
- **`error`**: `<Notice variant="error">We couldn't load your dashboard right now. Try refreshing the
  page.</Notice>`, then the three links, each `text-link text-sm underline underline-offset-4`, in a
  `flex flex-wrap items-center gap-3` row: `Start review session` → `/review`, `Generate cards` →
  `/generate`, `Browse library` → `/library`. The glass `<section>` wrapper is deleted; the message
  still precedes the links in DOM order, so it is read before the choices it qualifies, and **none of
  the three is a filled button** — no count survived the failure, so nothing outranks anything else.
  `Notice variant="error"` supplies the `role="alert"` and `aria-live="assertive"` the bare paragraph
  never had.

### 5. The one filled button

Across every state the page renders **at most one** `<Button>` with the default (filled) variant, and
it is always the lead's action. Principle 5 is satisfied by construction, and it is what makes the
lead legible as the answer to "what now?" even to someone who reads no headings. Every action on this
page navigates, so every one of them is an `<a href>` and never a `<button>`.

---

## 📋 States

Copy is unchanged from `main` throughout; only the treatment changes. `D` = due, `F` = drafts, `L` = library.

| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| Review waiting | `D > 0`, `F = 0` | `PageHeader` "Dashboard"; eyebrow `Next up`; `12 cards are due for review.` at `text-title`; one filled `Start review session` | Start the review; browse the library from the note below |
| Both waiting | `D > 0`, `F > 0` | The same lead, then a hairline note `Also waiting` — `7 generated cards still need a keep-or-discard decision.` with an underlined `Check generated cards` | Start the review (filled) or check drafts (link) — never two peers |
| Drafts waiting | `D = 0`, `F > 0` | Eyebrow `Next up`; `7 generated cards are waiting for your decision.`; one filled `Check generated cards` | Check the drafts |
| All caught up | `D = 0`, `F = 0`, `L > 0` | Eyebrow `All caught up`; `Nothing is due right now. Cards come back when their interval is up.`; one filled `Generate more cards`; library note below | Generate more, or browse |
| New account | `D = 0`, `F = 0`, `L = 0` | Eyebrow `Start your first deck`; the one-sentence product explanation at `text-title`; filled `Create your first cards` plus underlined `Or add a card by hand`. No note renders. | Generate, or add by hand. No count of zero appears anywhere |
| Library context | `L > 0`, with any of the above | Hairline note `Your library` — `Your library holds 24 saved cards.` with an inline underlined `Browse library` | Browse. It is context, not an action, and never looks like one |
| Read-only | `Astro.locals.isReadOnly` | `Notice variant="warning"` with the deletion-pending sentence; library note still shown when `L > 0`; no review, generate or draft action anywhere | Browse the library; cancel the deletion in the global banner |
| Load error | any count query errors or throws | `Notice variant="error"` "We couldn't load your dashboard right now. Try refreshing the page." then three underlined links | Refresh, or take any of the three routes — all still work |
| Not configured | `createClient(...)` returns `null` | `Notice variant="error"` "Supabase is not configured — your dashboard cannot be loaded." | Nothing; an operator problem, not a user one |
| Loading | — | **None, deliberately.** Server-rendered; all three counts resolve before the first byte. No skeleton, no spinner, no `client:` island. | — |

---

## 📋 Scope

**Now.** `src/pages/dashboard.astro`; new `src/components/dashboard/DashboardLead.astro`; new
`src/components/dashboard/DashboardNote.astro`; new `src/pages/dashboard.test.ts` (source-level
guards, following `src/pages/settings.test.ts` and `src/pages/generate.test.ts`).

**Later — the next increment, explicitly not this one.** Deleting the `bg-cosmic` utility from
`global.css`, removing `class="bg-cosmic"` from `Layout.astro`'s `<body>`, and migrating
`Welcome.astro` and the three auth pages, in the commit that removes the last `text-white` — the
condition written at `global.css:317–323`. Then `--radius` becoming `0.375rem` with `rounded-paper`
deleted; `Field` adopting `PasteAndGenerateForm` and then the auth form family; the unused
`ui/LibBadge.astro` deleted or given a consumer; dark mode, whose entry condition is zero hardcoded
colours in `src/`.

**Not doing.** Any change to `dashboard-state.ts` or its 21 unit tests. Any query, `Promise.all`,
error-handling or row-level-security change. A new registry primitive. `EmptyState` on this page.
`Section` on this page. A `client:` island. Any change to the h1 text, to `Topbar.astro`, or to
`Layout.astro`. Any new dashboard content — no charts, streaks, scores or study statistics, which the
original dashboard brief ruled out and this increment does not reopen. Dark mode.

---

## 📋 Assumptions to confirm

- `[FACT]` `dashboard-state.ts` and `dashboard-state.test.ts` are untouched by this increment.
  `git diff origin/main -- src/lib/dashboard-state.ts src/lib/dashboard-state.test.ts` must be empty
  at review. Every sentence the page renders comes from `dueSentence`, `draftsWaitingSentence`,
  `alsoWaitingSentence` and `librarySentence`, or is a literal already in `dashboard.astro`.
- `[FACT]` `Button` supports `asChild` over an anchor — `button.tsx:47` uses a Radix `Slot`, and
  `LibraryEmpty.tsx` ships the pattern with `variant="outline"`. This increment is the first use of
  `asChild` with the **default (filled)** variant; confirm the class merge survives it before relying
  on it, and if it does not, wrap the anchor rather than restyling the button.
- `[ASSUMPTION]` A `text-meta` uppercase eyebrow reads as a *label for the sentence below it* rather
  than as a stray caption, at the top of a page, with no bordered surface around it. It is proven
  inside `/review`'s bordered card face; the dashboard uses it unbounded. This is a walkthrough
  judgement, not a test. **If it reads as a caption, the fix is `font-medium` on the eyebrow and more
  space below it — not a surface fill and not a shadow**, which principles 1 and 4 forbid outright.
- `[ASSUMPTION]` Dropping to `max-w-content` (66ch) does not make the `Also waiting` and
  `Your library` notes feel cramped against the lead at desktop widths. Judged at the walkthrough,
  with `/generate` and `/review` open side by side.
- `[ASSUMPTION]` With no card and no filled control, the two notes still read as clearly subordinate
  when both render at once (the both-waiting state, which is also the busiest). **This is the specific
  regression risk of this increment** — it is the PR #31 finding — and it is the state to check first.
- `[FACT]` `tests/e2e/mobile-nav.spec.ts` navigates to `/dashboard` in three places and asserts no
  horizontal scroll at every viewport in its width matrix, plus `Sign out` staying in view at the
  640–680px handoff widths. `tests/e2e/auth.setup.ts:67` loads `/dashboard` as one of three
  post-sign-in smoke routes. Both must pass **unmodified**.
- `[ASSUMPTION]` There is no jsdom/RTL harness in this repo, so acceptance is enforced by a
  source-level guard test in the manner of `src/pages/settings.test.ts`, `src/pages/generate.test.ts`
  and `src/components/library/library-paper.test.ts`, plus a manual walkthrough of all ten states for
  everything a regex cannot see. Reaching every state needs seeded data: due cards, drafts, an empty
  account, and an account pending deletion.

---

## ✅ Acceptance criteria

1. **Given** `src/pages/dashboard.astro`, `DashboardLead.astro` and `DashboardNote.astro`, **when**
   the increment lands, **then** none of them contains `bg-cosmic`, `backdrop-blur`, `rounded-2xl`,
   `bg-gradient-to-`, `text-white`, or any Tailwind palette-scale colour utility (`blue-*`,
   `purple-*`, `red-*`, `amber-*`, `white/N`, `black/N`).
2. **Given** `/dashboard` renders, **when** the page paints, **then** it carries
   `bg-background text-foreground min-h-screen` and the body's `bg-cosmic` gradient is nowhere visible
   behind it, matching `/settings`, `/generate`, `/review` and `/library`.
3. **Given** the whole repository, **when** the increment lands, **then** `bg-cosmic` still exists as a
   utility in `global.css` and is still applied by `Layout.astro`, `Welcome.astro` and the three auth
   pages — this increment removes it from `dashboard.astro` and from nowhere else.
4. **Given** any state that renders a lead, **when** the page renders, **then** the lead's statement is
   `text-title` at `--foreground`, its `<h2>` label is `text-meta` at `--muted-foreground`, and no
   other text on the page is larger than the statement except the `<h1>`.
5. **Given** the both-waiting state (`D > 0`, `F > 0`), **when** the page renders, **then** exactly one
   filled `Button` is present (`Start review session`), `Also waiting` renders below the lead separated
   by a hairline with no surface fill, and its only control is an underlined text link.
6. **Given** any of the ten states, **when** the page renders, **then** at most one element carries the
   default (filled) `Button` variant, and every action on the page is an `<a href>` and not a
   `<button>`.
7. **Given** the read-only state, **when** the page renders, **then** the deletion-pending sentence
   renders through `Notice variant="warning"` with `role="status"`, no review, generate or draft action
   is present, and `Browse library` is reachable exactly once.
8. **Given** the load-error state, **when** the page renders, **then** no numeric count appears
   anywhere, the message renders through `Notice variant="error"` with `role="alert"` and
   `aria-live="assertive"`, it precedes the three links in DOM order, and all three links work.
9. **Given** `git diff origin/main -- src/lib/dashboard-state.ts src/lib/dashboard-state.test.ts`,
   **when** the increment lands, **then** it is empty, and every user-visible sentence on the page is
   byte-identical to what `main` renders for the same state.
10. **Given** `src/components/dashboard/DashboardLead.astro`, **when** the increment lands, **then** it
    has four call sites in `dashboard.astro` (`review-waiting`, `drafts-waiting`, `caught-up`,
    `new-account`), `DashboardNote.astro` has two, and `dashboard.astro` declares none of the eleven
    legacy class `const`s from lines 92–113.
11. **Given** `/dashboard` in each of the ten states at 390px, 640px and 680px, **when** it renders,
    **then** `document.documentElement.scrollWidth` does not exceed `clientWidth`, and the page
    contains no `client:` island and no skeleton or spinner markup.
12. **Given** `tests/e2e/` **unmodified** (`git diff origin/main -- tests/` is empty), **when**
    `npm run test:e2e` runs, **then** every spec passes, including all three `/dashboard` cases in
    `mobile-nav.spec.ts` and the smoke load in `auth.setup.ts`.
13. **Given** the increment is complete, **when** `npm run typecheck`, `npm run lint`, `npm run build`
    and `npm test` run, **then** all pass, and the new guard test has been shown to fail on a
    deliberate break before being accepted.
14. **Given** the page rendered in greyscale, **when** the both-waiting state is viewed, **then** the
    lead is still identifiable as the primary action without any colour information.

---

## ⚠️ Open decisions

- **`Section` does not appear on `/dashboard`.** Four screens use it and this one will not, for the
  reason argued above. **Owner: PR review.** If a reviewer prefers consistency, the correct resolution
  is to give `Section` an optional quiet-heading variant in a later increment, **not** to put two
  `text-title` headings back on this page — that is the PR #31 finding.
- **The measure drops from `max-w-3xl` to 66ch.** A visible desktop layout change, not a colour change.
  Called out so it is reviewed as a decision rather than discovered as drift.
- **The eyebrow label treatment** for `Next up` / `Also waiting` / `Your library`. **Owner: the
  implementer, decided at the walkthrough**, with the two fallbacks named above. Either outcome is
  Paper-legal; record the choice in the PR.
- **Practice or cram mode on the caught-up state** remains the open product question carried from the
  original dashboard brief and from Increment 6. Unrelated to this increment, whose copy does not
  foreclose it. Recorded so it is not lost when the last screen ships.
- **Whether the `<h1>` stays `Dashboard`** is still tied to the product-identity work, not to this
  increment. Unchanged here.

---

## 📋 Applied

AI necessity gate: not applicable — no AI behaviour is added, changed or removed by this increment, and
the one product sentence in the new-account state is unchanged copy. Human-AI checklist and
preferred-mistake framing: not applicable, same reason. Value metrics: applied to the outcome above,
stated as observable page behaviour — which block reads as primary, in greyscale — rather than as
adoption. Design contract: loaded — `.uxproof/contract.json` and `conventions.md` including its manual
section, the eight principles, and the legacy-starter *do not extend* rule; the Phase 4 direction
document, the original `/dashboard` brief, the primitives brief and the Increment 5–7 briefs and specs
were read, and every count in this document was measured against `main` at `aa9bc2c` rather than
carried over from Increment 7. Evidence tiers: `[PRODUCT]` for the eight principles, the two-tier
requirement and the PR #31 finding recorded in `dashboard.astro:84–91`; `[STANDARD]` for WCAG 2.2
§1.4.1; `[FACT]` for the measured counts, the shipped recipes cited by file and line, and the
end-to-end test dependencies; `[ASSUMPTION]` where marked, the eyebrow reading and the both-waiting
subordination being the two most likely to be wrong. Quality rubric: passed.
