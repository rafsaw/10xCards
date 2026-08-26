# Global `bg-cosmic` cleanup: the last four screens migrated, the starter landing retired

**Status:** ready to plan
**Source brief:** `.ai/specs/briefs/2026-08-26-bg-cosmic-cleanup.md` (Increment 9 — Strategy C, final step)
**Direction:** A — Paper (`.uxproof/conventions.md`, "Visual direction — decided 2026-08-22")
**Follows:** Increment 8, `/dashboard` (`708dcc8`, PR #41)

## 📝 TLDR

Migrate the four screens Strategy C never touched — `/`, `/auth/signin`, `/auth/signup`,
`/auth/confirm-email` — plus the auth form family, from the legacy glass recipe to Paper; then delete
the `bg-cosmic` utility, its `<body>` class, the unused `ui/LibBadge.astro`, and the last 45
hardcoded colour utilities in `src/`. The removal condition recorded at `src/styles/global.css:317–323`
requires all of that in one commit: deleting the utility while hardcoded near-white text survives
renders white-on-paper across the app, so the migration and the deletion cannot be separated.

`src/components/Welcome.astro` is not retokenised but **deleted**. It is the starter's marketing page
— heading "10x Astro Starter", a pitch about "a cosmic developer experience", three feature cards
about ESLint and Astro 5 — and it is the site's front door. It is replaced by a minimal sign-in
gateway: the product name, one line, and two controls.

No auth logic, validation, route, API endpoint or middleware behaviour changes anywhere in this
increment. The only behavioural change in the whole spec is what an anonymous visitor reads at `/`.
When it lands, `src/` contains zero hardcoded colours — the recorded entry condition for the
dark-mode increment.

## 📝 Resolved gate decisions

The four Open Questions raised on the skeleton were answered `a` across the board. They are recorded
here so a reviewer can re-open a decision without re-deriving it.

**Q1 — One PR, not two.** The whole increment ships as one commit and one PR. Splitting was viable in
one direction only (the landing retires alone; the auth migration and the utility deletion cannot),
and the intermediate state it would leave on `main` — a Paper front door in front of a dark-glass
sign-in screen — is worse than either endpoint. The atomic diff is ~14 files and is almost entirely
class-list substitution, so review cost tracks file count rather than logic.

**Q2 — The landing copy is accepted as written.** Heading **10xCards**, description **Paste what
you're reading. Keep the cards worth keeping.** It is derived from the PRD's problem statement
(`context/foundation/prd.md`, "Vision & Problem Statement"), not from research, and it is a
placeholder by construction: it lives in exactly one file and one line, and anyone with a better line
overwrites it without ceremony.

**Q3 — `--radius` does not flip here.** Two recorded removal conditions collide: Increment 8's handoff
defers the flip, while `global.css:276` states it triggers "when the last screen migrates" — which is
this increment. This spec resolves the collision in favour of deferral and **amends the comment at
`global.css:274–277`** so the condition stops firing ambiguously: its trigger becomes "when
`bg-cosmic` is gone", i.e. the increment after this one. Rationale: flipping `--radius` restyles every
legacy `rounded-sm/md/lg/xl` consumer at once, and that blast radius has nothing to do with deleting a
background gradient. A follow-up issue is filed as part of this increment (see Phasing, Phase 4).

**Q4 — `auth/ServerError.tsx` is deleted.** Both call sites (`SignInForm.tsx:80`, `SignUpForm.tsx:127`)
call `<Notice variant="error">` directly. The component was a second error-message recipe living
alongside the registry's, in hardcoded reds; principle 8 says screens compose registry primitives
rather than repeating the recipe, and retokenising it in place would have preserved the duplication
under better colours.

## 📝 Problem Statement

Strategy C has migrated five screens to Paper across eight increments — `/settings`, `/generate`, `/review`, `/library`, `/dashboard` — plus the shell. Four screens were never
touched, and they are the four an anonymous visitor sees first.

**The measured state, censused 2026-08-26 on `8e7e9ee`.** Forty-five hardcoded colour utilities
survive in `src/` across twelve non-test files:

| File | Count |
|---|---|
| `components/Welcome.astro` | 19 (plus the only raw `rgba()` literal outside `global.css`) |
| `components/auth/FormField.tsx` | 5 |
| `pages/auth/signin.astro` | 4 |
| `pages/auth/signup.astro` | 4 |
| `pages/auth/confirm-email.astro` | 4 |
| `components/ui/LibBadge.astro` | 2 |
| `components/auth/SubmitButton.tsx` | 2 |
| `components/ui/button.tsx` | 1 |
| `components/settings/CancelDeletionButton.tsx` | 1 |
| `components/auth/SignUpForm.tsx` | 1 |
| `components/auth/ServerError.tsx` | 1 |
| `components/auth/PasswordToggle.tsx` | 1 |

`bg-cosmic` itself is applied in five remaining places: `Layout.astro`'s `<body>`, `Welcome.astro`,
and the three auth pages, plus its `@utility` declaration in `global.css`.

**Three consequences, in descending order of how much they matter.**

*The front door advertises a different product.* `src/pages/index.astro` renders `Welcome.astro` to
every signed-out visitor. That page reads "10x Astro Starter", pitches "a production-ready starter
with authentication, modern tooling, and a cosmic developer experience", and carries three feature
cards about Supabase auth, "Astro 5, React 19, Tailwind 4", and "ESLint, Prettier, and pre-commit
hooks". None of it is about flashcards. This is not a styling defect that Paper tokens would fix; the
page is the wrong page.

*The signed-out path is visually disjoint from the product.* A visitor at `/auth/signin` sees dark
glass; one keystroke later at `/dashboard` they see paper. The seam runs exactly along the login
boundary, which is the worst place for it — it is the one transition every session crosses.

*Two later increments are blocked.* The dark-mode increment's recorded entry condition is zero
hardcoded colours in `src/` (`.uxproof/conventions.md`, "Visual direction"). The `--radius` flip's
condition is the last screen migrating (`global.css:276`). Both wait on this work.

**Why it must be one commit.** `global.css:317–323` records the constraint in the code itself: `body`
already carries `@apply bg-background text-foreground`, and `bg-cosmic` overrides it. Delete the
utility while `text-white`, `text-blue-100/80` and `text-white/40` survive, and those screens render
near-white text on a near-white background. The migration is not merely *scheduled* alongside the
deletion; it is the deletion's precondition.

## 📝 Proposed Solution

Five moves, in dependency order.

**1. Replace the landing rather than repaint it.** Delete `Welcome.astro`; write the gateway inline in
`index.astro`, composed from `PageHeader` and `buttonVariants()`. Nineteen hardcoded colours, three
blurred orbs, a star field made of a raw `rgba()` triple-gradient, and three feature cards go with it.
The redirect for signed-in users is untouched.

**2. Extract `auth/AuthCard.astro`.** The three auth pages carry a byte-identical shell — full-bleed
centring wrapper, `max-w-sm` card, gradient `h1`. Repeating a card recipe inline across three pages is
a finding under principle 8 even when the result looks right, and it is why retokenising all three
separately would be the wrong shape. One `.astro` component, a `title` prop, a default slot.

**3. Retokenise the auth form family in place.** `FormField.tsx`, `PasswordToggle.tsx`,
`SubmitButton.tsx`, and `SignUpForm.tsx`'s hint become token-only. `ServerError.tsx` is deleted in
favour of `Notice` (Q4). **`FormField` is deliberately not reconciled into `ui/Field.tsx`** — that
file's own docstring records the decision, and the two families genuinely differ (textarea versus
input, no icon versus leading icon, no error slot versus per-field error, no end content versus the
password toggle). Reopening it here would be a refactor riding along on a colour change.

**4. Sweep the two strays.** `button.tsx`'s destructive variant swaps `text-white` for the
`text-destructive-foreground` token that already exists and is currently consumed by nothing;
`settings/CancelDeletionButton.tsx:45` swaps `text-red-700` for `text-destructive`. The second is a
leak from Increment 4 that the `/settings` guard test did not catch because it only reads
`settings.astro`, `DeleteAccountButton.tsx` and `RetentionNotice.tsx`.

**5. Delete, last.** `class="bg-cosmic"` off `<body>`; the `@utility bg-cosmic` block and its removal-
condition comment out of `global.css`; `ui/LibBadge.astro` outright — it has no consumer in `src/` or
`tests/`, and Increment 8 recorded "deleted or given a consumer" as the choice. Inventing a consumer
for a starter badge to justify keeping it would be the worse half of that choice.

**Alternatives considered.**

*Retokenise `Welcome.astro` in place.* Rejected: it preserves the wrong product copy under better
colours, and the honest version of the work is a rewrite of every element on the page anyway. The
diff is not smaller, only less honest about what it is doing.

*Ship the landing separately (Q1 option b).* Rejected — see Resolved gate decisions.

*Build a real marketing landing.* Rejected as invented scope. The PRD's v1 audience is one person
dogfooding; positioning copy for an audience of one is work nobody asked for, and the gateway leaves
the seat open for real copy when there is any.

*Give `AuthCard` a `footer` slot for the "Don't have an account?" line.* Rejected: `confirm-email` has
no footer of that shape, so two of three consumers would use it and the third would pass nothing.
Named slots earn their place at three consumers, not two. The footer stays in the page, one line each.

## 📝 Research — what the market does that this spec should not ignore

Checked against open-source and widely-copied auth implementations (Supabase Auth UI, Clerk's hosted
pages, NextAuth's default pages, and the Anki/Mochi/RemNote landing pages as the domain's own
comparison set).

**What they carry that this spec adopts — one item.** Every serious auth form ships browser
autofill hints, and **this codebase has none: `autocomplete` does not appear once anywhere in `src/`.**
That is a functional gap, not a styling one — password managers and mobile keyboards key on it, and it
is a WCAG 2.1 AA success criterion in its own right (1.3.5 Identify Input Purpose). Since `FormField`
is being rewritten line by line in this increment anyway, adding the attribute costs one optional prop
and four call-site values. **This is a deliberate scope addition beyond the brief; it is called out
here and in the acceptance criteria so a reviewer sees it was chosen rather than smuggled.** The
values: `email` on both email fields, `current-password` on sign-in's password, `new-password` on
sign-up's password and confirmation.

**What they carry that this spec deliberately skips.** Social/OAuth buttons (no provider is
configured, and the PRD does not ask for one). "Remember me" (Supabase SSR already persists the
session; a checkbox that changes nothing is worse than no checkbox). Password-strength meters (the
rule here is a six-character minimum and the existing countdown hint already communicates it). Magic
links. Rate-limit messaging in the UI (server-side concern, and `?error=` already carries whatever
GoTrue returns). Marketing landing pages with feature grids and testimonials — the whole point of
Q2's answer.

**What the flashcard products get right on their landing pages** is a single sentence naming the job
before any chrome. Anki leads with what it does, not with its stack. The gateway follows that shape at
one-tenth the length: name, sentence, way in.

## 📝 Architecture

**Files added (2).**

| Path | What it is |
|---|---|
| `src/components/auth/AuthCard.astro` | The shared auth shell: full-bleed centring wrapper, hairline card, `h1`, default slot |
| `src/pages/index.test.ts` | Source-level guard for the landing, in the house `settings.test.ts` / `generate.test.ts` style |

**Files deleted (3).**

| Path | Why |
|---|---|
| `src/components/Welcome.astro` | Starter marketing page; replaced by the gateway in `index.astro` |
| `src/components/ui/LibBadge.astro` | No consumer in `src/` or `tests/`; Increment 8 recorded delete-or-adopt |
| `src/components/auth/ServerError.tsx` | Duplicated `Notice variant="error"` in hardcoded reds (Q4) |

**Files changed (11).** `src/pages/index.astro`, `src/pages/auth/signin.astro`,
`src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`,
`src/components/auth/FormField.tsx`, `src/components/auth/PasswordToggle.tsx`,
`src/components/auth/SubmitButton.tsx`, `src/components/auth/SignInForm.tsx`,
`src/components/auth/SignUpForm.tsx`, `src/components/ui/button.tsx`,
`src/components/settings/CancelDeletionButton.tsx`, `src/layouts/Layout.astro`,
`src/styles/global.css`, and the test files `src/components/dashboard/dashboard-paper.test.ts` and
`src/components/ui/primitives.test.ts`.

**What is reused, not invented.** `PageHeader`, `Notice` and `buttonVariants` come from the registry
unchanged — this increment adds no registry primitive. `AuthCard.astro` is deliberately *page-local
to the auth family*, in `components/auth/`, not in `components/ui/`: it has three consumers, all in
one folder, and promoting it to the registry would assert a generality it does not have. That mirrors
Increment 8's `DashboardLead.astro` / `DashboardNote.astro` placement.

**Hydration boundaries are unchanged.** `PageHeader` and `Notice` are `.tsx` but render server-side
without a `client:` directive when used from `.astro` — the pattern `settings.astro` and
`library.astro` already use. `AuthCard.astro` is plain Astro with no island. The two forms keep their
existing `client:load`. The landing gains no island at all: `<a class:list={buttonVariants()}>` is the
established link-as-button pattern from `dashboard.astro:158`, chosen over `<Button asChild>` because
the latter would drag React onto a static page.

**Data flow.** Nothing changes. The forms keep `method="POST"`, their `action` targets, and every
field `name`; `serverError` still arrives as a prop read from `Astro.url.searchParams`.

## 📝 Data Model

Not applicable. No entity, column, relation, index, migration, RLS policy or persisted client state
changes in this increment. `Astro.locals` is read exactly as it is read today.

## 📝 API Contracts

No contract changes. Recorded explicitly because the E2E auth fixture depends on them:

- `POST /api/auth/signin` and `POST /api/auth/signup` keep their current request shapes. The forms'
  `method`, `action`, and the `name` attributes `email`, `password`, `confirmPassword` are byte-identical
  after the change.
- The `?error=<message>` query contract on `/auth/signin` and `/auth/signup` is unchanged; only the
  element that renders the message changes, from `ServerError` to `Notice`.
- The post-signin redirect to `/` and `index.astro`'s onward redirect to `/dashboard` are untouched,
  which is what keeps `tests/e2e/auth.setup.ts`'s `waitForURL` assertion passing.

## 📝 UI/UX

### `/` — the gateway

`index.astro` keeps its existing guard verbatim:

```astro
if (Astro.locals.user) {
  return Astro.redirect("/dashboard");
}
```

Below it, inside `Layout`, a single centred column on the house wrapper recipe
(`bg-background text-foreground min-h-screen`, matching the five migrated pages):

- `<PageHeader title="10xCards" description="Paste what you're reading. Keep the cards worth keeping." />`
- A control row — `flex flex-col gap-3 sm:flex-row` so it stacks below 640px:
  - `<a href="/auth/signin" class:list={buttonVariants()}>Sign in</a>` — the screen's one filled action
  - `<a href="/auth/signup" class:list={buttonVariants({ variant: "outline" })}>Create account</a>`

Nothing else. No orbs, no star field, no feature cards, no decorative `svg`. `Topbar` renders its
signed-out branch from `Layout` as it does on every other route, so the landing does not import it —
which removes today's duplicate-`Topbar` path, where `Welcome.astro` imported it while `Layout` also
conditionally rendered it.

### `AuthCard.astro` — the shared shell

```astro
---
interface Props {
  title: string;
}
const { title } = Astro.props;
---

<div class="bg-background text-foreground flex min-h-screen items-center justify-center p-4">
  <div class="border-border bg-card rounded-paper w-full max-w-sm border p-8">
    <h1 class="text-display text-foreground mb-6 font-sans font-bold">{title}</h1>
    <slot />
  </div>
</div>
```

`--card` resolves to `--ink-05`, the same value as `--background`, so the card is separated from the
page by its hairline and its whitespace alone — principle 4, and the reason no shadow appears here.
The `h1` loses its `text-center`: centred headings were part of the glass recipe, and Paper's five
migrated screens are uniformly left-aligned.

### The three auth screens

| Screen | `AuthCard title` | Body | Footer |
|---|---|---|---|
| `/auth/signin` | `Sign in` | `<SignInForm serverError={error} client:load />` | **Don't have an account?** + underlined `text-link` **Sign up** |
| `/auth/signup` | `Sign up` | `<SignUpForm serverError={error} client:load />` | **Already have an account?** + underlined `text-link` **Sign in** |
| `/auth/confirm-email` | `Registration successful` (dev) / `Check your email` (prod) | icon + description | underlined `text-link`, text from the existing `content.linkText` |

Footer recipe, identical on signin and signup:
`<p class="text-muted-foreground mt-4 text-sm">…<a href="…" class="text-link underline underline-offset-4">…</a></p>`
— matching `dashboard.astro:145`'s link recipe exactly. Links are underlined so they are identifiable
without colour (WCAG 1.4.1); the previous `text-purple-300 hover:underline` failed that, since the
underline only appeared on hover.

On `/auth/confirm-email`, the `content` object keeps its `heading`, `description` and `linkText`
verbatim and drops its `emoji` key. The emoji block becomes a lucide icon — `CircleCheck` when
`import.meta.env.DEV`, `Mail` otherwise — rendered `aria-hidden="true"` at `text-muted-foreground
size-8`. Two reasons: an emoji is announced by name by screen readers where a decorative glyph should
be silent (WCAG 1.1.1), and `✅`/`📧` render in the platform's colour emoji font, which is exactly the
saturated decoration principle 6 rules out.

### The auth form family — class-by-class

| File | Today | After |
|---|---|---|
| `FormField.tsx` label | `text-blue-100/80` | `text-meta text-foreground` |
| `FormField.tsx` input base | `bg-white/10 … text-white placeholder-white/40` | `bg-background text-foreground placeholder:text-muted-foreground` |
| `FormField.tsx` leading icon | `text-white/40` | `text-muted-foreground` |
| `FormField.tsx` resting border | `border-white/20 focus:ring-purple-400` | `border-input focus:border-ring` |
| `FormField.tsx` error border | `border-red-400/60 focus:ring-red-400` | `border-destructive focus:border-destructive` |
| `FormField.tsx` error text | `text-red-300` | `text-destructive` |
| `PasswordToggle.tsx` | `text-white/40 hover:text-white/70` | `text-muted-foreground hover:text-foreground` |
| `SubmitButton.tsx` | `bg-purple-600 text-white hover:bg-purple-500` | colour classes dropped; `<Button>`'s default variant supplies them. `className` keeps only `w-full` |
| `SubmitButton.tsx` spinner | `border-white/30 border-t-white` | `border-muted border-t-foreground` |
| `SignUpForm.tsx` hint | `text-blue-100/50` | `text-meta text-muted-foreground` |
| `ServerError.tsx` | `border-red-500/30 bg-red-900/30 text-red-300` | file deleted; call sites use `<Notice variant="error">{message}</Notice>` |
| `button.tsx` destructive | `text-white` | `text-destructive-foreground` |
| `CancelDeletionButton.tsx:45` | `text-red-700` | `text-destructive` |

`FormField` also gains one optional prop, `autocomplete?: string`, forwarded to the input's
`autoComplete` attribute (see Research). Call sites: `email` on both email fields,
`current-password` on `SignInForm`'s password, `new-password` on `SignUpForm`'s password and
`confirmPassword`.

The focus treatment changes shape, not just colour: today's `focus:ring-2 focus:ring-purple-400`
becomes `focus:border-ring`, matching `ui/Field.tsx`'s recipe so the app has one focus behaviour for
text inputs rather than two.

`ServerError`'s deletion moves the message inside a `role="alert"` `aria-live="assertive"` region,
which `Notice` supplies for its `error` variant. Today's `<p>` has neither, so a server-side sign-in
failure is currently announced to nobody — a real accessibility improvement that falls out of Q4 for
free.

### Accessibility summary

| Change | Criterion |
|---|---|
| Links underlined, not colour-only | WCAG 1.4.1 Use of Colour |
| Emoji → `aria-hidden` icon | WCAG 1.1.1 Non-text Content |
| `autocomplete` on all four credential fields | WCAG 1.3.5 Identify Input Purpose |
| Server error inside `role="alert"` | WCAG 4.1.3 Status Messages |
| `text-destructive-foreground` on the destructive button | WCAG 1.4.3 Contrast — **must be measured, see Risks** |

Unchanged and must stay unchanged: the `htmlFor`/`id` pairing on every field, the `aria-label` on the
password toggle, the accessible names **Email**, **Password**, **Sign in**, **Create account** — all
four are locators in `tests/e2e/auth.setup.ts`.

## 📝 Edge Cases & Failure Scenarios

| Scenario | Behaviour after this increment |
|---|---|
| Signed-in visitor hits `/` | 302 to `/dashboard`, unchanged. The gateway never renders for them. |
| Signed-out visitor hits a protected route | `middleware.ts` redirects to `/auth/signin` as today; they land on the Paper card. |
| Client validation fails | Per-field message under the input in `text-destructive` with `CircleAlert`; the input's border goes `border-destructive`. Copy unchanged (**Email is required**, **Enter a valid email address**, **Passwords do not match**, …). Clears on next keystroke. |
| Server rejects the credentials | `?error=` round-trips; `Notice variant="error"` renders inside the card above the submit button, with `role="alert"`. The typed email is not preserved today and is not preserved after — **this increment does not change that**, and it is called out as a known gap rather than silently inherited. |
| Submit in flight | `useFormStatus().pending` disables the button; spinner + **Signing in…** / **Creating account…**. Unchanged. |
| JavaScript disabled | The forms still POST — `method`/`action` are real. Client validation is skipped and the server rejects; the `Notice` still renders because it is server-rendered from `serverError`. Same as today. |
| `/auth/confirm-email` in dev vs prod | Both branches keep their existing copy; only the glyph changes. |
| A `bg-cosmic` reference survives somewhere unscanned | Caught by the repo-wide guard in AC1, which greps `src/` including test files. |
| `dashboard-paper.test.ts`'s `AC3 — SURVIVORS` block | **Expected to fail and be deleted.** Its own test name reads "still carries bg-cosmic — the next increment removes it". This is that increment. The whole `describe` block goes. |
| `primitives.test.ts:75`'s `bg-cosmic` assertion | Kept, but it now asserts against a string that exists nowhere — harmless and still meaningful as a regression guard against reintroduction. Leave it. |
| `tests/e2e/auth.setup.ts` | Must pass **unmodified**. It locates by `getByLabel("Email", { exact: true })`, `getByLabel("Password", { exact: true })` and `getByRole("button", { name: "Sign in" })`. All three survive; the `exact: true` guard against the toggle's "Show password" label still matters, because `PasswordToggle`'s `aria-label` is unchanged. |

## 📝 Risks & Impact Review

**Blast radius.** Presentation-only outside `index.astro`'s content. No query, no endpoint, no
middleware, no RLS surface, no persisted state. The one behavioural change is what an anonymous
visitor reads at `/`, and it is user-visible by design.

**The one measurable risk: `button.tsx`'s destructive variant.** Swapping `text-white` for
`text-destructive-foreground` changes the foreground of a button whose background is `--destructive`.
The token exists but has never been consumed, so its contrast against `--destructive` has never been
exercised. **Measure it before accepting the change**; if it fails 4.5:1, the correct fix is to adjust
the token in `global.css` (and its `.dark` twin, per the same-names rule), not to restore `text-white`.
Note this is the only change in the increment that touches a shared primitive used by migrated
screens, so a regression here is visible on `/settings` and `/library`, not just on auth.

**Reintroduction risk.** Once `@utility bg-cosmic` is gone, `class="bg-cosmic"` becomes a silent no-op
rather than an error — Tailwind emits nothing for an unknown class. The guard tests are what convert
that silence into a failure, which is why AC10's deliberate-break step is not optional ceremony.

**Rollback.** A single `git revert` of one commit. Nothing to migrate back, no data touched, no
deploy-order dependency. The Cloudflare deploy is a static rebuild.

**Compatibility.** No `BACKWARD_COMPATIBILITY.md` exists in this repo, and no public surface changes.
The deleted components (`Welcome`, `LibBadge`, `ServerError`) are internal, and their import sites are
all inside this diff.

**Scope honesty.** Two things in this spec exceed the brief and are flagged rather than buried: the
`autocomplete` attributes (Research), and the amendment to `global.css:274–277`'s removal-condition
comment (Q3). Both are one-line-scale and both are argued above.

## 📋 Phasing

The commit is atomic (Q1), but the work is sequenced so the app builds and the suite is meaningful at
every step. **Phase 3 is the only point at which `bg-cosmic` may leave the codebase** — everything
before it keeps the app renderable.

- **Phase 1 — the auth family and the strays.** Retokenise the components. `bg-cosmic` still on
  `<body>`; the auth *pages* still dark. The app renders throughout.
- **Phase 2 — the four screens.** `AuthCard.astro`, the three auth pages, the gateway. Every screen is
  now Paper, but `bg-cosmic` is still declared and still on `<body>`, painting behind the per-page
  wrappers.
- **Phase 3 — the deletions.** `<body>` class, the `@utility` block, `LibBadge.astro`. The last
  possible moment, and the one that satisfies `global.css:317–323`.
- **Phase 4 — guards and hand-off.** New and amended tests, the deliberate-break proof, the follow-up
  issue for Increment 10.

## 📋 Implementation Plan

Each step leaves the application working and `npm run build` green.

### Phase 1 — the auth family and the strays

1. **`FormField.tsx`** — replace the eight colour classes per the table; add the optional
   `autocomplete?: string` prop, forwarded as `autoComplete`; change the focus treatment from
   `focus:ring-2 focus:ring-purple-400` to `focus:border-ring`.
   *Test:* `npm run typecheck` passes; a grep of the file returns no palette-scale utility.
2. **`PasswordToggle.tsx`** — two colour classes. The `aria-label` values are untouched.
   *Test:* grep returns no `white/`.
3. **`SubmitButton.tsx`** — strip the colour classes from `className`, leaving `w-full`; retokenise
   the spinner border.
   *Test:* the button renders filled via `<Button>`'s default variant; grep returns no `purple`.
4. **Delete `ServerError.tsx`; update both call sites** to `<Notice variant="error">{serverError}</Notice>`,
   guarded by the existing `serverError &&` truthiness so nothing renders when there is no error
   (`ServerError` did this internally with an early `return null`; the guard moves to the call site).
   Remove both `ServerError` imports; add the `Notice` import.
   *Test:* `npm run lint` catches any orphaned import; visiting `/auth/signin?error=Test` shows the
   notice.
5. **`SignUpForm.tsx`** — the hint's `text-blue-100/50` → `text-meta text-muted-foreground`; add
   `autocomplete` to its three fields (`email`, `new-password`, `new-password`).
   *Test:* grep returns no `blue-100`.
6. **`SignInForm.tsx`** — add `autocomplete` to its two fields (`email`, `current-password`). No colour
   change; this file has none.
   *Test:* the browser offers a saved credential on `/auth/signin`.
7. **`button.tsx`** — `text-white` → `text-destructive-foreground` on the destructive variant.
   **Measure the contrast ratio against `--destructive` before proceeding**; if it fails 4.5:1, adjust
   the token in `global.css` in both `:root` and `.dark` and record the measurement in the PR body.
   *Test:* `/settings`'s delete-account confirm step still reads legibly.
8. **`CancelDeletionButton.tsx`** — `text-red-700` → `text-destructive`.
   *Test:* grep of `src/components/settings/` returns no palette-scale utility.

### Phase 2 — the four screens

9. **Create `src/components/auth/AuthCard.astro`** with the `title` prop and default slot, per the
   contract in UI/UX.
   *Test:* `npm run build` compiles it; nothing consumes it yet.
10. **`/auth/signin`** — replace the wrapper, card and `h1` with `<AuthCard title="Sign in">`;
    retokenise the footer line to the `text-muted-foreground` + underlined `text-link` recipe.
    *Test:* the page renders on paper; `npm run test:e2e` still authenticates.
11. **`/auth/signup`** — same substitution, `title="Sign up"`, mirrored footer.
    *Test:* manual sign-up flow through to `/auth/confirm-email`.
12. **`/auth/confirm-email`** — `<AuthCard title={content.heading}>`; drop `content.emoji`; render
    `CircleCheck` / `Mail` `aria-hidden` at `text-muted-foreground size-8`; retokenise the link.
    *Test:* both the dev and prod branches of `content` render (toggle `import.meta.env.DEV` locally or
    check the built output).
13. **`index.astro`** — write the gateway inline: the wrapper, `PageHeader`, and the two
    `buttonVariants()` links. Delete the `Welcome` import.
    *Test:* signed out, `/` shows the gateway; signed in, `/` still 302s to `/dashboard`.
14. **Delete `src/components/Welcome.astro`.**
    *Test:* `npm run build` succeeds — proof nothing else imported it.

### Phase 3 — the deletions

15. **`Layout.astro`** — remove `class="bg-cosmic"` from `<body>`.
    *Test:* every one of the nine routes renders on paper; no route shows a dark gradient at any
    scroll position or viewport.
16. **`global.css`** — delete the `@utility bg-cosmic` block and its seven-line removal-condition
    comment. **Amend the `--radius-paper` comment at `274–277`** so its removal condition reads "when
    `bg-cosmic` is gone" rather than "when the last screen migrates" (Q3).
    *Test:* `npm run build`; `src/styles/tokens.test.ts` still passes unmodified, `--radius` still
    `0.625rem`.
17. **Delete `src/components/ui/LibBadge.astro`.**
    *Test:* `npm run build` succeeds; a repo-wide grep for `LibBadge` returns only the historical
    comment in `primitives.test.ts:18`, which is prose and stays.

### Phase 4 — guards and hand-off

18. **Write `src/pages/index.test.ts`** in the `settings.test.ts` / `generate.test.ts` idiom (read the
    file as text, assert over it — this repo has no jsdom harness). Assert: no colour literal, no
    palette-scale utility, no `backdrop-blur` / `bg-gradient-` / `shadow-` / `bg-cosmic`; the wrapper
    reads `bg-background text-foreground min-h-screen`; exactly one `buttonVariants()` call without a
    variant argument and exactly one with `variant: "outline"`; the redirect to `/dashboard` survives.
    *Test:* the suite is red before Phase 2 lands and green after.
19. **Extend the guard to the auth family.** Add a `MIGRATED_FILES` table covering `AuthCard.astro`,
    the three auth pages, `FormField.tsx`, `PasswordToggle.tsx`, `SubmitButton.tsx`, `SignInForm.tsx`
    and `SignUpForm.tsx` — either in `index.test.ts` or a sibling `src/components/auth/auth-paper.test.ts`
    following `dashboard-paper.test.ts`'s layout. Include an assertion that all four credential fields
    carry an `autocomplete` value.
    *Test:* each assertion fails when its property is deliberately broken.
20. **Delete the `AC3 — SURVIVORS` block** from `src/components/dashboard/dashboard-paper.test.ts`
    (lines 89–102). It asserts six files still contain `bg-cosmic`; this increment removes it from all
    six, and the block's own test name says the next increment removes it.
    *Test:* `npm test` green.
21. **Add the repository-wide sweep test.** One assertion that walks every `.astro` and `.tsx` under
    `src/` outside `*.test.*` and fails on any palette-scale utility, raw hex, `rgb()`, or the string
    `bg-cosmic`. This is what makes the dark-mode entry condition self-enforcing instead of a claim in
    a PR body.
    *Test:* reintroducing `text-red-700` anywhere in `src/` turns it red.
22. **Prove the guards.** Restore `class="bg-cosmic"` on `<body>` and re-add the `@utility` block; run
    `npm test` and confirm both the sweep test and `index.test.ts` fail. Revert. Record the observed
    failure output in the PR body.
23. **Full gate.** `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`,
    `npm run test:integration`, `npm run test:e2e`. Manual pass on `/`, `/auth/signin`,
    `/auth/signup`, `/auth/confirm-email`, `/dashboard`, `/generate`, `/review`, `/library`,
    `/settings` at 390px and at desktop width, checking `document.documentElement.scrollWidth` on each.
24. **File the Increment 10 follow-up issue** — `--radius` → `0.375rem`, delete `--radius-paper`,
    rewrite every `rounded-paper` usage, amend `tokens.test.ts:352`. Reference this spec and the
    amended comment at `global.css:274`.

## ✅ Acceptance Criteria

1. **Given** the whole repository, **when** the increment lands, **then** a search for `bg-cosmic`
   under `src/` returns nothing — not the utility, not the `<body>` class, not a test regex.
2. **Given** the `.astro` and `.tsx` files under `src/` outside `*.test.*`, **then** they contain zero
   Tailwind palette-scale colour utilities and zero raw hex or `rgb()` literals, **and** a test in the
   suite enforces this rather than a claim in the PR body. This is the recorded entry condition for
   the dark-mode increment; say so in the PR body.
3. **Given** `/`, `/auth/signin`, `/auth/signup` and `/auth/confirm-email`, **then** none contains
   `backdrop-blur`, `rounded-2xl`, `bg-gradient-to-`, `text-white` or a `shadow-` utility, and each
   renders ink-on-paper with no dark gradient anywhere in the viewport.
4. **Given** a signed-out visitor at `/`, **then** they see the heading **10xCards**, the description
   **Paste what you're reading. Keep the cards worth keeping.**, exactly one filled control (**Sign
   in**) and one outline control (**Create account**), and no decorative `svg`.
5. **Given** a signed-in visitor at `/`, **then** they are redirected to `/dashboard`, unchanged.
6. **Given** the three auth screens, **then** each composes `AuthCard.astro` and no auth page repeats
   the card recipe inline.
7. **Given** a failed sign-in with `?error=`, **then** the message renders in a registry `Notice
   variant="error"` carrying `role="alert"`, and `src/components/auth/ServerError.tsx` no longer exists.
8. **Given** the four credential inputs across both forms, **then** each carries an `autocomplete`
   value: `email`, `current-password`, `new-password`, `new-password`.
9. **Given** a 390px viewport on all nine routes, **then** `document.documentElement.scrollWidth` does
   not exceed the viewport width.
10. **Given** `src/components/Welcome.astro`, `src/components/ui/LibBadge.astro` and
    `src/components/auth/ServerError.tsx`, **then** all three are deleted and nothing imports them.
11. **Given** `tests/e2e/auth.setup.ts`, **then** it passes **unmodified**.
12. **Given** `src/styles/tokens.test.ts`, **then** it passes **unmodified** and `--radius` is still
    `0.625rem` — the Q3 deferral, enforced.
13. **Given** the guards, **then** restoring `class="bg-cosmic"` on `<body>` turns the suite red, and
    the observed failure is recorded in the PR body.
14. **Given** the PR body, **then** it names the two deliberate scope additions (`autocomplete`
    attributes; the `global.css:274–277` comment amendment), the measured contrast ratio for
    `text-destructive-foreground` on `--destructive`, and the Increment 10 follow-up issue number.

## 📋 Follow-ups, explicitly not this increment

- **Increment 10** — `--radius` → `0.375rem`, `--radius-paper` and every `rounded-paper` deleted,
  `tokens.test.ts:352` amended. Filed as an issue in Phase 4.
- **Dark mode** — unblocked by this increment. Its first task is the deliberate inspection of
  `button.tsx`'s four dormant `dark:` variants, which have never been reviewed and come alive the
  moment a toggle lands (`.uxproof/conventions.md`, "Light/dark drift").
- **`Topbar`'s signed-out label** reads "Not signed in", a status message where a landing page wants
  an invitation. One line, but it is `Topbar`'s business, not this increment's.
- **Preserving the typed email across a failed sign-in.** A real gap, unchanged here; it is a form-state
  change, not a colour change.
- **Real landing copy**, whenever the product has positioning worth writing down. The gateway is one
  heading and one sentence in one file, built to be overwritten.
- Carried, untouched: practice/cram mode on the caught-up review state; whether `/dashboard`'s `h1`
  stays "Dashboard".
