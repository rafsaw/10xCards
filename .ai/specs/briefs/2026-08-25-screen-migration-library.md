# Increment 7 — `/library` migrated to Paper

**Status:** handoff, ready to plan
**Written:** 2026-08-25 · `om-ux-shape` (Handoff mode)
**Follows:** Increment 6, `/review`, merged as `5c706de` (PR #39)
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Strategy C order:** tokens → primitives → shell / mobile navigation → **screen migration** → remove `bg-cosmic`

---

## 📝 Handoff

**Intent.** Migrate `/library` — the page, the create form, and the saved-card row — from the legacy
`bg-cosmic` glass recipe to Paper, and settle the two contracts that five increments have deferred to
this point: build **`Field`**, do **not** build **`Card`**. Along the way give `Section` and
`EmptyState` their next real consumers, give the search box an accessible name it does not have
today, and stop a list of twenty rows from rendering twenty filled red buttons.

**Non-goals.** No other page. `/dashboard` stays legacy and is the next and last increment. No change
to `src/pages/api/cards.ts` or `src/pages/api/cards/[id].ts`, to the PostgREST query, the pagination
maths, the `q` sanitisation, or the `history.replaceState` page-clamp script. No `Card` primitive
(see the deferral resolution). No adoption of `Field` by `auth/FormField.tsx` or by
`generate/PasteAndGenerateForm.tsx` — both are follow-ups. No dark mode. No removal of the
`bg-cosmic` utility or of `Layout.astro`'s `<body>` class. No touching `ui/LibBadge.astro`.

**Actor and trigger.** The developer implementing Strategy C's sixth screen. The user-facing trigger
is a signed-in person opening `/library` from the top navigation, or landing there after creating or
editing a card.

---

## 📋 Why `/library` now, and alone

### The scope decision

Two screens remain: `/library` (4 files, 521 lines, 68 legacy colour utilities) and `/dashboard`
(1 file, 270 lines, 15). Three candidate increments were weighed.

**`/library` alone — recommended.** It is the screen that carries the two open contract questions, and
it is the only screen whose evidence can answer them. It is also the largest remaining block of legacy
markup, so it is the increment that shrinks the debt most.

**`/dashboard` alone — rejected.** Its low legacy count is an artifact: `dashboard.astro:92–113`
hoists eleven class strings into `const`s, and its own brief said it deliberately introduced no colour
decision so the eventual sweep would restyle it with everything else. Migrating it means re-deriving
its entire two-tier "Next up" / "Also waiting" priority system, which today is carried by a glass card
plus a gradient-filled link against a bare text block plus an underlined link. Paper has neither glass
nor gradient, so both cues have to be rebuilt from type, space, and a single filled `Button`. That is
a design argument, not a token swap, and it is cheapest to settle once every other screen's vocabulary
is visible. `/library` is the last screen that adds to that vocabulary.

**Both together — rejected.** 791 lines across five files, mixing a form-and-list derivation with a
priority-hierarchy derivation, and burying the one genuinely contested decision of the pair inside a
diff about textareas. Every increment since `a233cc9` has shipped one coherent decision; this would
ship two.

**Decisive trade-off.** `/library` alone gives up nothing except a week — and it buys the `Field` and
`Card` answers from real markup rather than from a guess.

### What is already true on `main` (measured at `5c706de`, over `src/` only)

| Screen | Status | Legacy colour utilities |
|---|---|---|
| `/settings` | Paper (Increment 4) | 0 |
| `/generate` | Paper (Increment 5) | 0 |
| `/review` | Paper (Increment 6) | 0 |
| **`/library`** | **legacy** | **`library.astro` 36 · `CreateCardForm.tsx` 16 · `CardRow.tsx` 16 = 68** |
| `/dashboard` | legacy | 15 |

`bg-cosmic` survives on seven elements: `Layout.astro`'s `<body>`, `Welcome.astro`, the three auth
pages, `dashboard.astro`, and `library.astro`. This increment removes one of them.

---

## ⛔ The two deferred contracts, resolved

Increment 2 set one rule for creating a primitive: *build the ones whose contract is already proven by
existing duplication; defer the ones whose contract we would have to invent*
(`2026-08-24-paper-ui-primitives.md:49`). Applying that rule to today's code gives two different
answers.

### ✅ `Field` — build it

The duplication is literal. Four label-plus-textarea pairs, in two files, with a **byte-identical**
class string on every one of the four controls:

| File | Instances | Labels |
|---|---|---|
| `library/CreateCardForm.tsx:70–102` | 2 | `Front`, `Back` |
| `library/CardRow.tsx:108–137` | 2 | `Front`, `Back` (id-suffixed per card) |

```
w-full resize-y rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white
placeholder:text-blue-100/40 focus:border-blue-300/50 focus:outline-none disabled:opacity-50
```

Migrating those four to Paper means retyping the same Paper class string four times, in the same
increment, in two files. Principle 8 already names `Field` in the registry and says a page that
repeats the recipe inline is a finding even when the result looks right `[PRODUCT]`. This is the
condition the deferral was waiting for.

**The contract the evidence supports, and nothing more.** `Field` renders a `<label>` and a
`<textarea>`. It takes `id`, `label`, `value`, `onChange`, `rows`, `disabled`, and an optional
`placeholder`. It has **no `error` prop**: both consumers show a single form-level or row-level error
above the fields, not per-field errors, so an error slot would have zero consumers today. It has no
icon slot and no end-content slot, because nothing in this family has either.

**What stays out, deliberately.**

- `auth/FormField.tsx` (5 uses across `SignInForm` and `SignUpForm`) is the other family: `<input>`,
  a required icon, a password-toggle slot, and a per-field error. Reconciling the two families today
  means designing a form component taxonomy for screens nobody has redesigned — the invention the
  deferral rule forbids. It is also on a screen this increment does not migrate. Its filed, still-open
  accessibility gap (`aria-invalid` / `aria-describedby`, WCAG 2.2 §3.3.1) remains its own issue.
- `generate/PasteAndGenerateForm.tsx:90–105` is a textarea with **no `<label>` at all** — its only
  accessible name is a placeholder, which is a real WCAG 2.2 §3.3.2 gap — plus a character counter
  that would need a hint slot `Field` does not have. `/generate` is already migrated and the
  atomic-screen rule this project has held for five increments says an unrelated screen does not get
  opened for a small correct fix. **File it as a follow-up** (`bug`, `priority-medium`): give the
  textarea a visible or visually-hidden label, and adopt `Field` with a `hint` slot at that time.

### ❌ `Card` — do not build it; close the deferral with a no

The deferral's return condition was *"after the first two screens are migrated, when their real
regions are visible"* (`2026-08-24-paper-ui-primitives.md:264`). Three are now migrated, so the
condition is met and the answer is visible. It is no.

There are three renderings of "a flashcard's front and back" in the app, and they are three different
components serving three different jobs:

| Where | Surface | Type | Role on its screen |
|---|---|---|---|
| `review/ReviewSession.tsx:203–214` | `border-border bg-card` | `text-title font-serif`, uppercase `text-meta` Front/Back labels | The single hero object; no actions inside it |
| `generate/DraftReviewList.tsx:133–141` | `border-surface-draft-border bg-surface-draft` | `font-medium` + `text-sm text-muted-foreground` | A provisional draft in a list, with a keep/discard control |
| `library/CardRow.tsx:98,157–161` | to be decided by this increment | front + back stack | A saved row in a paginated list, with edit and delete, and an inline edit mode |

Two facts kill the shared component:

1. **The surfaces are required to differ.** Principle 7 says AI-generated unsaved content must never
   look like a saved card, and that a screen where a draft and a library card are indistinguishable is
   a finding `[PRODUCT]`. `--surface-draft` exists precisely to hold that line. A `Card` primitive
   spanning the draft row and the saved row would exist to erase the one difference the direction
   demands.
2. **Inside `/library` there is exactly one instance.** One is not duplication. Building `Card` here
   would mean reaching across to `/generate` and `/review` — two already-migrated screens — to
   manufacture the consumers, which is the abstraction-built-for-future-use the rule exists to stop.

**Action:** in the same increment, edit the manual section of `.uxproof/conventions.md`, principle 8,
to remove `Card` from the registry list, leaving `PageHeader`, `Section`, `Notice`, `EmptyState`,
`Field`. Add one sentence recording why: *the flashcard surface is rendered per screen, because
principle 7 requires the draft, saved, and review surfaces to differ.* Leaving `Card` in the list
would keep a house rule pointing at a component that has been decided against.

---

## 🎯 Outcomes

**User outcome.** A signed-in person opening `/library` sees a paper page where the card text is the
largest and highest-contrast thing on it, separated by hairlines instead of stacked glass panels. The
search box has a name a screen reader can announce. When a search returns nothing, the page says so in
the same voice as the rest of the app instead of a grey sentence. Creating, editing, deleting,
searching, and paging behave exactly as they do today.

**Behavioural signal.** `/library` renders with `document.body`'s `bg-cosmic` fully covered by the
page's own `bg-background`, matching `/settings`, `/generate` and `/review`; `seed.spec.ts` and
`auth.setup.ts` pass **unmodified**; the front and back text of a saved row are visibly larger and
higher-contrast than the Edit and Delete controls beside them; an automated accessibility scan reports
no unnamed form control on the page.

**Business effect.** Removes 68 of the legacy colour utilities left in `src/`, leaves `bg-cosmic` on
exactly one product screen, gives `Section` two more consumers and `EmptyState` two more, and closes
both primitive deferrals — so `/dashboard` can be planned against a settled vocabulary instead of an
open one.

**Guardrail.** Data behaviour must not move. The `count`-then-`range` query pair, `PAGE_SIZE = 20`,
the `safeQ` character stripping, the `orFilter` string, the out-of-range page clamp and its
`history.replaceState` script, the `window.location.assign("/library")` reloads after create, save and
delete, and the `readOnly` gating all stay byte-for-byte identical. No `user_id` filter is added —
row-level security scopes the reads, as `dashboard.astro:18–24` records.

---

## 📋 Scope

**Now.** `src/pages/library.astro`, `src/components/library/CreateCardForm.tsx`,
`src/components/library/CardRow.tsx`; new `src/components/ui/Field.tsx`; the principle-8 edit in
`.uxproof/conventions.md`; a source-level guard test following `review-paper.test.ts`.
`CardList.tsx` is untouched — it is a `<ul className="space-y-3">` with no colour in it.

**Later.** `/dashboard`, re-deriving its two-tier hierarchy in Paper; then `bg-cosmic`,
`Layout.astro`'s `<body>` class, the three auth screens, `Welcome.astro` and the starter landing;
`--radius` becoming `0.375rem` with `rounded-paper` deleted, per the removal condition in
`global.css`; `Field` adopting `PasteAndGenerateForm` and then the auth family; the unused
`ui/LibBadge.astro` deleted or given a consumer.

**Not doing.** Any API, query, or pagination-logic change. A `Card` primitive. A `Field` error, icon,
or hint slot. Any change to `auth/FormField.tsx` or `PasteAndGenerateForm.tsx`. Replacing
`window.confirm` with a `Dialog`. Sorting, bulk selection, tags, or any new library feature. Dark
mode.

---

## 📋 Behavior

The page keeps its shape: a header, then two regions, in this order.

### 1. Page frame

`library.astro`'s wrapper becomes `bg-background text-foreground min-h-screen p-4`, the inner
container `max-w-content mx-auto space-y-8 py-8` — `space-y-8` to match `/settings`, which is the
other two-region page. The gradient `<h1>` and the `← Dashboard` link are both deleted and replaced by
`<PageHeader title="Card library" />`. **The accessible name `Card library` must survive verbatim**:
`auth.setup.ts:61` asserts on it. The back link goes because the top navigation has carried Dashboard
since Increment 3, exactly as `/settings`, `/generate` and `/review` each dropped theirs.

The two unconfigured/error paragraphs become `Notice`:

- `<Notice variant="error">Supabase is not configured — your library cannot be loaded.</Notice>`
- `<Notice variant="error">Could not load your cards. Try refreshing the page.</Notice>`

Both strings are unchanged; `Notice` supplies the `role="alert"` and `aria-live="assertive"` the bare
paragraphs never had.

### 2. Create a card

`<Section title="Create a card">` replaces the glass `<section>`. Its two branches:

- read-only: `<Notice variant="warning">Your account is pending deletion and is read-only. Cancel the
  deletion to create cards.</Notice>` — text unchanged.
- otherwise: `<CreateCardForm client:load />`, unchanged as a call site.

Inside `CreateCardForm`, the hand-rolled red error paragraph becomes
`<Notice variant="error">{error.message}</Notice>`; the two label-plus-textarea blocks become two
`<Field>`s; the hand-rolled submit becomes
`<Button type="submit" variant="default" className="w-full" disabled={submitting || !canSubmit}>`
keeping both its icon states and both its labels (`Create card`, `Saving…`). This is the screen's one
filled button, satisfying principle 5.

### 3. Saved cards

`<Section title="Saved cards (N)">` replaces the second glass `<section>`, with `N` interpolated from
`totalCount` exactly as today.

**The search form moves from the heading row to the first child of the section.** Today it is crammed
beside the `<h2>` in a `flex-wrap` row that stacks awkwardly under 390px; `Section` has no action slot,
and inventing one for a single consumer is the wrong trade. As a full-width row above the list it
reads as a filter on the list below it, which is what it is:

- a visually hidden `<label for="library-search">Search cards</label>`
- the input, `id="library-search"`, `name="q"`, placeholder `Search front or back…` unchanged,
  carrying the Paper control recipe copied verbatim from `PasteAndGenerateForm.tsx:101`
  (`border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring
  w-full flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none`)
- `<Button type="submit" variant="outline" size="sm">Search</Button>`
- when `q` is set, a `Clear` link, `text-link text-sm underline underline-offset-4`

**The hidden label is a fix, not a restyle:** today the input's only accessible name is its
placeholder. It does not go through `Field`, which is textarea-only. `seed.spec.ts:50` selects the
create form's textarea by `name: "Front", exact: true`, so a search box named `Search cards` cannot
collide with it — but the new name must not contain the words `Front` or `Back`.

**Empty results** become `EmptyState`, with two variants:

- searching, no match — title `No cards match your search`; body
  `Nothing in your library matches “{q}”. Try a different word, or clear the search.`; action
  `Clear search`, linking to `/library`
- empty library — title `Your library is empty`; body
  `Cards you save appear here. Create one above, or generate a batch from a passage of text.`; action
  `Generate cards`, linking to `/generate`

The old single sentence (`You have no saved cards yet. Create your first card above.`) is replaced
because `EmptyState` requires a title and a body, and because the empty-library case now offers the
route that actually fills a library.

**Pagination** keeps its `<nav aria-label="Library pagination">` and its `Page {n} of {m}` text. The
two glass link-buttons become underlined text links (`text-link text-sm underline underline-offset-4`)
and the two disabled states become `<span class="text-muted-foreground text-sm" aria-disabled="true">`.
They are not `Button`s: principle 5 allows one filled button per screen and that is `Create card`;
page navigation is a link, and underlining keeps it identifiable without colour (WCAG 1.4.1).

### 4. The saved row — `CardRow`

**Display mode.** The `<li>` becomes `border-border rounded-paper border p-4`, with **no background
fill** — `--card` and `--background` resolve to the same `--ink-05` by design, so a saved row separates
by hairline and space, the same way `/review`'s card face does. That is also what keeps it visually
distinct from a `/generate` draft, which sits on `--surface-draft` (principle 7).

Front and back are the hero of the row: front `text-foreground text-body font-serif break-words`, back
`text-muted-foreground mt-1 text-body font-serif break-words`. Serif, because principle 3 makes card
content the hero and `/review` already renders card content in serif; `break-words` is kept from
today's markup and matters for a long unbroken string at 390px.

**Row actions become quiet.** `Edit` and `Delete` are both `<Button variant="ghost" size="sm">`, with
`Delete` additionally carrying `text-destructive`. The `Pencil` and `Trash2` glyphs and both text
labels stay. This is a deliberate departure from `settings/DeleteAccountButton.tsx`, which uses a
filled `variant="destructive"`: settings has one destructive action and it is the point of the
section, whereas a full page of `/library` renders up to twenty rows. Twenty filled red buttons would
make the chrome outweigh the content, against principle 3, and would put nineteen more filled buttons
on the screen than principle 5 permits. The word `Delete` carries the meaning; the colour only
reinforces it. `window.confirm` stays exactly as it is — replacing it with a real `Dialog` is a
separate change.

**Edit mode.** The two label-plus-textarea blocks become `<Field>`s with the same id scheme
(`card-front-<id>`, `card-back-<id>`) and the same labels. `Save` stays `<Button size="sm">` (filled)
and `Cancel` stays `<Button size="sm" variant="ghost">`. A filled button inside an opened edit
affordance is that affordance's own primary, not a second page primary — the same reading `/review`
uses for `Reveal answer`. The row error paragraph becomes
`<Notice variant="error">{error.message}</Notice>`, which is the accessibility fix for this file: an
inline edit failure is currently silent to a screen reader.

### 5. The new primitive — `src/components/ui/Field.tsx`

Props: `id`, `label`, `value`, `onChange`, and optional `rows` (default `2`), `placeholder`,
`disabled`.

Renders `<label htmlFor={id} className="text-meta text-foreground mb-1 block">{label}</label>` and a
`<textarea id={id} …>` carrying the Paper control recipe from `PasteAndGenerateForm.tsx:101` plus
`resize-y` and `disabled:opacity-50`, inside a plain `<div>`. No error, icon, hint, or end-content
slot — none has a consumer in this increment.

---

## 📋 States

| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| Loaded, cards present | `/library` with saved cards | `PageHeader` "Card library"; "Create a card" section; "Saved cards (N)" with search row, hairline-separated rows, pagination when N > 20 | Create, search, edit, delete, page |
| Empty library | no saved cards, no `q` | `EmptyState` "Your library is empty" / "Cards you save appear here. Create one above, or generate a batch from a passage of text." + "Generate cards" | Create above, or go to `/generate` |
| Empty search | `q` set, no match | `EmptyState` "No cards match your search" / "Nothing in your library matches “{q}”. Try a different word, or clear the search." + "Clear search" | Clear the search, or search again |
| Load error | count or select query errors | `Notice variant="error"` "Could not load your cards. Try refreshing the page." above both sections | Refresh; the create form still works |
| Not configured | `createClient` returns `null` | `Notice variant="error"` "Supabase is not configured — your library cannot be loaded." | Nothing on this page |
| Read-only | account pending deletion | Create section shows `Notice variant="warning"` instead of the form; rows render without Edit/Delete | Read and search only; cancel deletion in the banner |
| Creating | submit pressed | Filled button shows spinner + "Saving…", both `Field`s disabled | Wait; the page reloads on success |
| Create failed | non-OK response or network error | `Notice variant="error"` above the fields, with the existing `FALLBACK_MESSAGES` text | Correct and resubmit |
| Editing a row | Edit pressed | The row's text is replaced by two `Field`s, with Save (filled) and Cancel (ghost) | Save, or cancel back to display |
| Row action failed | PATCH or DELETE non-OK | `Notice variant="error"` at the top of that row, announced | Retry, or cancel |
| Out-of-range page | `?page=99` | Last page's rows; the URL is silently rewritten by the existing inline script | Page normally |

---

## 📋 Assumptions to confirm

- `[ASSUMPTION]` `Button` supports `asChild`, so the two `EmptyState` actions can render as anchors.
  `button.tsx:38–44` shows a Radix `Slot` behind `asChild`; confirm it survives the outline variant's
  class merge before relying on it. If it does not, use a plain underlined `text-link` anchor.
- `[ASSUMPTION]` Serif on the saved row's back text stays legible at `text-body` in a dense
  twenty-row list. `--font-serif` has rendered so far only on `/review`, where one card fills the
  screen. This is a walkthrough judgement, not a test.
- `[ASSUMPTION]` A hairline-only row on a background of the same lightness reads as a row and not as
  soup when twenty of them stack. `--card` and `--background` are both `--ink-05` deliberately
  (`global.css:105,112`), and `--border` is `--ink-30`. If the list reads flat in the browser, the fix
  is `space-y-3` and vertical rhythm, **not** a fill and **not** a shadow — principle 4 forbids the
  shadow outright.
- `[FACT]` `seed.spec.ts` and `auth.setup.ts` are the regression net and must pass unmodified. They
  depend on: the heading name `Card library`; textboxes accessibly named exactly `Front` and `Back`;
  `getByRole("listitem")` for a row; a `Delete` button inside it; a `Create card` button.
- `[ASSUMPTION]` There is no jsdom/RTL harness in this repo, so acceptance is enforced by a
  source-level guard test in the manner of `src/components/ui/primitives.test.ts`,
  `src/pages/settings.test.ts` and `src/components/review/review-paper.test.ts`, plus a manual
  walkthrough for everything a regex cannot see.

---

## ✅ Acceptance criteria

1. **Given** `/library` at any viewport, **when** it renders, **then** none of `library.astro`,
   `CreateCardForm.tsx`, `CardRow.tsx` contains `bg-cosmic`, `backdrop-blur`, `rounded-2xl`,
   `bg-gradient-to-`, or any Tailwind palette-scale utility (`blue-*`, `purple-*`, `red-*`, `amber-*`,
   `white/N`, `black/N`), **and** the body's `bg-cosmic` is nowhere visible behind the page.
2. **Given** a saved card, **when** its row renders in display mode, **then** the front and back text
   carry `font-serif` and `break-words` and are rendered larger and at higher contrast than the Edit
   and Delete labels beside them.
3. **Given** a card whose front is a 200-character unbroken string, **when** the row renders at 390px,
   **then** `document.documentElement.scrollWidth` does not exceed the viewport width.
4. **Given** `tests/e2e/seed.spec.ts` and `tests/e2e/auth.setup.ts` **unmodified**
   (`git diff origin/main -- tests/` is empty), **when** `npm run test:e2e` runs, **then** every spec
   passes.
5. **Given** a create, edit, or delete failure, **when** the error appears, **then** it renders through
   `Notice variant="error"`, carrying `role="alert"` and `aria-live="assertive"`.
6. **Given** the saved-cards section, **when** it renders, **then** the search input has a programmatic
   label whose text contains neither `Front` nor `Back`, and an automated accessibility scan reports no
   form element without an accessible name.
7. **Given** `src/components/ui/Field.tsx`, **when** the increment lands, **then** it is imported by
   both `CreateCardForm.tsx` and `CardRow.tsx`, it has exactly four call sites, and neither file
   contains a literal `<textarea` any more.
8. **Given** the whole repository, **when** the increment lands, **then** no file named `Card.tsx`
   exists under `src/components/ui/`, and principle 8 in `.uxproof/conventions.md` lists
   `PageHeader`, `Section`, `Notice`, `EmptyState`, `Field` and not `Card`, with the reason recorded.
9. **Given** a page of twenty saved cards, **when** it renders, **then** exactly one filled button
   (`Create card`) is present; Edit and Delete are `ghost`; pagination controls are links or disabled
   spans.
10. **Given** an empty library and, separately, a search with no matches, **when** each renders,
    **then** each shows the `EmptyState` title, body, and action written above, verbatim.
11. **Given** the increment is complete, **when** `npm run typecheck`, `npm run lint`,
    `npm run build`, and `npm test` run, **then** all pass, and the source-level guard test has been
    shown to fail on a deliberate break before being accepted.
12. **Given** `/library` and `/generate` side by side, **when** a saved row and a draft row are
    compared, **then** their surfaces are visibly different, satisfying principle 7.

---

## ⚠️ Open decisions

- **Serif on the saved row.** `/review` puts card content in serif and principle 3 makes content the
  hero, which argues for serif here too. But a twenty-row list is a scanning surface, not a reading
  surface, and sans may scan better. **Owner: the implementer, decided at the walkthrough.** Ship
  serif, and if the list reads as a wall of text, fall back to `font-sans` for the back line only and
  record the reason in the PR. Either outcome is Paper-legal.
- **Delete as `ghost text-destructive` rather than filled `destructive`.** This deliberately diverges
  from the `/settings` precedent. The reasoning is above and it is sound, but a reviewer may prefer
  consistency across the two screens. **Owner: PR review.** If consistency wins, the correct
  resolution is to change `/settings` down to ghost as a follow-up, not to put twenty filled red
  buttons on `/library`.
- **The search form's new position.** Moving it below the heading changes the layout on desktop, not
  just the colours. Called out so it is reviewed as a decision rather than discovered as drift.
- **Practice/cram mode** on `/review`'s "All caught up" remains an open product question from
  Increment 6. Unrelated to this increment; recorded so it is not lost.

---

## 📋 Applied

AI necessity gate: not applicable — no AI behaviour is added or changed by this increment. Human-AI
checklist and preferred-mistake framing: not applicable, same reason. Value metrics: applied to the
outcome and signal above, stated as observable page behaviour rather than adoption. Design contract:
loaded — `.uxproof/contract.json` and `conventions.md`, including its manual section, the eight
principles, and the legacy-starter *do not extend* rule; the prior briefs for Increments 1, 2, 4, 5
and 6 and the Phase 4 direction document were read, and every count in this document was measured
against `main` at `5c706de` rather than carried over. Evidence tiers: `[PRODUCT]` for the principles
and the deferral rules, `[STANDARD]` for WCAG 1.4.1, 3.3.1 and 3.3.2, `[ASSUMPTION]` where marked, and
the three assumptions above are the ones most likely to be wrong. Quality rubric: passed.
