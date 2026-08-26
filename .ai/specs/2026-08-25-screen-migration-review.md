# Screen migration: `/review` to Paper

**Status:** ready to plan
**Source brief:** `.ai/specs/briefs/2026-08-25-screen-migration-review.md` (Increment 6 — Strategy C, step 3 of 5)
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Follows:** Increment 5, `/generate` migration (`4862255`, PR #38) and follow-up `c02c650`

## 📝 TLDR

Rebuild the markup of `/review` — `src/pages/review.astro` and `src/components/review/ReviewSession.tsx` —
on the adopted Paper direction, using the shipped `PageHeader`, `Notice`, `EmptyState`, and `Button`
primitives plus the Paper tokens, and delete the local `DoneCard` that `EmptyState` was extracted from.
The flashcard face becomes the only bordered surface on the screen and therefore its visual hero, and the
two rating buttons stop being a red button and a green button, becoming two tiers of the house button
system — which resolves the one screen-specific house rule the direction still carries unmet. **No
scheduling, shortcut, or API behaviour changes.** The shortcut resolver, the submission path, the
re-entrancy guard, the state machine, the `/api/reviews` payload, and every accessible name the existing
E2E suites assert are frozen byte-for-byte, so those two Playwright suites are a genuine regression net
rather than something this change has to rewrite.

Three things do change beyond pure markup, each deliberate and each an improvement: two redundant
`Back to dashboard` affordances are removed (the shell nav shipped in Increment 3 covers them), long
unbroken card text stops overflowing the viewport (`break-words`), and a failed rating is announced to
assistive technology for the first time (`Notice` supplies `role="alert"`). Nothing else about what the
screen does moves.

## 📝 Problem Statement

`/review` is one of three screens still on the pre-migration treatment. Concretely, at `HEAD`:

- **Legacy debt.** 57 legacy colour-utility occurrences across 374 lines (12 in `review.astro`, 45 in
  `ReviewSession.tsx`) — `bg-cosmic`, `backdrop-blur-xl`, `bg-white/10`, `bg-gradient-to-r`, and
  Tailwind palette-scale utilities (`text-blue-100/70`, `border-red-500/30`, `bg-green-900/20`).
  `bg-cosmic` cannot be deleted from `Layout.astro` until every screen stops relying on it.
- **An unmet named requirement.** The adopted direction's principle 6 requires that the two rating
  buttons in `/review` be distinguished by shape and label, not only by colour. Today
  (`ReviewSession.tsx:250–294`) the two buttons are structurally identical — same `flex-1`, padding,
  radius, and border width — and differ only by `border-red-500/30 bg-red-900/20 text-red-200` versus
  `border-green-500/30 bg-green-900/20 text-green-200` plus their icon and label. Because label and icon
  already carry the meaning, this is not a WCAG 1.4.1 failure; it is an unmet house rule, and `/review`
  is the only remaining screen carrying one.
- **A duplicated primitive.** `ReviewSession.tsx:29–60` defines a local `DoneCard`. Increment 2
  extracted `EmptyState` from exactly this component, and `EmptyState` has had **zero consumers in
  `src/` since it shipped** — `grep -rn "EmptyState" src/` returns only its own file and
  `ui/primitives.test.ts`. It is inert, in the same position `--surface-draft` was in before Increment 5
  gave it a consumer.
- **A silent accessibility gap.** A failed rating POST renders a hand-rolled red `<p>`
  (`ReviewSession.tsx:229–232`) with no `role` and no `aria-live`, so the failure is announced to nobody.

Evidence that this screen is the right one to take next is recorded in the brief's alternatives analysis
and is not re-argued here; the short version is that `/review` is the only remaining screen that can be
migrated without first reopening a deferred component contract.

## 📝 Proposed Solution

A presentation-layer migration of exactly two files, with the interaction layer explicitly fenced. It is
not _purely_ markup: it also removes two redundant navigation links, adds `break-words`, and routes the
rating error through `Notice` so it is announced — the three deliberate exceptions listed in the TLDR.

Everything that decides _what happens_ stays untouched; everything that decides _what it looks like_ is
rewritten against the Paper tokens and the shipped primitives. The three terminal states that `DoneCard`
served are replaced individually — two by `EmptyState`, one by `Notice variant="error"` — following
Increment 2's own recorded decision that "Could not load your review session" is an error state, not an
empty one. The rating-button treatment follows from the direction's rules rather than from a fresh design
judgement (see **UI/UX → The rating-button tiers**).

**Alternatives considered and why they lost** (analysed in full in the brief):

| Alternative                                  | Why rejected                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| All three remaining screens in one increment | 1,165 lines over seven files, bundling three unrelated design derivations — a card face, a form-and-search surface, and a priority hierarchy — making the one genuinely contested decision (the dashboard hierarchy) unreviewable in isolation.                                                                    |
| `/review` + `/library` together              | The close call. `/library` drags in `CardRow`'s edit mode and `CreateCardForm` (which is the deferred `Field` contract, entangled with `auth/FormField.tsx`'s five uses and its filed accessibility gap), plus search and pagination controls that map onto no shipped primitive — four contracts decided at once. |
| `/library` alone                             | Same four contracts, and `Card` would then be derived from a row that is mostly buttons rather than from a clean flashcard face.                                                                                                                                                                                   |
| `/dashboard` alone                           | Best done last, once the Paper vocabulary is settled.                                                                                                                                                                                                                                                              |

## 📝 Architecture

Two files change. No primitive, token, library, or API is added or modified.

### Frozen surface — out of scope by definition

Not touched at all: `src/lib/review-shortcuts.ts`, `src/lib/leitner.ts`, `src/pages/api/reviews.ts`.

Not touched **within** `ReviewSession.tsx`: the `resolveReviewShortcut` call site; the keydown `useEffect`
and its dependency array; `handleRate`; `lockRef`; `handleRestart`; the
`index` / `revealed` / `submitting` / `pendingRating` state machine; the `/api/reviews` request body
(`{ cardId, rating, currentBox }`); the advance-on-`applied:false` rule; the `FALLBACK_MESSAGES` map;
and the three `aria-keyshortcuts` values (`"Space"`, `"1"`, `"2"`).

Three properties of the existing code make this fence credible rather than aspirational:

1. **The decision logic is not in this file.** Every "should this key do anything?" question is answered
   by the pure `resolveReviewShortcut`, which has its own unit suite
   (`src/lib/review-shortcuts.test.ts`). The component only translates its return value into the same
   `setRevealed` / `handleRate` calls the buttons make.
2. **The re-entrancy guard is a ref, not markup.** `lockRef` (`:76`) blocks a same-frame double
   submission independently of the `disabled` attribute, so restyling a button cannot reintroduce the
   double-POST bug it exists to prevent.
3. **Both E2E suites locate by role, text, and accessible name only** — not one CSS selector or class
   assertion between them.

### Preserved accessible names (asserted by the existing suites)

Heading `Review session`; buttons `Reveal answer`, `Restart`, `Right`, `Wrong`, and — on the complete
state — `Restart session`; the visible text `Space`. `Restart` (progress row) and `Restart session`
(complete state) intentionally differ and never render at the same time.

### Changed surface

**`src/pages/review.astro`** — the outer wrapper, the header block, and the read-only branch.
**`src/components/review/ReviewSession.tsx`** — `DoneCard` (deleted), the three terminal states, the
session container, the progress row, the restart control, the rating-error element, the card face, the
reveal button, the rating buttons, `Kbd`, and the shortcut hint row.

### Primitives consumed

| Primitive    | Use here                                                       | First consumer?                   |
| ------------ | -------------------------------------------------------------- | --------------------------------- |
| `PageHeader` | Page `h1`, replacing the gradient heading and inline back link | No (`/settings`, `/generate`)     |
| `Notice`     | Read-only warning, load error, rating error                    | No                                |
| `EmptyState` | "All caught up!" and "Session complete"                        | **Yes — its first two consumers** |
| `Button`     | Restart, reveal, both rating buttons                           | No                                |

## 📝 Data Model

No change. No migration, no schema touch, no new persisted field, no new sensitive data. The cards read
by `review.astro` (`id`, `front`, `back`, `repetition_count`) and the review write performed by
`/api/reviews` are both unchanged, and RLS scoping is untouched.

## 📝 API Contracts

No change. `POST /api/reviews` keeps its exact request body and response handling, including the
advance-on-`applied:false` behaviour. `ReviewSession`'s own props (`dueCards`, `loadError`) are
unchanged — **Q2 resolved (a)**: the load-error state stays rendered inside the React component rather
than moving to the Astro page as `/generate` does, because moving it would change the component's public
props and its test surface for no user-visible gain.

## 📝 UI/UX

### `src/pages/review.astro`

1. The outer wrapper `<div class="bg-cosmic min-h-screen p-4">` becomes
   `<div class="bg-background text-foreground min-h-screen p-4">`, and the inner column's `max-w-3xl`
   becomes `max-w-content` — the same two changes `/settings` and `/generate` made.
2. The `<header>` block (gradient `<h1>` + `← Dashboard` link) is replaced by
   `<PageHeader title="Review session" />`, rendered statically with no `client:*` directive. The inline
   back link is **deleted** — the shell nav shipped in Increment 3 carries it, and `/settings` and
   `/generate` both already dropped theirs. The accessible name `Review session` must be preserved
   exactly; two E2E specs assert `getByRole("heading", { name: "Review session" })`.
3. The `isReadOnly` branch loses its glass `<section>` wrapper and becomes a bare notice — **Q5 resolved
   (a)**: a read-only user sees `PageHeader` plus this one notice and nothing else. No card face, no
   empty state.

   ```astro
   <Notice variant="warning">
     Your account is pending deletion and is read-only. Cancel the deletion to review cards.
   </Notice>
   ```

   No `Section` wrapper here, deliberately diverging from `/generate`: there the warning replaced one of
   two sibling regions, so it needed a title to stay distinguishable. `/review` has a single region, and
   a `Section` whose title repeated the page's own `h1` would be chrome that enables nothing —
   principle 3.

### `src/components/review/ReviewSession.tsx`

4. **Delete the local `DoneCard`** (`:29–60`) entirely; its three call sites are replaced individually
   below. Its `Back to dashboard` link is not carried over — the shell nav provides it, consistent with
   step 2.
5. **Load-error state** becomes an error notice, not an empty state, per Increment 2's recorded decision:

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

7. **Session complete** becomes `EmptyState` with one action; the control keeps the accessible name
   `Restart session`:

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

8. **The active-session container loses its box.**
   `<section className="space-y-4 rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl">`
   becomes `<section className="space-y-4">`. The card face below is then the only bordered surface on
   the screen, which is what makes it read as the hero (principles 3 and 4).
9. **The progress row.** `Card {index + 1} of {dueCards.length}` becomes
   `className="text-meta text-muted-foreground"`. The restart control becomes
   `<Button type="button" variant="ghost" size="sm" onClick={handleRestart} disabled={submitting}>`
   with the `RotateCcw` icon and the label `Restart` — **the name stays `Restart`, not `Restart
session`**; an E2E spec asserts `getByRole("button", { name: "Restart" })`.
10. **The rating error** replaces the hand-rolled red `<p>` with
    `<Notice variant="error">{error.message}</Notice>`. This is the accessibility fix: `Notice` sets
    `role="alert"` and `aria-live="assertive"` for the error variant, which the current paragraph does
    not.
11. **The card face** is the one bordered surface and where the serif lives. It stays on the legacy
    radius scale rather than `rounded-paper`: `--radius-paper` is documented at `global.css:273` as
    "consumed only by primitives in `src/components/ui/`", `primitives.test.ts` criterion 5 enforces
    that confinement, and the merged `/generate` migration set the same precedent for its draft row.
    **Q1 resolved (a)** — the
    token layer is authoritative: `global.css:239` states _"Content never goes below `--text-title`"_,
    and the back of a card is content, so **both front and back render at `text-title`**. The FRONT /
    BACK labels stay at `text-meta`. The two faces are distinguished by the hairline, the label, and the
    reveal, not by a size step:

    ```tsx
    <div className="border-border bg-card space-y-3 rounded-lg border p-6">
      <div>
        <p className="text-meta text-muted-foreground tracking-wide uppercase">Front</p>
        <p className="text-foreground text-title mt-1 font-serif break-words">{card.front}</p>
      </div>
      {revealed && (
        <div className="border-border border-t pt-3">
          <p className="text-meta text-muted-foreground tracking-wide uppercase">Back</p>
          <p className="text-foreground text-title mt-1 font-serif break-words">{card.back}</p>
        </div>
      )}
    </div>
    ```

    `break-words` is new and required — principle 3 says content "always breaks long strings", and a
    single long token in a card front currently overflows the viewport.

12. **The reveal button** is the filled control of the question state:
    `<Button type="button" variant="default" className="w-full" aria-keyshortcuts="Space" onClick={…}>`
    with the `Eye` icon and the label `Reveal answer`, unchanged. It is not rendered once revealed, so it
    never competes with step 13.
13. **The rating-button tiers** — see below.
14. **`Kbd`** becomes
    `className="rounded-lg border-border bg-muted text-muted-foreground text-meta border px-1.5 py-0.5 font-mono"`.
    **Q4 resolved (b)**: the arbitrary `text-[0.7rem]` is replaced by `text-meta`, accepting slightly
    larger key caps — an arbitrary value below the smallest token has no place on the increment whose
    purpose is token conformance. The hint row becomes `text-meta text-muted-foreground`, keeping the
    always-rendered both-rows-with-dimming behaviour and its explanatory comment: the anti-reflow
    reasoning is behavioural, not stylistic, and still holds.
15. The `cn` import stays (still used for the hint-row dimming); the `CircleAlert` import is dropped if
    step 5 leaves it unused.

### The rating-button tiers (principle 6)

This is determined by the adopted direction, not invented here. The clause originates in Direction B §9
of `.ai/analysis/2026-08-22-ui-ux-visual-direction-phase4.md:138` and was carried verbatim into the final
principle 6 (`:306`). Read at its source, three things follow:

1. **"Shape" means the action-hierarchy tier**, not bespoke per-button geometry — the document uses the
   word once more, in Direction C §11 (`:188`), to mean _"the same shape as the secondary button"_
   (height + radius + fill). Direction A §6 defines exactly three tiers: Primary (filled ink), Secondary
   (outline on paper), Tertiary (underlined text link). There is no fourth to invent.
2. **Semantic colour has no licence on these buttons.** Principle 6 restricts
   `destructive` / `warning` / `success` to deletion, pending-or-read-only, and confirmation. Rating a
   card _Right_ is not a confirmation and _Wrong_ is not a deletion. Direction A §10 settles the glyphs
   the same way — icon colour is inherited from the text, never set independently. **Red and green leave
   the rating buttons entirely, including the icons.**
3. **Principle 5 forces one of the two to be filled** — _exactly_ one filled button per view, not _at
   most_ one. The revealed state is a view and the reveal button is not in it, so two outline buttons
   would leave it with zero filled controls. Which one is filled is settled by principle 5's next
   sentence, _"a destructive action is never the primary action"_: _Wrong_ resets the card's Leitner box
   and is the setback analogue, so _Right_ is Primary.

The labels are **not** renamed. Direction B's `Again` / `Good` were that direction's vocabulary; the
requirement is only that the two labels differ, which `Wrong` / `Right` already satisfy. Renaming would
change product copy and break the accessible names two E2E specs assert.

```tsx
<div className="flex gap-3">
  <Button
    type="button"
    variant="outline"
    className="flex-1"
    aria-keyshortcuts="1"
    disabled={submitting}
    onClick={() => {
      void handleRate("wrong");
    }}
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
    onClick={() => {
      void handleRate("right");
    }}
  >
    {submitting && pendingRating === "right" ? (
      <Loader2 className="size-4 animate-spin" />
    ) : (
      <Check className="size-4" />
    )}
    Right
  </Button>
</div>
```

The `cn()` wrappers around the old conditional colour strings are dropped with the colours; `flex-1`,
`aria-keyshortcuts`, `disabled`, the spinner swap, and both labels are preserved exactly. The two are
then distinguished by fill, border, text colour, label, and glyph — and by none of those alone.

**Recorded trade-off.** A filled _Right_ carries more visual weight than an outline _Wrong_, and that
asymmetry is new; today the two are equally weighted. It is a deliberate consequence of the direction's
own rules rather than a product judgement, and it does not touch scheduling — `handleRate` sends the same
payload for either rating. If a walkthrough shows it reading as a _recommendation_ rather than a
hierarchy, the fix is to revisit principle 5's "exactly one" for two-outcome views at the direction
level, not to reintroduce red and green here.

### States

| State        | Trigger                                         | What the user sees                                                                                                                                                      | What they can do                                                                          |
| ------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Read-only    | `Astro.locals.isReadOnly`                       | `PageHeader` plus an amber-bordered notice: _"Your account is pending deletion and is read-only. Cancel the deletion to review cards."_                                 | Cancel deletion from the retention banner; navigate away                                  |
| Load error   | Supabase absent, or the due-cards query errored | Red-bordered alert titled _"Could not load your review session"_ with _"Something went wrong fetching your due cards. Try refreshing the page."_, announced assertively | Refresh; navigate away                                                                    |
| Empty        | Query succeeded, zero cards due                 | Centred `PartyPopper`, _"All caught up!"_, _"You have no cards due for review right now. Come back later."_                                                             | Navigate away via the shell nav                                                           |
| Question     | A card is due, not yet revealed                 | _Card N of M_, _Restart_, the card face showing **Front** only in serif at `text-title`, a filled _Reveal answer_, and the hint row with **Space** active               | Reveal (click or `Space`); restart; navigate away                                         |
| Answer       | Revealed                                        | The same, plus **Back** beneath a hairline at the same size; the reveal button is replaced by an outline _Wrong_ and a filled _Right_, both monochrome                  | Rate (click, or `1` / `2`); restart; navigate away                                        |
| Submitting   | A rating POST is in flight                      | The rated button shows a spinner in place of its icon; both rating buttons and _Restart_ are disabled                                                                   | Wait — repeat key presses and same-frame clicks are dropped by the resolver and `lockRef` |
| Rating error | The POST failed or the network threw            | Red-bordered alert above the card face carrying the server message or its fallback, announced assertively; the same card stays on screen, still revealed                | Rate again; restart; navigate away                                                        |
| Complete     | Every due card rated                            | Centred `PartyPopper`, _"Session complete"_, _"You reviewed N cards. Nicely done."_, and an outline _Restart session_                                                   | Restart the same batch; navigate away                                                     |

## 📝 Edge Cases & Failure Scenarios

| Scenario                                                   | Behaviour after this change                                                                                                                                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase unconfigured, or the due-cards query errors       | `loadError` is true; `ReviewSession` renders the error `Notice`. Announced assertively for the first time.                                                                                               |
| Rating POST returns a non-OK status                        | `parseErrorBody` yields `{ code, message }`; the message (or its `FALLBACK_MESSAGES` entry) renders in an error `Notice` above the card face; the card stays revealed. Unchanged except for the element. |
| Rating POST throws (network)                               | `network_error` fallback, same `Notice`. Unchanged.                                                                                                                                                      |
| Rating POST returns `applied:false` (stale/replay)         | Still advances. Frozen — this is the response-handling branch, not markup.                                                                                                                               |
| Same-frame double click or key repeat                      | Dropped by `lockRef` and by `resolveReviewShortcut`'s `repeat` handling. Frozen; not reachable through markup.                                                                                           |
| A card front or back is one long unbroken string           | **New:** `break-words` prevents horizontal overflow. This is a fix, not a regression — today it overflows.                                                                                               |
| Read-only account                                          | `ReviewSession` never mounts; the page is header plus warning notice.                                                                                                                                    |
| Zero cards due, then the user restarts a completed session | `handleRestart` resets client state only; already-POSTed ratings stay persisted and no refetch occurs. Frozen.                                                                                           |
| Keyboard shortcut pressed while focus is in a text field   | Handled entirely by `resolveReviewShortcut`'s `target` check. Frozen.                                                                                                                                    |

## 📝 Risks & Impact Review

**Blast radius: two files.** No shared primitive, token, layout, or API is modified, so nothing outside
`/review` can regress. `Layout.astro` and `bg-cosmic` are untouched — after this increment `bg-cosmic`
remains live on exactly two screens (`/library`, `/dashboard`).

**Principal risk: silently perturbing the keyboard-shortcut behaviour.** `ReviewSession.tsx` carries the
freshest interaction logic in the repo (shipped six days before `/generate`). Mitigated structurally by
the frozen surface above — the logic lives in a separately-tested pure function, the guard is a ref
rather than an attribute, and both E2E suites locate purely on roles and accessible names, every one of
which this increment preserves verbatim.

**Secondary risk: the new visual asymmetry between the rating buttons** (recorded above, with its
escalation path at the direction level rather than a local revert to colour).

**Compatibility.** No public surface changes: no API, no schema, no config, no exported component
signature (`ReviewSession`'s props are unchanged). No deprecation or migration path is required.

**Rollback.** A single `git revert` of the increment's commits restores the previous screen exactly.
There is no persisted state, no migration, and no feature flag to unwind; a rollback is invisible to data.

### Assumptions the implementer should confirm during the walkthrough

- **`--text-meta` (0.8125rem) is right for the FRONT / BACK labels, the progress counter, the shortcut
  hints, and now `Kbd`.** It is the token's stated purpose in `global.css:247` (_"labels, counters,
  FRONT/BACK"_), which names this screen's elements literally — but the token has never rendered
  anywhere, because no shipped screen uses `text-meta` yet. This increment is its first render.
- **`bg-card` is not visually distinguishable from `bg-background` in the light palette.** Both resolve
  to `var(--ink-05)` (`global.css:105,112`), deliberately — the comment at `:108` says a card in this
  direction "is not a box". The card face therefore reads as a hairline-bordered region, which is
  principle 4's intent. Confirm the border alone gives enough separation at the card face's size;
  changing `--card` is out of scope and would be a token-layer increment.
- **The review card face and `/generate`'s draft row are now visibly different surfaces** — `bg-card` +
  `border-border` against `bg-surface-draft` (`--ink-10`) + `border-surface-draft-border` (`--ink-40`).
  This is the first time principle 7's draft-versus-saved contrast can be checked in the running app, and
  it should be checked here even though `/generate` is not modified.
- **`Button`'s `outline` variant ships `shadow-xs`** (the gap Increment 5 filed against `button.tsx`) and
  will render here at `flex-1` width with an icon and a spinner swap. Do not fix it in this increment.

## 📝 Scope

**Now:** `src/pages/review.astro` and `src/components/review/ReviewSession.tsx` only, plus the new tests
Q3 authorises.

**Not doing:** any change to `dashboard.astro`, `library.astro`, `generate.astro`, `settings.astro`, or
any auth page; any change to `src/lib/review-shortcuts.ts`, `src/lib/leitner.ts`, or
`src/pages/api/reviews.ts`; a `Card` primitive; a `Field` primitive; practice/cram mode on "All caught
up!"; dark mode; the `bg-cosmic` utility or `Layout.astro`; the `button.tsx` `shadow-xs` or touch-target
fixes; new copy beyond the two `EmptyState` strings Increment 2 already wrote down.

**Later:** `/library` in its own increment (where `Field` and `Card` are decided together from
`CreateCardForm` + `CardRow` + this increment's card face); `/dashboard` last; `bg-cosmic` and
`Layout.astro`'s `<body>` class removed after `/dashboard` lands; the review-session shell reduction
(deferred by Increment 3 and still deferred); the `button.tsx` follow-ups.

## ✅ Acceptance criteria

1. **Given** a signed-in user with due cards, **when** they open `/review`, **then** no element in
   `review.astro` or `ReviewSession.tsx` matches `bg-cosmic`, `backdrop-blur`, `rounded-2xl`,
   `bg-gradient-to-`, or a Tailwind palette-scale utility, and the page's own `bg-background` surface
   covers the viewport so the body gradient is not visible.
2. **Given** a card is on screen, **when** the rendered text is compared, **then** the front and back
   text both render at `text-title` in `--font-serif`, and both are larger and higher-contrast than the
   progress counter, the restart control, the FRONT/BACK labels, and the shortcut hints.
3. **Given** a card front containing a 200-character unbroken string, **when** it renders at a 390px
   viewport, **then** `document.documentElement.scrollWidth` does not exceed the viewport width.
4. **Given** the user presses `Space`, then `1`, then `Space`, then `2`, **when** the session runs,
   **then** the behaviour is identical to `main` before this change, and
   `tests/e2e/review-keyboard-shortcuts.spec.ts` and `tests/e2e/review-persistence.spec.ts` pass
   **unmodified**.
5. **Given** a rating POST fails, **when** the error renders, **then** the element carries `role="alert"`
   and `aria-live="assertive"`, and the card remains on screen in its revealed state.
6. **Given** the two rating buttons are revealed, **then** `ReviewSession.tsx` contains no `destructive`
   or `success` token on either button or either glyph; _Wrong_ renders as `variant="outline"` and
   _Right_ as `variant="default"`; the revealed view contains exactly one filled button; and with colour
   removed the two remain distinguishable by fill, border, label, and glyph.
7. **Given** zero due cards, **when** the page renders, **then** the empty state comes from
   `@/components/ui/EmptyState`, and `grep -rn "DoneCard" src/` returns nothing.
8. **Given** the whole change, **when** `npm run typecheck`, `npm run lint`, `npm run build`,
   `npm test`, and `npm run test:e2e` run, **then** all pass. The two existing review regression specs
   (`review-keyboard-shortcuts.spec.ts`, `review-persistence.spec.ts`) must pass **without any
   modification to those two files**; new test files and new cases elsewhere may be added as needed to
   make criteria 1, 3, 5, 6, and 7 executable.
9. **Given** `/generate` is opened alongside `/review`, **when** a draft row and a review card face are
   compared, **then** they are distinguishable by surface treatment alone, without reading the headings.

### How each criterion is verified (Q3 resolved — option (c))

The repo has no jsdom/RTL harness; `src/styles/tokens.test.ts` and `src/components/ui/primitives.test.ts`
established the house technique of reading a shipped file as text and asserting over it. New coverage
follows that technique rather than introducing a rendering harness.

A text guard can prove which classes a file contains. It cannot prove what the browser painted. Each AC
is therefore split at that line rather than assigned wholesale — the clauses about _rendered_ size,
contrast, and viewport coverage are manual, and are marked so honestly.

| AC clause                                                                                     | Verified by                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1, first clause — no legacy utility appears in either file                                  | **New** source-level Vitest guard, `src/components/review/review-paper.test.ts`                                                                                                                     |
| AC1, second clause — the page's own surface covers the viewport, body gradient not visible    | **Manual.** `Layout.astro` still ships `<body class="bg-cosmic">`; only a rendered check can confirm the page surface covers it.                                                                    |
| AC2, first clause — front and back carry `text-title` and `font-serif`                        | The new guard                                                                                                                                                                                       |
| AC2, second clause — both are larger and higher-contrast than counter, restart, labels, hints | **Manual.** Relative rendered size and contrast are not greppable.                                                                                                                                  |
| AC3 — no horizontal overflow at 390px with a 200-character unbroken front                     | **Manual.** A Playwright case would need a seeded card with adversarial content; deliberately left manual for this increment.                                                                       |
| AC4 — shortcut behaviour unchanged                                                            | The two existing E2E suites, run unmodified                                                                                                                                                         |
| AC5 — the rating error announces assertively and the card stays revealed                      | The new guard (asserts the rating error renders `Notice variant="error"`), plus the existing `primitives.test.ts` guarantee that the error variant maps to `role="alert"` / `aria-live="assertive"` |
| AC6, first clause — variants are `outline` / `default`, no `destructive` or `success` token   | The new guard                                                                                                                                                                                       |
| AC6, second clause — with colour removed the two remain distinguishable                       | **Manual.** A judgement about the rendered result, not about class strings.                                                                                                                         |
| AC7 — `EmptyState` is the empty state and `DoneCard` is gone                                  | The new guard                                                                                                                                                                                       |
| AC8 — the full gate passes                                                                    | `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run test:e2e`                                                                                                                |
| AC9 — draft row and card face distinguishable by surface treatment alone                      | **Manual** side-by-side walkthrough of `/generate` and `/review`                                                                                                                                    |

The manual clauses are not optional: Step 3 below makes them a required, screenshot-backed part of the
PR rather than a reviewer's discretion.

## ⚠️ Open decisions (deferred, not blocking)

1. **Should "All caught up!" offer a practice or cram session?** A standing product question from earlier
   work, including whether practice ratings should reschedule cards. Out of scope here; this increment
   restyles the state and adds no action to it. **Owner: product.**
2. **Does `Card` end up being the review card face, `CardRow`, or both?** Deferred by Increment 2 and
   still deferred. This increment produces the first of the two instances; `/library` produces the second
   and decides. **Owner: the `/library` increment.**
3. **Do the rating buttons meet the ≥44px touch target Direction A §13 requires?** `button.tsx`'s default
   size is `h-9` (36px), so probably not. Raising it changes a primitive shared by every shipped screen —
   filed here rather than fixed, alongside Increment 5's `shadow-xs` finding on the same file.
   **Owner: a `button.tsx` follow-up.** Call this out explicitly in the PR description: this increment
   closes one unmet direction rule (principle 6) while knowingly leaving another (§13) open on the same
   two controls.

## 📋 Phasing

**The screen is the atomic unit, and the plan must not pretend otherwise.** A half-migrated `/review` is
not a working screen: `review.astro`'s wrapper supplies the ground colour, and `ReviewSession.tsx`
supplies `text-white` / `text-blue-100/70` on every element inside it. Flip the wrapper to
`bg-background` (near-white `--ink-05`) while the component still carries light-on-dark text and the
screen is unreadable — which is precisely the hazard `global.css:317–323` already documents about
deleting `bg-cosmic` prematurely. Keep the dark wrapper and migrate the component first, and `PageHeader`'s
`text-foreground` (dark ink) lands on the dark gradient with the same result. There is no ordering of the
two files that produces a shippable intermediate.

Phase 1 is therefore **one commit** containing both files. The lettered items inside it are working-tree
checkpoints for the implementer and reviewer — each has its own verification — not commit boundaries.

- **Phase 1 — Migrate the screen** (one commit). `review.astro` and `ReviewSession.tsx` rewritten on
  Paper; `DoneCard` deleted. Delivers every user-visible outcome and is independently shippable.
- **Phase 2 — Make the criteria executable** (one or two commits). The new source-level guard plus the
  manual walkthrough evidence. **This phase is a dependent follow-on, not an independent capability** —
  Step 2's assertions (`text-title`, `font-serif`, `break-words`, no red classes, no `DoneCard`) fail by
  construction against pre-Phase-1 markup. It is split out only so a reviewer can read the markup diff
  without the test diff, and so the guard is written against finished markup rather than predicted.

Because Phase 2 cannot precede Phase 1, **both phases should land in the same PR.** Shipping Phase 1
alone would put AC1, 2, 5, 6, and 7 into `main` with no automated guard behind them.

## 📋 Implementation Plan

### Phase 1 — Migrate the screen (single commit)

Order the checkpoints as below and verify each in the working tree; commit only once 1d is green, so the
tree is never pushed in a light-on-paper state.

**1a — Migrate `review.astro`.**
Import `PageHeader` and `Notice`. Swap the wrapper to `bg-background text-foreground min-h-screen p-4`
and the inner column to `max-w-content`; replace the `<header>` block with
`<PageHeader title="Review session" />`; replace the read-only `<section>` with a bare
`<Notice variant="warning">`. Delete the `← Dashboard` link.
_Verify:_ `npm run typecheck && npm run lint && npm run build`; confirm the heading's accessible name is
still `Review session`. **Do not judge the rendered screen at this checkpoint** — the active session is
still light-on-dark inside a paper wrapper by design; 1d resolves it.

**1b — Replace the three terminal states and delete `DoneCard`.**
Import `Notice`, `EmptyState`, and `Button`. Replace the load-error call site with
`<Notice variant="error" title="Could not load your review session">`, the empty call site with
`EmptyState` (no action), and the complete call site with `EmptyState` plus the `Restart session`
`Button variant="outline"`. Delete the `DoneCard` function and drop `CircleAlert` from the import if it
is now unused.
_Verify:_ `grep -rn "DoneCard" src/` is empty (AC7); typecheck/lint/build; walk all three states — force
the load error by unsetting Supabase config, the empty state with no due cards, the complete state by
rating through a one-card session — and confirm `Restart session` still restarts.

**1c — Migrate the active-session container, progress row, and rating error.**
Strip the `<section>` down to `space-y-4`; restyle the progress `<p>` to
`text-meta text-muted-foreground`; convert the restart control to
`Button variant="ghost" size="sm"` keeping the name `Restart` and the `disabled={submitting}` binding;
replace the hand-rolled red `<p>` with `<Notice variant="error">{error.message}</Notice>`.
_Verify:_ typecheck/lint/build; trigger a failing rating POST (block `/api/reviews` in devtools) and
confirm the alert announces, the card stays revealed, and rating again succeeds (AC5). The surrounding
card face is still light-on-paper at this checkpoint; judge only the notice.

**1d — Migrate the card face, reveal button, rating buttons, and hint row.**
Rewrite the card face per UI/UX step 11 — `border-border bg-card rounded-paper` container, `text-meta`
uppercase labels, both faces at `text-title font-serif break-words`. Convert the reveal button to
`Button variant="default" className="w-full"` and the two rating buttons to the `outline` / `default`
pair per step 13, deleting every red and green class including on the glyphs and dropping the now-unused
`cn()` wrappers. Restyle `Kbd` to `text-meta` with Paper tokens and the hint row to
`text-meta text-muted-foreground`, keeping the dimming logic and its comment.
_Verify:_ typecheck/lint/build; `npm test`; **`npm run test:e2e` — both review suites must pass with
zero modification to their files (AC4/AC8)**; visually confirm exactly one filled button per state
(AC6) and the front/back size and contrast hierarchy (AC2).

**This is the first point at which the whole screen is coherent — commit here, not before.** Walk every
row of the state table once before committing.

### Phase 2 — Make the criteria executable

**Step 2 — Add the source-level guard `src/components/review/review-paper.test.ts`.**
Following the technique in `src/components/ui/primitives.test.ts` — read `review.astro` and
`ReviewSession.tsx` as text and assert over them. Cases: no `bg-cosmic` / `backdrop-blur` /
`rounded-2xl` / `bg-gradient-to-` / palette-scale utility in either file (AC1); the card-face paragraphs
carry `text-title` and `font-serif` and `break-words`, and the FRONT/BACK labels carry `text-meta`
(AC2); the rating error renders `Notice variant="error"` (AC5); `Wrong` is `variant="outline"`, `Right`
is `variant="default"`, and neither button nor glyph carries a `destructive` or `success` token (AC6);
`EmptyState` is imported and `DoneCard` does not appear (AC7).
_Verify:_ `npm test` passes; then deliberately reintroduce one red class and confirm the guard fails, to
prove the assertions bite.

**Step 3 — Manual walkthrough and evidence.**
At 390px, seed a card whose front is a 200-character unbroken string and confirm
`document.documentElement.scrollWidth` does not exceed the viewport (AC3). Open `/generate` and
`/review` side by side and confirm a draft row and the card face are distinguishable by surface
treatment alone (AC9). Confirm the `bg-card`-equals-`bg-background` assumption reads acceptably and that
`text-meta`'s first-ever render is legible. Capture screenshots of the question, answer, empty, complete,
and rating-error states for the PR.
_Verify:_ the full gate — `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`,
`npm run test:e2e` — plus the screenshots attached (AC8).
