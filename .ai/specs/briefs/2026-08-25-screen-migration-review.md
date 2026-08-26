# Increment 6 — Screen migration: `/review`

**Status:** handoff, ready to plan
**Written:** 2026-08-25 · `om-ux-shape` (Handoff mode)
**Follows:** Increment 5, screen migration `/generate`, merged as `4862255` (PR #38), plus one
follow-up commit `c02c650`
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Strategy C order:** tokens → primitives → shell / mobile navigation → **screen migration** (3 of 5) → remove `bg-cosmic`

---

## 🎯 Recommendation

**Migrate one screen, `/review`, in this increment — not two, and not all three.** It is the
remaining screen with the smallest *undecided* surface: it has no form fields, no search, and no
pagination, so it is the only one of the three that can be migrated without first reopening a
deferred component contract. It is also the only remaining screen the house rules name a specific,
currently-unmet requirement for, and the only one whose migration *deletes* a duplicated component
instead of adding one.

The keyboard-shortcut behaviour shipped six days before `/generate` is the real risk here, and it is
the reason this increment is scoped tightly and fences the interaction code explicitly rather than
avoiding the screen altogether. `/library` and `/dashboard` each carry a genuine design decision of
their own and get their own increments after this one.

---

## 📝 Current-state findings

All numbers below were read directly from the files at `HEAD` (`c02c650`), not carried over from a
prior brief.

### The three remaining screens are not the same size of problem

| Screen | Files | Lines | Legacy colour utilities | New contract decisions it forces |
|---|---|---|---|---|
| `/review` | `review.astro` (55), `ReviewSession.tsx` (319) | 374 | 12 + 45 = **57** | Rating-button differentiation (already mandated); the flashcard face |
| `/library` | `library.astro` (195), `CreateCardForm.tsx` (123), `CardRow.tsx` (186), `CardList.tsx` (17) | 521 | 42 + 16 + 16 = **74** | Search input/button pair; Previous/Next pagination; **`Field`** (three label+input+error triples); `Card` for the saved row |
| `/dashboard` | `dashboard.astro` (270) | 270 | **20** | Re-deriving the whole two-tier "Next up" / "Also waiting" priority hierarchy in Paper terms |

Legacy counts are occurrences of `bg-cosmic`, `backdrop-blur-*`, `rounded-2xl`, `bg-gradient-to-*`,
and Tailwind palette-scale utilities (`bg-white/10`, `text-blue-100/70`, `border-red-500/30`, …).

`/dashboard` has the *lowest* legacy count and is still the *largest* design decision, because its
low count is an artifact of `dashboard.astro:99–124` hoisting eleven shared class strings into
`const`s. Its brief said so out loud — *"this change introduces no new colour decision and extracts
no shared component, so that the eventual design-system sweep restyles the dashboard alongside every
other screen"* — which means migrating it is re-deriving a hierarchy, not swapping tokens. A glass
card plus a gradient-filled link is tier 1 today; a bare text block plus an underlined link is
tier 2. Paper has no gradient and no glass, so the entire cue system has to be rebuilt from type,
space, and a single filled `Button`. That is a design decision that deserves its own review, and it
is best made *last*, when the vocabulary the other four screens settled on is visible.

### `/review` is the only remaining screen that violates a named house rule today

`.uxproof/conventions.md`, principle 6, ends with a clause that names exactly one screen:

> The two rating buttons in `/review` must differ by label and shape, not by colour alone.

Today (`ReviewSession.tsx:250–294`) the two rating buttons are structurally identical — same
`flex-1`, same padding, same radius, same border width — and differ by `border-red-500/30
bg-red-900/20 text-red-200` versus `border-green-500/30 bg-green-900/20 text-green-200`, plus an
`X` / `Check` icon and the words *Wrong* / *Right*. The label and icon already carry meaning, so
this is not a WCAG 1.4.1 failure; it is an unmet house rule, and this is the increment where it gets
resolved instead of being restated. No other remaining screen has an outstanding named requirement.

### What "shape" was decided to mean — read from the source, not re-invented

The clause did not originate in the adopted direction. It was written in **Direction B**'s
§9 (`.ai/analysis/2026-08-22-ui-ux-visual-direction-phase4.md:138`), one of the three candidate
directions:

> Dwa przyciski ocen w `/review` (`Again` / `Good`) dostają rozróżnienie kształtem i etykietą, nie
> tylko kolorem — dziś stoją na czerwieni/zieleni.

and was then carried verbatim into the final principle 6 (`:306`) when Direction A — Paper was
adopted. Three things follow from reading it there rather than in isolation:

**1. "Kształt" means the action-hierarchy tier, not bespoke per-button geometry.** The document uses
the word exactly once more, in Direction C's §11 (`:188`): *"wysokość 32 px, promień 6 px — dokładnie
ten sam kształt co przycisk secondary"* — height plus radius plus fill treatment, named as
*"the same shape as the secondary button"*. Shape in this document's vocabulary is **which tier of
the button system a control belongs to**. The adopted direction defines exactly three and no more
(Direction A §6, *Hierarchia akcji*): **Primary** — filled ink (`bg-primary` / `text-primary-foreground`);
**Secondary** — outline, paper background, ink text; **Tertiary** — underlined text link. There is no
fourth shape to invent, and inventing one was never what the clause asked for.

**2. Semantic colour has no licence on these buttons at all.** Principle 6's own sentence, one line
above the clause, restricts `destructive` / `warning` / `success` to *"usuwania, stanu oczekującego
lub read-only, i potwierdzenia"* — deletion, pending-or-read-only, and confirmation. Rating a card
*Right* is not a confirmation and rating it *Wrong* is not a deletion, so neither token applies here.
Direction A §10 settles the icons the same way: *"kolor dziedziczony z tekstu"* — icon colour is
inherited from the text, never set independently. **The correct outcome is that red and green leave
the rating buttons entirely, including the glyphs** — not that they retreat onto the icon.

**3. Principle 5 forces one of the two to be filled.** *"Dokładnie jeden wypełniony przycisk na
widok"* — **exactly** one filled button per view, not *at most* one. The revealed state is a view,
and the reveal button is not rendered in it. Two outline buttons would leave that view with zero
filled controls, which principle 5 does not permit. So the shape distinction the clause asks for is
already fully determined by the rules around it: **one rating button is Primary and the other is
Secondary.**

Which one is filled is settled by principle 5's next sentence — *"Akcja destrukcyjna nigdy nie jest
akcją główną"*. *Wrong* is the rating that resets the card's Leitner box and is the closer analogue
of the setback action, so it is not the primary. *Right* is. This also matches Direction B's own
example labels, `Again` / `Good`, where *Good* is the expected path.

**One thing the clause does not ask for, despite appearances: renaming the buttons.** Direction B
wrote `Again` / `Good` because those were *its* vocabulary for a direction that was not adopted;
the requirement is that the two labels differ, and *Wrong* / *Right* already satisfy it. Renaming
would change product copy, expand this increment's scope, and break the accessible names two E2E
specs assert. The labels stay.

### This migration removes a duplicate rather than introducing one

`ReviewSession.tsx:29–60` defines a local `DoneCard` component. Increment 2's brief
(`2026-08-24-paper-ui-primitives.md:64`) says plainly: *"`DoneCard` in `ReviewSession.tsx` is this
component, already written and proven by three different uses"* — `EmptyState` was lifted from it,
shipped, and has had **zero consumers in `src/` ever since** (`grep -rn "EmptyState" src/` returns
only `ui/EmptyState.tsx` and `ui/primitives.test.ts`). That is the same inert-primitive situation
`--surface-draft` was in before Increment 5 gave it a consumer. Migrating `/review` deletes 32 lines
of duplicated component and gives `EmptyState` its first two real uses, with the copy already
written down in Increment 2's own acceptance table (`:457–458`).

That same brief also already decided which of `DoneCard`'s three uses is *not* an empty state
(`:126`): *"Could not load your review session" — an **error** state, not an empty one*. This
increment honours that: the load-error branch becomes a `Notice variant="error"`, not an
`EmptyState`. No new judgement is required.

### The keyboard-shortcut risk is real, bounded, and already isolated by the code

The concern is legitimate — `ReviewSession.tsx` is the file carrying the freshest interaction logic
in the repo (`.ai/specs/briefs/2026-08-20-review-keyboard-shortcuts.md`). Three facts bound it:

1. **The decision logic is not in this file.** Every "should this key do anything?" question is
   answered by `resolveReviewShortcut` in `src/lib/review-shortcuts.ts`, a pure function with its own
   unit suite (`src/lib/review-shortcuts.test.ts`). The component only translates its return value
   into the same `setRevealed` / `handleRate` calls the buttons make. A styling migration does not
   touch it.
2. **The re-entrancy guard is a ref, not markup.** `lockRef` (`:76`) blocks a same-frame double
   submission independently of the `disabled` attribute, so restyling a button cannot reintroduce
   the double-POST bug it was added to prevent.
3. **Both E2E suites locate by role, text, and accessible name only.**
   `tests/e2e/review-keyboard-shortcuts.spec.ts` and `review-persistence.spec.ts` use
   `getByRole("button", { name: "Reveal answer" | "Restart" | "Right" })`,
   `getByRole("heading", { name: "Review session" })`, and `getByText("Space")`. Not one CSS
   selector or class assertion. Every one of those names is preserved verbatim by this increment, so
   the existing suites are a genuine regression net for the migration rather than something the
   migration has to rewrite.

What this increment therefore **freezes, byte for byte**: `resolveReviewShortcut` and its call site,
the `useEffect` keydown subscription and its dependency array, `handleRate`, `lockRef`,
`handleRestart`, the `index` / `revealed` / `submitting` / `pendingRating` state machine, the
`/api/reviews` request body, and the three `aria-keyshortcuts` values (`"Space"`, `"1"`, `"2"`).
Only JSX `className` strings, the terminal-state components, and the error element change.

### Why not two screens, and why not three

**Three screens (rejected).** 1,165 lines across seven files, containing three unrelated design
derivations — a card face, a form-and-search surface, and a priority hierarchy — in one diff. That
is the opposite of the method Strategy C has followed for five increments, and it makes the one
genuinely contested decision in the batch (the dashboard hierarchy) unreviewable in isolation.

**`/review` + `/library` together (rejected, and it is the close call).** There is a real coherence
argument for pairing them: `CardRow`'s saved row and `ReviewSession`'s card face are the two
candidate meanings the primitives increment named when it deferred `Card`
(`2026-08-24-paper-ui-primitives.md:248–266`), and only both together supply the duplication
evidence that deferral asked for. The argument loses on what `/library` drags in with it.
`CardRow`'s edit mode (`:110–140`) and `CreateCardForm` are label-plus-textarea-plus-error triples —
which is `Field`, the *other* deferred primitive, whose return condition also lands in the migration
increment, and which is entangled with `auth/FormField.tsx`'s five existing uses and its filed,
unfixed accessibility gap (`2026-08-24-paper-ui-primitives.md:286–304`). Add the search input/button
pair and the Previous/Next pagination controls, neither of which maps onto any shipped primitive,
and the pair increment is deciding four contracts at once. `/review` alone still moves the `Card`
question forward — it produces the cleanest possible instance of a flashcard face, the one where
principle 3's "content is the hero" is least compromised by surrounding controls — and leaves
`/library` free to decide `Field` on its own evidence.

**`/library` alone (rejected).** Same four contracts, without the benefit of `/review` having
established the flashcard face first, and with `CardRow` then defining `Card` from a row that is
mostly buttons.

**`/dashboard` alone (rejected).** Best done last, for the reason given above.

**Decisive trade-off:** `/review` resolves the most decisions per line touched. It is second of
three on raw legacy-debt reduction (57 occurrences against `/library`'s 74), and this increment does
not pretend otherwise — it optimises for contracts settled, not for utilities deleted.

---

## 🎯 Outcomes

**User outcome.** A signed-in user starting a review session sees a paper page with the card itself
as the largest, highest-contrast element on the screen — front in a serif, back revealed beneath a
hairline — instead of a glass panel on a dark gradient. Reveal, rate, restart, and every keyboard
shortcut behave exactly as they do today. A rating failure is now announced to assistive technology
instead of appearing silently, and the two rating buttons no longer rely on red-versus-green as
their primary distinction.

**Behavioral signal.** `/review` renders with `document.body`'s `bg-cosmic` fully hidden beneath the
page's own `bg-background` surface, matching `/settings` and `/generate`; both existing Playwright
suites pass unchanged; a screen-reader user whose rating POST fails hears the message; the front and
back text are visibly larger and higher-contrast than the progress counter, the restart control, and
the shortcut hints.

**Business effect.** Gives `EmptyState` its first two real consumers three increments after it
shipped, deletes the duplicated `DoneCard` it was extracted from, resolves the one screen-specific
requirement the house rules still carry unmet, and leaves `bg-cosmic` present on exactly two screens.

**Guardrail.** The scheduling behaviour must not change. The `/api/reviews` request, the Leitner box
passed as `currentBox`, the advance-on-`applied:false` rule, the restart semantics (client-state
reset only, no refetch, already-POSTed ratings stay persisted), and the double-submit guard all stay
byte-for-byte identical. Nothing about which card comes next, or when a card comes back, may move.

---

## 📋 Scope

**Now:** migrate `/review` only — `review.astro`'s page wrapper, heading, back link, and read-only
branch; `ReviewSession.tsx`'s three terminal states, session container, progress row, restart
control, error element, card face, reveal button, rating buttons, `Kbd`, and shortcut hint row.
Delete the local `DoneCard`.

**Later:** `/library` in its own increment, which is where `Field` and `Card` get decided together
from `CreateCardForm` + `CardRow` + this increment's card face; `/dashboard` last, re-deriving its
two-tier hierarchy in Paper once the vocabulary is settled; `bg-cosmic` and `Layout.astro`'s `<body>`
class removed after `/dashboard` lands; the review-session shell reduction (an exit control and a
progress indicator replacing the full nav), explicitly deferred by Increment 3
(`2026-08-24-shell-mobile-navigation.md:134`) and still deferred here; the `button.tsx` `shadow-xs`
fix filed by Increment 5.

**Not doing:** any change to `dashboard.astro`, `library.astro`, `generate.astro`, `settings.astro`,
or any auth page; any change to `src/lib/review-shortcuts.ts`, `src/lib/leitner.ts`, or
`src/pages/api/reviews.ts`; a `Card` primitive; a `Field` primitive; practice/cram mode on the "All
caught up!" state (a separate, still-open product question — see Open decisions); dark mode; the
`bg-cosmic` utility or `Layout.astro`; new copy beyond the two `EmptyState` strings Increment 2
already wrote down.

---

## 📝 Handoff

**Intent.** Rebuild `/review`'s markup with `PageHeader`, `Notice`, `EmptyState`, `Button`, and
Paper tokens, so the flashcard face is the visual hero of the screen and the two terminal states use
the shipped primitive that was extracted from them. Change no interaction behaviour.

**Non-goals.** No other page. No scheduling, API, or shortcut-logic change. No `Card`. No `Field`.
No shell reduction. No new dependency.

**Actor and trigger.** A signed-in user who opens `/review` from the shell nav or from the
dashboard's *Start review session* link, with zero, one, or many cards due.

### 📋 Behavior

**`src/pages/review.astro`**

1. The outer wrapper `<div class="bg-cosmic min-h-screen p-4">` becomes
   `<div class="bg-background text-foreground min-h-screen p-4">`, and the inner column's
   `max-w-3xl` becomes `max-w-content` — the same two changes `/settings` and `/generate` made.
2. The `<header>` block (the gradient `<h1>` plus the `← Dashboard` link) is replaced by
   `<PageHeader title="Review session" />`, rendered statically with no `client:*`. The inline back
   link is deleted; the shell nav shipped in Increment 3 carries it, and both `/settings` and
   `/generate` already dropped theirs. **The accessible name "Review session" must be preserved
   exactly** — two E2E specs assert `getByRole("heading", { name: "Review session" })`.
3. The `isReadOnly` branch loses its glass `<section>` wrapper and becomes a bare notice:

   ```astro
   <Notice variant="warning">
     Your account is pending deletion and is read-only. Cancel the deletion to review cards.
   </Notice>
   ```

   No `Section` wrapper here, deliberately diverging from `/generate`: on `/generate` the warning
   replaced one of two sibling regions, so it needed a title to stay distinguishable. `/review` has
   a single region, and a `Section` whose title repeated the page's own `h1` would be chrome that
   enables nothing — principle 3.

**`src/components/review/ReviewSession.tsx`**

4. Delete the local `DoneCard` function (`:29–60`) entirely. Its three call sites are replaced
   individually below. Its `Back to dashboard` link is not carried over — the shell nav provides it,
   consistent with step 2.
5. **Load-error state** becomes an error notice, not an empty state, per Increment 2's recorded
   decision:

   ```tsx
   <Notice variant="error" title="Could not load your review session">
     Something went wrong fetching your due cards. Try refreshing the page.
   </Notice>
   ```

6. **No cards due** becomes `EmptyState` with no action:

   ```tsx
   <EmptyState
     icon={<PartyPopper className="size-10" />}
     title="All caught up!"
     body="You have no cards due for review right now. Come back later."
   />
   ```

7. **Session complete** becomes `EmptyState` with one action. The restart control keeps the
   accessible name `Restart session`:

   ```tsx
   <EmptyState
     icon={<PartyPopper className="size-10" />}
     title="Session complete"
     body={`You reviewed ${dueCards.length} card${dueCards.length === 1 ? "" : "s"}. Nicely done.`}
     action={
       <Button type="button" variant="outline" onClick={handleRestart}>
         <RotateCcw className="size-4" />
         Restart session
       </Button>
     }
   />
   ```

8. **The active-session container** loses its box. `<section className="space-y-4 rounded-2xl border
   border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">` becomes
   `<section className="space-y-4">`. The card face below is the only bordered surface on the
   screen, which is what makes it read as the hero (principles 3 and 4).
9. **The progress row.** `Card {index + 1} of {dueCards.length}` becomes
   `className="text-meta text-muted-foreground"`. The restart control becomes
   `<Button type="button" variant="ghost" size="sm" onClick={handleRestart} disabled={submitting}>`
   with the icon and the label `Restart` — **the name stays `Restart`, not `Restart session`**; an
   E2E spec asserts `getByRole("button", { name: "Restart" })`, and the two controls never render
   at the same time.
10. **The rating error** replaces the hand-rolled red `<p>` with `<Notice variant="error">{error.message}</Notice>`.
    This is the accessibility fix: `Notice` sets `role="alert"` and `aria-live="assertive"` for the
    error variant, which today's plain paragraph does not, so a failed rating is currently silent to
    a screen reader.
11. **The card face** is the one bordered surface, and it is where the serif lives:

    ```tsx
    <div className="border-border bg-card rounded-paper space-y-3 border p-6">
      <div>
        <p className="text-meta text-muted-foreground tracking-wide uppercase">Front</p>
        <p className="text-foreground text-title mt-1 font-serif break-words">{card.front}</p>
      </div>
      {revealed && (
        <div className="border-border border-t pt-3">
          <p className="text-meta text-muted-foreground tracking-wide uppercase">Back</p>
          <p className="text-foreground text-body mt-1 font-serif break-words">{card.back}</p>
        </div>
      )}
    </div>
    ```

    `break-words` is new and required — principle 3 says content "always breaks long strings", and a
    single long token in a card front currently overflows.
12. **The reveal button** is the filled control of the question state:
    `<Button type="button" variant="default" className="w-full" aria-keyshortcuts="Space" onClick={…}>`
    with the `Eye` icon and the label `Reveal answer`, unchanged. It is not rendered once revealed,
    so it does not compete with step 13 — principle 5's "exactly one filled button" is satisfied
    per state, and each of the two states has exactly one.
13. **The two rating buttons** are the principle-6 fix, and the direction already determines the
    answer (see *What "shape" was decided to mean* above). They stop being a red button and a green
    button and become **two different tiers of the house button system**:

    ```tsx
    <div className="flex gap-3">
      <Button
        type="button"
        variant="outline"
        className="flex-1"
        aria-keyshortcuts="1"
        disabled={submitting}
        onClick={() => { void handleRate("wrong"); }}
      >
        {submitting && pendingRating === "wrong" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
        Wrong
      </Button>
      <Button
        type="button"
        variant="default"
        className="flex-1"
        aria-keyshortcuts="2"
        disabled={submitting}
        onClick={() => { void handleRate("right"); }}
      >
        {submitting && pendingRating === "right" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Right
      </Button>
    </div>
    ```

    Concretely, that means three things. **Every red and green class is deleted**, including from the
    glyphs: no `text-destructive` on the `X`, no `text-success` on the `Check`. Both icons inherit
    their button's text colour, per Direction A §10. Neither `destructive` nor `success` is licensed
    here — principle 6 reserves them for deletion and confirmation, and a self-assessment rating is
    neither. **`Right` is `variant="default"`** — filled ink on paper — because the revealed state
    must contain exactly one filled button and a destructive-analogue action may never be the
    primary. **`Wrong` is `variant="outline"`** — the Secondary tier. The two are then distinguished
    by fill, by border, by text colour, by label, and by glyph, and by none of those alone.

    The `cn()` wrappers around the old conditional colour strings are dropped with the colours; the
    `flex-1` equal widths, `aria-keyshortcuts`, `disabled`, spinner swap, and both labels are
    preserved exactly.

    **Recorded trade-off.** A filled *Right* carries more visual weight than an outline *Wrong*, and
    that asymmetry is new — today the two are equally weighted. It is a deliberate consequence of the
    adopted direction's own rules rather than a product judgement, and it does not touch scheduling:
    `handleRate` sends the same payload for either rating. If a walkthrough shows it reading as a
    recommendation rather than as a hierarchy, the fix is to revisit principle 5's "exactly one" for
    two-outcome views at the direction level — not to reintroduce red and green here.
14. **`Kbd`** becomes
    `className="rounded-paper border-border bg-muted text-muted-foreground border px-1.5 py-0.5 font-mono text-[0.7rem]"`.
    The hint row becomes `text-meta text-muted-foreground`, keeping the always-rendered
    both-rows-with-dimming behaviour and its explanatory comment — the anti-reflow reasoning still
    holds and is not a styling decision.
15. The `cn` import stays (still used for the hint-row dimming); the `CircleAlert` import is dropped
    if step 5 leaves it unused.

### 📋 States

| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| Read-only | `Astro.locals.isReadOnly` | Amber-bordered notice: *"Your account is pending deletion and is read-only. Cancel the deletion to review cards."* | Cancel deletion from the retention banner; navigate away |
| Load error | Supabase absent, or the due-cards query errored | Red-bordered alert titled *"Could not load your review session"* with *"Something went wrong fetching your due cards. Try refreshing the page."*, announced assertively | Refresh; navigate away |
| Empty | Query succeeded, zero cards due | Centred `PartyPopper`, *"All caught up!"*, *"You have no cards due for review right now. Come back later."* | Navigate away via the shell nav |
| Question | A card is due, not yet revealed | *Card N of M*, *Restart*, the card face showing **Front** only in serif, a filled *Reveal answer* button, and the hint row with **Space** active | Reveal (click or `Space`); restart; navigate away |
| Answer | Revealed | The same, plus **Back** beneath a hairline; the reveal button is replaced by an outline *Wrong* and a filled *Right*, both monochrome | Rate (click, or `1` / `2`); restart; navigate away |
| Submitting | A rating POST is in flight | The rated button shows a spinner in place of its icon; both rating buttons and *Restart* are disabled | Wait — repeat key presses and same-frame clicks are dropped by the resolver and `lockRef` |
| Rating error | The POST failed or the network threw | Red-bordered alert above the card face carrying the server message or its fallback, announced assertively; the same card stays on screen, still revealed | Rate again; restart; navigate away |
| Complete | Every due card rated | Centred `PartyPopper`, *"Session complete"*, *"You reviewed N cards. Nicely done."*, and an outline *Restart session* button | Restart the same batch; navigate away |

### 📋 Assumptions to confirm

- **Assumption:** `--text-meta` (0.8125rem) is the right size for the FRONT / BACK labels, the
  progress counter, and the shortcut hints. It is the token's stated purpose in `global.css:247`
  (*"labels, counters, FRONT/BACK"*), which names this screen's elements literally, so this should
  hold — but it has never rendered anywhere, since no shipped screen uses `text-meta` yet.
- **Assumption:** `bg-card` is distinguishable from `bg-background` in the light palette. Both
  currently resolve to `var(--ink-05)` (`global.css:105,112`) — i.e. **identical**. The card face
  therefore reads purely as a hairline-bordered region, which is principle 4's intent and is
  acceptable, but the implementer should confirm the border alone gives enough separation at the
  card face's size before considering any token change. Changing `--card` is out of scope here and
  would be a token-layer increment.
- **Assumption:** the review card face and `/generate`'s draft row are now visibly different
  surfaces — `bg-card` + `border-border` against `bg-surface-draft` (`--ink-10`) +
  `border-surface-draft-border` (`--ink-40`). This is the first time principle 7's draft-versus-saved
  contrast can actually be checked in the running app, and it should be checked as part of this
  increment even though `/generate` is not modified.
- **Assumption:** `Button`'s `outline` variant is legible at `flex-1` width with an icon and a
  spinner swap. `variant="outline"` ships `shadow-xs` (the gap Increment 5 filed); it will render
  here. Do not fix it in this increment.

### ✅ Acceptance criteria

1. **Given** a signed-in user with due cards, **when** they open `/review`, **then** no element in
   `review.astro` or `ReviewSession.tsx` matches `bg-cosmic`, `backdrop-blur`, `rounded-2xl`,
   `bg-gradient-to-`, or a Tailwind palette-scale utility, and the page's own `bg-background`
   surface covers the viewport so the body gradient is not visible.
2. **Given** a card is on screen, **when** the rendered text is compared, **then** the front text is
   larger and higher-contrast than the progress counter, the restart control, and the shortcut
   hints, and it renders in `--font-serif`.
3. **Given** a card front containing a 200-character unbroken string, **when** it renders, **then**
   `document.documentElement.scrollWidth` does not exceed the viewport width at 390px.
4. **Given** the user presses `Space`, then `1`, then `Space`, then `2`, **when** the session runs,
   **then** the behaviour is identical to `main` before this change —
   `tests/e2e/review-keyboard-shortcuts.spec.ts` passes unmodified.
5. **Given** a rating POST fails, **when** the error renders, **then** the element carries
   `role="alert"` and `aria-live="assertive"`, and the card remains on screen in its revealed state.
6. **Given** the two rating buttons are revealed, **then** `grep` over `ReviewSession.tsx` finds no
   `destructive` or `success` token on either button or either glyph; *Wrong* renders as
   `variant="outline"` and *Right* as `variant="default"`; the revealed view contains exactly one
   filled button; and with colour removed entirely the two remain distinguishable by fill, border,
   label, and glyph.
7. **Given** zero due cards, **when** the page renders, **then** the empty state comes from
   `@/components/ui/EmptyState` and `grep -n "DoneCard" src/` returns nothing.
8. **Given** the whole change, **when** `npm run lint`, `npm run build`, `npm test`, and
   `npm run test:e2e` run, **then** all pass with no spec file modified.
9. **Given** `/generate` is opened alongside `/review`, **when** a draft row and a review card face
   are compared, **then** they are distinguishable by surface treatment alone, without reading the
   headings.

### ⚠️ Open decisions

1. ~~**Does principle 6's "shape" clause require more than a distinct label and icon?**~~
   **Closed 2026-08-25** against `.ai/analysis/2026-08-22-ui-ux-visual-direction-phase4.md:138,188,303,306`
   and Direction A §6 / §10. "Shape" means the action-hierarchy tier, the adopted direction defines
   exactly three tiers, semantic colour is not licensed on these buttons at all, and principle 5
   requires exactly one filled button in the revealed view. Resolution: *Wrong* is Secondary
   (outline), *Right* is Primary (filled ink), both monochrome. See *What "shape" was decided to
   mean* and Behavior step 13. No new interpretation was introduced and no bespoke geometry was
   invented.
2. **Should the "All caught up!" state offer a practice or cram session?** A standing open question
   from earlier work, including whether practice ratings should reschedule cards. Explicitly out of
   scope here; this increment restyles the state and adds no action to it. **Owner: product.**
3. **Does `Card` end up being the review card face, `CardRow`, or both?** Deferred by Increment 2
   and still deferred. This increment produces the first of the two instances; `/library` produces
   the second and decides. **Owner: the `/library` increment.**
4. **Do the rating buttons meet the ≥44px touch target Direction A §13 requires?** `button.tsx`'s
   default size is `h-9` (36px), so probably not. Raising it changes a primitive shared by every
   shipped screen, which is outside this increment's blast radius — filed here rather than fixed,
   alongside Increment 5's `shadow-xs` finding on the same file. **Owner: a `button.tsx` follow-up.**

### 📋 Applied

AI necessity gate: not applicable — no AI behaviour is added, changed, or removed by this increment
(the existing generation flow lives on `/generate` and is untouched). Human-AI checklist: not
applicable, same reason. Value metrics: applied to the outcome and signal above. Design contract:
loaded from `.uxproof/` — `contract.json`, `conventions.md` including the eight principles and the
legacy *do not extend* rule, plus `tokens.json` read with its recorded light/dark caveat. Prior
briefs read: all seven under `.ai/specs/briefs/`. Source evidence for the principle-6 resolution:
`.ai/analysis/2026-08-22-ui-ux-visual-direction-phase4.md` (Direction A §6, §10, §13; Direction B §9;
Direction C §11; principles §5, §6) — the clause was traced to its origin rather than interpreted
from the summary in `conventions.md`. Quality rubric: passed. Untrusted-content check: no directives
addressed to an agent were found in any file read.
