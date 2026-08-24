import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The design system's only durable guard.
 *
 * `.ai/specs/briefs/2026-08-22-token-layer-paper-ramp.md` tabulates ~40 contrast
 * pairs. A table in a document is a claim; this file turns it into a failing test
 * when someone darkens a token by 0.05. It re-parses `global.css` rather than
 * re-declaring the palette, so it cannot drift from what actually ships.
 *
 * The thresholds — not the tabulated decimals — are what is asserted, because the
 * brief's acceptance criteria are written as thresholds and because pinning
 * `17.69` would fail the build on a rounding difference while still passing a
 * genuinely inaccessible palette.
 */

const CSS = readFileSync(fileURLToPath(new URL("./global.css", import.meta.url)), "utf8");

// -- Stylesheet parsing ------------------------------------------------------

/** Strip comments so a token name mentioned in prose is never read as a declaration. */
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Custom-property declarations of one top-level block, by selector. Brace counting
 * (rather than a lazy `{...}` match) keeps this honest if a nested rule is ever
 * added inside the block.
 */
function declarationsOf(selector: string): Map<string, string> {
  const css = withoutComments(CSS);
  const start = css.indexOf(selector + " {");
  if (start === -1) throw new Error(`Block "${selector}" not found in global.css`);

  let depth = 0;
  let end = -1;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end === -1) throw new Error(`Block "${selector}" is unterminated in global.css`);

  const declarations = new Map<string, string>();
  for (const [, name, value] of css.slice(start, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    declarations.set(name, value.trim());
  }
  return declarations;
}

const light = declarationsOf(":root");
const dark = declarationsOf(".dark");

/**
 * The theme-invariant scales. `"@theme"` matches the plain block and not
 * `@theme inline {`, which is a different string.
 */
const themeScales = declarationsOf("@theme");

/**
 * Layer 1 — the value-named primitives: the neutral ramp plus the four semantic hue
 * families and the one pure white. Theme-invariant by design, so they are declared
 * once in `:root` and read from both ends rather than duplicated into `.dark`.
 */
const LAYER_1 = /^--(ink-\d{2}|blue-\d{3}|red-\d{3}|amber-\d{3}|green-\d{3}|white)$/;
const isRampToken = (name: string) => LAYER_1.test(name);

/** A legal layer-2 value: a bare `var()` reference into layer 1, and nothing else. */
const LAYER_2_VALUE = /^var\(--(ink-\d{2}|blue-\d{3}|red-\d{3}|amber-\d{3}|green-\d{3}|white)\)$/;

/** `--radius` is a length, not a colour role; it is the only non-colour token declared here. */
const NON_COLOUR_TOKENS = new Set(["--radius"]);

/**
 * Resolve a token to its `oklch` triple, following `var()` chains into layer 1.
 * A theme's own declaration wins; the shared ramp lives in `:root`.
 */
function resolve(token: string, theme: Map<string, string>): [number, number, number] {
  const seen = new Set<string>();
  let value = theme.get(token) ?? light.get(token);

  while (value?.startsWith("var(")) {
    const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value)?.[1];
    if (!ref) throw new Error(`Token ${token} has an unparseable var() value: ${value}`);
    if (seen.has(ref)) throw new Error(`Token ${token} resolves through a var() cycle at ${ref}`);
    seen.add(ref);
    value = theme.get(ref) ?? light.get(ref);
  }
  if (value === undefined) throw new Error(`Token ${token} is not declared in either theme`);

  if (value === "#ffffff") return [1, 0, 0]; // the one hex primitive: --white, in layer 1
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (!m) throw new Error(`Token ${token} resolves to an unsupported colour format: ${value}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// -- Colour maths ------------------------------------------------------------
// oklch -> OKLab -> linear sRGB -> gamma-encoded sRGB, then the WCAG 2.x
// relative-luminance formula. Out-of-gamut channels are clamped, which is the
// method the brief's own figures were computed with. A browser performs CSS
// Color 4 chroma reduction instead; for the one out-of-gamut value in this
// palette (light `--warning`) the two agree to two decimals, so the distinction
// does not change any verdict here.

function toSrgb([L, C, H]: [number, number, number]): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return linear.map((u) => {
    const encoded = u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, encoded));
  }) as [number, number, number];
}

function luminance(srgb: [number, number, number]): number {
  const [r, g, b] = srgb.map((u) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two tokens, resolved within one theme. */
function contrast(a: string, b: string, theme: Map<string, string>): number {
  const la = luminance(toSrgb(resolve(a, theme)));
  const lb = luminance(toSrgb(resolve(b, theme)));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// -- Acceptance criteria -----------------------------------------------------

/** The layer-2 role table. These are the tokens that may never hold a colour literal. */
const ROLE_TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--ring",
  "--link",
];

/** Body/label text that must clear WCAG AA for normal text. */
const TEXT_PAIRS: [string, string][] = [
  ["--foreground", "--background"],
  ["--muted-foreground", "--background"],
  ["--primary-foreground", "--primary"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--secondary-foreground", "--secondary"],
  ["--accent-foreground", "--accent"],
];

/** Each state's own text, on the page and on its matching surface tint. */
const SEMANTIC_ROLES = ["--destructive", "--warning", "--success", "--info"];

/** The layer-2 colour roles beyond the neutral set: the states, their surfaces, the draft pair. */
const SEMANTIC_ROLE_TOKENS = [
  ...SEMANTIC_ROLES,
  ...SEMANTIC_ROLES.map((r) => `${r}-surface`),
  "--destructive-foreground",
  "--surface-draft",
  "--surface-draft-border",
];

describe("criterion 1 — role tokens are references into the ramp, never literals", () => {
  it.each([
    ["light", light],
    ["dark", dark],
  ])("%s neutral role tokens all resolve through var()", (_theme, tokens) => {
    for (const token of ROLE_TOKENS) {
      expect(tokens.get(token), `${token} is not declared`).toMatch(LAYER_2_VALUE);
    }
  });

  it.each([
    ["light", light],
    ["dark", dark],
  ])("%s semantic role tokens all resolve through var()", (_theme, tokens) => {
    for (const token of SEMANTIC_ROLE_TOKENS) {
      expect(tokens.get(token), `${token} is not declared`).toMatch(LAYER_2_VALUE);
    }
  });

  // The invariant itself, stated once and enforced over everything actually
  // declared — not over a hand-maintained list, so a token added tomorrow is
  // covered without anyone remembering to add it here. There is no whitelist:
  // a colour literal anywhere in layer 2 fails the build, in either theme.
  it.each([
    ["light", light],
    ["dark", dark],
  ])("%s layer 2 contains no colour literal at all", (theme, tokens) => {
    const offenders = [...tokens.entries()]
      .filter(([name]) => !isRampToken(name) && !NON_COLOUR_TOKENS.has(name))
      .filter(([, value]) => !LAYER_2_VALUE.test(value))
      .map(([name, value]) => `${name}: ${value}`);

    expect(offenders, `${theme} layer 2 must reference layer 1 only`).toEqual([]);
  });

  it("layer 1 primitives are the only declarations holding a literal", () => {
    const literalBearing = [...light.entries()]
      .filter(([, value]) => !value.startsWith("var("))
      .map(([name]) => name)
      .filter((name) => !NON_COLOUR_TOKENS.has(name));

    // Every one of them is a layer-1 primitive. The assertion is on the property,
    // not on the roster, so adding a ramp step needs no edit here.
    expect(literalBearing.filter((name) => !isRampToken(name))).toEqual([]);
    expect(literalBearing.length).toBeGreaterThan(0);
  });

  // --shadow-raised is the one colour literal outside layer 1. It has to be a
  // literal: written as color-mix(in oklab, var(--ink-90) 18%, transparent),
  // Lightning CSS emits an @supports fallback that drops the alpha and paints an
  // opaque slab. So the value is copied — and this test is what stops the copy
  // from drifting, since --shadow-raised lives in the @theme block that the
  // layer-2 sweep above deliberately does not police.
  it("--shadow-raised is still made of --ink-90", () => {
    const shadow = themeScales.get("--shadow-raised") ?? "";
    expect(shadow, "--shadow-raised is not declared in the @theme block").not.toBe("");

    const ink90 = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(light.get("--ink-90") ?? "");
    if (ink90 === null) throw new Error("--ink-90 is not a plain oklch() triple");
    const [, inkL, inkC, inkH] = ink90;

    const layers = [...shadow.matchAll(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\/\s*([\d.]+)\s*\)/g)];
    expect(layers.length, "expected one oklch colour per shadow layer").toBe(2);

    for (const layer of layers) {
      const [whole, L, C, H, alpha] = layer;
      expect([L, C, H], `shadow layer "${whole}" no longer matches --ink-90`).toEqual([inkL, inkC, inkH]);
      // The alpha is the shadow's own decision and is intentionally not pinned to
      // a value; it only has to stay a shadow rather than an opaque fill.
      expect(Number(alpha)).toBeGreaterThan(0);
      expect(Number(alpha)).toBeLessThan(0.5);
    }
  });
});

describe("criterion 2 — the light palette meets its thresholds", () => {
  it.each(TEXT_PAIRS)("%s on %s clears 4.5:1", (fg, bg) => {
    expect(contrast(fg, bg, light)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SEMANTIC_ROLES)("%s clears 4.5:1 on the page and on its own surface", (role) => {
    expect(contrast(role, "--background", light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(role, `${role}-surface`, light)).toBeGreaterThanOrEqual(4.5);
  });

  it("--destructive-foreground clears 4.5:1 on the destructive fill", () => {
    expect(contrast("--destructive-foreground", "--destructive", light)).toBeGreaterThanOrEqual(4.5);
  });

  // WCAG 2.2 §1.4.11 Non-text Contrast: a control's own boundary and the focus
  // indicator identify the control, so 3:1 — unlike --border, which is decoration.
  it.each(["--input", "--ring"])("%s clears the 3:1 non-text threshold", (token) => {
    expect(contrast(token, "--background", light)).toBeGreaterThanOrEqual(3);
  });

  it("--border stays quieter than --input, which is the point of separating them", () => {
    expect(contrast("--border", "--background", light)).toBeLessThan(contrast("--input", "--background", light));
  });

  it("the draft surface carries body and muted text at AA", () => {
    expect(contrast("--foreground", "--surface-draft", light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--muted-foreground", "--surface-draft", light)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("criterion 3 — the dark palette meets the same thresholds, under a halation ceiling", () => {
  it.each(TEXT_PAIRS)("%s on %s clears 4.5:1", (fg, bg) => {
    expect(contrast(fg, bg, dark)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SEMANTIC_ROLES)("%s clears 4.5:1 on the page and on its own surface", (role) => {
    expect(contrast(role, "--background", dark)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(role, `${role}-surface`, dark)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["--input", "--ring"])("%s clears the 3:1 non-text threshold", (token) => {
    expect(contrast(token, "--background", dark)).toBeGreaterThanOrEqual(3);
  });

  it("--destructive-foreground clears 4.5:1 on the destructive fill", () => {
    expect(contrast("--destructive-foreground", "--destructive", dark)).toBeGreaterThanOrEqual(4.5);
  });

  it("the draft surface carries body and muted text at AA", () => {
    expect(contrast("--foreground", "--surface-draft", dark)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("--muted-foreground", "--surface-draft", dark)).toBeGreaterThanOrEqual(4.5);
  });

  // Maximum contrast on a dark background produces halation for readers with
  // astigmatism — a reading product's worst failure mode. The body pair is
  // --ink-20 on --ink-90 (14.8:1) rather than --ink-05 on --ink-90 (17.69:1),
  // and an over-eager "improvement" to the contrast would break this.
  it("--foreground on --background stays below the 16:1 halation ceiling", () => {
    const measured = contrast("--foreground", "--background", dark);
    expect(measured).toBeGreaterThanOrEqual(4.5);
    expect(measured).toBeLessThan(16);
  });
});

describe("criterion 4 — the two themes declare the same tokens (principle 2)", () => {
  it(":root and .dark declare identical role-token sets", () => {
    // The ramp is excluded because it is theme-invariant by design: dark mode is
    // a re-assignment of the same eleven steps, not a second palette. Duplicating
    // it into .dark would contradict the system. Same for --radius, which is a
    // theme-invariant scale rather than a colour role.
    const roles = (tokens: Map<string, string>) =>
      [...tokens.keys()].filter((name) => !isRampToken(name) && name !== "--radius").sort();

    expect(roles(dark)).toEqual(roles(light));
  });

  it("every role token resolves to a real colour in both themes", () => {
    for (const token of [...light.keys()].filter((name) => name !== "--radius")) {
      expect(() => resolve(token, light), `${token} (light)`).not.toThrow();
      expect(() => resolve(token, dark), `${token} (dark)`).not.toThrow();
    }
  });
});
