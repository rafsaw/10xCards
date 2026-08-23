# Token layer — the "paper" ramp

**Date:** 2026-08-22
**Status:** Proposed
**Type:** Visual system (redesign strategy C, first increment)
**Origin:** `om-ux-shape` in Handoff mode
**Inputs:** `.ai/analysis/2026-08-22-ui-ux-visual-direction-phase4.md` (direction decided), `.uxproof/conventions.md` (manual section, eight principles), `.ai/analysis/2026-08-21-ui-ux-discovery-phase1.md`, `.ai/analysis/2026-08-21-ui-ux-review-phase2.md`, `.ai/analysis/2026-08-21-ui-ux-redesign-strategy-phase3.md`, `main` at `e63caad`

## 📝 Token layer — handoff

**Intent**: `src/styles/global.css` stops carrying the starter's inherited shadcn defaults and starts carrying the decided "paper" system — one warm-neutral lightness ramp, every semantic role assigned to a step of it, and a contrast guarantee that is measured rather than asserted. Nothing on screen changes.

**Non-goals**: No screen is migrated. No component is edited. No primitive (`Card`, `PageHeader`, `Notice`, `EmptyState`, `Field`) is created. The shell is untouched. `bg-cosmic` is **not** removed — see "The one thing that must not happen". No theme toggle, no `.dark` application, no PR against `src/components/**`.

**Actor and trigger**: The developer (or implementing skill) starting strategy C. There is no user-facing trigger — this increment is deliberately invisible to users, and that is the property that makes it safe to land first.

**Reader assumption**: written for someone who was not in the conversation and does not know the design system. Every value below is the value to type.

---

### 📋 Behavior

This increment replaces the colour section of `src/styles/global.css` with a two-layer system and adds type, radius and shadow tokens. The two layers are the whole idea, so they come first.

**Layer 1 — the raw ramp.** Eleven steps of one warm neutral (`oklch`, hue 85, chroma tapering with lightness), plus two accent literals. Value-named, because they _are_ values. Nothing in `src/` outside `global.css` may reference these directly.

**Layer 2 — the roles.** Every semantic token (`--background`, `--foreground`, `--border`, …) is a `var()` reference into layer 1. Role tokens never contain a colour literal.

That split is what makes the rules checkable. "Is this colour legal?" becomes "is it a `var(--ink-*)` / `var(--accent-*)` reference?" — a question a reviewer or a script can answer without judgment. It is also what makes dark mode later a re-assignment rather than a second palette: the ramp is read from the other end.

#### Layer 1 — the ramp

Hue 85 puts a trace of warmth in both ends, so the page reads as paper rather than as a white screen and the text as ink rather than as black. Chroma peaks in the middle of the ramp and tapers at both ends, because a fully neutral mid-grey next to warm extremes looks green.

| Token      | Value                   | Renders   |
| ---------- | ----------------------- | --------- |
| `--ink-00` | `oklch(0.995 0.002 85)` | `#fefdfc` |
| `--ink-05` | `oklch(0.985 0.004 85)` | `#fbfaf7` |
| `--ink-10` | `oklch(0.965 0.006 85)` | `#f5f3ef` |
| `--ink-20` | `oklch(0.925 0.008 85)` | `#e9e6e0` |
| `--ink-30` | `oklch(0.87 0.009 85)`  | `#d7d4ce` |
| `--ink-40` | `oklch(0.78 0.01 85)`   | `#bab7b0` |
| `--ink-50` | `oklch(0.63 0.012 85)`  | `#8c8981` |
| `--ink-60` | `oklch(0.52 0.012 85)`  | `#6c6861` |
| `--ink-70` | `oklch(0.4 0.012 85)`   | `#4b4740` |
| `--ink-80` | `oklch(0.29 0.011 85)`  | `#2e2b25` |
| `--ink-90` | `oklch(0.19 0.008 85)`  | `#151410` |

Two steps are placed by measurement, not by eye, and must not be nudged without re-running the check described under Acceptance criteria:

- **`--ink-50` sits at L 0.63, not at the L 0.665 an even ramp would give it.** At 0.665 it measures 2.92:1 against the page and fails the 3:1 an input boundary needs. At 0.63 it measures 3.35:1.
- **`--ink-30` is the hairline, not `--ink-20`.** `--ink-20` measures 1.2:1 against the page, which is below the threshold where a 1px rule is reliably visible; `--ink-30` measures 1.42:1.

Accent literals — one per theme, because a single hue cannot serve as readable text on both paper and ink:

| Token          | Value                  | Renders   | Used by                     |
| -------------- | ---------------------- | --------- | --------------------------- |
| `--accent-500` | `oklch(0.45 0.12 250)` | `#0e5794` | light theme links and focus |
| `--accent-300` | `oklch(0.74 0.12 250)` | `#6db0f4` | dark theme links and focus  |

#### Layer 2 — role assignment

Read this table as the spec. The "measured" column is the WCAG 2.x contrast ratio against that theme's page background, computed from the sRGB these `oklch` values actually resolve to; every number below was calculated, and the calculation is the thing the acceptance test re-runs.

| Role token               | Light          | Dark           | What it is for                           | Measured (light / dark) |
| ------------------------ | -------------- | -------------- | ---------------------------------------- | ----------------------- |
| `--background`           | `--ink-05`     | `--ink-90`     | the page                                 | —                       |
| `--foreground`           | `--ink-90`     | `--ink-20`     | body and content text                    | **17.69 / 14.8**        |
| `--card`                 | `--ink-05`     | `--ink-90`     | card surface — _same as the page_        | 1.0 / 1.0 (by design)   |
| `--card-foreground`      | `--ink-90`     | `--ink-20`     | text on a card                           | 17.69 / 14.8            |
| `--popover`              | `--ink-00`     | `--ink-80`     | genuinely floating layers only           | 1.03 / 1.31 vs page     |
| `--popover-foreground`   | `--ink-90`     | `--ink-20`     | text on those                            | —                       |
| `--primary`              | `--ink-90`     | `--ink-20`     | the one filled action                    | —                       |
| `--primary-foreground`   | `--ink-05`     | `--ink-90`     | its label                                | **17.69 / 14.8**        |
| `--secondary`            | `--ink-10`     | `--ink-80`     | quiet filled surface                     | —                       |
| `--secondary-foreground` | `--ink-90`     | `--ink-20`     | its label                                | —                       |
| `--muted`                | `--ink-10`     | `--ink-80`     | recessed surface                         | —                       |
| `--muted-foreground`     | `--ink-60`     | `--ink-40`     | labels, counters, secondary text         | **5.28 / 9.23**         |
| `--accent`               | `--ink-10`     | `--ink-80`     | hover surface (**shadcn meaning, kept**) | —                       |
| `--accent-foreground`    | `--ink-90`     | `--ink-20`     | text on hover surface                    | —                       |
| `--border`               | `--ink-30`     | `--ink-70`     | decorative hairline                      | 1.42 / 2.0 (visibility) |
| `--input`                | `--ink-50`     | `--ink-60`     | a control's own boundary                 | **3.35 / 3.35**         |
| `--ring`                 | `--accent-500` | `--accent-300` | focus indicator                          | **7.13 / 8.05**         |
| `--link`                 | `--accent-500` | `--accent-300` | text links                               | **7.13 / 8.05**         |

Four assignments carry a decision worth stating out loud, because a later reader will otherwise "fix" them:

**`--card` equals `--background`, deliberately.** In this direction a card is not a box; it is a block of text separated by a hairline and space (principle 4). Giving `--card` its own value would quietly reintroduce the panel look the direction rejects. Dialogs and popovers still get their own lighter surface via `--popover`, which is the only place elevation exists.

**`--accent` keeps shadcn's meaning, not the everyday English one.** In shadcn, `--accent` is the neutral hover surface consumed by `Button variant="ghost"` and `variant="outline"` (`hover:bg-accent hover:text-accent-foreground` in `src/components/ui/button.tsx`). Redefining it as the blue would turn every ghost hover blue. The blue is therefore `--ring` and `--link`, which are its two actual jobs.

**`--border` and `--input` are separated on purpose,** where shadcn ships them near-identical. A hairline between sections is decoration and may be quiet. A field's boundary is what identifies the control, so it needs 3:1 — WCAG 2.2 §1.4.11 Non-text Contrast `[STANDARD]`. Two tokens, two thresholds, and the test enforces the second one only.

**The dark body pair is `--ink-20` on `--ink-90` (14.8:1), not `--ink-05` on `--ink-90` (17.69:1).** Maximum contrast on a dark background produces halation for readers with astigmatism, which is a reading product's worst failure mode. Dark is not applied in this increment, but the value is chosen now so the later increment inherits it rather than re-deciding it.

#### Semantic roles

Each state gets a text/border colour and a matching surface tint, so `Notice` can be built later without inventing values. Every pair was measured; the surface tints are not decoration but the background the role's own text sits on.

**Light**

| Role                    | Value                    | Renders   | Text on page | Text on its own surface |
| ----------------------- | ------------------------ | --------- | ------------ | ----------------------- |
| `--destructive`         | `oklch(0.48 0.17 27)`    | `#a92321` | **6.84**     | **6.22**                |
| `--destructive-surface` | `oklch(0.955 0.022 27)`  | `#ffebe8` | —            | —                       |
| `--warning`             | `oklch(0.5 0.11 75)`     | `#875800` | **5.86**     | **5.36**                |
| `--warning-surface`     | `oklch(0.955 0.035 85)`  | `#fbefd6` | —            | —                       |
| `--success`             | `oklch(0.45 0.09 155)`   | `#23643f` | **6.81**     | **6.30**                |
| `--success-surface`     | `oklch(0.955 0.025 155)` | `#e4f5e9` | —            | —                       |
| `--info`                | `var(--accent-500)`      | `#0e5794` | **7.13**     | **6.54**                |
| `--info-surface`        | `oklch(0.955 0.022 250)` | `#e5f2ff` | —            | —                       |

**Dark**

| Role                    | Value                   | Renders   | Text on page | Text on its own surface |
| ----------------------- | ----------------------- | --------- | ------------ | ----------------------- |
| `--destructive`         | `oklch(0.71 0.16 27)`   | `#f57569` | **6.70**     | **5.40**                |
| `--destructive-surface` | `oklch(0.28 0.055 27)`  | `#401d1a` | —            | —                       |
| `--warning`             | `oklch(0.79 0.12 80)`   | `#e3b25a` | **9.45**     | **7.50**                |
| `--warning-surface`     | `oklch(0.28 0.05 80)`   | `#362607` | —            | —                       |
| `--success`             | `oklch(0.74 0.11 155)`  | `#6ebf8c` | **8.38**     | **6.52**                |
| `--success-surface`     | `oklch(0.28 0.04 155)`  | `#182f20` | —            | —                       |
| `--info`                | `var(--accent-300)`     | `#6db0f4` | **8.05**     | **6.35**                |
| `--info-surface`        | `oklch(0.28 0.045 250)` | `#172a3e` | —            | —                       |

`--destructive-foreground` is `#ffffff` in light (7.14:1 on the destructive fill) and `--ink-90` in dark. Today `button.tsx` hardcodes `text-white` for that case; the token exists so the primitives increment can stop doing that.

One value was moved by measurement: the light `--destructive-surface` was drafted at chroma 0.025 and falls outside the sRGB gamut, which browsers clamp silently. At 0.022 it is in gamut and the text on it still measures 6.22:1.

#### The draft surface — principle 7's token

Principle 7 requires that AI-generated, unsaved content never looks like a saved card. That treatment is built in the primitives increment, but its values belong here, otherwise that increment will invent them:

| Token                    | Light      | Dark       | Measured                                               |
| ------------------------ | ---------- | ---------- | ------------------------------------------------------ |
| `--surface-draft`        | `--ink-10` | `--ink-80` | 1.06 / 1.31 against the page — visible, quiet          |
| `--surface-draft-border` | `--ink-40` | `--ink-60` | 1.81 against the draft surface — carries a dashed rule |

Body text on the draft surface measures 16.69:1 (light) and 11.31:1 (dark); muted text on it measures 4.98:1, so a draft card can carry the same text roles as a saved one. The distinction is surface and rule, never colour alone — the state label is still required by principle 6.

#### Type, radius, shadow

These are theme-invariant, so they go in a plain `@theme` block rather than `@theme inline`.

**Families.** Two, with the split doing the work:

```css
--font-serif: "Iowan Old Style", Charter, "Bitstream Charter", "Sitka Text", Georgia, serif;
--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
```

`--font-serif` carries card content and prose; `--font-sans` carries all chrome; `--font-mono` exists only for the `<kbd>` hints already in `ReviewSession.tsx`. **Honest limitation:** this stack resolves to Iowan or Charter on Apple platforms, Sitka Text on Windows, Georgia where those are absent, and the platform's default serif on Android — so content typography varies by device. That is the accepted cost of shipping no self-hosted font in this increment; a single variable serif is the "Later" item that removes it.

**Sizes — four, and that is the whole scale.** Tailwind 4 pairs a line height with a size through the `--text-<name>--line-height` convention, so both land in one place:

```css
--text-display: 2rem;
--text-display--line-height: 1.15; /* page h1 */
--text-title: 1.25rem;
--text-title--line-height: 1.4; /* section h2, and card content in serif */
--text-body: 1rem;
--text-body--line-height: 1.55;
--text-meta: 0.8125rem;
--text-meta--line-height: 1.45; /* labels, counters, FRONT/BACK */
```

Card content and section headings share the 20px step and are told apart by family and weight, not by size. Content never goes below the `--text-title` step: a serif at 16px loses the legibility that justified choosing one.

**Measure.** `--container-content: 66ch`, so the reading column is a token rather than a `max-w-3xl` repeated on six pages.

**Radius.** `--radius: 0.375rem` (6px), down from the starter's `0.625rem`. The existing `@theme inline` block already derives `--radius-sm/md/lg/xl` from it; that derivation stays as is.

**Shadow — exactly one, named for the only place it is allowed:**

```css
--shadow-raised: 0 8px 24px -8px oklch(0.19 0.008 85 / 0.18), 0 2px 6px -2px oklch(0.19 0.008 85 / 0.12);
```

Principle 4 says shadows are for `Dialog`, `Popover`, `Tooltip` and `Toast` and nowhere else. Shipping one shadow token whose name says "raised" makes that rule self-documenting: a reviewer seeing `shadow-md` on a card knows it came from Tailwind's defaults, not from this system.

#### Tokens that are deleted

**`--chart-1` … `--chart-5` and the eight `--sidebar*` tokens go, from `:root`, `.dark` and `@theme inline`.** They are unused shadcn defaults; `.uxproof/conventions.md` already records that 13 of 31 colour tokens describe features this product does not have, and the chosen direction has neither a sidebar nor charts. Deleting them is safe: `grep -r "sidebar\|chart-" src/` returns nothing outside `global.css`. Leaving them in would be worse than untidy — they are the readiest excuse for a future screen to grow a chart the product decided against.

#### The one thing that must not happen

**Do not delete `bg-cosmic` in this increment, and do not remove `class="bg-cosmic"` from `Layout.astro`.**

The failure is not cosmetic. `body` already carries `@apply bg-background text-foreground`, overridden by the `bg-cosmic` utility. Delete the utility while 331 hardcoded classes still say `text-white` (53 occurrences), `text-blue-100/70` and `bg-white/10`, and every screen renders near-white text on a paper background — an app that is not merely ugly but unreadable, on a repo whose entire automated defence is three Playwright specs. The class is applied in ten files: `Layout.astro`, `Welcome.astro`, and the eight pages under `src/pages/`.

`bg-cosmic` is removed in the **last** screen-migration increment, in the same commit that removes the last `text-white`. Until then it stays, and this increment ships tokens that nothing yet consumes. That inertness is the feature: it is what makes the largest and most consequential change in strategy C also the one that cannot break anything.

---

### 📋 States

The states table from the handoff template does not apply: this increment renders no UI and has no empty, loading, error or permission state. It is recorded here rather than dropped so the omission reads as a decision. The user-visible state matrix arrives with the primitives increment, which is where `Notice`, `EmptyState` and `Field` get built from the tokens above.

The one observable behaviour worth naming: **after this increment, every screen looks exactly as it did before.** A visual difference of any kind means something consumed a token it should not have yet, and is a defect in this increment.

---

### 🤖 AI contract

Not applicable. This increment proposes no AI behaviour, changes no model, prompt or schema, and touches neither the generation endpoint nor the draft flow. Its only relationship to the product's AI is `--surface-draft`, which reserves the values that principle 7 ("a draft is visibly provisional") will need — the gate's behaviour itself remains the separate piece of work Phase 3 called strategy A, still waiting on the capture-loop test.

---

### 📋 Assumptions to confirm

- **`[ASSUMPTION]` The build needs no configuration change.** Tailwind 4 here is CSS-first through `@tailwindcss/vite` with no `tailwind.config`, so new `@theme` entries should generate utilities on rebuild. Confirm by checking that `bg-warning` and `text-meta` resolve after the change; if they do not, the namespace name is wrong, not the value.
- **`[FACT]` `oklch()` needs no fallback.** `src/styles/global.css` already ships every colour in `oklch` today, so this increment adds no browser-support risk that the product has not already accepted.
- **`[ASSUMPTION]` Nothing outside `global.css` reads the deleted tokens.** Verified by grep at the time of writing; re-run before deleting, because `astro sync` and the generated `.astro` types do not cover CSS.
- **`[ASSUMPTION]` `--container-content` does not collide.** Tailwind's `--container-*` namespace also drives `max-w-*` utilities; `--container-content` should produce `max-w-content`. Confirm the utility exists rather than assuming the name is free.
- **`[FACT]` Contrast numbers here are computed, not sampled.** They come from converting each `oklch` triple to sRGB and applying the WCAG relative-luminance formula, with out-of-gamut values clamped the way a browser clamps them. They are reproducible by the test named below, which is the point of writing it.

---

### ✅ Acceptance criteria

1. **Given** `src/styles/global.css` after the change, **when** its colour declarations are read, **then** every role token's value is a `var(--ink-*)` or `var(--accent-*)` reference, and no role token contains a colour literal.
2. **Given** the light palette, **when** contrast is computed for `--foreground`, `--muted-foreground`, `--primary-foreground` on `--primary`, `--destructive`, `--warning`, `--success` and `--info` against their stated backgrounds, **then** each meets 4.5:1, and `--input` and `--ring` each meet 3:1.
3. **Given** the dark palette, **when** the same computation runs, **then** the same thresholds hold, **and** `--foreground` on `--background` measures below 16:1 — the halation ceiling, which an over-eager "improvement" to the contrast would break.
4. **Given** `:root` and `.dark`, **when** their declared token names are compared, **then** the two sets are identical. A token in one block and not the other fails (principle 2).
5. **Given** the repository after the change, **when** `grep -rn "chart-\|sidebar" src/` runs, **then** it returns nothing.
6. **Given** the repository after the change, **when** `grep -rln "bg-cosmic" src/` runs, **then** it still returns the same eleven files it returns today (`global.css`, `Layout.astro`, `Welcome.astro`, and the eight pages). Removing it here is a failure, not progress.
7. **Given** `npm run lint`, `npm run build` and `npm test`, **when** each runs, **then** each passes.
8. **Given** the running app at `/dashboard`, `/generate`, `/library`, `/review`, `/settings` and `/auth/signin`, **when** each is opened before and after the change, **then** they are visually identical.

**How criteria 1–4 are checked, given there is no visual-regression coverage.** Add one test — `src/styles/tokens.test.ts`, colocated per the repo's testing convention — that parses `global.css`, extracts the ramp and the role assignments, converts `oklch` to sRGB, and asserts the pairs above. It is roughly eighty lines and it is the only durable guard this system gets: it turns "the palette is accessible" from a claim in a document into a failing test when someone darkens a token by 0.05. Criteria 5–8 are shell commands and a browser walk.

---

### ⚠️ Open decisions

- **Whether `--link` earns its own token, or links simply use `--ring`.** Two tokens with one value is duplication; one token doing two jobs is a name that lies. The recommendation is to keep both, because the dark-mode increment may well want a link that differs from the focus ring, and splitting a token later is more expensive than merging one. Owner: whoever builds the primitives increment.
- **Whether the eventual enforcement move is worth its blast radius.** Tailwind 4 supports `--color-*: initial` inside `@theme`, which deletes the default palette outright and makes `bg-blue-500`, `text-white` and `bg-white/10` stop existing at build time — turning principle 2 from a review rule into a compiler guarantee. It cannot happen now (it would silently unstyle 331 class usages), but it is the natural closing commit of strategy C. Flagging it here so the last increment is planned with it in mind rather than discovering it. Owner: the author, at the end of C.
- **The self-hosted serif.** Deferred, with the device-dependent content typography above as the accepted cost until then.

---

### 📋 Applied

AI necessity gate: not applicable — no AI behaviour in scope. Human-AI checklist: not applicable for the same reason; principle 7's tokens reserved for the increment that will need them. Value metrics: not applicable — this increment is deliberately invisible to users and is measured by contrast thresholds and unchanged screens, not by behaviour. Design contract: loaded (`.uxproof/contract.json`, `conventions.md` including the manual section and its eight principles); 15 registered components, 0 archetypes, both limitations already recorded in the contract. Evidence tiers: one `[STANDARD]` (WCAG 2.2 §1.4.11), four `[ASSUMPTION]` and two `[FACT]` labels, all in place. Contrast figures: computed, 40 pairs, zero failures at the stated thresholds. Quality rubric: passed, with the states section explicitly marked not-applicable rather than omitted.
