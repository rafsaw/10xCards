# Increment 3 — Shell + mobile navigation

**Status:** handoff, ready to plan
**Written:** 2026-08-24 · `om-ux-shape` (Handoff mode)
**Follows:** Increment 1, the token layer, merged as `a233cc9` (PR #32)
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Strategy C order:** tokens → primitives → **shell / mobile navigation** → screen migration → remove `bg-cosmic`

---

## ⚠️ Correction, 2026-08-24 — Increment 2 is now shipped

**This handoff was originally shaped against a stale `main`.** It's re-verified here against the
current `HEAD`, `98219f2` — `feat(ui): ship Paper UI primitives (Notice, EmptyState, PageHeader) (#33)`,
merged on top of `3c3bfb8`. The first draft's claim that Increment 2 was only a written brief is
**no longer true** and is corrected below, item by item, against the code as it exists now.

| Shipped in #33 | Verified state today | Effect on Increment 3 |
|---|---|---|
| `src/components/ui/PageHeader.tsx` | Exists: `{ title, description }`, an `<h1 className="text-display ...">` at `max-w-content`, no back link, no nav — exactly the contract the original Increment 2 brief specified. **Zero consumers**: not imported by any page, only by its own test file. | None. It's a page-content primitive; the shell doesn't render page headers. The back-link question (below) is unaffected because no page has adopted it yet. |
| `src/components/ui/Notice.tsx` | Exists: `role`/`aria-live` mapping, variant surface tokens, `rounded-paper`. **Zero consumers** outside its own test file — `Banner.astro` does not use it (confirmed: `Banner.astro` still renders its own markup, related only by shared tokens, exactly as the Increment 2 brief said it would stay). | None. The shell's nav panel has no error/status messaging need; nothing in this handoff's contract calls for `Notice`. |
| `src/components/ui/EmptyState.tsx` | Exists, matches the `DoneCard`-derived contract. **Zero consumers** — `ReviewSession.tsx` still defines its own local `DoneCard`, not yet swapped for this. | None. Empty states are screen content, not shell chrome. |
| `--radius-paper: 0.375rem` | Real now, in `global.css`'s plain `@theme` block, and Tailwind generates `rounded-paper` from it. **`src/components/ui/primitives.test.ts` (criterion 5) asserts `rounded-paper` appears only under `src/components/ui/`.** | This is now a *verified, test-enforced* constraint, not a scope preference: `Topbar.astro` lives in `src/components/`, not `src/components/ui/`, so it must not use `rounded-paper` without either moving the file or editing that test — both out of bounds for a frame-only increment. The shell keeps reading the legacy `--radius` scale (`rounded-md`/`rounded-lg`), same as `Button` does until its own screens migrate. |
| `Banner.astro` semantic-token adoption | Shipped: its `<style>` block now reads `var(--info-surface)`/`var(--info)` etc., zero hex literals, confirmed by reading the file directly. | None on the shell contract — `Banner` and `RetentionBanner` keep the same position in `Layout.astro`, above and below `Topbar` respectively, which this increment doesn't touch. |
| `Button` focus-visible correction | Shipped: `button.tsx` now reads `focus-visible:ring-ring` with no alpha, and the `destructive` variant's ring override is gone. | Updates the accessibility contract below: the shell's interactive controls (Sign out, the mobile menu trigger, the panel's close control) should match this now-correct pattern — `focus-visible:ring-ring`, 3px, no alpha, no per-variant override — rather than the broken pattern the first draft had to route around. If a control is built with `<Button>` directly, this comes for free. |

**Net effect on this handoff: no direction change and no blast-radius change.** `Topbar.astro` and
`Layout.astro` are byte-identical to what the first draft inspected — PR #33 touched
`Banner.astro`, three new files under `src/components/ui/`, `button.tsx`, and `global.css`, and nothing
in the shell. The three new primitives all still have zero consumers anywhere in `src/pages/`, so the
"do not expand into screen migration" boundary was never at risk — there is no page adopting them yet
for this increment to accidentally build on top of. Everything else in this document stands; the
sections below are corrected only where the shipped code changes a specific claim.

---

## 📝 Current-state findings

**One layout, one nav component, both legacy.** `src/layouts/Layout.astro` is the only layout in the
app — there is no second recipe to reconcile. It renders, unconditionally in this order: config-error
`Banner`s → `Topbar` (only `{user && ...}`) → `RetentionBanner` (only `{isReadOnly}`) → `<slot />`, all
inside `<body class="bg-cosmic">`. `Topbar.astro` is a static Astro component (no client JS): a
`user.email` + 5 links (`/generate /review /library /dashboard /settings`) + a `POST
/api/auth/signout` form, laid out with `flex flex-wrap`, styled entirely in the legacy glass recipe
(`bg-white/15`, `border-white/10`, `text-blue-100/70`) with no token in it.

**Every protected route shares this exact shell — there is no per-route layout branching.**
`PROTECTED_ROUTES` in `src/middleware.ts` is `/dashboard /generate /review /library /settings`, gated
by redirect-to-`/auth/signin`. `Topbar` renders whenever `Astro.locals.user` is set, which is true on
every protected route and **only** those (public routes — `/`, `/auth/*` — never have a user, so
`Topbar` never appears there today). Consequence: **the shell touches all five protected pages by
inclusion, but none of their own markup**, because they only ever `import Layout` and wrap their
content in it. That is the whole blast radius story — see below.

**The mobile gap is already measured and recorded, not hypothesized.** `.ai/analysis/2026-08-21-ui-ux-discovery-phase1.md:62`: *"Cała `src/` ma 12 użyć breakpointów... Brak nawigacji mobilnej: 5 linków + email + Sign out zawijają się w wiersz"* — zero responsive rules outside `Welcome.astro`, `button.tsx`, and one each in `Layout.astro`/`Topbar.astro`; `dashboard`, `generate`, `library`, `review`, `settings` rely on `max-w-3xl` + wrap only. `.uxproof/conventions.md` principle 8 (already decided, not up for renegotiation here) states the target directly: *"The shell fits one row at 390px, `scrollWidth` never exceeds the viewport on any screen with any content, and during a review session the shell reduces to an exit control and a progress indicator."* Today's `Topbar` fails the first clause by construction — 5 text links + an email address + a submit button cannot fit one row at 390px logical width in a legible size — and does not implement the third at all (see the review-session note below).

**Sign-out has exactly one entry point in the entire app: `Topbar`'s form.** No other page, menu, or
route offers it. Whatever the mobile nav becomes, it is the only place a signed-in user can sign out,
so the contract carries that responsibility forward without regression — this is the single hardest
constraint on the design.

**A back link is duplicated with the nav, but it belongs to the pages, not the shell.** `generate.astro`,
`library.astro`, `review.astro`, `settings.astro`, and `auth/confirm-email.astro` each still hand-roll an
identical `<header>`: a gradient `<h1>` plus `<a href="/dashboard">← Dashboard</a>` — unchanged by PR
#33. The Increment 2 brief deliberately excluded this link from `PageHeader` with the note *"← Dashboard
is shell, and the shell is Increment 3... the four pages keep their existing back links inline until the
shell increment takes them."* `PageHeader` exists now, but **no page imports it yet** (confirmed above),
so there is still nothing for Increment 3 to hand the back link to without editing five page files
directly to adopt `PageHeader` first — which is screen work. **Decision unchanged: leave the inline back
links untouched.** They already coexist with `Topbar`'s own `Dashboard` link today (that redundancy is
pre-existing, not introduced here); resolving it is explicitly the screen-migration increment's job,
once a page actually adopts `PageHeader`.

**The review session already tracks its own progress, but the shell doesn't know about it.**
`ReviewSession.tsx:215` renders `Card {index + 1} of {dueCards.length}` inside the screen itself, and
`DoneCard` (`ReviewSession.tsx:29`) has its own "Back to dashboard" exit link. Principle 8's "shell
reduces to an exit control and a progress indicator" describes the shell *reacting* to review-session
state — that requires the screen to signal the shell, which is screen-level wiring. **Out of scope
here**, recorded under Deferred below; today's full nav bar keeps rendering on `/review` unchanged.

**No component library for a drawer/dialog exists, and none should be added.** Dependencies are
`@radix-ui/react-slot` (used only for `Button`'s `asChild`), `lucide-react`, `class-variance-authority`,
`clsx`, `tailwind-merge` — no Radix Dialog, no `vaul`, no headless-UI drawer primitive. `Banner.astro`
already sets the precedent for this shell: it stays plain Astro specifically to avoid a hydration
boundary for a static, sitewide element (`Notice`'s docs, `.ai/specs/briefs/2026-08-24-paper-ui-primitives.md:198`). The same reasoning applies more strongly to nav, which renders on every
protected page. The native `<dialog>` element gives a built-in modal (focus trap, `Escape` to close,
`showModal()`/`close()`, and a `::backdrop` pseudo-element to style) with zero new dependencies and zero
React hydration cost. Dismissing on a backdrop click is not one of the free parts — see the Behavior
section below for exactly what has to be wired by hand.

**Token and geometry facts that constrain the visual rebuild:** `--radius-paper` is real now (see the
correction above), but `src/components/ui/primitives.test.ts` enforces that `rounded-paper` appears only
under `src/components/ui/` — `Topbar.astro` lives outside that directory, so the shell keeps reading the
existing `--radius` scale (`rounded-md`/`rounded-lg`) like every other current component. This is no
longer just a scope preference; it's a test-enforced boundary the shell would break by adopting
`rounded-paper` without also moving itself into `src/components/ui/`, which is out of bounds for a
frame-only increment. `--accent` in
`global.css` is **not** the "accent" principle 6 means ("the accent is for the primary action, the
focus ring and the active nav item") — the code comment at `global.css:124` is explicit that `--accent`
is shadcn's neutral hover-surface role, and pointing it at blue "would turn every ghost hover blue."
The active-nav-item colour principle 6 asks for is `--link` / `--ring` (`--blue-500`), not `--accent`.
This is a naming trap worth calling out explicitly so the implementer doesn't wire the wrong token.

---

## 🎯 Outcomes

**User outcome.** From any protected screen, at any viewport width, a signed-in user can reach every
one of the five destinations and sign out, without the page requiring horizontal scroll and without
hunting through a wrapped, unlabeled row of text.

**Behavioral signal.** At a 390px-wide viewport, on each of `/dashboard /generate /review /library
/settings`: `document.documentElement.scrollWidth` does not exceed the viewport width, the nav
disclosure control is reachable and operable by keyboard alone, and every one of the 5 links plus
sign-out is reachable from it in a bounded number of steps (open the panel, then one activation).

**Business effect.** Removes the one shell property (mobile nav) that still visibly contradicts the
decided Paper direction on every protected screen a user ever sees, which is the blocking precondition
Strategy C recorded before screen migration can start looking coherent rather than half-migrated.

**Guardrail.** Sign-out must not become harder to reach than it is today, and desktop keyboard tab
order through the nav must not regress — both are easy to break silently while adding a mobile-only
code path.

---

## 📋 Scope

**Now:** a single responsive shell contract — `Layout.astro`'s Topbar wrapper and a rebuilt
`Topbar.astro` — that renders a horizontal Paper-styled link row above `sm` (640px) and collapses to a
menu button opening a native `<dialog>` panel below it, on all five protected routes, via the one
Layout every route already shares.

**Later:** the review-session shell reduction (exit control + progress indicator replacing the full
nav during an active session) — needs `ReviewSession` to signal state upward, which is screen work;
`PageHeader` adoption and back-link consolidation, once a page actually imports `PageHeader`; a brand
mark / wordmark decision for the shell, if one is wanted at all; icon-based nav if a future increment
decides icons carry more value than the current text-link model.

**Not doing:** any change to `dashboard.astro`, `generate.astro`, `library.astro`, `review.astro`,
`settings.astro`, or the auth pages' own markup; dark mode; a bottom tab bar (rejected below); a new
UI dependency (Radix Dialog, `vaul`, or similar) for the drawer; a design-token or radius change beyond
what the shell itself consumes from the existing scale.

---

## 📋 Direction comparison

**A — Bottom tab bar (rejected).** A persistent icon row solves "one row at 390px" trivially, but it
occupies vertical space on *every* screen forever, including the one screen (`/review`) whose own
decided direction (principle 8) is to shrink chrome further, not add a fixed bar beneath it. It also
requires inventing an icon per destination — undecided, and "Generate" and "Review" do not have an
obvious lucide glyph — which is a product decision this increment should not make by default. Rejected
on fit with the Paper principle "chrome recedes" and on the undecided icon-language cost.

**B — Off-canvas drawer via a menu button, native `<dialog>` (recommended).** Chrome recedes to one
control until requested, matching principle 3. The content of the drawer is the same text-link model
the desktop bar already uses — no new icon decisions, no new component library, no hydration cost
(`<dialog>` + a small inline script, same posture as `Banner.astro`). It trivially satisfies "one row
at 390px" (the collapsed bar is just the menu button) and composes cleanly with the deferred
review-session reduction — that later increment can simply stop rendering the trigger during an active
session instead of restructuring a persistent bar.

**C — Cosmetic-only responsive tweaks to the current wrapping bar (rejected).** Bigger touch targets
and better spacing do not change the arithmetic: 5 text links + an email address + a sign-out button
cannot fit one row at 390px logical width at a legible size. This is the status quo with polish, and it
does not meet the already-decided principle 8 contract.

**Decisive trade-off:** B costs one new small component (the drawer + its trigger) and a few lines of
vanilla JS; A costs a permanent icon bar with an unresolved icon-language decision and a standing
conflict with the review-session chrome-reduction direction; C costs nothing but doesn't solve the
problem. B is the smallest change that actually satisfies the decided contract.

---

## 📝 Handoff

**Intent.** Rebuild `Topbar.astro` and its wrapper in `Layout.astro` as a Paper-styled, responsive
shell: a full-bleed hairline-bordered bar, horizontal links above 640px, a menu button opening a native
`<dialog>` panel below it, both listing the same 5 destinations, the signed-in email, and sign-out.

**Non-goals.** No page under `src/pages/{dashboard,generate,library,review,settings}.astro` (or the
auth pages) changes. `bg-cosmic` stays everywhere it is today. No `PageHeader` adoption — `PageHeader`
exists (shipped in #33), but wiring it into a page is screen-migration work, not shell work. No
back-link consolidation. No review-session-aware shell reduction. No new dependency. No icon-based nav.
No brand mark / wordmark.

**Actor and trigger.** Any signed-in user, on any of the 5 protected routes, at any viewport width, any
time they want to move to another destination or sign out.

### 📋 Behavior

**Desktop / tablet (≥640px, Tailwind `sm` and above — unchanged breakpoint convention, matches every
other responsive rule already in the app):**

1. A full-width bar renders directly under any config-error banner, above the page's own content (and
   above `RetentionBanner`, which keeps its current position). Left: the signed-in email. Right: the 5
   links in their current order (`Generate`, `Review`, `Library`, `Dashboard`, `Settings`), then the
   `Sign out` button.
2. The link matching the current route carries `aria-current="page"`, renders in `--link` (not
   `--accent`, see the token note above), and is `font-medium`; every other link is
   `--muted-foreground`, becoming `--foreground` on hover.
3. `Sign out` submits the existing `POST /api/auth/signout` form — unchanged endpoint, unchanged
   behavior, restyled only.
4. Tab order is: email (not focusable, plain text) → the 5 links in order → Sign out. No behavior
   change from today's order.

**Mobile (<640px):**

1. The same bar collapses to one row containing only a menu button, right-aligned:
   `<button aria-haspopup="dialog" aria-expanded="false">` with a lucide `Menu` icon and a visually
   hidden "Open navigation" label. No email, no links, no sign-out button render inline — this is what
   makes the one-row-at-390px contract trivial rather than a squeeze.
2. Activating it calls `dialogRef.showModal()` on a `<dialog>` that slides in from the trailing edge
   (a plain CSS transform/transition, no animation library) and covers the full viewport height. Its
   own header repeats the menu button as a close control (lucide `X`, label "Close navigation") plus
   the signed-in email.
3. Below that: the same 5 links, one per row, each a full-width tap target — 44px minimum height is the
   design target, matching common mobile touch-target conventions (Apple HIG, Material Design). This is
   not itself a WCAG requirement: WCAG 2.2 SC 2.5.8 Target Size (Minimum) sets a 24×24 CSS-px floor, not
   44px — 44px is a design choice made here, not a citation. Same `aria-current`/`--link` active
   treatment as desktop. Below the links, `Sign out` as a full-width control, visually separated by a
   hairline (principle 4 — no shadow).
4. `<dialog>` gives focus trap and `Escape`-to-close natively; the implementation must also return
   focus to the menu button on close (`dialog.addEventListener('close', () => trigger.focus())`),
   since native `<dialog>` does not do this for you.
5. **Backdrop-click dismissal is not native `<dialog>` behavior and must be implemented explicitly.**
   A `<dialog>` element does not close itself on an outside click — that has to be wired by hand: attach
   a `click` listener to the `dialog` element itself and close it only when `event.target === dialog`
   (a click that lands on the `::backdrop` fires with the dialog as its target; a click inside the panel's
   content wrapper does not, because the wrapper is a separate element the event targets instead). Get
   this wrong — e.g. listening on `document` instead — and a click anywhere outside the dialog, including
   on the page behind a non-modal fallback, could close it unintentionally, or a click inside the content
   could close it if the target check is missing.

### 📋 States

| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| Desktop bar, resting | viewport ≥640px | Full-width hairline-bordered bar: email, 5 links, Sign out | Navigate, sign out, tab through in order |
| Desktop bar, active route | current path matches a link | That link in `--link` colour, `font-medium`, `aria-current="page"` | Same as above; the current page's own link is still clickable (re-navigates, no special-case needed) |
| Mobile bar, closed | viewport <640px | One row: right-aligned menu button, nothing else | Open the panel |
| Mobile panel, open | menu button activated | Full-height panel: close button, email, 5 full-width links, Sign out, in that order | Navigate (closes panel via route change), sign out, close via `X`, `Escape`, or backdrop click |
| Mobile panel, closing | `Escape` (native), backdrop click (explicit script — see Behavior), or close button | Panel dismisses | Focus returns to the menu button (explicit script — native `<dialog>` does not do this) |
| Config-error banner present | `missingConfigs` non-empty | Banner(s) render above the shell bar, unchanged position | Unaffected — this increment does not touch `Banner.astro`'s layout, only the shell beneath it |
| Retention banner present | `isReadOnly` | Renders below the shell bar, unchanged position, on both desktop and mobile | Unaffected |

### ♿ Accessibility contract

- The bar is a `<nav aria-label="Main">` landmark on both breakpoints, so a screen-reader user can jump
  to it directly regardless of which visual form is showing.
- `aria-current="page"` on the active link, in both the desktop bar and the mobile panel — not colour
  alone (principle 6).
- The mobile trigger is a real `<button>` with `aria-haspopup="dialog"` and `aria-expanded` kept in
  sync; the panel is a `<dialog>`, which AT already announces as a dialog — no extra `role` needed.
- Focus moves into the dialog on open (native `<dialog>` `showModal()` behavior) and back to the
  trigger on close (must be wired manually, per the behavior spec above).
- `Escape` closes the panel (native). Tab is trapped inside it while open (native).
- All interactive targets (links, Sign out, the menu trigger, the panel's close control) meet the
  `Button` focus-ring contract already shipped in `button.tsx` — `focus-visible:ring-ring`, 3px, no
  alpha, no per-variant override. No new focus style is invented here; the same `--ring` token and the
  same corrected pattern are reused everywhere in the shell. Building `Sign out` and the menu/close
  controls with `<Button variant="ghost">` gets this for free; hand-rolled classes must replicate it
  exactly rather than reintroduce the alpha-ringed pattern `button.tsx` no longer has.

### 📋 Route / blast-radius map

| File | Change |
|---|---|
| `src/components/Topbar.astro` | Rewritten: Paper tokens, `aria-current` semantics kept, responsive markup + inline `<script>` for the dialog, `role`/`aria-*` additions |
| `src/layouts/Layout.astro` | The `<div class="px-4 pt-4 sm:px-8">` wrapper around `<Topbar />` is replaced or removed so the bar can render full-bleed with a hairline bottom border instead of an inset floating pill — everything else in this file (`Banner`, `RetentionBanner`, `<slot />` order) is unchanged |
| `src/pages/*.astro` (all 5 protected + auth pages) | **Untouched** — they only ever consume `Layout`; none of their own markup changes |
| `src/styles/global.css` | No new tokens required — the shell reads existing `--background`, `--foreground`, `--muted-foreground`, `--border`, `--link`, `--ring` |
| Auth pages, `/` | Unaffected in practice — `Topbar` already never renders for a signed-out user, and this increment does not change that condition |

No other file changes. Nothing under `src/components/{auth,generate,library,review,settings}/` is
touched.

### 📋 Assumptions to confirm

1. **`<dialog>`'s `showModal()`/`close()`, native focus trap, and `Escape`-to-close render correctly
   across the project's supported browser set — and the hand-written backdrop-click handler
   (`event.target === dialog`) behaves correctly alongside them.** `[ASSUMPTION]` — modern evergreen
   browsers all support the native parts; no IE/legacy target is implied anywhere else in this codebase
   (React 19, Astro 6). The custom backdrop handler is new code, not a native guarantee, so it needs its
   own check, not just the native feature's — worth a real-device pass on iOS Safari specifically during
   QA.
2. **A plain inline `<script>` inside `Topbar.astro` (not a React island) can safely call
   `document.getElementById(...).showModal()`.** `[ASSUMPTION]` — consistent with `Banner.astro`'s own
   "stays Astro, no hydration boundary" precedent; confirm Astro's script processing doesn't need
   `is:inline` here the way `library.astro:81` needed it for its own inline script.
3. **`sm` (640px) is the right collapse point**, reusing the breakpoint every other responsive rule in
   the app already uses (`Welcome.astro`, `button.tsx`'s two breakpoint uses). `[ASSUMPTION]` — not
   re-derived from new evidence; carried forward for consistency rather than re-litigated.
4. **Removing the `px-4 pt-4 sm:px-8` wrapper in `Layout.astro` does not regress spacing for
   `RetentionBanner` or the page content below it**, since that div today also indirectly sets the
   left/right inset the eye reads before the bar. `[ASSUMPTION]` — needs a visual check against the
   config-error-banner and retention-banner cases together, not just the empty-state shell.

### ✅ Acceptance criteria

1. **Given** a signed-in user on `/dashboard`, `/generate`, `/review`, `/library`, or `/settings` at a
   390px-wide viewport, **when** the page loads, **then**
   `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
2. **Given** the same routes at 390px, **when** the page loads, **then** the only interactive nav
   element visible without further interaction is the menu button — no link, email, or Sign out control
   renders inline.
3. **Given** the mobile menu button, **when** activated by mouse or by `Enter`/`Space` on keyboard
   focus, **then** a `<dialog>` opens containing all 5 links, the signed-in email, and Sign out, and
   focus moves inside it.
4. **Given** the open mobile panel, **when** `Escape` is pressed, or the backdrop is clicked, or the
   close button is activated, **then** the panel closes and focus returns to the menu button.
5. **Given** the open mobile panel, **when** `Tab` is pressed repeatedly, **then** focus never leaves
   the panel's own interactive elements (native `<dialog>` focus trap).
6. **Given** a viewport ≥640px, **when** any protected page loads, **then** the email, all 5 links, and
   Sign out render inline in one row, with no menu button visible.
7. **Given** either viewport, **when** the current route matches one of the 5 links, **then** that link
   carries `aria-current="page"` and is visually distinguished by both colour (`--link`) and weight
   (`font-medium`), not colour alone.
8. **Given** the existing `POST /api/auth/signout` endpoint, **when** Sign out is activated from either
   the desktop bar or the mobile panel, **then** the request and resulting redirect behavior are
   byte-for-byte the same as today's — only the surrounding markup changed.
9. **Given** `src/pages/*.astro`, **when** diffed against `main`, **then** none of the 5 protected pages
   or the 3 auth pages show any change.
10. **Given** `npm run typecheck`, `npm run lint`, `npm run build`, and `npm test`, **when** each runs,
    **then** each passes.

---

## 🧪 Validation

**Riskiest belief:** that a native `<dialog>` panel, styled and scripted without a component library,
delivers a correct focus trap and `Escape`/backdrop dismissal in the actual browsers this app is used
in — not just in the spec.

**Smallest test that could change the decision:** a Playwright spec (this repo's existing pattern —
`playwright.config.ts` has one `chromium`/Desktop-Chrome project; no mobile-viewport project exists,
and adding one is unnecessary — override the viewport per-test with
`test.use({ viewport: { width: 390, height: 844 } })`, the same technique already available to any spec
in `tests/e2e/`) that: opens the panel via the menu button (`getByRole('button', { name: /open navigation/i })`),
asserts every link and Sign out are reachable via `getByRole('link'|'button', { name: ... })`, presses
`Escape`, and asserts focus returned to the trigger (`toBeFocused()`). A second assertion at 390px on
each of the 5 routes checks `scrollWidth` against `clientWidth` via `page.evaluate`.

**What each result means:** if the dialog's focus trap or return-focus behavior fails in Chromium, the
`<dialog>`-only approach needs a manual focus-trap fallback before this ships — that would be the one
thing in this handoff worth re-opening. If it passes, the native-element choice is validated and no
further browser-compat spike is needed before implementation.

---

## ⚠️ Open decisions

1. **When a page adopts `PageHeader`, does it take over the "← Dashboard" back link, or does the
   shell's own `Dashboard` nav item make it redundant and worth deleting instead of moving?** `PageHeader`
   is shipped and available now, but no page imports it yet, so this is still open. Recorded so the
   migration increment doesn't rediscover the question. **Owner: screen-migration increment.**

### Settled, recorded so they are not reopened

- **No brand mark / wordmark in Increment 3.** The collapsed mobile bar stays intentionally minimal —
  menu button only, no logo, no wordmark. Any future identity treatment for the shell is a separate,
  later decision, out of scope here.
- **No bottom tab bar.** Settled here: conflicts with "chrome recedes" and the review-session direction,
  and requires an undecided icon language. See Direction comparison.
- **No new dependency for the drawer.** Settled here: native `<dialog>` meets every accessibility
  requirement this increment needs, at zero dependency cost, consistent with `Banner.astro`'s existing
  no-hydration precedent.
- **`PageHeader` is not adopted by the shell or by any page in this increment.** Settled here: it ships
  in `#33` and is available, but it is a page-content primitive (a screen's `<h1>` + description), not
  shell chrome — the shell doesn't render page headers, and wiring it into a page is screen work this
  increment doesn't do. See the correction at the top of this document.
- **The shell does not adopt `--radius-paper`.** Settled here: `primitives.test.ts` (criterion 5)
  enforces `rounded-paper` only under `src/components/ui/`; `Topbar.astro` lives outside that directory,
  so using it there would fail an existing test without also relocating the shell — out of bounds for
  this increment.

---

## 📋 Applied

AI necessity gate: not applicable — no AI behaviour in scope. Human-AI checklist: not applicable, same
reason. Value metrics: outcome, behavioral signal, business effect, and guardrail stated above per
`human-value-metrics.md`'s ordering; this increment ships user-facing behaviour (unlike Increment 2) so
they are not skipped. Design contract: loaded (`.uxproof/contract.json`, `conventions.md` including the
manual section and its eight principles, `components.json`); registry covers 15 of ~30 UI files per the
manual section's own caveat, so `Topbar.astro` and `Layout.astro` were read directly rather than
assumed from the registry. Evidence tiers: findings above are tagged `[ASSUMPTION]` where unverified;
everything else is read directly from the repository at `HEAD` (`98219f2`) rather than carried over from
an earlier document. Quality rubric: passed — diagnosis names the mobile-nav/legacy-shell gap rather
than restating "build a shell"; scope completes one real job (reach every destination and sign out) end
to end at both breakpoints; the riskiest belief (native `<dialog>` behavior) has a decision-changing
test; screens, components, copy, and states are named concretely throughout.

**Correction, 2026-08-24 — re-verification against shipped Increment 2, not a re-shape.** The first
draft was written against a stale `main` and wrongly concluded Increment 2 hadn't shipped. Re-inspected
against `HEAD` `98219f2` (`feat(ui): ship Paper UI primitives (Notice, EmptyState, PageHeader) (#33)`):
`PageHeader`, `Notice`, `EmptyState`, `--radius-paper`, `Banner`'s token adoption, and `Button`'s focus
correction are all real now, all verified directly against the shipped files, and all still have zero
effect on this increment's direction or blast radius — `Topbar.astro` and `Layout.astro` are unchanged
by `#33`, and none of the three new primitives has a consumer yet for this increment to build on top of.
Two corrections of fact were also made: backdrop-click dismissal on `<dialog>` is not native and is now
specified as requiring an explicit `event.target === dialog` handler; the 44px mobile touch target is
recorded as a design convention, not a WCAG 2.5.8 citation (2.5.8 sets 24×24 CSS px). The recommended
direction (off-canvas drawer via a menu button, native `<dialog>`), the blast radius
(`Topbar.astro` + `Layout.astro`'s wrapper only, no page files), the acceptance criteria, and the
remaining open decisions are unchanged.
