# Execution plan — Token layer, the "paper" ramp

**Date:** 2026-08-23
**Slug:** `token-layer-paper-ramp`
**Branch:** `feat/token-layer-paper-ramp`
**Base:** `main`
**Engine:** om-auto-create-pr (steps: 10, --loop: no)
**Source doc:** `.ai/specs/briefs/2026-08-22-token-layer-paper-ramp.md`

## 🎯 Goal

Replace the starter's inherited shadcn colour defaults in `src/styles/global.css` with the
decided "paper" system — one warm-neutral eleven-step ramp, every semantic role assigned to a
step of it by `var()` reference, semantic/draft surfaces, and type/radius/shadow tokens — plus
one colocated test that recomputes the palette's contrast from the stylesheet so the
accessibility guarantee is measured rather than asserted. **Nothing on screen changes.**

## Scope

- `src/styles/global.css` — **changed.** The whole colour section is rewritten into two layers
  (raw ramp → role assignment), `--chart-*`/`--sidebar*` are deleted, and a theme-invariant
  `@theme` block adds font, size, measure, radius and shadow tokens.
- `src/styles/tokens.test.ts` — **new.** Parses `global.css`, converts `oklch` to sRGB, and
  asserts acceptance criteria 1–4 (var()-only role tokens, light thresholds, dark thresholds
  plus the halation ceiling, `:root`/`.dark` token-name parity).

### Non-goals (explicitly not touched)

- No screen is migrated; no file under `src/pages/**`, `src/layouts/**` or `src/components/**`
  is edited at all.
- No primitive is created (`Card`, `PageHeader`, `Notice`, `EmptyState`, `Field`).
- `bg-cosmic` is **not** removed, and `class="bg-cosmic"` stays in all ten files that apply it.
- No theme toggle, no `.dark` application, no dark mode shipped — `.dark` is populated so the
  later increment inherits the decided values, but nothing adds the class.
- No `--color-*: initial` palette deletion (the spec's own "Later" item).
- No new dependency: the `oklch` → sRGB conversion in the test is ~40 lines of arithmetic
  rather than a colour library.

### Autonomous decision recorded: the guard test asserts thresholds, not the printed decimals

The brief tabulates exact ratios (17.69, 5.28, 3.35 …) but its acceptance criteria 2–4 are
written as thresholds (≥ 4.5:1, ≥ 3:1, < 16:1). The test asserts the **thresholds**, because
that is what the criteria say and what actually protects the system: pinning `17.69` would fail
the build on a rounding difference in the conversion while still passing a genuinely
inaccessible palette. Every tabulated figure was nonetheless reproduced independently before
this plan was written — 40 of 40 matched to two decimals — so the two readings do not disagree
about any value.

### Autonomous decision recorded: one out-of-gamut value the brief did not flag, verified harmless

The brief flags exactly one gamut correction (light `--destructive-surface`, chroma 0.025 →
0.022). Recomputing found a second value outside sRGB that it does not mention: light
`--warning`, `oklch(0.5 0.11 75)`, whose blue channel resolves to −0.0475. It is shipped
**unchanged**, because the divergence is inaudible: naive per-channel clamping gives `#875800`
and the CSS Color 4 chroma-reduction a browser actually performs gives `#865900` — both measure
5.86:1 against the page and 5.36:1 on `--warning-surface`, so every threshold holds under either
rendering. Recorded here rather than silently "fixed" so a later reader knows it was examined.

### ⚠️ Finding: acceptance criterion 8 does not hold, and cannot — the tokens are not inert

The brief's central safety claim is that this increment "ships tokens that nothing yet consumes",
so "after this increment, every screen looks exactly as it did before" (criterion 8), and that
"a visual difference of any kind … is a defect in this increment". **Measured against a real
build, that claim is false**, and the shipped values are what make it false. `bg-cosmic` overrides
the page _background_ only — it does not override a shadcn primitive's own colours, nor any
radius. The increment was implemented as specified and the differences are all in the direction
the design intends, but the claim must not be repeated, and QA screenshots will show them:

- **Border radius, the largest one.** `--radius` drops `0.625rem → 0.375rem`, and `@theme inline`
  derives `rounded-sm/md/lg/xl` from it. `src/` uses `rounded-lg` 49 times, `rounded-md` 5 and
  `rounded-xl` 4, so **58 elements tighten from 10px to 6px** (and buttons from 8px to 4px).
  `rounded-2xl` (13 uses) and `rounded-full` (5) are unaffected — they do not derive from `--radius`.
- **Destructive buttons.** `src/components/ui/button.tsx` `variant="destructive"` is `bg-destructive`,
  which moves from `oklch(0.577 0.245 27.325)` (bright red) to `oklch(0.48 0.17 27)` = `#a92321`
  (darker, less saturated). Visible on `/library` (Delete) and `/settings` (Delete account).
- **The default filled button.** `bg-primary` moves from `oklch(0.205 0 0)` to `var(--ink-90)`
  `#151410` — darker and warmer. Visible on `/library` in edit mode (Save).
- **Focus rings, on every button.** `focus-visible:ring-ring/50` and `focus-visible:border-ring`
  consume `--ring`, which moves from a mid grey `oklch(0.708 0 0)` to `var(--accent-500)` `#0e5794`
  blue. This is an accessibility improvement, and it is visible on keyboard focus everywhere.
- **Ghost hover** (`hover:bg-accent`, `/library` Edit/Cancel) shifts `#f7f7f7 → #f5f3ef`, and the
  base layer's universal `border-border` shifts `#e5e5e5 → #d7d4ce`. Both are subtle.

None of these is the failure mode the brief actually guards against — nothing becomes unreadable,
because no screen's text or background colour changes. The increment is still safe to land first.
What is wrong is only criterion 8's premise, and it is wrong because the brief treats "no screen is
migrated" as equivalent to "no token is consumed"; `button.tsx` and 58 `rounded-*` usages consume
them today. Flagged for the human reviewer rather than resolved by narrowing the spec's scope:
dropping the `--radius` change would preserve criterion 8, but it would also silently discard a
value the brief's own token table decides.

### Risks

- **Low, by construction.** The tokens this increment ships are consumed by nothing: `body`
  carries `@apply bg-background text-foreground` but `bg-cosmic` overrides it, and 331 hardcoded
  colour classes still paint every screen. The visible-change risk is therefore confined to any
  surface that already consumed a role token _and_ is not covered by `bg-cosmic` — checked in
  Phase 3.
- **Deleting `--chart-*` / `--sidebar*`** would break a consumer outside `global.css`; grep is
  re-run in Phase 3 rather than trusted from the brief's writing time.
- **The `@theme` namespace assumptions** (`--text-*`, `--container-*`, `--shadow-*`) could
  generate no utilities if a namespace name is wrong. Confirmed against a real build in Phase 3,
  which is what the brief asks for.

## Implementation Plan

### Phase 1 — the token layer in `global.css`

1.1 Add layer 1 to `:root`: the eleven `--ink-*` steps and the two `--accent-*` literals, with
the comment that records why `--ink-50` and `--ink-30` are placed by measurement.

1.2 Rewrite every `:root` role token as a `var(--ink-*)` / `var(--accent-*)` reference, and add
the tokens the brief introduces: `--link`, `--destructive-foreground`, the four semantic roles
with their surface tints, and `--surface-draft` / `--surface-draft-border`.

1.3 Mirror the identical token set in `.dark`, reading the ramp from the other end.

1.4 Delete `--chart-1…5` and the eight `--sidebar*` tokens from `:root`, `.dark` **and**
`@theme inline`, and extend `@theme inline` with `--color-*` mappings for the new role tokens so
they generate utilities.

1.5 Add the theme-invariant `@theme` block — three font families, the four-step type scale with
its paired line heights, `--container-content: 66ch`, `--shadow-raised` — and lower `--radius`
from `0.625rem` to `0.375rem`.

### Phase 2 — the contrast guard test

2.1 Add `src/styles/tokens.test.ts` with the stylesheet parser and the colour maths:
`oklch` → OKLab → linear sRGB → gamma-encoded sRGB with clamping, and WCAG 2.x relative
luminance / contrast ratio.

2.2 Assert acceptance criteria 1–4: no role token holds a colour literal; the light palette
clears 4.5:1 for text roles and 3:1 for `--input` and `--ring`; the dark palette clears the same
and `--foreground` stays **below** the 16:1 halation ceiling; `:root` and `.dark` declare
identical token-name sets.

### Phase 3 — verification the brief asks for by name

3.1 Re-run the deletion and preservation greps: `grep -rn "chart-\|sidebar" src/` returns
nothing, and `grep -rln "bg-cosmic" src/` still returns the same eleven files.

3.2 Confirm the two build `[ASSUMPTION]`s against a real production build — that `bg-warning`,
`text-meta` and `max-w-content` resolve to real utilities, proving the `@theme` namespaces are
right.

3.3 Run the full validation gate (`npm run typecheck`, `npm run lint`, `npm run build`,
`npm test`) and confirm the rendered screens are unchanged.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The token layer in global.css

- [x] 1.1 Add layer 1 — the eleven-step ink ramp and the two accent literals — 9431b07
- [x] 1.2 Rewrite :root role tokens as var() references and add the new roles — 9431b07
- [x] 1.3 Mirror the identical token set in .dark — 9431b07
- [x] 1.4 Delete chart/sidebar tokens and extend @theme inline — 9431b07
- [x] 1.5 Add the theme-invariant @theme block and lower --radius — 9431b07

### Phase 2: The contrast guard test

- [x] 2.1 Add src/styles/tokens.test.ts with the parser and colour maths — 87c46dc
- [x] 2.2 Assert acceptance criteria 1-4 — 87c46dc

### Phase 3: Verification

- [x] 3.1 Re-run the chart/sidebar deletion and bg-cosmic preservation greps
- [x] 3.2 Confirm the @theme namespace assumptions against a real build
- [x] 3.3 Run the full validation gate
