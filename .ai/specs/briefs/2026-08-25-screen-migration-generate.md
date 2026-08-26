# Increment 5 — Screen migration: `/generate`

**Status:** handoff, ready to plan
**Written:** 2026-08-25 · `om-ux-shape` (Handoff mode)
**Follows:** Increment 4, screen migration `/settings`, merged as `1a88d37` (PR #35), plus one
follow-up commit `c8483dc`
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Strategy C order:** tokens → primitives → shell / mobile navigation → **screen migration** (2 of 5) → remove `bg-cosmic`

---

## 📝 Current-state findings

**Re-measured today at `HEAD` (`c8483dc`).** `grep -rnoE 'rounded-(md|lg|xl)\b' src/ | wc -l` returns
**61**, matching Increment 4's own predicted-and-verified number exactly — nothing has drifted since
that increment landed.

**`/generate` is the smallest remaining screen by total touched surface, and the only one that
exercises a shipped-but-unconsumed Paper token.** Measured directly: `src/pages/generate.astro` is 82
lines, `src/components/generate/PasteAndGenerateForm.tsx` is 128, `src/components/generate/DraftReviewList.tsx`
is 191 — 401 lines total across three files. `/library` (195 + 123 + 186 + 17 = 521 across four files)
and `/dashboard` (270 lines in one file, eight rendered states, its own resolver) are both larger.
`/review`'s own page file is smaller (55 lines), but its one consumer, `ReviewSession.tsx` (319 lines),
owns the keyboard-shortcut interaction shipped six days ago (`.ai/specs/briefs/2026-08-20-review-keyboard-shortcuts.md`)
— restyling it means touching the file with the freshest, least-settled interaction logic in the repo,
for no migration benefit `/generate` doesn't already offer. `/generate` is the better trade: small,
uncoupled from anything recently changed, and — via `DraftReviewList`'s per-draft rows — the first
screen where `--surface-draft` / `--surface-draft-border` get a real consumer. Those two tokens shipped
in Increment 1 (`.ai/specs/briefs/2026-08-22-token-layer-paper-ramp.md`) specifically for principle 7
("a draft is visibly provisional") and have had zero consumers in `src/` ever since — confirmed today by
`grep -rn "surface-draft" src/`, which returns only `global.css` and `tokens.test.ts`.

**Every raw-literal box in scope maps onto an already-shipped primitive or token — nothing here requires
inventing a new contract.** Inventory, read directly from the three files:

| File | Occurrence | What it is | Existing primitive/token it maps to |
|---|---|---|---|
| `generate.astro:47` | `rounded-lg border border-red-500/30 bg-red-900/30 …` | "Supabase not configured" | `Notice variant="error"` |
| `generate.astro:55` | same recipe | "Could not load your drafts" | `Notice variant="error"` |
| `generate.astro:65` | `rounded-lg border border-amber-500/30 bg-amber-900/20 …` | read-only warning | `Notice variant="warning"`, no `action` — the first bare-warning use |
| `PasteAndGenerateForm.tsx:86` | same red recipe | generation error | `Notice variant="error"` |
| `DraftReviewList.tsx:104` | same red recipe | save error | `Notice variant="error"` |
| `DraftReviewList.tsx:141` | `rounded-lg border border-white/10 bg-white/5` per `<li>` | one draft row | `bg-surface-draft` / `border-surface-draft-border` — principle 7's own token, first real use |
| `DraftReviewList.tsx:119,128,155` | `border-green-500/30 bg-green-900/20 text-green-200` / the red equivalent | Keep/Discard controls | `--success` / `--success-surface`, `--destructive` / `--destructive-surface` — like-for-like token swap, same technique Increment 2 used on `Banner.astro` |
| `PasteAndGenerateForm.tsx:112`, `DraftReviewList.tsx:184` | hand-rolled `<button>` | Generate / Save changes submits | `<Button>` — the contract's own native-equivalents rule, `<button>` → `<Button>` |

**Two sibling regions on one page, when drafts exist, are the second and third real instances of the
exact shape Increment 2 deferred `Section`/`Card` on.** `generate.astro` today wraps `DraftReviewList`
and the `PasteAndGenerateForm` host in two separate `rounded-2xl border border-white/10 bg-white/10 …
backdrop-blur-xl` boxes — the same recipe `/settings`'s danger zone carried before Increment 4 turned it
into a hairline region (`border-border border-t pt-6`, a title, and body content). Increment 2's return
condition for this was explicit: *"after the first two screens are migrated, when their real regions are
visible."* `/settings` is the first, already shipped. This increment produces the second migrated screen
**and** two real region instances inside it in the same diff — three total instances of one shape,
across two screens, is the duplication bar Increment 2 itself used to justify `Notice`, `EmptyState` and
`PageHeader` in the first place ("build the primitives whose contract is already proven by existing
duplication"). See the Section decision below.

**A genuine principle-5 tension exists here that no prior increment had to resolve, and it needs a
recorded decision.** Principle 5: "Exactly one filled button per view." When drafts exist, both
`PasteAndGenerateForm`'s `Generate` submit and `DraftReviewList`'s `Save changes` submit render on the
same page simultaneously. Today neither is meaningfully "filled" — `Generate` is a neutral
`bg-white/10` button, `Save changes` is the closest thing to a filled action already present
(`bg-blue-600/30 text-white`) — so the current screen has never actually had to choose. Migrating both to
Paper tokens forces the choice explicitly, because `--primary` and `--accent`(blue) are no longer
interchangeable neutral-ish fills the way ad-hoc opacity utilities were. **Resolution below, not left
open**, on the same reasoning `/dashboard`'s already-shipped priority rule uses: resolving an
already-produced, waiting artifact outranks starting new work. `DraftReviewList` already renders above
the form in DOM order today, which is the existing UI's own implicit vote for the same ordering.

**One pre-existing `button.tsx` gap surfaces while reading it for this increment, and it is out of
this increment's blast radius.** Every non-`link`/`ghost` variant (`default`, `destructive`, `outline`,
`secondary`) carries `shadow-xs` — a shadow on a button, which principle 4 reserves for `Dialog`,
`Popover`, `Tooltip` and `Toast` only. `button.tsx` is shared by every screen already in production
(`CardRow`, `DeleteAccountButton`, both `SubmitButton`s), so fixing it reaches past `/generate` the same
way `CancelDeletionButton.tsx`'s error span reached past `/settings` in Increment 4. Recorded as a
follow-up below, not fixed here.

---

## 🎯 Outcomes

**User outcome.** A signed-in user visiting Generate reads a page that looks and reads consistently with
the rest of the product's decided direction — paper background, ink text, hairline-separated regions
instead of dark glass boxes — and can still paste text to generate cards, review a draft batch, and
keep/discard/save exactly as before, with every error and warning now announced to assistive technology,
and a pending draft visibly distinguished from a saved card for the first time.

**Behavioral signal.** `/generate` renders with `document.body`'s `bg-cosmic` fully hidden beneath the
page's own `bg-background` surface, matching `/settings`; a screen-reader user triggering a failed
generation or save hears the message announced; a sighted user can tell a draft row apart from a saved
card by surface alone, without reading the section heading.

**Business effect.** Delivers the second and third real-world proof of `Notice` (four new consumers
across two files, including its first bare-warning use), the first real-world use of `Section` — built in
this increment from now-duplicated evidence rather than guessed contract — and the first real consumer of
principle 7's draft-surface tokens, shipped inert in Increment 1 and unused for three increments since.

**Guardrail.** The generation request/response behavior, the draft accept/reject/save flow, the
`window.confirm()` steps, and the redirect targets must not change in any way — only the surrounding
markup, styling, and which submit button carries the filled treatment change. Signing out, navigating,
and every shell affordance already shipped in Increment 3 must keep working unchanged on this page.

---

## 📋 Scope

**Now:** migrate `/generate` only — `generate.astro`'s heading, back link, not-configured/loadError
notices, isReadOnly branch, and the two section wrappers; `PasteAndGenerateForm.tsx`'s error state, its
section wrapper, and its submit button; `DraftReviewList.tsx`'s error state, its section wrapper, its
Keep/Discard/toggle colours, its per-row draft surface, and its submit button. One new file,
`src/components/ui/Section.tsx`, extracted from the now-duplicated hairline-region shape and consumed by
both `PasteAndGenerateForm` and `DraftReviewList` (see Behavior).

**Later:** the remaining three screens (`/dashboard`, `/library`, `/review`) migrate in their own
increments; `Card` (the domain flashcard component), still deferred, still separate from `Section`;
`--radius-paper` and `bg-cosmic` removal, gated on every screen migrating, not this one; the
`button.tsx` `shadow-xs` fix, filed as a follow-up; retrofitting `/settings`'s already-shipped
danger-zone markup onto the new `Section` component — safe and mechanical, but not required for
`Section`'s contract to be proven, and left as a small standalone follow-up so this increment's blast
radius stays one screen.

**Not doing:** any change to `dashboard.astro`, `library.astro`, `review.astro`, `settings.astro`, or any
auth page; any change to the `/api/generations` or `/api/generations/save` request logic, the
`window.confirm()` steps, or the redirect targets; a new `Card` primitive; an empty state for "no drafts
yet" (not present today — inventing new copy is out of scope); dark mode; the global `bg-cosmic` utility
or `Layout.astro`'s `<body>` class; the `button.tsx` `shadow-xs` fix.

---

## 📋 Direction comparison

**A — Migrate `/dashboard` next instead (rejected).** Largest single file (270 lines), eight rendered
states, and its own brief explicitly scoped it to inherit the sibling pages' styling *unmigrated*
("this increment introduces no new colour decisions... the eventual design-system sweep restyles the
dashboard alongside every other screen") — meaning migrating it now means re-deriving a tiered
primary/secondary visual language (the "Next up" / "Also waiting" / "Your library" hierarchy) in Paper
terms essentially from scratch, a bigger and more consequential decision than this increment's budget.
Rejected on size and risk, not on eventual necessity.

**B — Migrate `/library` next instead (rejected, close).** Offers the same two-sibling-region evidence
for `Section` that `/generate` does, and is explicitly named in Increment 2 as a directly-upcoming
`EmptyState` consumer. But it is the larger of the two candidates (521 lines across four files against
401), and it adds two new interaction surfaces this increment would otherwise have to invent styling
for without a named primitive — a search input/button pair and Previous/Next pagination controls, neither
of which maps onto `Notice`, `EmptyState`, `PageHeader` or the new `Section`. `/generate` reaches the
same `Section` evidence bar with less surface and no undecided interaction styling.

**C — Migrate `/review` next instead (rejected).** Its own page file is the smallest (55 lines), but all
of its real content and every one of its states live in `ReviewSession.tsx`, the file carrying last
week's keyboard-shortcut feature. Restyling it means touching the newest, least-settled interaction
logic in the repo for a Paper migration that gains nothing `/generate` doesn't already offer — and risks
conflating a visual regression with a functional one if anything breaks.

**D — Migrate `/generate` (recommended).** Smallest total surface among the four remaining screens,
zero coupling to recently-changed logic, and the only screen that gives principle 7's inert draft-surface
tokens a real consumer. Its two sibling regions supply the second and third real instances of the
hairline-region shape, meeting `Section`'s duplication bar in the same diff rather than speculatively.

**Decisive trade-off:** D is the smallest true end-to-end migration that still produces genuine new
evidence (a validated `Section`, a validated bare-warning `Notice`, a validated draft-surface token) —
B produces the same `Section` evidence at higher cost and with undecided interaction styling attached; A
and C both cost more without a corresponding increase in what gets proven.

---

## 📝 Handoff

**Intent.** Rebuild `/generate`'s own markup — its heading, both error/warning notices, and its two
section regions — using `PageHeader`, `Notice`, a new `Section` primitive, Paper tokens throughout, and
the page-level `bg-background` full-bleed technique proven in Increment 4. Give principle 7's
draft-surface tokens their first real consumer on `DraftReviewList`'s per-draft rows. Delete the
now-redundant inline "← Dashboard" link.

**Non-goals.** No other page changes. No change to the generation, draft-save, or redirect logic. No
`Card` primitive. No new empty state. No dark mode. No `bg-cosmic` utility or `Layout.astro` change. No
`button.tsx` fix beyond consuming its existing `outline`/`default` variants.

**Actor and trigger.** Any signed-in user who opens `/generate` from the shell nav, whether to paste a
new passage or to decide on a batch of drafts already waiting.

### 📋 Behavior

1. `generate.astro`'s outer wrapper changes from `<div class="bg-cosmic min-h-screen p-4">` to
   `<div class="bg-background text-foreground min-h-screen p-4">`, and the inner column's `max-w-3xl`
   becomes `max-w-content`, matching `/settings`.
2. The `<header>` block (gradient `<h1>` + `← Dashboard` link) is replaced with
   `<PageHeader title="Generate cards" />` — no `description`, no `client:*`, same reasoning as every
   prior `PageHeader` use.
3. The "Supabase not configured" and "Could not load your drafts" paragraphs both become
   `<Notice variant="error">{message}</Notice>`, rendered statically (no `client:*` — neither carries an
   `action`).
4. The isReadOnly branch becomes:
   ```astro
   <Section title="Generate new cards from text">
     <Notice variant="warning">
       Your account is pending deletion and is read-only. Cancel the deletion to generate cards.
     </Notice>
   </Section>
   ```
   Rendered statically, no `client:*` on either component — the first `Notice` in the app with **no**
   `action`, and the first time two static primitives compose directly in `.astro` template syntax with
   neither one hydrating. (See Assumptions — lower risk than Increment 4's cross-boundary case, because
   nothing here hydrates at all, but still unverified in a real browser until this ships.)
5. The non-isReadOnly branch passes a new `primary` boolean to the form island, computed server-side:
   `<PasteAndGenerateForm client:load primary={drafts.length === 0} />`. This is the principle-5
   resolution: when no drafts are waiting, `Generate` is the page's only action and gets the filled
   treatment; when drafts are waiting, `Save changes` (finishing an already-produced, waiting artifact)
   gets the filled treatment instead, and `Generate` steps down to outline. `DraftReviewList` needs no
   equivalent prop — its own submit is filled exactly when it renders, i.e. exactly when drafts exist.
6. **`PasteAndGenerateForm.tsx`** wraps its whole return value in
   `<Section title="Generate new cards from text">…</Section>` (composed inside this one file — the same
   technique Increment 4 used for `RetentionNotice`, so the `Section`/form composition happens in plain
   React, never split across the Astro/React boundary). Its own error `<p>` becomes
   `<Notice variant="error">{error.message}</Notice>` (drop the now-redundant manual `CircleAlert` import
   and icon — `Notice` renders its own). Its submit button becomes
   `<Button type="submit" variant={primary ? "default" : "outline"} disabled={submitting || tooShort}>`,
   keeping its existing `Loader2`/`Sparkles` icon-and-label children unchanged. The textarea keeps its
   own `rounded-lg` legacy geometry (it is not becoming `Field` in this increment) but its literal
   `border-white/20 bg-white/5 text-white placeholder:text-blue-100/40 focus:border-blue-300/50` colours
   become `border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring`.
7. **`DraftReviewList.tsx`** wraps its whole return value in
   `<Section title={\`Review draft batch (${drafts.length})\`} description={\`${acceptCount} to save · ${rejectCount} to discard\`}>…</Section>`
   — the description slot carries the existing subtitle sentence unchanged, so no copy is invented. Its
   own error `<p>` becomes `<Notice variant="error">` (same `CircleAlert` cleanup as above). Its submit
   button becomes `<Button type="button" variant="default" disabled={submitting} onClick={…}>`, keeping
   its existing `Loader2`/`Save` icon-and-label children. `Keep all` / `Discard all` and the per-row
   toggle keep their own hand-rolled `<button>` markup (a two-state semantic toggle does not fit
   `Button`'s variant set, and `Field` stays deferred) but their literal
   `border-green-500/30 bg-green-900/20 text-green-200` / `border-red-500/30 bg-red-900/20 text-red-200`
   become `border-success bg-success-surface text-success` / `border-destructive bg-destructive-surface
   text-destructive`. Each `<li>` draft row's literal `border-white/10 bg-white/5` becomes
   `border-surface-draft-border bg-surface-draft` — principle 7's tokens, first real consumer.

### 📋 New file — `src/components/ui/Section.tsx`

```tsx
export interface SectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <section className="border-border space-y-4 border-t pt-6">
      <div>
        <h2 className="text-title font-semibold">{title}</h2>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {children}
    </section>
  );
}
```

Lifted directly from `/settings`'s own shipped danger-zone markup (`settings.astro:21–28`), generalised
only with a `title`/optional-`description` header the way `EmptyState` generalised `DoneCard`. No radius:
like `EmptyState`, a titled region separated by hairline and space carries no box, so `rounded-paper`
never applies here — consistent with principle 4. **`/settings`'s own danger zone is not retrofitted
onto this component in this increment** — see Scope and Open decisions.

### 📋 States

| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| Generate, resting, no drafts | page load, `drafts.length === 0`, not read-only | "Generate cards" heading, one section "Generate new cards from text" with a filled `Generate` button | Paste text, generate |
| Generate, resting, drafts waiting | `drafts.length > 0` | "Review draft batch (N)" section above "Generate new cards from text"; `Save changes` is filled, `Generate` is outline | Decide on drafts, or paste more text |
| Generating | `Generate` clicked with ≥200 chars | Button shows a spinner and elapsed seconds, is disabled | Wait |
| Generation failed | request fails | An error-tinted `Notice` appears above the textarea: `role="alert"`, `aria-live="assertive"`, the server's message or fallback | Retry by submitting again |
| Generation succeeded | request succeeds | Browser navigates to `/generate`, which now shows the new draft batch | — |
| Reviewing drafts | drafts present | Per-row `Keep`/`Discard` toggle, `Keep all`/`Discard all` bulk setters, each row on the `--surface-draft` tint | Toggle any row, bulk-set, or save |
| Save in progress | `Save changes` clicked, confirmed | Button shows a spinner, is disabled | Wait |
| Save failed | request fails | An error-tinted `Notice` appears above the batch heading | Retry |
| Save succeeded | request succeeds | Browser navigates to `/generate`, reviewed drafts are gone | — |
| Read-only | `isReadOnly` true | "Generate new cards from text" section containing a bare warning `Notice`: "Your account is pending deletion and is read-only. Cancel the deletion to generate cards." | Nothing on this page — cancel from the sitewide retention banner |
| Not configured | `createClient(...)` returns `null` | An error-tinted `Notice`: "Supabase is not configured — drafts cannot be loaded." | Nothing — an operator problem |
| Load error | the drafts query fails | An error-tinted `Notice`: "Could not load your drafts. Try refreshing the page." | Refresh |

### ♿ Accessibility contract

- Exactly one `<h1>` on the page, rendered by `PageHeader`.
- Every `Section` heading is a real `<h2>`, matching `EmptyState`'s and `/settings`'s established pattern.
- Every `Notice` on this page inherits its role/`aria-live` mapping for free — `status`/`polite` for the
  bare warning, `alert`/`assertive` for every error. None are re-specified here.
- The isReadOnly warning carries **no** action, unlike `/settings`'s — nothing to focus-trap or wire.
- `Generate` and `Save changes` both remain real `<button>` elements via `<Button>`, inheriting the
  Increment-2-corrected focus ring (`focus-visible:ring-ring`, 3px, no alpha) for free.
- `Keep`/`Discard`/`Keep all`/`Discard all` keep their existing `aria-pressed` (per-row toggle) and plain
  `<button>` semantics — unchanged by this increment, only their colour literals move to tokens.
- The draft-surface tint (`bg-surface-draft`) is a colour and border change only; it carries no new
  semantic role and needs no new `aria-*` attribute — the row's status (accept/reject) is still carried
  by the existing `aria-pressed` toggle and its label text, not by the draft tint.
- The removed "← Dashboard" link is not a net accessibility loss, for the same reason recorded in
  Increment 4: the shell's `Dashboard` nav item is reachable and `aria-current`-marked on this route.

### 📋 Route / blast-radius map

| File | Change |
|---|---|
| `src/pages/generate.astro` | Header replaced with `PageHeader`; back link removed; not-configured/loadError notices → `Notice`; isReadOnly branch → `Section` + bare warning `Notice`; non-isReadOnly branch passes `primary={drafts.length === 0}` to the form island; outer wrapper `bg-cosmic` → `bg-background text-foreground`, `max-w-3xl` → `max-w-content` |
| `src/components/generate/PasteAndGenerateForm.tsx` | Wrapped in `Section`; error `<p>` → `Notice`; submit button → `<Button variant={primary ? "default" : "outline"}>`; textarea colour literals → tokens; new `primary` prop |
| `src/components/generate/DraftReviewList.tsx` | Wrapped in `Section` (title + description); error `<p>` → `Notice`; submit button → `<Button variant="default">`; Keep/Discard/toggle colour literals → `success`/`destructive` tokens; per-row `<li>` → `surface-draft`/`surface-draft-border` |
| `src/components/ui/Section.tsx` | **New file.** Extracted from `/settings`'s shipped danger-zone markup, generalised with `title`/`description` |
| `src/components/ui/primitives.test.ts` | `NEW_PRIMITIVES` gains `"Section.tsx"` (criterion 9 coverage); criterion 5's asserted `rounded-(md|lg|xl)` count updated from 61 to the re-measured total (expected 54 — verify, do not assume) |
| `src/pages/{dashboard,library,review,settings}.astro`, auth pages | **Untouched** |
| `src/components/settings/**` | **Untouched** — the `Section` retrofit onto `/settings` is a follow-up, not part of this increment |
| `src/styles/global.css` | **No change.** Every token this increment uses (`--surface-draft`, `--surface-draft-border`, `--success*`, `--destructive*`) already exists |

No other file changes.

### 📋 Assumptions to confirm

1. **A statically-rendered `Section` composing a statically-rendered `Notice`, both invoked directly in
   `.astro` template syntax with no `client:*` on either, renders as plain HTML with no hydration
   boundary at all.** `[ASSUMPTION]` — lower-risk than Increment 4's `RetentionNotice` case, because
   nothing here hydrates, but unverified until `astro check` and a real render confirm it.
2. **`Section` composed inside `PasteAndGenerateForm.tsx`'s and `DraftReviewList.tsx`'s own return
   values hydrates correctly as part of each file's existing `client:load` island.** `[ASSUMPTION]` —
   same technique Increment 4 validated for `RetentionNotice`; carried forward with high confidence, but
   confirm under `astro check` before relying on it for a third screen.
3. **The `bg-background` full-bleed wrapper renders as cleanly on `/generate` as it did on `/settings`.**
   `[ASSUMPTION]` — the technique is now proven once in production; this is its second real screen, not
   its first attempt, so risk is lower, but still worth a real-browser check at both viewports.
4. **The re-measured `rounded-(md|lg|xl)` count after this change is 54.** `[ASSUMPTION]` — reasoned
   from the specific edits in the Route/blast-radius map (7 literal removals: 2 page-level notices, 2
   component errors, 2 submit-button conversions, and zero net change from the token-only swaps on
   Keep/Discard/toggle/draft-row, which touch colour, not radius). The implementer must run the grep and
   use the real number.
5. **Giving `Save changes` the filled `default` variant whenever drafts are present, and `Generate` the
   filled variant only when they are not, reads clearly in the browser as "here is the one thing to do
   right now" rather than as an inconsistency.** `[ASSUMPTION]` — this is the increment's one product-adjacent
   judgment call; see Validation below for how to check it before it reaches a second screen.

### ✅ Acceptance criteria

1. **Given** `/generate`, **when** the page loads, **then** exactly one `<h1>` exists, reading
   "Generate cards", rendered by `PageHeader`.
2. **Given** `/generate`'s rendered DOM, **when** searched for an anchor with the text "Dashboard" or
   "← Dashboard" outside the shell's own `<nav>`, **then** none exists.
3. **Given** a signed-in user with zero drafts, **when** `/generate` loads, **then** the `Generate`
   button carries the filled (`default`) variant and no `Save changes` button exists in the DOM.
4. **Given** a signed-in user with one or more drafts, **when** `/generate` loads, **then** the
   `Save changes` button carries the filled (`default`) variant and `Generate` carries the outline
   variant.
5. **Given** the generation request, **when** it fails, **then** an element with `role="alert"` and
   `aria-live="assertive"` renders the server's message or fallback, and the form remains submittable.
6. **Given** a signed-in user with `isReadOnly` true, **when** `/generate` loads, **then** the warning
   message renders inside an element with `role="status"` and `aria-live="polite"`, with no interactive
   control inside it.
7. **Given** each draft `<li>` in `DraftReviewList`, **when** its class list is read, **then** it
   contains `bg-surface-draft` and `border-surface-draft-border`, and no `bg-white/5` or
   `border-white/10`.
8. **Given** `src/pages/generate.astro`, `src/components/generate/PasteAndGenerateForm.tsx`,
   `src/components/generate/DraftReviewList.tsx`, and `src/components/ui/Section.tsx`, **when** their
   source is read, **then** none contains a hex, `rgb()`, `oklch()`, or Tailwind-palette-scale colour
   literal, `shadow-*`, `backdrop-blur-*`, `bg-gradient-*`, or `bg-cosmic`, except the single, deliberate
   `bg-background` on `generate.astro`'s outer wrapper.
9. **Given** `src/pages/{dashboard,library,review,settings}.astro` and every auth page, **when** diffed
   against `main`, **then** none shows any change.
10. **Given** `grep -rnoE 'rounded-(md|lg|xl)\b' src/ | wc -l`, **when** run after this change, **then**
    the result matches the number asserted in `primitives.test.ts` criterion 5 (expected 54; the test is
    updated to whatever the true measured count is, not forced to 54).
11. **Given** the running app with drafts pending, **when** `Save changes` is clicked, confirmed, and the
    request succeeds, **then** the browser navigates to `/generate` and the reviewed drafts no longer
    appear — unchanged from today's behavior.
12. **Given** the running app with no drafts pending, **when** text is pasted and `Generate` is clicked,
    and the request succeeds, **then** the browser navigates to `/generate` and the new drafts appear —
    unchanged from today's behavior.
13. **Given** `npm run typecheck`, `npm run lint`, `npm run build`, and `npm test`, **when** each runs,
    **then** each passes.

---

## Implementation Plan

Restates the Behavior, Route/blast-radius map, and Acceptance criteria above as Phases and Steps — no
new decisions, no scope beyond what those sections already specify.

### Phase 1: `Section` primitive

- 1.1 Create `src/components/ui/Section.tsx` per the contract given above, lifted from `/settings`'s
      shipped danger-zone markup.
- 1.2 Add `"Section.tsx"` to `NEW_PRIMITIVES` in `src/components/ui/primitives.test.ts` so criterion 9's
      no-literal/no-shadow/no-blur/no-cosmic checks cover it.

### Phase 2: Page shell — background, heading, top-level notices

- 2.1 In `src/pages/generate.astro`, replace the outer wrapper's `bg-cosmic` with
      `bg-background text-foreground`, and `max-w-3xl` with `max-w-content` (Behavior 1).
- 2.2 Replace the gradient `<h1>` + back link with `<PageHeader title="Generate cards" />` (Behavior 2).
- 2.3 Replace the not-configured and loadError paragraphs with `<Notice variant="error">` (Behavior 3).
- 2.4 Replace the isReadOnly branch with `<Section title="Generate new cards from text"><Notice
      variant="warning">…</Notice></Section>` (Behavior 4).
- 2.5 Pass `primary={drafts.length === 0}` to `<PasteAndGenerateForm client:load />` (Behavior 5).

### Phase 3: Form and draft-review islands

- 3.1 In `PasteAndGenerateForm.tsx`: accept the new `primary` prop; wrap the return value in `<Section
      title="Generate new cards from text">`; replace the error `<p>` with `<Notice variant="error">`
      and remove the now-unused `CircleAlert` import; change the submit button to `<Button
      variant={primary ? "default" : "outline"}>`; move the textarea's colour classes to tokens
      (Behavior 6).
- 3.2 In `DraftReviewList.tsx`: wrap the return value in `<Section title={...} description={...}>`;
      replace the error `<p>` with `<Notice variant="error">` and remove the now-unused `CircleAlert`
      import; change the submit button to `<Button variant="default">`; move Keep/Discard/toggle colour
      classes to `success`/`destructive` tokens; move each `<li>`'s colour classes to
      `surface-draft`/`surface-draft-border` (Behavior 7).

### Phase 4: Test parity and validation gate

- 4.1 Run `grep -rnoE 'rounded-(md|lg|xl)\b' src/ | wc -l` and update `primitives.test.ts` criterion 5's
      asserted count to the real measured number (expected 54 — verify, don't assume).
- 4.2 Run the full validation gate (`npm run typecheck`, `npm run lint`, `npm run build`, `npm test`) and
      fix forward until green (acceptance criterion 13).
- 4.3 Manually verify (or `om-auto-qa-pr`) both the no-drafts and drafts-pending states, and the
      isReadOnly state, at desktop and 390px viewports, confirming no `bg-cosmic` gradient is visible and
      that the filled/outline button pairing reads as intended (Validation below).

---

## 🧪 Validation

**Riskiest belief:** that resolving the principle-5 tension by making `Save changes` filled whenever
drafts exist (demoting `Generate` to outline) reads, in the real browser, as "here is the one thing to do
right now" rather than as an arbitrary inconsistency between two screens that both used to look the same.

**Smallest test that could change the decision:** load `/generate` with at least one pending draft, at
both desktop and a 390px viewport, and look at the page without reading any code: does the filled
`Save changes` button read as the obvious next action, with `Generate` clearly secondary but still fully
usable? Then load it again with zero drafts and confirm `Generate` alone carries the filled treatment.

**What each result means:** if the filled/outline pairing reads as arbitrary or confusing in the real
browser, this increment's one product-adjacent call needs revisiting — likely by keeping both outline and
deferring "exactly one primary action" to a dedicated later decision, the more conservative alternative
this brief considered and did not choose. If it reads clearly, the dynamic single-primary-action pattern
(server-computed, prop-driven) is validated for reuse wherever a future screen has the same
two-simultaneous-actions shape.

---

## ⚠️ Open decisions

*(none blocking — the one item this increment had to resolve itself is settled below)*

### Settled, recorded so they are not reopened

- **`Section` is introduced in this increment, not deferred a third time.** Settled here: Increment 2's
  return condition — "after the first two screens are migrated, when their real regions are visible" —
  is met by this increment's own diff, which produces the second migrated screen and two real region
  instances in it, on top of `/settings`'s already-shipped one. Building it now, from three concrete
  instances, matches the same evidence bar `Notice`/`EmptyState`/`PageHeader` were held to, rather than
  guessing a shape ahead of duplication.
- **`/settings`'s already-shipped danger zone is not retrofitted onto `Section` in this increment.**
  Settled here: the retrofit is safe and mechanical (no visual change), but it is not required for
  `Section`'s contract to be proven by this increment's own two regions, and skipping it keeps this
  increment's blast radius to one screen. Filed as a follow-up.
- **`Card` (the domain flashcard component) stays deferred.** Settled here: nothing in this increment's
  scope renders a flashcard as a first-class object the way `library/CardRow.tsx` or
  `review/ReviewSession.tsx` do; `Section` and `Card` remain the two different things Increment 2
  predicted they would split into.
- **No new empty state for "no drafts yet."** Settled here: the current screen has no such message today,
  and inventing one is new copy/behaviour, not migration.
- **The principle-5 tension between `Generate` and `Save changes` is resolved, not left open.** Settled
  here: `Save changes` gets the filled treatment whenever drafts exist, `Generate` otherwise — see
  Behavior 5 and Validation for the reasoning and the check.
- **`button.tsx`'s `shadow-xs` on every non-`link`/`ghost` variant is not fixed here.** Settled here: it
  predates this increment, is shared by every screen already in production, and reaching into it is past
  this increment's boundary — the same reasoning Increment 4 applied to `CancelDeletionButton.tsx`.
  **Action:** file it as a standalone finding (`bug`, `priority-low`) — `shadow-xs` in `button.tsx`'s
  `default`/`destructive`/`outline`/`secondary` variants is a principle-4 violation, visible today on
  every filled or outlined button in the app.

---

## 📋 Applied

AI necessity gate: not applicable — this increment changes no AI behaviour; `/generate`'s underlying
feature calls an LLM, but this diff touches only the surrounding markup, styling, and which button is
filled, never the request, response, or prompt. Human-AI checklist: not applicable, same reason — though
principle 7's draft-surface tokens (the human-decides-before-anything-saves gate's visual half) get their
first real consumer here, which is a visibility improvement to an already-implemented control, not a new
one. Value metrics: outcome, behavioral signal, business effect, and guardrail stated above per
`human-value-metrics.md`'s ordering; this increment ships user-facing behaviour. Design contract: loaded
(`.uxproof/contract.json`, `conventions.md` including the manual section and its eight principles); the
registry still covers roughly half of the UI files per its own caveat, so every file this increment
touches was read directly rather than assumed from the registry. Evidence tiers: findings above are
tagged `[ASSUMPTION]` where unverified; every count and line reference is measured directly against the
repository at `HEAD` (`c8483dc`) today. Quality rubric: passed — diagnosis names the specific gap
(duplicate glass-card sections, silent errors, an inert principle-7 token, an unresolved principle-5
tension) rather than restating "migrate the screen"; scope completes one real job end to end (every state
of both generate and draft-review, not just the happy path); the riskiest belief (the filled/outline
pairing reading as intentional) has a decision-changing test; screens, components, and copy are named
concretely throughout, including the full source of the one new primitive this increment adds; the
`Section`-now-vs-later question was evaluated against real evidence rather than either forced early or
deferred by default.
