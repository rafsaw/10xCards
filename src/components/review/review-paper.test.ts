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

  it("the progress counter and the hint line sit at text-meta", () => {
    expect(session).toMatch(/<p className="text-meta text-muted-foreground">\s*\n\s*Card \{index \+ 1\} of/);
    // #82 folded the shortcut-hint footer into the hint line above the row; the
    // line it became still sits at text-meta.
    expect(session).toMatch(/text-meta text-muted-foreground flex h-7 /);
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

describe("AC6 — the four rating buttons are distinguished by tier, not by colour", () => {
  // Assert over the code with comments stripped, not over a fixed-width slice
  // around the buttons: a slice silently stops covering the last button if the
  // JSX grows, and the file-wide alternative trips over the prose comment that
  // explains *why* these tokens are not licensed here.
  const code = session.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // Each `<Button …>…</Button>` element as its own slice, so a claim about "the
  // Good button" cannot accidentally be satisfied by a neighbour's props.
  const buttonBlocks = session.split("<Button").slice(1);
  function buttonFor(keyshortcut: string): string {
    return buttonBlocks.find((block) => block.includes(`aria-keyshortcuts="${keyshortcut}"`)) ?? "";
  }

  // The row, written out from spec #76: Again / Hard / Good / Easy left to right
  // on keys 1-4, Good the only filled one.
  const RATINGS: [key: string, label: string, variant: string][] = [
    ["1", "Again", "outline"],
    ["2", "Hard", "outline"],
    ["3", "Good", "default"],
    ["4", "Easy", "outline"],
  ];

  it.each(RATINGS)("key %s is the %s button at the %s tier", (key, label, variant) => {
    const block = buttonFor(key);
    expect(block).not.toBe("");
    expect(block).toContain(`variant="${variant}"`);
    expect(block).toContain(label);
  });

  it.each(RATINGS)("key %s shows its digit hint in the %s button itself", (key, label) => {
    // `Again 1` … `Easy 4`: the shortcut must not be sighted-only knowledge.
    expect(buttonFor(key)).toMatch(new RegExp(`${label}\\s*<KeyHint>${key}</KeyHint>`));
  });

  it("all four digit hints are styled identically, so only the grouping sets Again apart", () => {
    // One definition, four uses: Again's hint cannot drift from the other three.
    expect(session).toMatch(/function KeyHint\(\{ children \}/);
    const hints = session.match(/<KeyHint>\d<\/KeyHint>/g) ?? [];
    expect(hints).toHaveLength(4);
  });

  it("Again is detached from the Hard / Good / Easy group", () => {
    // Again is a different kind of statement ("I did not know this"); the other
    // three are a dial on one statement. The layout has to say so.
    const againAt = session.indexOf('aria-keyshortcuts="1"');
    const groupAt = session.indexOf('role="group"');
    const hardAt = session.indexOf('aria-keyshortcuts="2"');
    expect(againAt).toBeGreaterThan(-1);
    expect(groupAt).toBeGreaterThan(againAt);
    expect(hardAt).toBeGreaterThan(groupAt);
    // The gap detaches Again from the group; inside the group the segments are
    // flush (no gap) and only the outer corners stay rounded.
    expect(session).toContain('<div className="flex items-stretch gap-6">');
    expect(session).toContain('<div className="flex flex-[3] items-stretch" role="group"');
    for (const corner of ["rounded-r-none", "rounded-none", "rounded-l-none"]) {
      expect(session).toContain(`flex-1 ${corner}`);
    }
  });

  it("neither rating button nor its spinner carries a semantic-colour token", () => {
    expect(code).not.toMatch(/destructive/);
    expect(code).not.toMatch(/success/);
  });

  it("the revealed view contains exactly one filled button", () => {
    // The reveal button is not rendered once revealed, so `default` appears twice
    // in the file but never twice in one view: once for reveal, once for Good.
    const filled = session.match(/variant="default"/g) ?? [];
    expect(filled).toHaveLength(2);
  });

  it("the rating in flight shows a spinner on that specific button", () => {
    for (const [, label] of RATINGS) {
      const rating = label.toLowerCase();
      expect(session).toContain(`submitting && pendingRating === "${rating}" ?`);
    }
    const spinners = session.match(/<Loader2 className="size-4 animate-spin" \/>/g) ?? [];
    expect(spinners).toHaveLength(4);
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
  it("the five keyboard shortcuts keep their accessible bindings", () => {
    for (const shortcut of ["Space", "1", "2", "3", "4"]) {
      expect(session).toMatch(new RegExp(`aria-keyshortcuts="${shortcut}"`));
    }
  });

  it("the re-entrancy guard and the shortcut resolver are still wired", () => {
    expect(session).toMatch(/lockRef\.current = true/);
    expect(session).toMatch(/resolveReviewShortcut\(/);
  });

  it("the /api/reviews payload echoes the card's SM-2 scheduler state", () => {
    // The endpoint guards its write on all three columns (ADR 0002), so the body
    // must carry all three — dropping one turns every rating into applied:false.
    expect(session).toMatch(
      /JSON\.stringify\(\{\s*cardId: card\.id,\s*rating,\s*currentRepetition: card\.repetition,\s*currentEfactor: card\.efactor,\s*currentIntervalDays: card\.interval_days,\s*\}\)/,
    );
  });

  it("every accessible name the E2E suites assert is preserved", () => {
    expect(page).toMatch(/title="Review session"/);
    for (const name of ["Reveal answer", "Restart session", "Restart", "Again", "Hard", "Good", "Easy", "Space"]) {
      expect(session).toContain(name);
    }
  });
});

describe("#82 — the predicted interval lives in one fixed-height line, not on the buttons", () => {
  // Only the STRUCTURAL facts live here (spec #76, testing seam 6): the line
  // exists, it is always rendered, and no interval string reaches a button. The
  // hint's *behaviour* — hover and focus actually driving the text — is proven
  // in tests/e2e/review-interval-hint.spec.ts, because hover and focus are only
  // real in a browser and a grep would prove a pattern, not a behaviour.
  const PLACEHOLDER = "hover or tab a rating to see when it comes back";

  it("the discoverability placeholder is written out once, verbatim from the ticket", () => {
    const occurrences = session.split(PLACEHOLDER).length - 1;
    expect(occurrences).toBe(1);
  });

  it("the hint line is rendered unconditionally, above the button slot", () => {
    // Inside the `revealed` branch the line would appear only once the ratings
    // are on screen, pushing the row down as it mounted — the reflow AC4 forbids.
    const hintAt = session.indexOf("{hintLine}");
    const slotAt = session.indexOf("{!revealed ? (");
    expect(hintAt).toBeGreaterThan(-1);
    expect(slotAt).toBeGreaterThan(hintAt);
  });

  it("the line reserves exactly one text-meta line, in every state", () => {
    // AC4's mechanism: a fixed `h-7` (1.75rem, above the tallest of the three
    // states) plus `truncate`, so neither the longer placeholder nor a narrow
    // viewport can wrap the line to two and push the rating row down.
    expect(session).toMatch(/<p className="[^"]*\bflex h-7 items-center[^"]*\btruncate">/);
  });

  it("the Space shortcut hint survives the slot takeover", () => {
    // #82 reuses the shortcut-hint slot. Space is the only key that does anything
    // before the reveal, so the hint has to still be there while it is true.
    expect(session).toMatch(/!revealed \? \(\s*<>\s*<Kbd>Space<\/Kbd> Reveal\s*<\/>/);
    expect(session).toContain('aria-keyshortcuts="Space"');
  });

  it("no rating button prints an interval", () => {
    // The rejected prototype variant: three near-identical numbers on the row.
    // The interval string must exist exactly once, and not inside a button.
    const buttonBlocks = session.split("<Button").slice(1);
    for (const block of buttonBlocks) {
      expect(block.slice(0, block.indexOf("</Button>"))).not.toMatch(/back in|interval_days/);
    }
    expect(session.split("back in").length - 1).toBe(1);
  });

  it("the interval comes from the shared scheduler, not a second copy of it", () => {
    // AC6 ("matches what the server would schedule") is only structurally
    // guaranteed by calling the same pure function the endpoint calls, on the
    // state the card echoed back, for the one rating being inspected.
    expect(session).toMatch(/import \{ schedule, type Rating \} from "@\/lib\/sm2"/);
    expect(session).toMatch(/schedule\(card, inspected, 0\)\.interval_days/);
    expect(session.split("schedule(").length - 1).toBe(1);
    // None of SM-2's constants may be restated on the client.
    for (const constant of ["1.3", "0.14", "2.5", "Math.ceil"]) {
      expect(session).not.toContain(constant);
    }
  });
});
