import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guards for the landing gateway, following the technique
 * src/pages/settings.test.ts and src/pages/generate.test.ts established: read a shipped
 * file as text and assert over it, rather than rendering — this repo has no jsdom/RTL
 * harness.
 *
 * The rendered half of these criteria — that the page paints ink-on-paper with no
 * gradient anywhere in the viewport, and that `scrollWidth` never exceeds the viewport
 * width — is not greppable. It is verified by the browser walk in
 * `.ai/runs/2026-08-26-bg-cosmic-cleanup/ui-walk.mjs` and recorded in the PR.
 *
 * Source: .ai/specs/2026-08-26-bg-cosmic-cleanup.md
 */

const PAGES_DIR = fileURLToPath(new URL(".", import.meta.url));
const page = readFileSync(join(PAGES_DIR, "index.astro"), "utf8");

/**
 * The page with its Astro comment blocks removed.
 *
 * The gateway documents its own choices in an Astro comment block — which prettier
 * reformats onto its own lines, so the pattern below tolerates whitespace inside the
 * braces — and that prose quotes
 * the very markup some of these assertions count — the link-as-button pattern, spelled
 * out. Counting against the raw source therefore reports two filled controls where the
 * page renders one. Assertions about *what the page renders* read this; assertions about
 * what the file must not contain anywhere (colour literals, legacy utilities) keep
 * reading the raw source, because a legacy class is not made acceptable by sitting in a
 * comment.
 */
const markup = page.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");

describe("AC2 — the landing carries no colour literal and no palette-scale utility", () => {
  it("has no hex, rgb() or oklch() colour literal", () => {
    expect(page).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(page).not.toMatch(/\brgba?\(/);
    expect(page).not.toMatch(/\boklch\(/);
  });

  it("uses no Tailwind palette-scale colour utility", () => {
    const paletteHues =
      "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
    expect(page).not.toMatch(new RegExp(`\\b(?:bg|text|border|from|to|via)-(?:${paletteHues})-\\d{2,3}\\b`));
  });

  it("uses no white/N or black/N opacity utility", () => {
    expect(page).not.toMatch(/\b(?:bg|text|border|from|to|via)-(?:white|black)\/\d{1,3}\b/);
  });
});

describe("AC3 — no legacy surface utility survives on the landing", () => {
  // The glass recipe Welcome.astro carried. `shadow-` is included because Paper allows
  // exactly one shadow and it belongs to Dialog, Popover, Tooltip and Toast — never to a
  // page.
  const LEGACY = [
    /\bbg-cosmic\b/,
    /\bbackdrop-blur/,
    /\brounded-2xl\b/,
    /\bbg-gradient-to-/,
    /\btext-white\b/,
    /\bshadow-/,
  ];

  it.each(LEGACY.map((pattern) => [String(pattern), pattern] as const))("carries no %s", (_label, pattern) => {
    expect(page).not.toMatch(pattern);
  });

  it("carries no decorative svg — the orbs and the star field went with Welcome.astro", () => {
    expect(page).not.toMatch(/<svg\b/);
  });
});

describe("AC4 — the gateway is a heading, a sentence and two controls", () => {
  it("paints its own Paper ground on the house wrapper recipe", () => {
    expect(page).toMatch(/<div class="bg-background text-foreground min-h-screen p-4">/);
  });

  it("names the product and the job through PageHeader, not a hand-rolled h1", () => {
    expect(page).toMatch(/<PageHeader\s+title="10xCards"/);
    expect(page).toMatch(/description="Paste what you're reading\. Keep the cards worth keeping\."/);
    expect(page).not.toMatch(/<h1\b/);
  });

  it("offers exactly one filled control and exactly one outline control", () => {
    // The filled one is the bare call; the outline one names its variant. Counting both
    // is what stops a second primary action being added without a decision.
    //
    const bare = markup.match(/class:list=\{buttonVariants\(\)\}/g) ?? [];
    const outline = markup.match(/class:list=\{buttonVariants\(\{\s*variant:\s*"outline"\s*\}\)\}/g) ?? [];
    expect(bare).toHaveLength(1);
    expect(outline).toHaveLength(1);
  });

  it("wires those controls to the two auth routes", () => {
    expect(page).toMatch(/href="\/auth\/signin"/);
    expect(page).toMatch(/href="\/auth\/signup"/);
  });

  it("stacks the control row below 640px", () => {
    expect(page).toMatch(/class="flex flex-col gap-3 sm:flex-row"/);
  });

  it("adds no island — the landing stays React-free", () => {
    expect(page).not.toMatch(/client:/);
  });
});

describe("AC5 — the signed-in redirect is untouched", () => {
  it("still sends an authenticated visitor to /dashboard", () => {
    expect(page).toMatch(/if \(Astro\.locals\.user\) \{/);
    expect(page).toMatch(/return Astro\.redirect\("\/dashboard"\);/);
  });
});

describe("AC10 — the starter marketing page is gone, not merely unreferenced", () => {
  it("does not import Welcome.astro", () => {
    expect(page).not.toMatch(/Welcome/);
  });

  it("does not import Topbar either — Layout renders it, and only for a signed-in user", () => {
    expect(page).not.toMatch(/Topbar/);
  });
});
