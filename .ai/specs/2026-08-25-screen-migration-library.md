# Screen migration: `/library` to Paper, and the `Field` / `Card` deferrals closed

**Status:** ready to plan
**Source brief:** `.ai/specs/briefs/2026-08-25-screen-migration-library.md` (Increment 7 — Strategy C, step 4 of 5)
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Follows:** Increment 6, `/review` migration (`5c706de`, PR #39, plus `308b531`)

## 📝 TLDR

Migrate `/library` — `src/pages/library.astro`, `src/components/library/CreateCardForm.tsx` and
`src/components/library/CardRow.tsx` — from the legacy `bg-cosmic` glass recipe to Paper, using the
shipped `PageHeader`, `Section`, `Notice`, `EmptyState` and `Button` primitives, and settle the two
component contracts five increments have deferred: **build `Field`** (four byte-identical
label-plus-textarea pairs across those two files prove the contract) and **do not build `Card`**
(principle 7 requires the draft, saved and review surfaces to differ, and `/library` holds exactly one
instance — the deferral closes with a `no`, and principle 8's registry is edited to match).

**No data behaviour moves.** The `count`-then-`range` query pair, `PAGE_SIZE = 20`, `safeQ`
stripping, the `orFilter` string, the out-of-range page clamp and its `history.replaceState` script,
the three `window.location.assign("/library")` reloads, and the `readOnly` gating are frozen
byte-for-byte. `tests/e2e/seed.spec.ts` and `tests/e2e/auth.setup.ts` must pass **unmodified**, so
they are a genuine regression net rather than something this change rewrites.

Four things change beyond colour, each deliberate: the search input gains a real accessible name
(today its only name is a placeholder — WCAG 2.2 §3.3.2), `CardRow`'s silent edit/delete failure
becomes an announced `Notice variant="error"`, `Delete` drops from filled `destructive` to
`ghost text-destructive` so a twenty-row page does not render twenty filled red buttons, and
`PageHeader` gives up the layout constraint it should never have owned so `/library` can be wider
than a prose column.

## 📝 Problem Statement

Measured on `main` at `5c706de`, over `src/` only:

| Screen                             | Status                | Legacy colour utilities                                                        |
| ---------------------------------- | --------------------- | ------------------------------------------------------------------------------ |
| `/settings`, `/generate`, `/review` | Paper (Increments 4–6) | 0                                                                              |
| **`/library`**                     | **legacy**            | **`library.astro` 36 · `CreateCardForm.tsx` 16 · `CardRow.tsx` 16 = 68**       |
| `/dashboard`                       | legacy                | 15                                                                             |

`/library` is the largest remaining block of legacy markup and the only remaining screen carrying the
two open primitive contracts. `bg-cosmic` survives on seven elements — `Layout.astro`'s `<body>`,
`Welcome.astro`, the three auth pages, `dashboard.astro`, `library.astro`; this increment removes one
of them and leaves it on exactly one product screen.

Beyond the colour debt, three concrete defects:

- **An unnamed form control.** The search `<input>` (`library.astro:132–139`) has no `<label>`; its
  only accessible name is the placeholder `Search front or back…` (WCAG 2.2 §3.3.2).
  `seed.spec.ts:47–49` already carries a comment working around the consequence.
- **A silent failure.** `CardRow.tsx:100–105` renders edit and delete errors as a hand-rolled red
  `<p>` with no `role` and no `aria-live` — announced to nobody. This is the same gap Increment 6
  closed on `/review`.
- **Chrome outweighing content.** A full page renders up to twenty filled `variant="destructive"`
  Delete buttons (`CardRow.tsx:163–174`) against `font-medium` front text — the inverse of
  principle 3, and nineteen more filled buttons than principle 5 permits.

Two shipped primitives are also still thin on consumers: `Section` and `EmptyState` each gain new call
sites here, which is how their contracts get tested by something other than their author.

The scope argument for `/library` alone (versus `/dashboard`, versus both) is settled in the brief and
is not re-argued here.

## 📝 Proposed Solution

A presentation-layer migration of three files plus one new primitive, with the data and interaction
layers explicitly fenced. Everything that decides _what happens_ is untouched; everything that decides
_what it looks like_ is rewritten against the Paper tokens and the shipped primitives.

Four gate decisions shape the design and are recorded here so they are not re-litigated in review:

**1. Card content stays at `text-title` (Q1a).** The brief proposed `text-body font-serif` for the
saved row. That is superseded: `global.css:237–239` states _"Content never goes below
`--text-title`: a serif at 16px loses the legibility…"_, and Increment 6 shipped a guard
(`review-paper.test.ts`, AC2) asserting both `/review` card faces at `text-title` for that reason. A
saved row's front and back are card content by the same definition, so they render at `text-title` in
the serif. The list gets taller; the token rule is not forked for one screen.

**2. `EmptyState` replaces the `Section`, it does not nest inside it (Q2b).** Both primitives render a
`border-t` hairline **and** an `<h2>` (`Section.tsx:11–13`, `EmptyState.tsx:14–16`). Nesting them
produces two stacked hairlines and "Saved cards (0)" directly above "Your library is empty". So when
the list is empty the whole `Section` is replaced by the `EmptyState`, whose own title becomes the
region heading. No `bare` prop is added: a composition conflict is not a reason to grow a shipped
primitive's surface.

**3. `/library` is wider than a prose column (Q3b).** `--container-content` is `66ch`
(`global.css:251`) — a measure constraint for reading. `/library` is an operational list whose rows
carry trailing actions, so it uses `max-w-3xl`, the width it renders at today. The exception is local
and explicit; no new global width token is introduced.

That decision surfaces a latent defect: `PageHeader.tsx:8` bakes `max-w-content mx-auto` into the
primitive itself. Inside a wider container the `h1` would clamp to 66ch and centre, leaving the header's
left edge out of line with the list below it. The fix is to delete that clause — a **provable no-op**
for all three existing consumers, each of which already sits inside its own `max-w-content mx-auto`
wrapper (`settings.astro:14`, `generate.astro:40`, `review.astro:36`). Width becomes the page's
concern, which is where it belongs.

**4. One increment, not two (Q4).** `Field` has zero consumers outside this migration — all four of
its call sites are created by it — and the principle-8 edit documents a decision this increment makes.
Splitting would ship a primitive with no users and a registry pointing at a component decided against.

### The two deferred contracts

Increment 2's rule: _build the primitives whose contract is already proven by existing duplication;
defer the ones whose contract we would have to invent_ (`2026-08-24-paper-ui-primitives.md:49`).

**`Field` — build it.** Four label-plus-textarea pairs, two files, with a byte-identical class string
on every control (`CreateCardForm.tsx:70–102`, `CardRow.tsx:108–137`). Migrating them to Paper without
a primitive means retyping the same Paper recipe four times in one increment — which principle 8 names
as a finding outright. The contract is exactly what the evidence supports and nothing more: a `<label>`
and a `<textarea>`, no error slot (both consumers show a single form-level or row-level error above
the fields), no icon slot, no hint slot, no end-content slot.

**`Card` — do not build it.** The deferral's return condition was _"after the first two screens are
migrated, when their real regions are visible"_ (`2026-08-24-paper-ui-primitives.md:264`). Three are
migrated; the answer is visible and it is no. The three renderings of "a flashcard's front and back"
are three different components doing three different jobs:

| Where                                | Surface                                    | Role on its screen                                 |
| ------------------------------------ | ------------------------------------------ | -------------------------------------------------- |
| `review/ReviewSession.tsx:203–214`   | `border-border bg-card`                    | The single hero object; no actions inside it       |
| `generate/DraftReviewList.tsx:133–141` | `border-surface-draft-border bg-surface-draft` | A provisional draft in a list, with keep/discard |
| `library/CardRow.tsx`                | `border-border`, **no fill** (this spec)   | A saved row in a paginated list, with edit/delete  |

Two facts kill the shared component. The surfaces are **required** to differ — principle 7 says an
unsaved draft must never look like a saved card, and `--surface-draft` exists to hold that line, so a
`Card` spanning the draft and saved rows would exist to erase the one difference the direction demands.
And inside `/library` there is exactly **one** instance; one is not duplication, and manufacturing
consumers by reaching into two already-migrated screens is the abstraction-for-future-use the rule
exists to stop.

**Action:** edit the manual section of `.uxproof/conventions.md`, principle 8, to list `PageHeader`,
`Section`, `Notice`, `EmptyState`, `Field` — dropping `Card` — with one sentence recording why: _the
flashcard surface is rendered per screen, because principle 7 requires the draft, saved and review
surfaces to differ._

### Alternatives considered

| Alternative                                              | Why rejected                                                                                                                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/library` + `/dashboard` together                        | 791 lines over five files, bundling a form-and-list derivation with a priority-hierarchy derivation, burying the pair's one genuinely contested decision inside a diff about textareas.  |
| `/dashboard` alone next                                   | Its low legacy count is an artifact (`dashboard.astro:92–113` hoists eleven class strings into `const`s). Its two-tier hierarchy rests on glass + gradient, neither of which Paper has — a design argument best settled once the Paper vocabulary is complete. `/library` is the last screen that adds to that vocabulary. |
| Build `Card` anyway, to "finish the registry"             | Directly contradicts principle 7 and the deferral rule. A registry entry with no legitimate consumer is worse than an absent one.                                                        |
| Give `Field` an `error` slot now, for the auth family     | `auth/FormField.tsx` is a different family (`<input>`, required icon, password-toggle slot, per-field error) on a screen this increment does not migrate. Reconciling them today means designing a form taxonomy for un-redesigned screens — the invention the rule forbids. |
| Add an action slot to `Section` for the search form        | One consumer. The search reads better as a full-width filter row above the list anyway (see UI/UX).                                                                                     |

## 📝 Architecture

### Frozen surface — out of scope by definition

**Not touched at all:** `src/pages/api/cards.ts`, `src/pages/api/cards/[id].ts`,
`src/components/library/CardList.tsx` (a `<ul className="space-y-3">` with no colour in it),
`src/components/ui/LibBadge.astro`, `src/components/auth/FormField.tsx`,
`src/components/generate/PasteAndGenerateForm.tsx`, `tests/e2e/**`.

**Not touched _within_ `library.astro`:** the `PAGE_SIZE = 20` constant; the `rawPage` / `page`
parsing; the `q` trim and the `safeQ` character strip; `buildHref`; `orFilter`; the head-only `count`
query and the `range` query; `totalPages` / `lastPage` / `effectivePage` / `shouldFixPageUrl`; the
`is:inline` `history.replaceState` script; `hasPrev` / `hasNext`; the `Astro.locals.isReadOnly` read.

**Not touched _within_ `CreateCardForm.tsx` and `CardRow.tsx`:** `FALLBACK_MESSAGES` (both maps),
`parseErrorBody` / `parseError`, `handleSubmit`, `handleSave`, `handleDelete`, `startEdit`,
`cancelEdit`, `canSubmit` / `canSave`, every `useState`, the `window.confirm` copy, and all three
`window.location.assign("/library")` calls.

Two properties make that fence credible: the entire data path lives in the Astro frontmatter above the
`---`, physically separate from the markup being rewritten; and both E2E suites locate by role, label
and text only — there is not one CSS selector or class assertion between them.

### Preserved accessible names (asserted by the existing suites)

| Name                       | Asserted by                          | Where it lives after this change    |
| -------------------------- | ------------------------------------ | ----------------------------------- |
| Heading `Card library`     | `auth.setup.ts:61`                   | `<PageHeader title="Card library" />` |
| Textbox `Front` (exact)    | `seed.spec.ts:50`                    | `<Field label="Front" …>`           |
| Textbox `Back` (exact)     | `seed.spec.ts:51`                    | `<Field label="Back" …>`            |
| Button `Create card`       | `seed.spec.ts:56`                    | `<Button type="submit">`            |
| `getByRole("listitem")`    | `seed.spec.ts:33`                    | `CardRow`'s `<li>`                  |
| Button `Delete` in a row   | `seed.spec.ts:35`                    | `<Button variant="ghost">`          |

The new search label is `Search cards`. It contains neither `Front` nor `Back`, and `seed.spec.ts`'s
locators are `exact: true` regardless, so no collision is possible from either direction.

### Changed surface

| File                                          | Change                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/components/ui/Field.tsx`                 | **New.** The label-plus-textarea primitive.                                                 |
| `src/components/ui/PageHeader.tsx`            | Delete `max-w-content mx-auto` from the `<header>` class (provable no-op for all consumers). |
| `src/components/library/LibrarySearch.astro`  | **New.** Page-local composition of the search row, so it is single-sourced across the two branches that render it. Not a registry primitive. |
| `src/pages/library.astro`                     | Markup below the `---` only: page frame, header, notices, both regions, empty states, pagination. |
| `src/components/library/CreateCardForm.tsx`   | Error → `Notice`; two textareas → `Field`; hand-rolled submit → `Button`.                    |
| `src/components/library/CardRow.tsx`          | `<li>` surface; front/back typography; error → `Notice`; two textareas → `Field`; `Delete` → ghost. |
| `.uxproof/conventions.md`                     | Principle 8 registry: `Card` removed, reason recorded.                                       |
| `src/components/library/library-paper.test.ts` | **New.** Source-level guard test.                                                            |
| `src/components/ui/primitives.test.ts`        | Extend `NEW_PRIMITIVES` with `Field.tsx`; add `Field` contract criteria.                     |

### Primitives consumed

| Primitive    | Use here                                                       | Consumer count before → after |
| ------------ | -------------------------------------------------------------- | ----------------------------- |
| `PageHeader` | Page `h1`, replacing the gradient heading and the back link      | 3 → 4                         |
| `Section`    | "Create a card"; "Saved cards (N)" when the list is non-empty    | 1 → 3                         |
| `Notice`     | Unconfigured, load error, read-only, create error, row error     | 3 → 8                         |
| `EmptyState` | Empty library; empty search result                               | 2 → 4                         |
| `Button`     | Create card (filled), Search (outline), Edit / Cancel / Delete (ghost), Save (filled, in edit mode) | — |
| `Field`      | Create front/back; row edit front/back                           | 0 → 4 (all in this increment) |

### The new primitive — `src/components/ui/Field.tsx`

```tsx
export interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;        // default 2
  placeholder?: string;
  disabled?: boolean;
}
```

Renders, inside a plain `<div>`:

- `<label htmlFor={id} className="text-meta text-foreground mb-1 block">{label}</label>`
- `<textarea id={id} …>` carrying the Paper control recipe copied verbatim from
  `PasteAndGenerateForm.tsx:101` plus `resize-y`:
  `border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none disabled:opacity-50`

`onChange` takes the **string**, not the event: all four call sites do `setX(e.target.value)` and
nothing else, so the event is dead weight at every one of them.

No `error`, `icon`, `hint`, or end-content slot — none has a consumer in this increment, and each is a
contract we would be inventing. The two known future adopters and their blockers are recorded under
**Later** in Scope.

## 📝 Data Model

No change. No migration, table, column, or index. RLS continues to scope reads; no `user_id` filter is
added (`dashboard.astro:18–24` records why).

## 📝 API Contracts

No change. The `POST /api/cards`, `PATCH /api/cards/[id]` and `DELETE /api/cards/[id]` request and
response shapes are untouched, as are both `FALLBACK_MESSAGES` maps that render their error codes.

## 📝 UI/UX

### 1. Page frame

```astro
<div class="bg-background text-foreground min-h-screen p-4">
  <div class="mx-auto max-w-3xl space-y-8 py-8">
    <PageHeader title="Card library" />
```

`space-y-8` matches `/settings`, the other two-region page. `max-w-3xl` is the Q3b exception and is the
width `/library` renders at today, so the change is a width the page keeps rather than one it invents.
The gradient `<h1>` and the `← Dashboard` link are both deleted — the accessible name `Card library`
survives verbatim through `PageHeader`, and the top navigation has carried Dashboard since Increment 3,
exactly as `/settings`, `/generate` and `/review` each dropped theirs.

The two bare error paragraphs become `Notice variant="error"`, strings unchanged
(`Supabase is not configured — your library cannot be loaded.` and
`Could not load your cards. Try refreshing the page.`). `Notice` supplies the `role="alert"` and
`aria-live="assertive"` they never had.

### 2. Create a card

`<Section title="Create a card">` replaces the glass `<section>`. Read-only renders
`<Notice variant="warning">` with its text unchanged; otherwise `<CreateCardForm client:load />`,
unchanged as a call site.

Inside `CreateCardForm`: the hand-rolled red paragraph becomes
`<Notice variant="error">{error.message}</Notice>`; the two label-plus-textarea blocks become two
`<Field>`s (ids `card-front`, `card-back`; labels `Front`, `Back`; placeholders unchanged); the
hand-rolled submit becomes
`<Button type="submit" className="w-full" disabled={submitting || !canSubmit}>` keeping both icon
states and both labels (`Create card`, `Saving…`). This is the screen's **one filled button**
(principle 5).

### 3. Saved cards

**The search form moves out of the heading row.** Today it is crammed beside the `<h2>` in a
`flex-wrap` row that stacks awkwardly under 390px. As a full-width row above the list it reads as a
filter on the list below it, which is what it is. It is extracted to
`src/components/library/LibrarySearch.astro` — page-local, not a registry primitive — because two
different branches render it and duplicating twelve lines of markup is exactly what principle 8
objects to:

- a visually hidden `<label for="library-search">Search cards</label>`
- the input, `id="library-search"`, `name="q"`, placeholder `Search front or back…` unchanged,
  carrying the same Paper control recipe as `Field`'s textarea
- `<Button type="submit" variant="outline" size="sm">Search</Button>`
- when `q` is set, a `Clear` link, `text-link text-sm underline underline-offset-4`

The visible label is a **fix, not a restyle**: today the input's only accessible name is a placeholder.
It does not go through `Field`, which is textarea-only by contract.

**Three rendering branches:**

| Condition                        | Renders                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `cards.length > 0`               | `<Section title={`Saved cards (${totalCount})`}>` containing `LibrarySearch`, `CardList`, and the pagination `<nav>` when `totalPages > 1` |
| `cards.length === 0 && q`        | `LibrarySearch` in a plain `<div>`, then `<EmptyState>` "No cards match your search"             |
| `cards.length === 0 && !q`       | `<EmptyState>` "Your library is empty" — no search row: an empty library has nothing to filter   |

The empty branches carry no `Section`, so exactly one hairline and one `<h2>` render in each (Q2b).
Copy, verbatim:

- **No match** — title `No cards match your search`; body
  `Nothing in your library matches “{q}”. Try a different word, or clear the search.`; action
  `Clear search` → `/library`.
- **Empty library** — title `Your library is empty`; body
  `Cards you save appear here. Create one above, or generate a batch from a passage of text.`; action
  `Generate cards` → `/generate`.

Both actions render as anchors via `<Button asChild variant="outline" size="sm"><a href="…">`; the
Radix `Slot` at `button.tsx:38–44` is confirmed present and the variant classes merge through `cn`.

**Pagination** keeps its `<nav aria-label="Library pagination">` and its `Page {n} of {m}` text. The
two glass link-buttons become underlined text links (`text-link text-sm underline underline-offset-4`)
and the two disabled states become `<span class="text-muted-foreground text-sm" aria-disabled="true">`.
They are not `Button`s: principle 5 allows one filled button per screen and that is `Create card`;
page navigation is a link, and the underline keeps it identifiable without colour (WCAG 1.4.1).

### 4. The saved row — `CardRow`

**Display mode.** The `<li>` becomes `border-border rounded-paper border p-4` with **no background
fill** — `--card` and `--background` both resolve to `--ink-05` by design (`global.css:105,112`), so a
saved row separates by hairline and space, the same way `/review`'s card face does. That is also what
keeps it visually distinct from a `/generate` draft on `--surface-draft` (principle 7).

Front and back are the hero of the row (principle 3), both at the content floor (Q1a):

- front: `text-foreground text-title font-serif break-words`
- back: `text-muted-foreground mt-1 text-title font-serif break-words`

Same size, distinguished by colour role and order — the treatment `/review` uses. `break-words` is
kept from today's markup and is what stops a long unbroken string overflowing at 390px.

**Row actions become quiet.** `Edit` and `Delete` are both `<Button variant="ghost" size="sm">`, with
`Delete` additionally carrying `className="text-destructive"`. Both glyphs (`Pencil`, `Trash2`) and
both text labels stay. This deliberately departs from `settings/DeleteAccountButton.tsx`'s filled
`variant="destructive"`: settings has one destructive action and it _is_ the point of the section,
whereas `/library` renders up to twenty rows. Twenty filled red buttons put the chrome above the
content (principle 3) and nineteen extra filled buttons on the screen (principle 5). The word `Delete`
carries the meaning; the colour only reinforces it. `window.confirm` stays exactly as it is.

**Edit mode.** The two label-plus-textarea blocks become `<Field>`s with the same id scheme
(`card-front-<id>`, `card-back-<id>`) and the same labels. `Save` stays `<Button size="sm">` (filled)
and `Cancel` stays `<Button size="sm" variant="ghost">` — a filled button inside an opened edit
affordance is that affordance's own primary, not a second page primary, the same reading `/review`
uses for `Reveal answer`. The row error becomes `<Notice variant="error">{error.message}</Notice>`,
which is this file's accessibility fix.

### 5. `PageHeader` gives up its width clause

`PageHeader.tsx:8` changes from `max-w-content mx-auto space-y-2` to `space-y-2`. All three existing
consumers already wrap it in `max-w-content mx-auto` (`settings.astro:14`, `generate.astro:40`,
`review.astro:36`), so the rendered output of `/settings`, `/generate` and `/review` is byte-identical.
A primitive that describes a page header should not also decide the page's measure.

## 📝 Edge Cases & Failure Scenarios

| State                    | Trigger                          | What the user sees                                                                                     | What they can do                       |
| ------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Loaded, cards present    | `/library` with saved cards      | `PageHeader`; "Create a card"; "Saved cards (N)" with search row, hairline rows, pagination when N > 20 | Create, search, edit, delete, page     |
| Empty library            | no saved cards, no `q`           | `EmptyState` "Your library is empty" + "Generate cards"; no search row, no "Saved cards (0)" heading    | Create above, or go to `/generate`     |
| Empty search             | `q` set, no match                | Search row, then `EmptyState` "No cards match your search" + "Clear search"                            | Clear the search, or search again      |
| Load error               | count or select query errors     | `Notice variant="error"` above both regions; the create form still renders                             | Refresh; creating still works          |
| Not configured           | `createClient` returns `null`    | `Notice variant="error"` "Supabase is not configured…"                                                 | Nothing on this page                   |
| Read-only                | account pending deletion         | Create region shows `Notice variant="warning"`; rows render without Edit/Delete                         | Read and search only                   |
| Creating                 | submit pressed                   | Filled button shows spinner + "Saving…"; both `Field`s disabled                                        | Wait; the page reloads on success      |
| Create failed            | non-OK response or network error | `Notice variant="error"` above the fields with the existing `FALLBACK_MESSAGES` text, announced        | Correct and resubmit                   |
| Editing a row            | Edit pressed                     | Row text replaced by two `Field`s, Save (filled) and Cancel (ghost)                                     | Save, or cancel back to display        |
| Row action failed        | PATCH or DELETE non-OK           | `Notice variant="error"` at the top of that row, **announced for the first time**                       | Retry, or cancel                       |
| Out-of-range page        | `?page=99`                       | Last page's rows; URL silently rewritten by the existing inline script                                 | Page normally                          |
| 200-char unbroken string | pathological card front          | `break-words` wraps it; `scrollWidth` does not exceed the viewport at 390px                            | Read, edit, delete normally            |

**Failure modes this change cannot introduce.** No network call, migration, or long-running job is
added. Every failure path already existed and is being re-rendered, not re-implemented — the guarantee
rests on the frozen-surface list above and is checked by the guard test's "the data layer is frozen"
block.

## 📝 Risks & Impact Review

| Risk                                                                                     | Severity | Mitigation                                                                                                                                     |
| ---------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| The `PageHeader` edit silently changes `/settings`, `/generate` or `/review`               | Medium   | Provable no-op — all three already wrap it in `max-w-content mx-auto`. Verified by a guard assertion plus a walkthrough of all four pages side by side against `main`. |
| Twenty `text-title` serif rows read as a wall of text                                      | Medium   | Accepted deliberately (Q1a). If the walkthrough says it reads badly, the Paper-legal fix is more vertical rhythm — **not** a smaller size, **not** a fill, and **not** a shadow (principle 4 forbids it outright). Record the outcome in the PR. |
| A hairline-only row on a same-lightness background reads as soup                            | Medium   | `--border` is `--ink-30` against `--ink-05`, the same contrast `/review`'s card face uses. Same fallback as above: rhythm, never fill.          |
| `Field`'s `onChange(value)` signature diverges from `auth/FormField.tsx`                    | Low      | Deliberate — they are different families and `Field` is textarea-only. The reconciliation is a recorded follow-up, not this increment.          |
| `max-w-3xl` diverges from the other three screens                                           | Low      | Explicit, recorded exception with a stated reason. Contained to one page; no new token.                                                        |
| A reviewer prefers `Delete` filled, for consistency with `/settings`                        | Low      | Called out for PR review. If consistency wins, the correct resolution is to bring `/settings` **down** to ghost as a follow-up — not to put twenty filled red buttons on `/library`. |
| An E2E locator breaks                                                                       | Low      | Every asserted name is tabulated above and guarded by the source-level test. `git diff origin/main -- tests/` must be empty (AC4).             |

**Blast radius.** Three shipped screens are touched only through the `PageHeader` one-liner; one screen
is rewritten; one primitive is added; no API, schema, or config surface changes. **Rollback** is
`git revert` of the phase commits — there is no migration, no persisted state, and no feature flag to
unwind.

## 📋 Scope

**Now.** `src/pages/library.astro`; `src/components/library/CreateCardForm.tsx`;
`src/components/library/CardRow.tsx`; new `src/components/library/LibrarySearch.astro`; new
`src/components/ui/Field.tsx`; the one-line `src/components/ui/PageHeader.tsx` edit; the principle-8
edit in `.uxproof/conventions.md`; new `src/components/library/library-paper.test.ts`; extensions to
`src/components/ui/primitives.test.ts`.

**Later (follow-ups to file, not to build here).**

- `generate/PasteAndGenerateForm.tsx:90–105` — a textarea with **no `<label>` at all**, its only
  accessible name a placeholder (WCAG 2.2 §3.3.2), plus a character counter needing a `hint` slot
  `Field` does not have. File as `bug`, `priority-medium`.
- `auth/FormField.tsx` — its own family (input, required icon, password toggle, per-field error) and
  its filed, still-open `aria-invalid` / `aria-describedby` gap (WCAG 2.2 §3.3.1).
- `/dashboard`, re-deriving its two-tier hierarchy in Paper; then `bg-cosmic`, `Layout.astro`'s
  `<body>` class, the three auth screens, `Welcome.astro`, the starter landing.
- `--radius` becoming `0.375rem` with `rounded-paper` deleted, per the removal condition at
  `global.css:276`.
- The unused `ui/LibBadge.astro`: delete or give it a consumer.

**Not doing.** Any API, query, or pagination-logic change. A `Card` primitive. A `Field` error, icon,
or hint slot. Any change to `auth/FormField.tsx` or `PasteAndGenerateForm.tsx`. Replacing
`window.confirm` with a `Dialog`. Sorting, bulk selection, tags, or any new library feature. Dark mode.
Removing the `bg-cosmic` utility itself.

## ✅ Acceptance criteria

1. **Given** `/library` at any viewport, **when** it renders, **then** none of `library.astro`,
   `LibrarySearch.astro`, `CreateCardForm.tsx`, `CardRow.tsx` contains `bg-cosmic`, `backdrop-blur`,
   `rounded-2xl`, `bg-gradient-to-`, or any Tailwind palette-scale utility, **and** the body's
   `bg-cosmic` is nowhere visible behind the page.
2. **Given** a saved card, **when** its row renders in display mode, **then** the front and back both
   carry `text-title font-serif break-words`, and are larger and higher-contrast than the Edit and
   Delete labels beside them.
3. **Given** a card whose front is a 200-character unbroken string, **when** the row renders at 390px,
   **then** `document.documentElement.scrollWidth` does not exceed the viewport width.
4. **Given** `tests/e2e/seed.spec.ts` and `tests/e2e/auth.setup.ts` **unmodified**
   (`git diff origin/main -- tests/` is empty), **when** `npm run test:e2e` runs, **then** every spec
   passes.
5. **Given** a create, edit, or delete failure, **when** the error appears, **then** it renders through
   `Notice variant="error"`, carrying `role="alert"` and `aria-live="assertive"`.
6. **Given** the saved-cards region, **when** it renders, **then** the search input has a programmatic
   label whose text contains neither `Front` nor `Back`, and an accessibility scan reports no form
   element without an accessible name.
7. **Given** `src/components/ui/Field.tsx`, **when** the increment lands, **then** it is imported by
   both `CreateCardForm.tsx` and `CardRow.tsx`, has exactly four call sites, and neither file contains
   a literal `<textarea` any more.
8. **Given** the whole repository, **when** the increment lands, **then** no file named `Card.tsx`
   exists under `src/components/ui/`, and principle 8 in `.uxproof/conventions.md` lists `PageHeader`,
   `Section`, `Notice`, `EmptyState`, `Field` and not `Card`, with the reason recorded.
9. **Given** a page of twenty saved cards, **when** it renders, **then** exactly one filled button
   (`Create card`) is present; Edit and Delete are `ghost`; pagination controls are links or disabled
   spans.
10. **Given** an empty library and, separately, a search with no matches, **when** each renders,
    **then** each shows exactly one `<h2>` and one hairline for the region, with the `EmptyState` title,
    body and action written above, verbatim — and the empty-library case renders no search row.
11. **Given** `/settings`, `/generate` and `/review`, **when** they render after the `PageHeader` edit,
    **then** each is visually identical to `main`.
12. **Given** `/library` and `/generate` side by side, **when** a saved row and a draft row are
    compared, **then** their surfaces are visibly different, satisfying principle 7.
13. **Given** the increment is complete, **when** `npm run typecheck`, `npm run lint`, `npm run build`
    and `npm test` run, **then** all pass, and the source-level guard test has been shown to fail on a
    deliberate break before being accepted.

### How each criterion is verified

There is no jsdom/RTL harness in this repo, so acceptance splits two ways, following the technique
`src/styles/tokens.test.ts`, `src/components/ui/primitives.test.ts` and
`src/components/review/review-paper.test.ts` established.

| Criterion               | Verified by                                                                 |
| ----------------------- | ---------------------------------------------------------------------------- |
| 1 (first clause), 2 (first clause), 5, 7, 8, 9 (first clause), 10 (structure) | `library-paper.test.ts` + `primitives.test.ts` (source-level) |
| 4, 13                   | `npm run test:e2e` and the validation gate                                   |
| 1 (second clause), 2 (second clause), 3, 6, 9 (rendered), 10 (copy), 11, 12 | Manual walkthrough at 390px and desktop, `/library` against a `main` control |

## 📋 Phasing

Each phase leaves the application working and is independently revertable.

- **Phase 1 — The primitive and the width fix.** `Field` ships with tests; `PageHeader` gives up its
  width clause. Nothing consumes `Field` yet; the three migrated screens are unchanged. Shippable.
- **Phase 2 — The two React islands.** `CreateCardForm` and `CardRow` move to Paper and adopt `Field`.
  `/library` renders Paper islands inside a legacy glass page — visually mixed, functionally intact.
  Shippable but not a good stopping point; Phase 3 follows immediately.
- **Phase 3 — The page.** `library.astro` and `LibrarySearch.astro`. The screen is fully Paper.
- **Phase 4 — The record and the guard.** The principle-8 edit and `library-paper.test.ts`, including
  the deliberate-break proof and the manual walkthrough.

## 📋 Implementation Plan

### Phase 1 — The primitive and the width fix

1. Create `src/components/ui/Field.tsx` per the contract in **Architecture**: `<label>` +
   `<textarea>`, `onChange(value: string)`, `rows` defaulting to `2`, no error/icon/hint slot.
   _Testable:_ `npm run typecheck` passes; the file exports `Field`.
2. Extend `src/components/ui/primitives.test.ts`: add `Field.tsx` to `NEW_PRIMITIVES`, and assert
   Field renders a `htmlFor`/`id` pair, carries the Paper control recipe, and contains no
   palette-scale utility and no `error`/`icon`/`hint` prop.
   _Testable:_ `npm test`.
3. Delete `max-w-content mx-auto ` from `PageHeader.tsx:8`, leaving `space-y-2`. Add an assertion to
   `primitives.test.ts` that `PageHeader.tsx` contains no `max-w-` utility, with a comment naming why
   (width is the page's concern).
   _Testable:_ `npm test`; then `npm run build` and a visual check of `/settings`, `/generate`,
   `/review` against a `main` control (AC11).

### Phase 2 — The two React islands

4. `CreateCardForm.tsx`: replace the hand-rolled error `<p>` with
   `<Notice variant="error">{error.message}</Notice>`; drop the now-unused `CircleAlert` import.
   _Testable:_ trigger a create failure (submit against a stopped API) and confirm the notice renders
   and is announced.
5. `CreateCardForm.tsx`: replace both label/textarea blocks with `<Field>` (`card-front` / `Front`,
   `card-back` / `Back`, placeholders unchanged, `disabled={submitting}`, `rows={2}`).
   _Testable:_ `getByRole("textbox", { name: "Front", exact: true })` still resolves; the create flow
   still saves.
6. `CreateCardForm.tsx`: replace the hand-rolled submit `<button>` with
   `<Button type="submit" className="w-full" disabled={submitting || !canSubmit}>`, keeping both icon
   states and both labels.
   _Testable:_ `seed.spec.ts`'s `getByRole("button", { name: "Create card" })` still resolves.
7. `CardRow.tsx`: error `<p>` → `Notice variant="error"`; both edit textareas → `<Field>` with the
   `card-front-<id>` / `card-back-<id>` scheme.
   _Testable:_ open a row's edit mode, force a PATCH failure, confirm the notice renders and is
   announced.
8. `CardRow.tsx`: restyle the `<li>` to `border-border rounded-paper border p-4`; front and back to
   `text-title font-serif break-words` with `text-foreground` / `text-muted-foreground`.
   _Testable:_ the guard test's AC2 block (added in Phase 4) and a 390px walkthrough with a
   200-character front (AC3).
9. `CardRow.tsx`: `Delete` becomes `<Button variant="ghost" size="sm" className="text-destructive">`,
   keeping the `Trash2` glyph, the `Delete` label, the spinner state and `window.confirm`.
   _Testable:_ `seed.spec.ts`'s `afterEach` still finds and clicks `Delete`.

### Phase 3 — The page

10. Create `src/components/library/LibrarySearch.astro`: visually hidden
    `<label for="library-search">Search cards</label>`, the input with the Paper control recipe, the
    outline `Search` button, and the conditional `Clear` link. It takes `q` as a prop.
    _Testable:_ `getByLabel("Search cards")` resolves; searching still filters (AC6).
11. `library.astro` markup: page frame (`bg-background text-foreground min-h-screen p-4` /
    `mx-auto max-w-3xl space-y-8 py-8`), `<PageHeader title="Card library" />` replacing the gradient
    `<h1>` and the `← Dashboard` link, and both bare error paragraphs → `Notice variant="error"`.
    _Testable:_ `auth.setup.ts`'s `getByRole("heading", { name: "Card library" })` still resolves.
12. `library.astro`: the create region → `<Section title="Create a card">` with the read-only branch as
    `<Notice variant="warning">`.
    _Testable:_ toggle `isReadOnly` and confirm both branches render.
13. `library.astro`: the saved-cards region's three branches per the UI/UX table — `Section` +
    `LibrarySearch` + `CardList` + pagination when non-empty; `LibrarySearch` + `EmptyState` when `q`
    with no match; `EmptyState` alone when the library is empty.
    _Testable:_ all three branches reachable by hand; AC10 (one `<h2>`, one hairline per empty branch).
14. `library.astro`: pagination links → `text-link text-sm underline underline-offset-4`; disabled
    states → `<span class="text-muted-foreground text-sm" aria-disabled="true">`; `<nav
    aria-label="Library pagination">` and the `Page {n} of {m}` text unchanged.
    _Testable:_ with 21+ cards, page forward and back; `?page=99` still clamps and rewrites the URL.

### Phase 4 — The record and the guard

15. Edit the manual section of `.uxproof/conventions.md`, principle 8: registry becomes `PageHeader`,
    `Section`, `Notice`, `EmptyState`, `Field`, with the recorded reason for dropping `Card`.
    _Testable:_ AC8's grep.
16. Create `src/components/library/library-paper.test.ts` covering the source-level criteria in the
    verification table: the legacy-utility and palette-scale bans across all four files; the page's own
    Paper ground and `max-w-3xl`; the row's `text-title font-serif break-words` on both faces; `Field`
    imported by both files with exactly four call sites and no literal `<textarea`; both errors routed
    through `Notice variant="error"`; exactly one `variant="default"` outside edit mode; `Edit` and
    `Delete` both `ghost`; no `Card.tsx` under `src/components/ui/`; and a "the data layer is frozen"
    block asserting `PAGE_SIZE = 20`, the `safeQ` regex, `orFilter`, `buildHref`, the
    `history.replaceState` script, and the three `window.location.assign("/library")` calls survive
    verbatim.
    _Testable:_ `npm test`.
17. Prove the guard: break one asserted property deliberately (e.g. restore `bg-cosmic` on the wrapper),
    confirm `npm test` goes red, revert.
    _Testable:_ the red run is recorded in the PR body (AC13).
18. Run the validation gate — `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` — then
    `npm run test:e2e` with `git diff origin/main -- tests/` empty (AC4), then the manual walkthrough
    at 390px and desktop covering AC1, 2, 3, 6, 9, 10, 11, 12, with `/library` and `/generate` compared
    side by side for principle 7.
19. File the two follow-ups listed under **Later**: the `PasteAndGenerateForm` missing-label bug
    (`bug`, `priority-medium`) and the `Field`-adoption note for the auth family.
