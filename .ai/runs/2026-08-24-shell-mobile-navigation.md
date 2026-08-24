# Execution plan — Shell + mobile navigation

**Date:** 2026-08-24
**Slug:** `shell-mobile-navigation`
**Branch:** `feat/shell-mobile-navigation`
**Base:** `main`
**Engine:** om-auto-create-pr (steps: 10, --loop: no)
**Source doc:** `.ai/specs/briefs/2026-08-24-shell-mobile-navigation.md`

## 🎯 Goal

Rebuild `Topbar.astro` (and its wrapper in `Layout.astro`) as a Paper-styled, responsive
shell: a full-bleed hairline-bordered bar with horizontal links above 640px, collapsing to
a menu button that opens a native `<dialog>` panel below it — same 5 destinations, the
signed-in email, and sign-out, on all five protected routes via the one shared `Layout`.
Direction B (off-canvas drawer, native `<dialog>`, no new dependency) per the spec.

## Scope

- `src/layouts/Layout.astro` — remove the `px-4 pt-4 sm:px-8` wrapper div around
  `<Topbar />` so the bar renders full-bleed; `Banner`/`RetentionBanner`/`<slot />` order
  unchanged.
- `src/components/Topbar.astro` — rewritten: Paper tokens (`bg-background`,
  `text-foreground`, `text-muted-foreground`, `border-border`, `text-link`), `<nav
  aria-label="Main">` landmark on both breakpoints, `aria-current="page"` semantics kept,
  responsive markup (desktop row hidden below `sm`, mobile trigger hidden at `sm`+), a
  native `<dialog>` panel, and an inline `<script>` for open/close/focus-return/backdrop
  dismissal.
- `tests/e2e/mobile-nav.spec.ts` — new Playwright spec per the Validation section's
  smallest-decision-changing test.

### Non-goals (explicitly not touched)

- No `.astro` page under `src/pages/{dashboard,generate,library,review,settings}` (or the
  auth pages) changes.
- `bg-cosmic` stays everywhere it is today; no dark-mode work.
- No `PageHeader` adoption, no back-link consolidation, no review-session-aware shell
  reduction, no new dependency (Radix Dialog/`vaul`/etc.), no icon-based nav beyond the
  two inline Menu/X glyphs the spec itself calls for, no brand mark.
- No `rounded-paper` / `--radius-paper` adoption in the shell (test-enforced boundary —
  `primitives.test.ts` scopes `rounded-paper` to `src/components/ui/`, which `Topbar.astro`
  is not part of).

## Risks

- **Correction to the spec's blast-radius claim:** `src/components/Welcome.astro:2,28`
  imports and renders `<Topbar />` directly and unconditionally — not gated by
  `Layout.astro`'s `{user && ...}` wrapper. `src/pages/index.astro` redirects any
  signed-in user to `/dashboard` before rendering `Welcome`, so in practice `Topbar`
  always renders there in its **signed-out** branch ("Not signed in" / Sign in / Sign up).
  The spec's note "Auth pages, `/`: Unaffected in practice — Topbar already never renders
  for a signed-out user" is factually incorrect: it renders every time, in exactly that
  state. Mitigation: keep the signed-out branch functionally identical (same links, same
  copy) so `/` does not regress, and give it the same token/focus-ring treatment as the
  rest of the rewritten file since the whole component is being touched anyway.
- **`<dialog>` cross-browser fidelity** (native focus trap, `Escape`, the hand-written
  `event.target === dialog` backdrop handler) is asserted in Chromium via Playwright per
  the Validation section, but a real-device iOS Safari pass is called out by the spec as
  its own follow-up — out of scope for this automated run.
- **Entrance-only slide animation.** To avoid a close-race between the exit transition and
  `dialog.close()` (which would risk the focus-return/backdrop-click acceptance criteria),
  the panel animates in on open but closes immediately rather than waiting out an exit
  transition. Matches "a plain CSS transform/transition, no animation library" without
  adding transition-timing risk to the tested behavior.
- Removing `Layout.astro`'s `px-4 pt-4 sm:px-8` wrapper changes the visual inset read
  before the bar (assumption 4 in the spec) — needs a visual check against the
  config-error-banner and retention-banner cases, not just the empty-state shell.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Layout wrapper

- [ ] 1.1 Remove the `px-4 pt-4 sm:px-8` wrapper div around `<Topbar />` in `Layout.astro` so the bar renders full-bleed with its own hairline bottom border

### Phase 2: Desktop bar — Paper tokens + accessibility

- [ ] 2.1 Rewrite the signed-in branch of `Topbar.astro`: full-bleed `border-b border-border bg-background` bar, `<nav aria-label="Main">` landmark, email + 5 links + Sign out in current order, active link `aria-current="page"` + `text-link font-medium`, inactive `text-muted-foreground` hover `text-foreground`, hand-rolled `outline-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px]` (matching `button.tsx`'s corrected pattern, no alpha) on every interactive element
- [ ] 2.2 Verify tab order is unchanged (email non-focusable text → 5 links in order → Sign out) — DOM order preserved from the original, confirmed manually

### Phase 3: Mobile collapse — trigger button

- [ ] 3.1 Hide the desktop nav row below `sm` (640px); add a right-aligned `<button aria-haspopup="dialog" aria-expanded="false" aria-controls="...">` visible only below `sm`, with an inline SVG matching lucide's `menu` path data (`M4 5h16 / M4 12h16 / M4 19h16`, no new dependency) and a visually-hidden "Open navigation" label

### Phase 4: Native `<dialog>` panel

- [ ] 4.1 Add the `<dialog>` markup (signed-in branch only): header with a close button (inline SVG matching lucide's `x` path data, "Close navigation" label) plus the signed-in email; the same 5 links as full-width ≥44px (`min-h-11`) rows with the same active-link treatment; a hairline-separated full-width Sign out control submitting the existing `POST /api/auth/signout` form
- [ ] 4.2 Add scoped `<style>` for the panel: fixed, full `100dvh` height, slides in from the trailing edge via `transform`/`transition` (entrance-only, no animation library), `::backdrop` styling; hidden at `sm` and above

### Phase 5: Dialog behavior script

- [ ] 5.1 Add the inline `<script>` wiring `showModal()`/`close()` to the trigger/close button, `aria-expanded` kept in sync, focus returned to the trigger on the dialog's native `close` event (`dialog.addEventListener('close', () => trigger.focus())`), and the explicit backdrop-click handler checking `event.target === dialog` (not `document`) so a click inside the panel content never closes it

### Phase 6: Signed-out branch parity

- [ ] 6.1 Token-pass the existing "Not signed in" branch (same copy, same links to `/auth/signin` and `/auth/signup`) so `Welcome.astro`'s direct, unconditional `<Topbar />` render on `/` does not regress; give it the same focus-ring treatment as the rest of the file

### Phase 7: E2E coverage

- [ ] 7.1 Add `tests/e2e/mobile-nav.spec.ts`: `test.use({ viewport: { width: 390, height: 844 } })`, open the panel via `getByRole('button', { name: /open navigation/i })`, assert all 5 links + Sign out are reachable via `getByRole('link'|'button', { name })`, press `Escape`, assert focus returns to the trigger via `toBeFocused()`
- [ ] 7.2 In the same spec, assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at 390px on each of the 5 protected routes
