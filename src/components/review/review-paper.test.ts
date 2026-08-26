import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guards for the /review Paper migration, following the technique
 * src/styles/tokens.test.ts and src/components/ui/primitives.test.ts established:
 * read a shipped file as text and assert over it, rather than rendering — this
 * repo has no jsdom/RTL harness.
 *
 * These cover the acceptance criteria a grep can genuinely settle. The clauses
 * about *rendered* size, contrast, and viewport coverage (AC1's second clause,
 * AC2's second clause, AC3, AC6's second clause, AC9) are verified by manual
 * walkthrough instead, and are listed as such in the spec's verification table.
 *
 * Source: .ai/specs/2026-08-25-screen-migration-review.md
 */

const REVIEW_DIR = fileURLToPath(new URL(".", import.meta.url));
const SRC_DIR = fileURLToPath(new URL("../..", import.meta.url));

const session = readFileSync(join(REVIEW_DIR, "ReviewSession.tsx"), "utf8");
const page = readFileSync(join(SRC_DIR, "pages", "review.astro"), "utf8");

const FILES: [name: string, source: string][] = [
  ["ReviewSession.tsx", session],
  ["review.astro", page],
];

describe("AC1 — no legacy utility survives on /review", () => {
  // The legacy recipe this migration removes. `bg-cosmic` is the body gradient
  // Layout.astro still ships; the rest are the glass-card treatment.
  const LEGACY = [/\bbg-cosmic\b/, /\bbackdrop-blur/, /\brounded-2xl\b/, /\bbg-gradient-to-/];

  it.each(FILES)("%s carries no legacy surface utility", (_name, source) => {
    for (const pattern of LEGACY) {
      expect(source).not.toMatch(pattern);
    }
  });

  // Palette-scale utilities (text-blue-100/70, border-red-500/30, bg-green-900/20)
  // are what principle 2 replaces with role tokens. Matches `<utility>-<colour>-<scale>`
  // for the Tailwind palette families this screen used.
  const PALETTE_SCALE =
    /\b(?:bg|text|border|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

  it.each(FILES)("%s carries no Tailwind palette-scale colour utility", (_name, source) => {
    expect(source).not.toMatch(PALETTE_SCALE);
  });

  it("the page paints its own Paper ground instead of relying on the body gradient", () => {
    expect(page).toMatch(/bg-background text-foreground min-h-screen/);
    expect(page).toMatch(/max-w-content/);
  });
});

describe("AC2 — the card face is the hero, and its content sits at the token floor", () => {
  // global.css:239 — "Content never goes below --text-title". The back of a card
  // is content, so both faces sit at text-title; the hairline and the BACK label
  // do the distinguishing, not a size step.
  it("both the front and the back render at text-title in the serif, and break long strings", () => {
    const faces = session.match(/text-foreground text-title mt-1 font-serif break-words/g) ?? [];
    expect(faces).toHaveLength(2);
  });

  it("the FRONT and BACK labels sit at text-meta, below the content", () => {
    const labels = session.match(/text-meta text-muted-foreground tracking-wide uppercase/g) ?? [];
    expect(labels).toHaveLength(2);
  });

  it("the card face is the only bordered surface in the active session", () => {
    expect(session).toMatch(/border-border bg-card space-y-3 rounded-lg border p-6/);
    // The session container itself lost its box.
    expect(session).toMatch(/<section className="space-y-4">/);
  });

  it("the progress counter and the shortcut hints sit at text-meta", () => {
    expect(session).toMatch(/<p className="text-meta text-muted-foreground">\s*\n\s*Card \{index \+ 1\} of/);
    expect(session).toMatch(/text-meta text-muted-foreground flex flex-wrap/);
  });
});

describe("AC5 — a failed rating is announced", () => {
  it("the rating error renders through Notice's error variant", () => {
    expect(session).toMatch(/\{error && <Notice variant="error">\{error\.message\}<\/Notice>\}/);
  });

  it("no hand-rolled error paragraph remains", () => {
    expect(session).not.toMatch(/<p className="flex items-center gap-2 rounded-lg border/);
  });

  // The role="alert" / aria-live="assertive" mapping itself is guaranteed by
  // src/components/ui/primitives.test.ts criterion 1; this file only proves
  // /review routes its error through that variant.
});

describe("AC6 — the rating buttons are distinguished by tier, not by colour", () => {
  // Assert over the code with comments stripped, not over a fixed-width slice
  // around the two buttons: a slice silently stops covering the Right button if
  // its JSX grows, and the file-wide alternative trips over the prose comment
  // that explains *why* these tokens are not licensed here.
  const code = session.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("Wrong is the Secondary tier and Right is Primary", () => {
    expect(session).toMatch(/variant="outline"[\s\S]{0,200}aria-keyshortcuts="1"/);
    expect(session).toMatch(/variant="default"[\s\S]{0,200}aria-keyshortcuts="2"/);
  });

  it("neither rating button nor either glyph carries a semantic-colour token", () => {
    expect(code).not.toMatch(/destructive/);
    expect(code).not.toMatch(/success/);
  });

  it("the revealed view contains exactly one filled button", () => {
    // The reveal button is not rendered once revealed, so `default` appears twice
    // in the file but never twice in one view: once for reveal, once for Right.
    const filled = session.match(/variant="default"/g) ?? [];
    expect(filled).toHaveLength(2);
  });

  it("both labels and both glyphs survive, so the distinction never rests on fill alone", () => {
    expect(session).toMatch(/<X className="size-4" \/>/);
    expect(session).toMatch(/<Check className="size-4" \/>/);
    expect(session).toContain("Wrong");
    expect(session).toContain("Right");
  });
});

describe("AC7 — EmptyState replaces the duplicated DoneCard", () => {
  it("DoneCard is gone from the component", () => {
    expect(session).not.toMatch(/DoneCard/);
  });

  it("EmptyState is imported and used for both terminal states", () => {
    expect(session).toMatch(/import \{ EmptyState \} from "@\/components\/ui\/EmptyState"/);
    const uses = session.match(/<EmptyState/g) ?? [];
    expect(uses).toHaveLength(2);
  });

  it("the load error is an error notice, not an empty state", () => {
    expect(session).toMatch(/<Notice variant="error" title="Could not load your review session">/);
  });
});

describe("the interaction layer is frozen", () => {
  it("the three keyboard shortcuts keep their accessible bindings", () => {
    expect(session).toMatch(/aria-keyshortcuts="Space"/);
    expect(session).toMatch(/aria-keyshortcuts="1"/);
    expect(session).toMatch(/aria-keyshortcuts="2"/);
  });

  it("the re-entrancy guard and the shortcut resolver are still wired", () => {
    expect(session).toMatch(/lockRef\.current = true/);
    expect(session).toMatch(/resolveReviewShortcut\(/);
  });

  it("the /api/reviews payload is unchanged", () => {
    expect(session).toMatch(/JSON\.stringify\(\{ cardId: card\.id, rating, currentBox: card\.repetition_count \}\)/);
  });

  it("every accessible name the E2E suites assert is preserved", () => {
    expect(page).toMatch(/title="Review session"/);
    for (const name of ["Reveal answer", "Restart session", "Restart", "Wrong", "Right", "Space"]) {
      expect(session).toContain(name);
    }
  });
});
