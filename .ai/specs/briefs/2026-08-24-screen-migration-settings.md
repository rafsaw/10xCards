# Increment 4 — Screen migration: `/settings`

**Status:** handoff, ready to plan
**Written:** 2026-08-24 · `om-ux-shape` (Handoff mode)
**Follows:** Increment 3, shell + mobile navigation, merged as `edb9a22` (PR #34)
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Strategy C order:** tokens → primitives → shell / mobile navigation → **screen migration** → remove `bg-cosmic`

---

## 📝 Current-state findings

**`/settings` is exactly the screen Increment 2 named as the strongest first candidate, and nothing
since has changed that.** `.ai/specs/briefs/2026-08-24-paper-ui-primitives.md`'s "Settled" section
recorded it explicitly: *"52 lines, no AI or scheduling logic, one destructive action, and an instance
of nearly every primitive built here — and that increment should start there."* Re-measured today at
`HEAD` (`edb9a22`): `src/pages/settings.astro` is 52 lines, `src/components/settings/DeleteAccountButton.tsx`
is 72, `src/components/settings/CancelDeletionButton.tsx` is 48. No other page or shared component
changed shape since Increment 2 wrote that recommendation.

**The gradient heading and the inline back link are both banned or redundant now, for reasons that
didn't exist when the page was written.** `settings.astro:15` carries the exact gradient heading
principle 3 bans product-wide (`bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text
text-transparent`); `PageHeader` exists now and is its replacement, unused anywhere in the app until
this increment. The back link at `settings.astro:18` (`← Dashboard`) was deliberately left in place by
both Increment 2 and Increment 3 with the same note: *"the shell increment takes them"* — but Increment
3 shipped a shell whose `Dashboard` nav item is present, keyboard-reachable, and `aria-current`-marked
on every one of the five protected routes, including this one. The back link is now pure duplication of
a control the shell already provides on this exact page, not a stopgap for a missing one. This
increment is `.ai/specs/briefs/2026-08-24-shell-mobile-navigation.md`'s own recorded owner of that open
question (*"Owner: screen-migration increment"*) — see Open decisions below for the resolution.

**The danger-zone box is the glass-card recipe, on the one screen where the destructive-action
principle matters most.** `settings.astro:25`: `rounded-2xl border border-red-500/30 bg-red-900/10 p-6
text-white backdrop-blur-xl` — box, shadow-adjacent blur, and three raw `red-*`/`white` literals, all
banned by principles 1, 2, and 4. The isReadOnly sub-block nested inside it (`settings.astro:36`)
repeats the same recipe in amber. Both are structurally the exact shape `Notice` was built for:
Increment 2's own contract for `Notice`'s `warning` variant states, verbatim, *"Real copy in
production: 'Your account is scheduled for deletion on 24 September 2026. Until then it's read-only.'"*
and *"Activate `Cancel deletion`"* — this screen's isReadOnly block is not merely similar to that
example, it **is** that example, unbuilt until now.

**`DeleteAccountButton.tsx` hand-rolls a second, independent instance of the same error shape `Notice`
already covers.** Its own error `<p>` (line 54) is `rounded-lg border border-red-500/30 bg-red-900/30
px-3 py-2 text-sm text-red-300` with no `role` or `aria-live` — the exact accessibility defect
Increment 2's Notice contract exists to close, on a screen that triggers it from a real, consequential
failure path (a failed account-deletion request). `grep -rn 'DeleteAccountButton' src/` confirms this
component has exactly one consumer, `settings.astro` — so fixing it is contained to this screen, unlike
the deferred `auth/FormField.tsx` fix in Increment 2, which touched a component shared beyond the
increment's boundary.

**`CancelDeletionButton.tsx` is shared beyond this screen, and that boundary constrains what this
increment may touch.** `RetentionBanner.astro` (rendered by `Layout.astro` sitewide, on every protected
route, whenever `isReadOnly`) also renders `CancelDeletionButton` — with no `className` override, so it
falls back to the component's own default styling (`rounded-md border border-current ...`, already
colour-neutral via `border-current`/inherited text colour, not a token violation). `settings.astro`,
by contrast, always passes its own explicit `className` override. That means the component file itself
does not need to change for this increment: only the string `settings.astro` passes it changes, which
is a call-site edit fully contained to this screen and leaves `RetentionBanner`'s appearance untouched.
**One thing inside `CancelDeletionButton.tsx` is out of that boundary and is not fixed here:** its own
inline error span (`text-sm text-red-700`, line 45) is a raw Tailwind-palette literal, but it is
internal to a component `RetentionBanner` also renders sitewide — fixing it reaches past `/settings`.
Recorded as a follow-up below, the same way Increment 2 deferred `auth/FormField.tsx`.

**The page already paints its own full-bleed background independent of `<body>`, which is exactly the
mechanism this migration needs and already proves itself safe.** `settings.astro:12` wraps its content
in `<div class="bg-cosmic min-h-screen p-4">` — a second, redundant `bg-cosmic` layered on top of
`Layout.astro`'s own `<body class="bg-cosmic">`. That redundancy is not a bug to fix; it is proof that
a page-level wrapper can fully opaque the body's cosmic background underneath it. `Topbar.astro` and
`Banner.astro` already use the same technique in miniature — a `bg-background` island against the
`bg-cosmic` page. This increment does the same thing at the scale of the whole page: swap this one
`div`'s `bg-cosmic` for `bg-background text-foreground`, and everything below the shell on `/settings`
renders as a full Paper surface, with `<body>`'s own `bg-cosmic` present but entirely hidden underneath
it. `global.css`'s removal-condition comment on `bg-cosmic` ("do not remove ... until the last
screen-migration increment removes it in the same commit") governs the **utility and `Layout.astro`'s
`<body>`**, not this page-level wrapper — nothing in that comment is touched here.

**Section and Card stay deferred, on schedule.** Increment 2's return condition for `Card` was *"after
the first two screens are migrated, when their real regions are visible"* — this is the first, so that
condition is not yet met. The danger-zone region below is therefore hand-styled inline with Paper
tokens once, not extracted into a new shared primitive; extracting `Section` is a decision for whichever
increment migrates the second screen, once two real examples exist to compare.

**Token and geometry facts that constrain this increment specifically:**
`src/components/ui/primitives.test.ts` (criterion 5) asserts `rounded-paper` appears only under
`src/components/ui/` and that `rounded-(md|lg|xl)` occurrences across `src/` total a fixed count —
**63 today**, per the file itself. None of the three files this increment touches
(`settings.astro`, `DeleteAccountButton.tsx`, a new `RetentionNotice.tsx`) live under
`src/components/ui/`, so none of them may use `rounded-paper` directly — same constraint `Topbar.astro`
hit in Increment 3, resolved the same way: keep reading the legacy `--radius` scale via `rounded-md`
where a bordered control still needs a radius, and let composed primitives (`Notice`, which already
carries `rounded-paper`) supply Paper geometry instead. The expected net effect on the count, worked
through file by file below, is **63 → 61**: the two hand-rolled boxes this increment removes
(`settings.astro`'s `rounded-lg` isReadOnly box, `DeleteAccountButton.tsx`'s `rounded-lg` error box)
are both replaced by `Notice`, which contributes no new `rounded-md|lg|xl` occurrence; the one
`rounded-md` control that survives (the Cancel-deletion action button) relocates from `settings.astro`
into the new `RetentionNotice.tsx` file, a wash. **The implementer must re-run
`grep -rnoE 'rounded-(md|lg|xl)\b' src/ | wc -l` after the change and update criterion 5's asserted
number to whatever it actually is** — 61 is the reasoned expectation, not a number to force.

---

## 🎯 Outcomes

**User outcome.** A signed-in user visiting Settings reads a page that looks and reads consistently
with the rest of the product's decided direction — paper background, ink text, a hairline-separated
danger zone instead of a dark glass box — and can still delete their account, or cancel a pending
deletion, exactly as before, with every error and warning now announced to assistive technology instead
of appearing silently.

**Behavioral signal.** `/settings` renders with `document.body`'s `bg-cosmic` fully hidden beneath the
page's own `bg-background` surface; a screen-reader user triggering a failed deletion or viewing a
pending-deletion state hears the message announced (`role="alert"`/`"status"` with matching
`aria-live`), which today they do not.

**Business effect.** Delivers the first real, in-product proof that `Notice` and `PageHeader` compose
correctly on a live screen — the exact evidence Increment 2 shipped without, by design, and the
precondition for every subsequent screen-migration increment to move faster with a validated pattern
instead of a theoretical one.

**Guardrail.** The account-deletion and cancel-deletion request/response behavior, the native
`window.confirm()` step, and the redirect on success must not change in any way — only the surrounding
markup and styling change. Signing out, navigating, and every other shell affordance already shipped in
Increment 3 must keep working unchanged on this page.

---

## 📋 Scope

**Now:** migrate `/settings` only — `settings.astro`'s heading, back link, "signed in as" line, and
danger-zone region; `DeleteAccountButton.tsx`'s error state; the styling `settings.astro` passes to
`CancelDeletionButton`. One new file, `src/components/settings/RetentionNotice.tsx`, composes `Notice`
and `CancelDeletionButton` for the isReadOnly case (see Behavior).

**Later:** the remaining four screens (`/dashboard`, `/generate`, `/library`, `/review`) migrate in
their own increments, each starting from the pattern this one proves; `Section`/`Card` extraction, once
a second screen's regions make the real shared shape visible; the standalone `CancelDeletionButton.tsx`
error-span token fix, filed as a follow-up rather than folded in here; `--radius-paper` and `bg-cosmic`
removal, both explicitly gated on *every* screen migrating, not this one.

**Not doing:** any change to `dashboard.astro`, `generate.astro`, `library.astro`, `review.astro`, or
any auth page; any change to `CancelDeletionButton.tsx`'s own file (only the className `settings.astro`
passes it changes); any change to the account-deletion or cancel-deletion request logic, the
`window.confirm()` step, or the redirect targets; a new `Section` or `Card` primitive; dark mode; the
global `bg-cosmic` utility or `Layout.astro`'s `<body>` class.

---

## 📋 Direction comparison

**A — Migrate all five protected screens in one increment (rejected).** Would finish the "screen
migration" step of Strategy C in a single pass, but stakes the first real-world use of `Notice` and
`PageHeader` on five screens at once instead of one, makes the diff large enough that a wrong call in
the composition pattern (see the `Notice`+action island question in Behavior) gets baked into five
places before anyone reviews it working in one. Also forces the `Section`/`Card` extraction decision
immediately, before two real regions exist to compare — the exact premature-abstraction risk Increment
2's own scoping rule was written to avoid.

**B — Migrate `/settings` only (recommended).** Matches the explicit, already-recorded recommendation
in Increment 2 and costs the least: the smallest of the five files, one destructive action, no AI or
scheduling logic to reason about alongside the visual change, and — per the current-state findings
above — a load-bearing, real-world test of both new primitives at once (`PageHeader` for the heading,
`Notice` for both the error and the warning-with-action states) before any other screen commits to the
same pattern.

**C — Migrate `/dashboard` first instead (rejected).** `/dashboard` was Strategy B's own increment
(shipped earlier, per the commit history) and per Phase 3's analysis already carries more surface area
(orientation data, due-card counts, draft counts) and more open questions (icon language, empty-state
placement across three data points) than `/settings`'s one screen with one danger zone. Larger diff,
more decisions bundled into a first proof point, and not the increment Increment 2 named — rejected on
both risk and evidence grounds.

**Decisive trade-off:** B is the smallest true end-to-end migration available, proves both new
primitives together in production, and leaves `Section`/`Card` correctly undecided for one more
increment. A and C both cost more for no corresponding reduction in risk.

---

## 📝 Handoff

**Intent.** Rebuild `/settings`'s own markup — its heading, the danger-zone region, the isReadOnly
warning, and the delete-account error state — using `PageHeader` and `Notice`, Paper tokens throughout,
and the page-level `bg-background` full-bleed technique already proven by `Topbar`/`Banner`. Delete the
now-redundant inline "← Dashboard" link.

**Non-goals.** No other page changes. `CancelDeletionButton.tsx`'s own file is untouched. No new
`Section`/`Card` primitive. No change to account-deletion, cancel-deletion, or redirect behavior. No
dark mode. No `bg-cosmic` utility or `Layout.astro` change.

**Actor and trigger.** Any signed-in user who opens `/settings` from the shell nav, whether to check
their account state, cancel a pending deletion, or delete their account.

### 📋 Behavior

1. `settings.astro`'s outer wrapper changes from `<div class="bg-cosmic min-h-screen p-4">` to
   `<div class="bg-background text-foreground min-h-screen p-4">`. This is the only place `bg-cosmic`
   is removed; `Layout.astro`'s `<body class="bg-cosmic">` is untouched, and stays fully hidden beneath
   this opaque wrapper for the whole page.
2. The `<header>` block (gradient `<h1>` + `← Dashboard` link) is replaced with a single
   `<PageHeader title="Settings" />` — no `description`, matching the bare state in Increment 2's own
   contract. **No `client:*` directive**: `PageHeader` has no interactivity, so Astro renders it to
   static HTML with zero hydration cost, the same reasoning Increment 2 applied to `Notice`.
3. The "signed in as" line keeps its copy, restyled: `<p class="text-muted-foreground text-sm">Signed
   in as <span class="text-foreground font-semibold">{user?.email}</span></p>`.
4. The danger-zone box loses its border/background/blur box treatment and becomes a hairline-separated
   region: `<div class="border-border space-y-3 border-t pt-6">`, heading
   `<h2 class="text-title text-destructive font-semibold">Danger zone</h2>`, and the existing body copy
   restyled to `<p class="text-muted-foreground text-sm mt-1">` with **no change to the sentence
   itself** — only Increment 3's shell already told the user how to leave; this increment does not
   invent new copy.
5. Inside that region, the existing `isReadOnly` branch renders a new component,
   `<RetentionNotice client:load formatted={formatted} />` (see contract below), instead of the
   hand-rolled amber box. The non-`isReadOnly` branch is unchanged: `<DeleteAccountButton client:load />`.
6. `DeleteAccountButton.tsx`'s error `<p>` is replaced with `<Notice variant="error">{error.message}</Notice>`,
   imported from `@/components/ui/Notice`. No other change to the component — the `Button`, the
   `window.confirm()` step, and the fetch/error-parsing logic are untouched.

**New file — `src/components/settings/RetentionNotice.tsx`.** Composes `Notice` and
`CancelDeletionButton` in one React tree so the whole thing hydrates as a single island from
`settings.astro`, avoiding any ambiguity about passing a second framework component as a prop value
across the Astro/React boundary (see Assumptions):

```tsx
import { Notice } from "@/components/ui/Notice";
import CancelDeletionButton from "@/components/settings/CancelDeletionButton";

interface RetentionNoticeProps {
  formatted: string;
}

export default function RetentionNotice({ formatted }: RetentionNoticeProps) {
  return (
    <Notice
      variant="warning"
      action={
        <CancelDeletionButton
          className="border-warning text-warning hover:bg-warning-surface rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        />
      }
    >
      Your account is scheduled for deletion on <strong>{formatted}</strong>. Until then it&apos;s
      read-only.
    </Notice>
  );
}
```

This is the exact copy the current amber box already shows — unchanged — and the exact `action` usage
Increment 2's own `Notice` contract named as its motivating example (*"e.g. Retry or Cancel
deletion"*). `rounded-md` is deliberate, not an oversight: this file lives outside
`src/components/ui/`, so it may not use `rounded-paper` (criterion 5), and keeps reading the legacy
`--radius` scale like every other non-primitive file, the same call Increment 3 made for `Topbar.astro`.

### 📋 States

| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| Settings, resting | page load, not read-only | "Settings" heading, "Signed in as {email}", Danger zone with copy and a `Delete account` button | Read, delete account |
| Settings, read-only | `isReadOnly` true | Same, plus a warning-tinted `Notice`: "Your account is scheduled for deletion on {date}. Until then it's read-only." with a `Cancel deletion` control inside it | Cancel the deletion |
| Delete in progress | `Delete account` clicked, confirmed | Button shows a spinner, is disabled | Wait; no other action available |
| Delete failed | request fails | An error-tinted `Notice` appears above the button: `role="alert"`, `aria-live="assertive"`, the server's message or a fallback ("Could not request account deletion. Please try again.", etc.) | Retry by clicking `Delete account` again |
| Delete succeeded | request succeeds | Browser navigates to `/dashboard`, which now renders read-only with the sitewide retention banner | — (this increment does not touch `/dashboard`) |
| Cancel in progress | `Cancel deletion` clicked | Button shows a spinner, is disabled | Wait |
| Cancel failed | request fails | `CancelDeletionButton`'s own inline error text appears next to it (unchanged component, not migrated here) | Retry |
| Cancel succeeded | request succeeds | Page reloads; `isReadOnly` is now false, the warning `Notice` is gone | Resume normal use |

### ♿ Accessibility contract

- Exactly one `<h1>` on the page, rendered by `PageHeader` — matches Increment 2's contract for it.
- The danger-zone heading is a real `<h2>`, matching `EmptyState`'s established pattern of a heading
  element rather than a styled `<p>`.
- The isReadOnly warning and the delete-error state both carry `Notice`'s existing role/`aria-live`
  mapping (`status`/`polite` for warning, `alert`/`assertive` for error) — inherited for free by using
  the component, not re-specified here.
- `Cancel deletion` inside the warning `Notice` and `Delete account` both remain real `<button>`
  elements with the `Button`/focus-ring contract already shipped in Increment 2 —
  `focus-visible:ring-ring`, 3px, no alpha. `DeleteAccountButton` already uses `<Button
  variant="destructive">`, unchanged; `CancelDeletionButton`'s hand-rolled `<button>` already carries
  no competing focus style, so this increment's new `className` for it does not need to add one.
- The removed "← Dashboard" link is not a net accessibility loss: the shell's `Dashboard` nav item
  (Increment 3) is reachable from `/settings` by the same keyboard path (`Tab` from the page into the
  shell, or the shell's own tab order before the page content on desktop) and already carries
  `aria-current` semantics the inline link never had.

### 📋 Route / blast-radius map

| File | Change |
|---|---|
| `src/pages/settings.astro` | Header replaced with `PageHeader`; back link removed; danger-zone box restyled to hairline; isReadOnly branch replaced with `RetentionNotice`; outer wrapper `bg-cosmic` → `bg-background text-foreground` |
| `src/components/settings/DeleteAccountButton.tsx` | Error `<p>` replaced with `<Notice variant="error">`; nothing else changes |
| `src/components/settings/RetentionNotice.tsx` | **New file.** Composes `Notice` + `CancelDeletionButton` for the isReadOnly case |
| `src/components/settings/CancelDeletionButton.tsx` | **Untouched.** Its default className (used by `RetentionBanner`) and its own internal error span are out of this increment's blast radius |
| `src/components/RetentionBanner.astro`, `src/components/Banner.astro`, `src/layouts/Layout.astro`, `src/components/Topbar.astro` | **Untouched** |
| `src/pages/{dashboard,generate,library,review}.astro`, auth pages | **Untouched** |
| `src/components/ui/primitives.test.ts` | Criterion 5's asserted `rounded-(md|lg|xl)` count updated from 63 to the re-measured total (expected 61 — verify, do not assume) |
| `src/styles/global.css` | **No change.** All tokens this increment uses already exist |

No other file changes.

### 📋 Assumptions to confirm

1. **A single React island (`RetentionNotice.tsx`) composing `Notice` and `CancelDeletionButton`
   renders and hydrates correctly when included from `settings.astro` as `<RetentionNotice client:load
   formatted={formatted} />`.** `[ASSUMPTION]` — this sidesteps, rather than tests, the open question of
   whether Astro reliably passes one React component as a prop (e.g. `action={<CancelDeletionButton />}`)
   into another React component's island boundary declared separately in `.astro` template syntax; by
   composing both inside one `.tsx` file and hydrating that file as a single unit, the composition
   happens in plain React, which is unambiguous. Confirm this still type-checks and renders under
   `astro check` before relying on the pattern for a future screen.
2. **A `bg-background` full-bleed wrapper on `settings.astro`'s own `<div>` fully hides `<body>`'s
   `bg-cosmic` underneath it, with no visible seam or flash.** `[ASSUMPTION]` — consistent with how
   `Topbar`/`Banner` already sit as opaque islands on the cosmic page, but this is the first time the
   technique covers the *entire* remaining viewport rather than a band; confirm with a real-browser
   check, including a fast reload, that no cosmic gradient is visible at any scroll position.
3. **`min-h-screen` on the wrapper (carried over unchanged from the current `bg-cosmic` version)
   remains sufficient to cover the viewport below the shell on short-content viewports.** `[ASSUMPTION]`
   — not re-derived; the current page already relies on this and nothing here changes viewport math.
4. **The re-measured `rounded-(md|lg|xl)` count after this change is 61.** `[ASSUMPTION]` — reasoned
   from the specific edits above (two `rounded-lg` boxes removed via `Notice`, one `rounded-md` control
   relocated with no count change), but not yet executed; the implementer must run the grep and use the
   real number, updating `primitives.test.ts` to match rather than to the number in this document.

### ✅ Acceptance criteria

1. **Given** `/settings`, **when** the page loads, **then** exactly one `<h1>` exists, reading
   "Settings", rendered by `PageHeader`.
2. **Given** `/settings`'s rendered DOM, **when** searched for an anchor with the text "Dashboard" or
   "← Dashboard" outside the shell's own `<nav>`, **then** none exists — the shell's `Dashboard` nav
   item is the only path back.
3. **Given** a signed-in user with `isReadOnly` true, **when** `/settings` loads, **then** the warning
   message renders inside an element with `role="status"` and `aria-live="polite"`, and a `Cancel
   deletion` button is reachable inside it.
4. **Given** the `Delete account` flow, **when** the `POST /api/account/delete` request fails, **then**
   an element with `role="alert"` and `aria-live="assertive"` renders containing the server's message
   or the existing fallback text, and the `Delete account` button remains clickable to retry.
5. **Given** `src/pages/settings.astro`, `src/components/settings/DeleteAccountButton.tsx`, and
   `src/components/settings/RetentionNotice.tsx`, **when** their source is read, **then** none contains
   a hex, `rgb()`, `oklch()`, or Tailwind-palette-scale colour literal, `shadow-*`, `backdrop-blur-*`,
   `bg-gradient-*`, or `bg-cosmic` — except the single, deliberate `bg-background` (not `bg-cosmic`) on
   `settings.astro`'s outer wrapper.
6. **Given** `src/components/settings/CancelDeletionButton.tsx`, **when** diffed against `main`,
   **then** it is byte-for-byte unchanged.
7. **Given** `grep -rnoE 'rounded-(md|lg|xl)\b' src/ | wc -l`, **when** run after this change, **then**
   the result matches the number asserted in `primitives.test.ts` criterion 5 (expected 61; the test is
   updated to whatever the true measured count is, not forced to 61).
8. **Given** `src/pages/dashboard.astro`, `src/pages/generate.astro`, `src/pages/library.astro`,
   `src/pages/review.astro`, and every auth page, **when** diffed against `main`, **then** none shows
   any change.
9. **Given** the running app with an account **not** pending deletion, **when** `Delete account` is
   clicked and confirmed via the native dialog, and the request succeeds, **then** the browser navigates
   to `/dashboard`, unchanged from today's behavior.
10. **Given** the running app with an account pending deletion, **when** `Cancel deletion` is clicked
    and the request succeeds, **then** the page reloads and the warning `Notice` no longer renders,
    unchanged from today's behavior.
11. **Given** `npm run typecheck`, `npm run lint`, `npm run build`, and `npm test`, **when** each runs,
    **then** each passes.

---

## Implementation Plan

Restates the Behavior, Route/blast-radius map, and Acceptance criteria above as Phases and Steps for
the implementing engine — no new decisions, no scope beyond what those sections already specify.

### Phase 1: Page shell — background, heading, danger-zone region

- 1.1 In `src/pages/settings.astro`, replace the outer wrapper's `bg-cosmic` with
      `bg-background text-foreground` (Behavior 1).
- 1.2 Replace the gradient `<h1>` + `← Dashboard` link with `<PageHeader title="Settings" />`, no
      `client:*` directive (Behavior 2; Open decisions — back link deleted, not moved).
- 1.3 Restyle the "Signed in as" line to `text-muted-foreground`/`text-foreground` token classes,
      copy unchanged (Behavior 3).
- 1.4 Restyle the danger-zone box to a hairline-separated region (`border-border border-t pt-6`,
      `text-title text-destructive` heading, `text-muted-foreground` body copy), copy unchanged
      (Behavior 4).

### Phase 2: Notice adoption — error and retention states

- 2.1 In `src/components/settings/DeleteAccountButton.tsx`, import `Notice` from
      `@/components/ui/Notice` and replace the hand-rolled error `<p>` with
      `<Notice variant="error">{error.message}</Notice>` (Behavior 6).
- 2.2 Create `src/components/settings/RetentionNotice.tsx` per the contract given in Behavior —
      composes `Notice` (`variant="warning"`) and `CancelDeletionButton` (with the Paper-token
      `className` shown there) in one React tree, copy unchanged.
- 2.3 In `src/pages/settings.astro`, replace the hand-rolled isReadOnly amber box with
      `<RetentionNotice client:load formatted={formatted} />` (Behavior 5); leave the
      non-`isReadOnly` branch (`<DeleteAccountButton client:load />`) unchanged.
- 2.4 Confirm `src/components/settings/CancelDeletionButton.tsx` is untouched (Route/blast-radius
      map) and file the standalone follow-up for its `text-red-700` literal (Open decisions —
      Settled) as a tracker issue, `bug` / `priority-low`.

### Phase 3: Test parity and validation gate

- 3.1 Run `grep -rnoE 'rounded-(md|lg|xl)\b' src/ | wc -l` and update
      `src/components/ui/primitives.test.ts` criterion 5's asserted count to the real measured
      number (Assumptions to confirm #4 — expected 61, verify rather than assume).
- 3.2 Run the full validation gate (`npm run typecheck`, `npm run lint`, `npm run build`, `npm test`)
      and fix forward until green (Acceptance criterion 11).
- 3.3 Manually verify (or `om-auto-qa-pr`) that no `bg-cosmic` gradient is visible on `/settings` in
      either state (default and `isReadOnly`), at desktop and 390px viewports (Validation section
      above).

---

## 🧪 Validation

**Riskiest belief:** that the page-level `bg-background` full-bleed technique — one wrapper `<div>`
opaquing the entire remaining viewport over `<body>`'s still-present `bg-cosmic` — renders as a clean,
seamless Paper page in the actual browser, with the shell bar (`Topbar`, already Paper-styled) sitting
directly above it with no visible colour seam or gap.

**Smallest test that could change the decision:** load `/settings` in a real browser at both a signed-in
state (default) and an `isReadOnly` state (retention banner also visible), at both desktop and a 390px
mobile viewport, and visually confirm no cosmic gradient is visible anywhere on the page, including
during scroll and at the exact boundary between `Topbar`/`RetentionBanner` and the page content. This is
a manual/`om-auto-qa-pr` check, not a source-level test — nothing else in the repo can assert "no dark
gradient is visible," only that `bg-cosmic` is absent from the relevant source files (criterion 5 above).

**What each result means:** if a seam or flash is visible, the wrapper needs an explicit height
guarantee beyond `min-h-screen` (e.g. accounting for the shell's height with `calc()`) before this
pattern is reused on the next four screens — that would be this increment's one finding worth
re-opening. If it renders cleanly, the technique is validated once for all remaining screen-migration
increments to reuse without re-deriving it.

---

## ⚠️ Open decisions

*(none — the one item this increment was recorded as owning is resolved below)*

### Settled, recorded so they are not reopened

- **The inline "← Dashboard" back link is deleted, not moved into `PageHeader`.** Settled here,
  resolving the open decision Increment 3 recorded with this increment as its owner. Reasoning: the
  shell's `Dashboard` nav item, shipped in Increment 3, is present and `aria-current`-marked on every
  protected route including this one, so the inline link duplicates a control that already exists one
  level up. `PageHeader`'s contract (Increment 2) deliberately excludes navigation by design — this
  decision keeps that boundary rather than growing `PageHeader` a back-link prop no other consumer
  needs.
- **`Section`/`Card` are not introduced in this increment.** Settled here: Increment 2's return
  condition is two migrated screens; this is the first. The danger-zone region is hand-styled inline,
  once, exactly as Increment 2 anticipated for the first migration.
- **`CancelDeletionButton.tsx`'s own file is not edited.** Settled here: its default styling (used by
  the sitewide `RetentionBanner`) is untouched, and its internal error-span token issue is filed as a
  follow-up rather than folded into a settings-only increment, the same boundary Increment 2 drew
  around `auth/FormField.tsx`. **Action:** file it as a standalone finding (`bug`, `priority-low`) —
  `text-red-700` in `CancelDeletionButton.tsx` line 45 is a raw Tailwind-palette literal, a principle-2
  violation, visible today on the sitewide retention banner whenever a cancel-deletion request fails.

---

## 📋 Applied

AI necessity gate: not applicable — no AI behaviour in scope. Human-AI checklist: not applicable, same
reason. Value metrics: outcome, behavioral signal, business effect, and guardrail stated above per
`human-value-metrics.md`'s ordering; this increment ships user-facing behaviour. Design contract:
loaded (`.uxproof/contract.json`, `conventions.md` including the manual section and its eight
principles); the registry still covers roughly half of the UI files per its own caveat, so every file
this increment touches (`settings.astro`, `DeleteAccountButton.tsx`, `CancelDeletionButton.tsx`,
`RetentionBanner.astro`) was read directly rather than assumed from the registry. Evidence tiers:
findings above are tagged `[ASSUMPTION]` where unverified; every count and line reference is measured
directly against the repository at `HEAD` (`edb9a22`) today, not carried over from an earlier document.
Quality rubric: passed — diagnosis names the specific gap (gradient heading, box treatment, silent
errors, a redundant back link) rather than restating "migrate the screen"; scope completes one real job
end to end (every state of the danger zone, not just the happy path); the riskiest belief (the
full-bleed background technique at page scale) has a decision-changing test; screens, components, and
copy are named concretely throughout, including the full source of the one new file this increment
adds.
