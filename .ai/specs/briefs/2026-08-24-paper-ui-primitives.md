# Increment 2 — Paper UI primitives

**Status:** handoff, ready to plan
**Written:** 2026-08-24 · `om-ux-shape` (Handoff mode)
**Follows:** Increment 1, the semantic token layer, merged as `a233cc9` (PR #32)
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Strategy C order:** tokens → **primitives** → shell / mobile navigation → screen migration → remove `bg-cosmic`

---

## 📝 Handoff

**Intent.** Build the three page primitives whose shape is already proven by duplication in this
repository — `Notice`, `EmptyState`, `PageHeader` — in Paper's visual language, each with an
accessibility contract, and give them one safe production consumer. Correct the focus indicator on
`Button`, and introduce Paper's geometry through a new token that legacy markup does not read.

**Non-goals.** No screen is migrated. No component under `src/components/{auth,generate,library,review,settings}/`
changes its layout. `bg-cosmic` stays, on all ten files that apply it. No shell, no mobile
navigation, no dashboard product changes. No `Card`, no `Field` — see the deferrals. No design-system
framework, no Storybook, no variant taxonomy beyond what the named consumers need.

**Actor and trigger.** The developer implementing Strategy C's second step. There is no user-facing
trigger: the only thing a user can observe after this increment is a slightly different focus ring
and a retention banner in Paper colours instead of hardcoded ones.

---

## 🎯 The decision this increment turns on

Increment 1 shipped a token layer that **nothing consumes**. Measured today on `main` at `a233cc9`,
across all of `src/`:

| Token shipped by Increment 1                    | Consumers |
| ----------------------------------------------- | --------- |
| `--font-serif`                                  | 0         |
| `--text-display`, `--text-title`, `--text-meta` | 0         |
| `--container-content`                           | 0         |
| `--shadow-raised`                               | 0         |
| `--surface-draft`, `--surface-draft-border`     | 0         |

That inertness was correct for Increment 1 and is dangerous for Increment 2. A primitive with no
consumer cannot be validated, and building five of them would be exactly the "abstraction built only
for future use" this increment is told not to produce. But a Paper primitive genuinely **cannot** be
dropped into a cosmic screen: it resolves to the light palette and would render light-on-light.

So the increment is scoped by one rule:

> **Build the primitives whose contract is already proven by existing duplication. Defer the ones
> whose contract we would have to invent.**

That rule, not a taste judgment, is what separates the three included primitives from the two
deferred ones.

---

## 📋 Recommended scope

### Build now

| Primitive        | Why its contract is already known                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`Notice`**     | `Banner.astro` already implements the exact variant set and the correct roles; five React error paths repeat an inline version of it without them. |
| **`EmptyState`** | `DoneCard` in `ReviewSession.tsx` is this component, already written and proven by three different uses.                                           |
| **`PageHeader`** | Four pages repeat a byte-identical heading-and-back-link recipe; a fifth varies only in size.                                                      |

### Also in scope

- **`Banner.astro` adopts the semantic surface tokens** — the one production adoption that is safe
  today, and the first consumer of `--info-surface` / `--warning-surface` / `--destructive-surface`.
- **The `Button` focus correction** — two class changes, no API change.
- **`--radius-paper`** — Paper geometry for new primitives, invisible to the 58 legacy consumers.

### Deferred

`Card` and `Field`, with reasons and return conditions in **Explicit deferrals** below.

---

## 📸 Evidence and consumers, per included primitive

Every count below was measured on `main` at `a233cc9` on 2026-08-24, over `src/` only.

### `Notice`

**The accessibility defect is the strongest single reason to do this increment.** `[STANDARD]`
WCAG 2.2 §4.1.3 Status Messages.

There is **exactly one `role=` attribute in the entire user interface** — `Banner.astro:11` — and
**zero `aria-live` attributes anywhere**. Every other status message in the app appears silently to a
screen-reader user: it is a `<p>` that materialises in the DOM with colour and an icon and announces
nothing.

Current consumers, all of which today hand-roll a coloured box with no live-region semantics:

| File                                     | What it shows                            |
| ---------------------------------------- | ---------------------------------------- |
| `auth/ServerError.tsx`                   | sign-in / sign-up server errors          |
| `generate/PasteAndGenerateForm.tsx`      | generation failures                      |
| `generate/DraftReviewList.tsx`           | save / discard failures                  |
| `library/CreateCardForm.tsx`             | create-card validation and server errors |
| `library/CardRow.tsx`                    | inline edit and delete errors            |
| `settings/DeleteAccountButton.tsx`       | deletion errors                          |
| `review/ReviewSession.tsx`               | rating submission errors                 |
| `Banner.astro` → `RetentionBanner.astro` | the account-pending-deletion strip       |

**`Banner.astro` is also the only place in `src/` where colours are written as raw hex** — nine of
them, in a `<style>` block: `#dbeafe`/`#1e3a8a`/`#3b82f6` (info), `#fef3c7`/`#78350f`/`#f59e0b`
(warning), `#fee2e2`/`#7f1d1d`/`#dc2626` (error). That is a direct violation of principle 2, "every
colour comes from a role token" `[PRODUCT]`.

**Why Banner can adopt Paper today without migrating a screen.** Banner already renders as a _light_
strip on the cosmic page — light background, dark text. Swapping its nine hex values for
`--info-surface`/`--info`, `--warning-surface`/`--warning`, `--destructive-surface`/`--destructive`
is a like-for-like exchange: same polarity, same layout, comparable hues (`#dbeafe` → `#e5f2ff`,
`#fef3c7` → `#fbefd6`, `#fee2e2` → the red-050 tint). No screen changes shape, and Increment 1's
surface tokens get their first real consumer.

### `EmptyState`

`ReviewSession.tsx:29–60` already contains this component under the name `DoneCard`, with the API
`{ icon, title, body, onRestart? }`, and it is used three times in that one file:

| Line   | Use                                  | Note                                             |
| ------ | ------------------------------------ | ------------------------------------------------ |
| `:171` | "Could not load your review session" | an **error** state, not an empty one             |
| `:181` | "All caught up!"                     | the genuine empty state                          |
| `:191` | "Session complete"                   | a success state, with a `Restart session` action |

Three uses, three different meanings, one shape — that is a proven contract, not a guessed one. The
same shape is hand-rolled again as plain prose in `library.astro:153` ("You have no saved cards yet.
Create your first card above.") and twice in `dashboard.astro:217` and `:235`.

**Directly upcoming consumers:** `/library` empty and no-search-results, `/generate` before a
generation, and the three `ReviewSession` states above — all in the screen-migration increment.

### `PageHeader`

Four pages — `generate.astro:39`, `library.astro:89`, `review.astro:36`, `settings.astro:15` — carry
a byte-identical heading recipe:

```
<h1 class="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-3xl font-bold text-transparent">
```

followed by a byte-identical back link:

```
<a href="/dashboard" class="text-sm text-blue-100/70 transition-colors hover:text-white">← Dashboard</a>
```

`dashboard.astro:120` and `auth/confirm-email.astro:27` are the same recipe at a different size.

Two things make this worth extracting now rather than later. The gradient heading is **banned
product-wide** by principle 3 `[PRODUCT]`, so every one of these five has to change anyway; and
`PageHeader` is the first and only planned consumer of `--text-display` and `--container-content`,
which currently have zero.

**The back link is deliberately not part of it** — see the contract below.

---

## 📋 Minimal component contracts

Written to serve the named consumers and nothing else. Anything a current or directly-upcoming
consumer does not need is absent on purpose.

### `Notice` — `src/components/ui/Notice.tsx`

```tsx
type NoticeVariant = "info" | "warning" | "error" | "success";

interface NoticeProps {
  variant?: NoticeVariant; // default "info"
  title?: string; // optional bold lead-in
  children: React.ReactNode; // the message
  action?: React.ReactNode; // one control, e.g. Retry or Cancel deletion
}
```

**Rendering.** A hairline-bordered block with the variant's surface tint: background
`--{variant}-surface`, border and icon `--{variant}`, text `--foreground`. Radius `--radius-paper`.
No shadow — principle 4 `[PRODUCT]`. A lucide icon per variant (`Info`, `TriangleAlert`,
`CircleAlert`, `CircleCheck`).

**Accessibility contract, non-negotiable:**

- `role="alert"` when `variant` is `"error"`, otherwise `role="status"`. `[STANDARD]` WCAG 2.2 §4.1.3.
- `aria-live="assertive"` for `error`, `"polite"` for the rest.
- The icon is `aria-hidden`; the variant is carried by a **word** in the message, never by colour
  alone — principle 6 `[PRODUCT]`, and `[STANDARD]` WCAG 1.4.1.
- Text on tint meets 4.5:1. Increment 1's tests already assert this for all four pairs, so no new
  contrast maths is needed — only that `Notice` uses the pairs the tests cover.

**Not in scope:** dismissal, auto-timeout, stacking, a toast queue, portals, animation. No consumer
needs any of them.

**`Banner.astro` stays Astro** — it is server-rendered on every protected page and turning it into a
React island would cost a hydration boundary for a static strip. It keeps its own full-bleed layout
and its existing `role` logic; only its nine hex values change to the same tokens `Notice` uses. The
two are related by shared tokens, not by shared code.

### `EmptyState` — `src/components/ui/EmptyState.tsx`

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode; // optional lucide icon
  title: string;
  body: string;
  action?: React.ReactNode; // at most one control
}
```

Lifted from `DoneCard` unchanged in shape. Centred, generous vertical space, `--muted-foreground`
for the body, `--text-title` for the title, hairline separation only — no box, no shadow.

**Accessibility contract:** the title renders as `<h2>`; the icon is `aria-hidden`; the block is not
a live region, because an empty state is the page's content rather than a status change.

**Not in scope:** multiple actions, illustrations, per-variant styling. `DoneCard`'s three uses need
one optional action between them.

### `PageHeader` — `src/components/ui/PageHeader.tsx`

```tsx
interface PageHeaderProps {
  title: string;
  description?: string;
}
```

`<h1>` at `--text-display` in `--font-sans`, optional description at `--text-body` in
`--muted-foreground`, constrained to `--container-content`, separated from the content below by
whitespace and nothing else.

**Deliberately excluded: the back link, and any navigation at all.** `← Dashboard` is shell, and the
shell is Increment 3 `[PRODUCT]`. Putting it into `PageHeader` now would decide the navigation model
before the increment that owns it — the exact failure the guardrail names. The four pages keep their
existing back links inline until the shell increment takes them.

**Accessibility contract:** exactly one `<h1>` per page, and `PageHeader` is it. No `tabindex`, no
skip-link — those belong to the shell.

---

## ⛔ Explicit deferrals

### `Card` — deferred to the screen-migration increment

There are 13 occurrences of the glass-card recipe across 10 files, so the _duplication_ is real. The
**contract** is not, for two reasons.

1. **The name is overloaded in this product.** A "card" is the domain object — a flashcard with a
   front and a back, which is what `library/CardRow.tsx`, `generate/DraftReviewList.tsx` and
   `review/ReviewSession.tsx` render. It is also the layout container that the auth screens, the
   dashboard and the settings danger zone use. Those are two different components, and today's markup
   cannot tell us which one `Card` should be.
2. **In Paper a card is deliberately not a box.** `--card` is assigned the same value as
   `--background` on purpose — the direction says a card is "a block of text separated by a hairline
   and space" `[PRODUCT]`, and elevation exists only on `--popover`. A component named `Card` built
   before the screens exist will be built as a box, every migration will reach for it, and the
   direction is lost by default. This is the guardrail's concern and it is well founded.

**Return condition:** after the first two screens are migrated, when their real regions are visible.
`[ASSUMPTION]` — when it returns it is more likely to be `Section` (a titled region separated by a
hairline) than `Card`, with `Card` reserved for the flashcard itself. Principle 8 already lists both
names separately, which supports the split.

### `Field` — deferred to the screen-migration increment

An abstraction already exists — `auth/FormField.tsx`, used five times across `SignInForm` and
`SignUpForm` — and the consumers outside auth cannot use it:

| Family  | Shape                                              | Files                                                        |
| ------- | -------------------------------------------------- | ------------------------------------------------------------ |
| auth    | `<input>`, **icon required**, password toggle slot | `SignInForm` ×2, `SignUpForm` ×3                             |
| content | `<textarea>`, no icon, no toggle                   | `CardRow` ×2, `CreateCardForm` ×2, `PasteAndGenerateForm` ×1 |

Reconciling those two into one component today means inventing a control taxonomy for forms nobody
has designed — a form framework, which the guardrail rules out. Note also that Strategy C's own
smallest-scope definition in `.ai/analysis/2026-08-21-ui-ux-redesign-strategy-phase3.md:85` names
page header, section/card, message and empty state — **and not a field** `[PRODUCT]`.

#### Follow-up finding, deliberately **not** fixed in Increment 2

`auth/FormField.tsx` renders its error as a loose `<p>` with no `aria-invalid` on the input and no
`aria-describedby` linking the two, so the error is invisible to assistive technology —
`[STANDARD]` WCAG 2.2 §3.3.1 Error Identification. The fix is three attributes:

- `aria-invalid={Boolean(error)}` on the `<input>`,
- `aria-describedby={error ? \`${id}-error\` : undefined}`,
- `id={\`${id}-error\`}` on the error paragraph.

**Revised 2026-08-24: this is recorded as a follow-up, not scoped into Increment 2.** An earlier
draft folded it in on the grounds that it is small and correct. That reasoning does not survive the
atomic-scope rule. `Field` is deferred, so `FormField` is not a component this increment owns;
nothing Increment 2 changes touches it — the primitives are new files, `Banner.astro` is unrelated,
and the `Button` focus classes do not reach it — so there is **no direct dependency** that would
justify opening an unrelated component. Small and correct is not the same as in scope, and a fix
smuggled into an unrelated increment is harder to review and to revert than one filed on its own.

**Action:** file it as a standalone accessibility issue (`bug`, `priority-medium`) so it is fixed on
its own merits, on its own PR, and verified against the auth screens rather than against this
increment's acceptance criteria. It becomes part of the `Field` work if the migration increment
reaches those screens first.

---

## 📐 Radius decision

**Decision: introduce `--radius-paper: 0.375rem` as a transitional token. Leave `--radius` at
`0.625rem`. Do not touch any existing markup.**

The problem is exact, and re-measured today rather than carried over:

| Utility            | Occurrences in `src/` | Reads `--radius`?                  |
| ------------------ | --------------------- | ---------------------------------- |
| `rounded-lg`       | 49                    | yes, via `--radius-lg`             |
| `rounded-md`       | 5                     | yes, via `--radius-md`             |
| `rounded-xl`       | 4                     | yes, via `--radius-xl`             |
| **total affected** | **58**                |                                    |
| `rounded-2xl`      | 13                    | no — Tailwind default, not derived |
| `rounded-full`     | 5                     | no                                 |

Changing the global `--radius` restyles all 58 in one commit, across every screen, with no
corresponding layout work — the accidental migration this increment must not perform.

**How it works.** Add to the plain `@theme` block in `src/styles/global.css`, beside the other
theme-invariant scales:

```css
/* Transitional. Paper's geometry, consumed only by primitives in src/components/ui/.
 * Legacy markup keeps reading --radius (0.625rem) via rounded-sm/md/lg/xl, so introducing
 * this restyles nothing. REMOVAL CONDITION: when the last screen migrates, --radius becomes
 * 0.375rem and this token and every `rounded-paper` usage are deleted in the same commit. */
--radius-paper: 0.375rem;
```

Tailwind v4 generates `rounded-paper` from it. `Notice`, `EmptyState` and any bordered surface in
the new primitives use `rounded-paper`; nothing else may.

**Why a second token rather than the alternatives.** Hardcoding `rounded-[0.375rem]` in the
primitives violates principle 2's token rule `[PRODUCT]`. Flipping `--radius` and pinning the 58
legacy consumers to an explicit `rounded-[0.625rem]` inverts the debt onto legacy code and touches
58 lines to avoid touching one. A second token costs one declaration and one deletion later.

**Honest cost.** For the duration of the migration the codebase has two radii, and a reviewer must
know which is which. The comment above and the test below are what keep that from becoming folklore.

---

## ♿ Button focus decision

**Decision: yes, include it — exactly two class changes in `src/components/ui/button.tsx`, and
nothing else in that file.**

The current state, measured through a real browser during the Increment 1 QA pass and re-read from
the source today. The base variant string is:

```
outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
```

| Variant       | Focus indicator today                                                                                                             | Where it is reachable                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `default`     | a ring paints, but at 50 % alpha                                                                                                  | `SubmitButton` — `Sign in`, `Create account` |
| `destructive` | `focus-visible:ring-destructive/20` overrides the base ring; measured `oklab(0 0 0 / 0) 0 0 0 0` — transparent **and** zero-width | `CardRow` Delete, `DeleteAccountButton`      |
| `ghost`       | no ring layer measured                                                                                                            | `CardRow` Edit / Cancel ×3                   |

`outline-style` is `none` everywhere, so the base layer's `outline-ring/50` paints nothing and the
ring is the only indicator there is. Five keyboard-reachable controls — including both destructive
ones — therefore have **no visible focus indicator at all**. That is `[STANDARD]` WCAG 2.2 §2.4.7
Focus Visible, a Level A failure, not a refinement.

**The two changes:**

1. `focus-visible:ring-ring/50` → `focus-visible:ring-ring`. The alpha is the fault, not the token:
   `--ring` measures **7.13:1** against `--ink-05`, while `ring-ring/50` measures **2.38:1** on the
   same Paper background — under the 3:1 that `[STANDARD]` WCAG 2.2 §1.4.11 asks of a focus
   indicator, before any page even gets involved.
2. Delete `focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40` from the
   `destructive` variant, so it inherits the same visible ring as every other variant. A destructive
   control is the last one that should be invisible to a keyboard user.

**Why now and not in the migration increment.** `button.tsx` is a primitive and this is the
primitives increment — the Increment 1 brief deferred this fix _to here_ by name. It is two class
edits with no API change, and unlike the three new primitives it has five real consumers already, so
the change is observable on the running app the day it lands rather than waiting for a Paper screen.
Its contrast against a Paper background stays unmeasured until then; see the risks.

**Explicitly not in scope:** no new variants, no size changes, no `rounded-md` → `rounded-paper` on
`Button` (that is geometry migration, and `Button`'s radius is legacy geometry until its screens
move), no touching the dead `dark:` variants — `.uxproof/conventions.md` records those as a trap for
the dark-mode increment to inspect deliberately, and quietly editing them here would spend that
review.

**Expected visible change:** on the legacy cosmic screens the ring becomes a solid blue instead of a
half-transparent one. Ring-to-surface contrast over the sign-in card rises from the measured 1.34:1
toward roughly 2.7:1 `[ASSUMPTION]` — still under 3:1 on cosmic, because the cosmic surface is the
remaining problem and is removed in the final increment. On Paper it clears 7:1. This increment
improves a Level A failure without claiming to close it on legacy screens.

---

## 🖥️ How this increment is proved — and what stays unproved

**Decision (revised 2026-08-24): no proving route is built.** An earlier draft of this brief proposed
an unlisted `/dev/primitives` route. It is removed from scope: the app is `output: "server"` on
Cloudflare, so such a route ships to production, and shipping a route to production solely to
demonstrate components is infrastructure this increment should not introduce.

**There is no existing mechanism to reuse instead.** Checked on `main` at `a233cc9`:

| Candidate                            | Verdict                                                                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storybook or any component workbench | not present, and adding one is new infrastructure                                                                                                                                                    |
| Vitest component rendering           | `vitest.config.ts` sets `environment: "node"`; there is no jsdom or happy-dom and no `@testing-library/react`, and no `*.test.tsx` exists anywhere in the repo — enabling this is new infrastructure |
| Playwright (`tests/e2e/`)            | present and working, but it drives real routes; with no consumer screen there is nothing for it to visit                                                                                             |

So the honest position is: **visual and interaction proof for the three new primitives waits for
their first real consumers in the screen-migration increment.** This brief does not pretend
otherwise.

**What can still be proved now, with nothing new added.** Three of the five acceptance criteria that
matter are source facts, not browser facts, and `src/styles/tokens.test.ts` already demonstrates the
technique — it reads a shipped file as text in the node environment and asserts over it. The same
approach covers:

- the two radius facts (criteria 4 and 5),
- the "no colour literal, no shadow, no blur, no gradient in `src/components/ui/`" rule (criterion 11),
- the `role` / `aria-live` mapping in `Notice`, assertable by reading the component source.

**And one part of this increment _is_ verifiable in a real browser, because it has a real consumer.**
`Banner.astro` renders on every protected page whenever an account is pending deletion, so the
retention-banner change (criteria 3 and 8) can be walked by `om-auto-qa-pr` on the running app
exactly as Increment 1 was. That is the whole value of choosing an adoption that was safe today.

**What this leaves genuinely unverified until migration:** how the three primitives _look_ and
compose on a Paper page, and whether the corrected focus ring clears 3:1 on a Paper background
rather than the measured 7.13:1 of the token in isolation. Both are recorded as risks below rather
than quietly assumed away.

---

## 📋 States

The primitives themselves are stateless. These are the states each component must support; with no
proving route in scope, they are specified here as the component contract and are first observed
when a real screen adopts them.

| State                   | Trigger                 | What the user sees                                                                                                                       | What they can do                   |
| ----------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Notice, info            | `variant="info"`        | Blue-tinted hairline block, `Info` icon, message text                                                                                    | Read; activate the optional action |
| Notice, warning         | `variant="warning"`     | Amber-tinted block. Real copy in production: _"Your account is scheduled for deletion on 24 September 2026. Until then it's read-only."_ | Activate `Cancel deletion`         |
| Notice, error           | `variant="error"`       | Red-tinted block, announced assertively. Real copy: _"We couldn't save your card. Try again."_                                           | Retry, or correct the input        |
| Notice, success         | `variant="success"`     | Green-tinted block, announced politely                                                                                                   | Read                               |
| EmptyState, no action   | `title`/`body` only     | Centred `<h2>` and one sentence. Real copy: _"All caught up!"_ / _"You have no cards due for review right now. Come back later."_        | Leave the page                     |
| EmptyState, with action | `action` provided       | The same, plus one control. Real copy: _"Session complete"_ / _"You reviewed 3 cards. Nicely done."_ with `Restart session`              | Restart                            |
| PageHeader, bare        | `title` only            | One `<h1>`: _"Settings"_                                                                                                                 | —                                  |
| PageHeader, described   | `title` + `description` | The heading plus one muted sentence beneath                                                                                              | —                                  |
| Button focus            | `Tab`                   | A solid 3px ring on `default`, `destructive` and `ghost` alike                                                                           | Activate with Enter or Space       |

---

## 📋 Assumptions to confirm with engineering

1. **Tailwind v4 generates `rounded-paper` from `--radius-paper` in the plain `@theme` block.**
   `[ASSUMPTION]` — consistent with how `--radius-sm/md/lg/xl` behave in `@theme inline` today, but
   verify against `dist/` output before relying on it, the way Increment 1 verified `--shadow-raised`.
2. **`Notice` as a React island does not need `client:load` in Astro pages that render it
   statically.** `[ASSUMPTION]` — it has no interactivity unless an `action` is passed.
3. **`Banner.astro`'s `<style>` block can read the custom properties.** `[ASSUMPTION]` — it is a
   scoped Astro style, and `var(--info-surface)` should resolve from `:root`; confirm the scoping
   does not break inheritance.
4. **A `Notice` with no consumer still survives the build and the lint gate.** `[ASSUMPTION]` — an
   exported React component that nothing imports is valid, but confirm the repo's `eslint` config
   does not flag unused exports, and that `astro check` is content with a `.tsx` island no page
   renders. This is the practical cost of shipping primitives ahead of their consumers.

---

## ✅ Acceptance criteria

1. **Given** `src/components/ui/Notice.tsx`, **when** it renders with `variant="error"`, **then** the
   container carries `role="alert"` and `aria-live="assertive"`; for every other variant it carries
   `role="status"` and `aria-live="polite"`.
2. **Given** `src/components/Banner.astro`, **when** its `<style>` block is read, **then** it contains
   no hex, `rgb()` or `oklch()` literal, and every colour resolves through `--info*`, `--warning*` or
   `--destructive*`.
3. **Given** the running app with an account pending deletion, **when** any protected page is opened
   before and after this change, **then** the retention banner occupies the same position and the
   same height, is still a light strip on the cosmic page, and its text still measures at least
   4.5:1 against its own background.
4. **Given** `src/styles/global.css`, **when** its tokens are read, **then** `--radius` is still
   `0.625rem` and `--radius-paper` is `0.375rem`. A test asserts both, so flipping the global radius
   is a deliberate act rather than a side effect.
5. **Given** the repository, **when** `grep -rnoE 'rounded-(md|lg|xl)\b' src/` runs, **then** it
   returns the same 58 occurrences it returns today, and `grep -rn 'rounded-paper' src/` returns
   matches only under `src/components/ui/`.
6. **Given** `src/components/ui/button.tsx`, **when** its variant strings are read, **then** the base
   carries `focus-visible:ring-ring` with no alpha modifier, and the `destructive` variant declares
   no `focus-visible:ring-*` override of its own.
7. **Given** the running app, **when** `Tab` moves focus to the `Sign in` button on `/auth/signin`,
   to `Delete account` on `/settings`, and to `Edit` on a `/library` card row, **then** each shows a
   visible 3px ring. Contrast against the cosmic surface is recorded, not asserted — the 3:1 target
   `[STANDARD]` WCAG 2.2 §1.4.11 is only reachable once those screens are on Paper, and this
   increment improves the failure without closing it.
8. **Given** the six product routes `/dashboard`, `/generate`, `/library`, `/review`, `/settings`,
   `/auth/signin` before and after this increment, **then** each is **structurally and behaviourally
   unchanged**, and the only permitted differences are the focus-ring colour on the five
   `Button` consumers and the retention banner's tint. Specifically this increment MUST NOT change
   page polarity, remove or stop applying `bg-cosmic`, alter any layout, or change any interaction.
9. **Given** `src/components/ui/`, **when** its files are read, **then** none contains a hex,
   `rgb()`, `oklch()` or Tailwind palette literal, and none uses `shadow-*`, `backdrop-blur-*`,
   `bg-cosmic` or a gradient.
10. **Given** the repository, **when** `find src -name '*.astro' -path '*dev*'` and
    `ls src/pages/dev` run, **then** neither returns anything — no proving route was added.
11. **Given** `npm run typecheck`, `npm run lint`, `npm run build` and `npm test`, **when** each runs,
    **then** each passes.

---

## ⚠️ Risks and non-goals

**The primitives ship unproved, and one of them may be wrong.** This is the increment's real risk and
it is now unmitigated by design: with the proving route removed, nothing renders `Notice`,
`EmptyState` or `PageHeader` until the migration increment adopts them, so their appearance and
composition are unverified when this lands. Three things limit the damage rather than remove it —
each shape is copied from working code rather than invented, `Card` and `Field` (where inventing a
contract would cost most) are deferred, and the source-level checks above still hold the token and
accessibility rules. Accepted knowingly: the alternative was shipping a production route to
demonstrate components, which is a worse permanent cost than a temporary gap in evidence.

**The corrected focus ring is not measured on Paper.** The token measures 7.13:1 against `--ink-05`
in isolation, but no Paper screen exists to composite it against. Criterion 7 therefore records the
cosmic figure instead of asserting the 3:1 target. The migration increment must re-measure it on the
first Paper screen and treat a shortfall as its own finding.

**`--radius-paper` outlives its purpose.** It is explicitly temporary and the kind of temporary that
becomes permanent. Mitigation: the removal condition is written into the token's own comment and
belongs in the migration increment's first Progress row.

**Two radii and two focus behaviours during the migration.** The codebase will briefly be
inconsistent by design. Accepted: the alternative is a 58-element restyle in an increment that owns
none of those elements.

**`Notice` grows a dismissal API on first contact with a real screen.** `[ASSUMPTION]` Likely, and
acceptable — adding one prop when a consumer needs it is cheaper than designing a toast system now.

**Non-goals restated:** no screen migration — `/settings` included — no proving, demo or gallery
route, no shell or mobile navigation, no dashboard changes, no `bg-cosmic` removal or extension, no
dark-mode work, no `Card`, no `Field`, no edits to `auth/FormField.tsx`, no `Button` redesign beyond
the two focus classes, and no component library published or documented beyond these three files.

---

## ⚠️ Open decisions

1. **Does `Section` replace `Card` when the deferral returns?** Not needed now; recorded so the
   migration increment does not rediscover it. **Owner: next shaping round.**

### Settled, recorded so they are not reopened

- **A proving route is not built.** Settled 2026-08-24: a route shipped to production solely to
  demonstrate primitives is infrastructure this increment will not introduce, and no existing
  mechanism can be reused without adding some. Visual proof waits for real consumers.
- **`/settings` is not migrated here.** Settled 2026-08-24: the Strategy C boundary
  (tokens → primitives → shell / mobile navigation → screen migration → remove `bg-cosmic`) holds,
  and primitives do not reach into the screen step. **`/settings` is recorded as the strongest
  first candidate for the screen-migration increment** — 52 lines, no AI or scheduling logic, one
  destructive action, and an instance of nearly every primitive built here — and that increment
  should start there.
- **`auth/FormField.tsx` is not touched.** Settled 2026-08-24: its accessibility gap is real and is
  filed as a standalone follow-up, because no part of Increment 2 depends on that file.

---

## 📋 Applied

AI necessity gate: not applicable — no AI behaviour in scope. Human-AI checklist: not applicable for
the same reason. Value metrics: not applicable — this increment ships no user-facing behaviour and is
measured by the acceptance criteria above rather than by usage. Design contract: loaded
(`.uxproof/contract.json`, `conventions.md` including the manual section and its eight principles);
15 registered components, 0 archetypes, both recorded limitations respected. Evidence tiers: five
`[STANDARD]` (WCAG 2.2 §2.4.7, §1.4.11, §4.1.3, §3.3.1, WCAG 1.4.1), six `[PRODUCT]`, five
`[ASSUMPTION]`, all labelled in place. Counts: measured on `main` at `a233cc9` on 2026-08-24, not
carried over from earlier documents. Quality rubric: passed.

**Revision, 2026-08-24 — scope correction, not a re-shape.** Three changes on top of the first
draft, all narrowing: the `/dev/primitives` proving route is removed from scope and replaced with an
honest statement of what stays unproved; `/settings` is confirmed out of Increment 2 and recorded as
the migration increment's first candidate instead; and the `auth/FormField.tsx` accessibility fix is
reclassified from in-scope to a standalone follow-up, because no part of this increment depends on
that file. The recommendation, the evidence, the measurements, the component contracts, the radius
decision and the Button focus decision are unchanged.
