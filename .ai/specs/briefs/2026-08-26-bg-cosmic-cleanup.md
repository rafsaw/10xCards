# Increment 9 — global `bg-cosmic` cleanup

**Status:** handoff, ready to plan
**Written:** 2026-08-26 · `om-ux-shape` (Handoff mode)
**Follows:** Increment 8, `/dashboard`, merged as `708dcc8` (PR #41)
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Strategy C order:** tokens → primitives → shell / mobile navigation → screen migration → **remove `bg-cosmic`** (last step)

---

## 📝 Handoff

**Intent.** Migrate the last four unmigrated screens (`/`, `/auth/signin`, `/auth/signup`,
`/auth/confirm-email`) and the auth form family to Paper, then delete the `bg-cosmic` utility, its
`<body>` class and the last hardcoded colour from `src/` — in one commit, because the removal
condition recorded at `src/styles/global.css:317–323` forbids splitting them.

**Non-goals.** Dark mode. The `--radius` → `0.375rem` flip and the `rounded-paper` deletion.
Reconciling `auth/FormField.tsx` into `ui/Field.tsx`. Any change to auth logic, validation, routes,
API endpoints, or `Topbar.astro`.

**Actor and trigger.** The developer implementing Strategy C's ninth and final increment. The
user-facing trigger is a signed-out visitor opening `/` or following a sign-in link.

## 🎯 The one real decision in this increment

Everything here is mechanical retokenisation except `Welcome.astro`, which is not a styling problem —
it is the wrong product. It renders the heading **"10x Astro Starter"**, the sentence *"A
production-ready starter with authentication, modern tooling, and a cosmic developer experience"*,
and three feature cards about ESLint and Astro 5. It is 19 of the 45 remaining hardcoded colours, and
repainting it in Paper tokens would mean carefully restyling a page that advertises the wrong
product.

**Recommendation: delete `Welcome.astro` and replace it with a minimal sign-in gateway, not a
marketing page.** The decisive trade-off: a real 10xCards landing page needs positioning copy nobody
has written, and the PRD says the v1 audience is literally one person dogfooding `[PRODUCT]`
(`context/foundation/prd.md`, "User & Persona"). Writing marketing copy for an audience of one is
invented work; leaving a starter advertisement on the product's front door is worse. The gateway is
the smallest thing that completes the actual job — *an anonymous visitor gets into the app* — and it
costs nothing to replace later when there is something to say. Strategy C already recorded
"wycofanie starterowego landingu" (retire the starter landing) as in-scope `[PRODUCT]`
(`.ai/analysis/2026-08-21-ui-ux-redesign-strategy-phase3.md:85`).

## 📋 Behavior

**`/` (anonymous).** `index.astro` keeps its existing redirect to `/dashboard` for signed-in users.
For everyone else it renders, inside `Layout`, a centred column on `bg-background text-foreground`:

- `<PageHeader>` with title **10xCards** and description **Paste what you're reading. Keep the cards
  worth keeping.**
- Two controls in a row (column below 640px): **Sign in** as the one filled `<Button>` (principle 5 —
  one primary action per screen), and **Create account** as `variant="outline"`.
- Nothing else. No feature cards, no orbs, no star field, no `<svg>` decoration.

`Welcome.astro` is deleted. `Topbar` already renders its signed-out branch from `Layout`, so the
landing does not import it — this removes today's duplicate-Topbar path.

**The three auth screens.** Identical shell on all three, extracted to
`src/components/auth/AuthCard.astro` because three files repeating a card recipe inline is itself a
finding `[PRODUCT]` (principle 8). Its contract: an outer
`bg-background text-foreground flex min-h-screen items-center justify-center p-4` wrapper around an
inner `border-border bg-card rounded-paper w-full max-w-sm border p-8` card, with a `title` prop
rendered as an `h1` carrying `text-display text-foreground mb-6 font-sans font-bold`, and a default
slot. No `backdrop-blur`, no `rounded-2xl`, no gradient heading, no shadow — `--card` equals
`--background`, so the hairline and the whitespace do the separating (principle 4).

- **`/auth/signin`** — heading **Sign in**, `SignInForm`, then the footer line **Don't have an
  account?** with an underlined `text-link` **Sign up**.
- **`/auth/signup`** — heading **Sign up**, `SignUpForm`, footer **Already have an account?** with an
  underlined `text-link` **Sign in**.
- **`/auth/confirm-email`** — heading and body unchanged from today's `content` object; the emoji
  block (✅ / 📧) is replaced by the matching lucide icon (`CircleCheck` / `Mail`) at
  `text-muted-foreground size-8`, because an emoji is announced by name by screen readers and carries
  meaning here `[STANDARD]` (WCAG 1.1.1). The link keeps its current text and becomes an underlined
  `text-link`.

Links stay underlined so they are identifiable without colour `[STANDARD]` (WCAG 1.4.1).

**The auth form family, retokenised in place.** `ui/Field.tsx` documents that `auth/FormField.tsx` is
deliberately a separate family — input, leading icon, per-field error, password toggle `[PRODUCT]`.
Honour that; do not merge them.

| File | Today | After |
|---|---|---|
| `FormField.tsx` label | `text-blue-100/80` | `text-meta text-foreground` |
| `FormField.tsx` input | `bg-white/10` … `text-white placeholder-white/40` | `bg-background text-foreground placeholder:text-muted-foreground` |
| `FormField.tsx` icon | `text-white/40` | `text-muted-foreground` |
| `FormField.tsx` border/ring | `border-white/20 focus:ring-purple-400` / `border-red-400/60 focus:ring-red-400` | `border-input focus:border-ring` / `border-destructive focus:border-destructive` |
| `FormField.tsx` error text | `text-red-300` | `text-destructive` |
| `PasswordToggle.tsx` | `text-white/40 hover:text-white/70` | `text-muted-foreground hover:text-foreground` |
| `SubmitButton.tsx` | `bg-purple-600 text-white hover:bg-purple-500` | className drops all colour; `<Button>`'s default variant supplies it. Spinner border → `border-muted border-t-foreground` |
| `SignUpForm.tsx` hint | `text-blue-100/50` | `text-meta text-muted-foreground` |
| `ServerError.tsx` | `border-red-500/30 bg-red-900/30 text-red-300` | `<Notice variant="error">` from the registry |
| `button.tsx` destructive | `text-white` | `text-destructive-foreground` (token already exists) |
| `CancelDeletionButton.tsx:45` | `text-red-700` | `text-destructive` |

**The deletions, same commit.** `class="bg-cosmic"` off `Layout.astro`'s `<body>`; the `@utility
bg-cosmic` block and its 7-line removal-condition comment out of `global.css`;
`src/components/ui/LibBadge.astro` deleted outright — it has no consumer anywhere in `src/` or
`tests/`, and the prior increment listed "deleted or given a consumer" as the choice `[PRODUCT]`.
Deleting it is correct: inventing a consumer for a starter badge is worse than removing it.

`body` already carries `@apply bg-background text-foreground`, so removing the utility is what makes
the body correct rather than what breaks it. The `bg-background text-foreground min-h-screen`
wrappers on the five already-migrated pages stay — they become redundant, not wrong, and stripping
them risks layout change for no gain.

## 📋 States

| State | Trigger | What the user sees | What they can do |
|---|---|---|---|
| Landing, anonymous | `GET /` with no session | 10xCards, the one-line description, **Sign in** and **Create account** | Go to either auth screen |
| Landing, signed in | `GET /` with a session | Nothing — 302 to `/dashboard` (unchanged) | — |
| Field error | Client validation fails on submit | Red hairline on the input, `CircleAlert` plus the existing message (**Email is required**, **Passwords do not match**, …) below it, in `text-destructive` | Edit the field; the error clears on the next keystroke (unchanged) |
| Server error | `?error=` on the URL | A `Notice variant="error"` inside the card, above the submit button, carrying the server's message verbatim | Correct and resubmit |
| Submitting | `useFormStatus().pending` | Button disabled, spinner plus **Signing in…** / **Creating account…** (unchanged) | Wait |
| Confirmation | Reached `/auth/confirm-email` | Icon, **Registration successful** or **Check your email**, its description, and the underlined link | Return to sign in |

Every state above already exists today. This increment changes what they look like, not when they
appear — the only behavioural change in the whole increment is the landing page's content.

## 📋 Assumptions to confirm

- **The landing copy is a placeholder, not a decision.** *Paste what you're reading. Keep the cards
  worth keeping.* is derived from the PRD's problem statement, not from user research. Anyone with a
  better line should overwrite it without ceremony. `[ASSUMPTION]`
- **Nothing outside `src/` renders `bg-cosmic`.** Verified across `src/`; a Playwright spec or a
  screenshot fixture asserting the dark gradient would break. Grep `tests/` before deleting.
  `[ASSUMPTION]`
- **`text-destructive-foreground` on `button.tsx`'s destructive variant preserves contrast.** The
  token exists but the variant has never used it; check the ratio against `--destructive` before
  accepting `[STANDARD]` (WCAG 1.4.3).
- **Deleting `Welcome.astro` breaks no test.** `dashboard-paper.test.ts:93` asserts the file still
  contains `bg-cosmic`. That assertion, and the whole `AC3 — SURVIVORS` block it lives in, is
  designed to be deleted by this increment — it says so in its own test name.

## ✅ Acceptance criteria

1. **Given** the whole repository, **when** the increment lands, **then** a repository-wide search
   for `bg-cosmic` under `src/` returns nothing — not the utility, not the `<body>` class, not a test
   regex.
2. **Given** the whole repository, **then** the `.astro` and `.tsx` files under `src/` outside test
   files contain zero Tailwind palette-scale colour utilities and zero raw hex or `rgb()` literals.
   This is the recorded entry condition for the dark-mode increment `[PRODUCT]`, and this increment is
   what satisfies it — say so in the PR body.
3. **Given** `/`, `/auth/signin`, `/auth/signup` and `/auth/confirm-email`, **then** none contains
   `backdrop-blur`, `rounded-2xl`, `bg-gradient-to-`, `text-white` or a `shadow-` utility, and each
   renders ink-on-paper with no dark gradient anywhere in the viewport.
4. **Given** a signed-out visitor at `/`, **then** they see exactly one filled button (**Sign in**)
   and one outline control (**Create account**), and no decorative `svg`.
5. **Given** a signed-in visitor at `/`, **then** they are redirected to `/dashboard` — unchanged
   from today.
6. **Given** the three auth screens, **then** each composes `AuthCard.astro`; no auth page repeats
   the card recipe inline.
7. **Given** a failed sign-in with a server error, **then** the message appears in a registry `Notice
   variant="error"` with `role="alert"`, and the pasted email is not lost.
8. **Given** a 390px viewport on all four screens, **then** `document.documentElement.scrollWidth`
   does not exceed the viewport width.
9. **Given** `src/components/ui/LibBadge.astro` and `src/components/Welcome.astro`, **then** both are
   deleted and nothing imports them.
10. **Given** the new source-level guard `src/pages/index.test.ts` and the updated
    `dashboard-paper.test.ts`, **then** the `AC3 — SURVIVORS` block is gone and each asserted property
    fails when deliberately broken (restore `bg-cosmic` on `<body>` and watch it go red before
    shipping).

Validate with `npm run lint`, `npm run build`, `npm test`, and `npm run test:e2e` — the auth setup
fixture drives these exact screens, so a broken selector shows up there first. Manual pass on `/`,
`/auth/signin`, `/auth/signup`, `/auth/confirm-email` at 390px and desktop.

## ⚠️ Open decisions

- **The landing copy** (owner: the author). The gateway shape is the recommendation; the sentence
  inside it is replaceable and should not block the increment.
- **`Topbar`'s signed-out label reads "Not signed in"**, which is a status message where a landing
  page wants an invitation. Out of scope here — flag it as a follow-up rather than widening this
  commit.
- **Whether `/` should exist at all** once the product has a single dogfooding user, versus
  redirecting anonymous visitors straight to `/auth/signin`. Recommend keeping the landing: it is the
  only place the product names itself, and it is the natural seat for real positioning copy when
  there is any.
- Carried forward, untouched: practice/cram mode on the caught-up review state, and whether
  `/dashboard`'s `h1` stays "Dashboard".

## 📋 Applied

AI necessity gate: not applicable (no AI in this increment). Human-AI checklist and value metrics:
not applicable — this is a styling and identity change with no new user-facing behaviour beyond the
landing page. Design contract: loaded (`.uxproof/contract.json` + `conventions.md`, all eight
principles, plus the registry's five primitives and its deliberate absence of `Card`).
Prior-increment record: read (Increments 4–8 briefs and specs; the removal condition at
`global.css:317–323` and `Field.tsx`'s "not reconciled here" note are both honoured). Quality rubric:
passed. Nothing was implemented — this is a decision document.
