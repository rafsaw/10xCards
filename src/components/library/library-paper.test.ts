import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guards for the /library Paper migration, following the technique
 * src/styles/tokens.test.ts, src/components/ui/primitives.test.ts and
 * src/components/review/review-paper.test.ts established: read a shipped file as
 * text and assert over it, rather than rendering — this repo has no jsdom/RTL
 * harness.
 *
 * These cover the acceptance criteria a grep can genuinely settle. The clauses
 * about *rendered* size, contrast and viewport coverage (AC1's second clause,
 * AC2's second clause, AC3, AC6's second clause, AC11, AC12) are verified by
 * manual walkthrough instead, and are listed as such in the spec's verification
 * table.
 *
 * Source: .ai/specs/2026-08-25-screen-migration-library.md
 */

const LIBRARY_DIR = fileURLToPath(new URL(".", import.meta.url));
const SRC_DIR = fileURLToPath(new URL("../..", import.meta.url));

const createForm = readFileSync(join(LIBRARY_DIR, "CreateCardForm.tsx"), "utf8");
const cardRow = readFileSync(join(LIBRARY_DIR, "CardRow.tsx"), "utf8");
const libraryEmpty = readFileSync(join(LIBRARY_DIR, "LibraryEmpty.tsx"), "utf8");
const search = readFileSync(join(LIBRARY_DIR, "LibrarySearch.astro"), "utf8");
const page = readFileSync(join(SRC_DIR, "pages", "library.astro"), "utf8");

const FILES: [name: string, source: string][] = [
  ["CreateCardForm.tsx", createForm],
  ["CardRow.tsx", cardRow],
  ["LibraryEmpty.tsx", libraryEmpty],
  ["LibrarySearch.astro", search],
  ["library.astro", page],
];

describe("AC1 — no legacy utility survives on /library", () => {
  const LEGACY = [/\bbg-cosmic\b/, /\bbackdrop-blur/, /\brounded-2xl\b/, /\bbg-gradient-to-/];

  it.each(FILES)("%s carries no legacy surface utility", (_name, source) => {
    for (const pattern of LEGACY) {
      expect(source).not.toMatch(pattern);
    }
  });

  const PALETTE_SCALE =
    /\b(?:bg|text|border|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

  it.each(FILES)("%s carries no Tailwind palette-scale colour utility", (_name, source) => {
    expect(source).not.toMatch(PALETTE_SCALE);
  });

  it("the page paints its own Paper ground instead of relying on the body gradient", () => {
    expect(page).toMatch(/bg-background text-foreground min-h-screen/);
  });

  it("the page keeps the max-w-3xl measure it already renders at (the recorded Q3b exception)", () => {
    expect(page).toMatch(/mx-auto max-w-3xl space-y-8 py-8/);
  });
});

describe("AC2 — the saved row's two faces are the hero, at the content floor", () => {
  it("front and back both render at text-title in the serif, and break long strings", () => {
    expect(cardRow).toMatch(/text-foreground text-title font-serif break-words/);
    expect(cardRow).toMatch(/text-muted-foreground text-title mt-1 font-serif break-words/);
  });

  it("the row separates by hairline and space, with no background fill", () => {
    expect(cardRow).toMatch(/<li className="border-border rounded-lg border p-4">/);
  });

  it("below sm the actions stack under the content, so the front keeps the full width", () => {
    // UX review finding 1: inline at 390px, Edit + Delete took ~150px of the row and
    // wrapped the front onto extra lines — chrome outranking content (principle 3).
    // The row is column-first and only goes side-by-side from sm up.
    expect(cardRow).toMatch(/flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4/);
    expect(cardRow).not.toMatch(/<div className="flex items-start justify-between gap-4">/);
  });

  it("the actions keep their source order, so tab order and both labels are unchanged", () => {
    const display = cardRow.slice(cardRow.indexOf("sm:justify-between"));
    expect(display.indexOf("{card.front}")).toBeLessThan(display.indexOf("Edit"));
    expect(display.indexOf("Edit")).toBeLessThan(display.indexOf("Delete"));
  });
});

describe("AC5 — every error is announced through Notice", () => {
  it("both islands route their error through Notice variant=error", () => {
    expect(createForm).toMatch(/<Notice variant="error">\{error\.message\}<\/Notice>/);
    expect(cardRow).toMatch(/<Notice variant="error">\{error\.message\}<\/Notice>/);
  });

  it("neither island keeps a hand-rolled error paragraph", () => {
    for (const source of [createForm, cardRow]) {
      expect(source).not.toMatch(/CircleAlert/);
    }
  });

  it("the page's two load errors go through Notice too", () => {
    expect(page).toMatch(/<Notice variant="error">Supabase is not configured/);
    expect(page).toMatch(/<Notice variant="error">Could not load your cards/);
  });
});

describe("AC6 — the search input has a programmatic label", () => {
  it("the label is bound to the input by id and reads Search cards", () => {
    expect(search).toMatch(/<label for="library-search" class="sr-only">Search cards<\/label>/);
    expect(search).toMatch(/id="library-search"/);
  });

  it("the label text collides with neither Front nor Back", () => {
    const label = /<label for="library-search"[^>]*>([^<]*)<\/label>/.exec(search)?.[1] ?? "";
    expect(label).not.toMatch(/Front|Back/);
  });
});

describe("AC7 — Field has exactly four call sites and no literal textarea survives", () => {
  it("both islands import Field", () => {
    expect(createForm).toMatch(/import \{ Field \} from "@\/components\/ui\/Field"/);
    expect(cardRow).toMatch(/import \{ Field \} from "@\/components\/ui\/Field"/);
  });

  it("there are exactly four Field call sites across the two islands", () => {
    const calls = [createForm, cardRow].reduce((total, source) => total + (source.match(/<Field\b/g) ?? []).length, 0);
    expect(calls).toBe(4);
  });

  it("neither island contains a literal textarea any more", () => {
    for (const source of [createForm, cardRow]) {
      expect(source).not.toMatch(/<textarea/);
    }
  });
});

describe("AC8 — the Card deferral is closed by removal, with the reason recorded", () => {
  it("no Card.tsx exists under src/components/ui/", () => {
    const cardPath = fileURLToPath(new URL("../ui/Card.tsx", import.meta.url));
    expect(() => statSync(cardPath)).toThrow();
  });

  it("principle 8 lists the five shipped primitives and not Card", () => {
    const conventions = readFileSync(
      fileURLToPath(new URL("../../../.uxproof/conventions.md", import.meta.url)),
      "utf8",
    );
    const principle = /8\. \*\*One shell, one page skeleton\.\*\*([\s\S]*?)\n\n/.exec(conventions)?.[1] ?? "";
    expect(principle).not.toBe("");
    expect(principle).toMatch(/`PageHeader`,\s*\n?\s*`Section`, `Notice`, `EmptyState`, `Field`/);
    expect(principle).toMatch(/`Card` is deliberately not in the registry/);
  });
});

describe("AC9 — one filled button on the screen; row actions and pagination stay quiet", () => {
  it("Create card is the screen's one default-variant Button", () => {
    // The submit carries no `variant`, so it takes the filled default.
    expect(createForm).toMatch(/<Button type="submit" className="w-full" disabled=\{submitting \|\| !canSubmit\}>/);
    // Notice carries a variant of its own; this is about Button variants only.
    expect(createForm).not.toMatch(/<Button[^>]*variant="/);
    expect((createForm.match(/<Button\b/g) ?? []).length).toBe(1);
  });

  it("outside edit mode every CardRow action is ghost", () => {
    expect(cardRow).toMatch(/variant="ghost"[\s\S]*?Edit/);
    expect(cardRow).toMatch(/variant="ghost"[\s\S]*?Delete/);
    expect(cardRow).not.toMatch(/variant="destructive"/);
  });

  it("Delete keeps its destructive tint through hover and keyboard focus", () => {
    // The ghost variant ships `hover:text-accent-foreground`. tailwind-merge keeps a
    // base utility and a hover: variant side by side, so `text-destructive` alone is
    // silently overridden on hover. Fixed at the call site rather than by widening the
    // shared Button contract with a destructive-ghost variant no second caller wants.
    expect(cardRow).toMatch(/className="text-destructive hover:text-destructive focus-visible:text-destructive"/);
  });

  it("pagination renders links and disabled spans, never Buttons", () => {
    const nav = /<nav[\s\S]*?<\/nav>/.exec(page)?.[0] ?? "";
    expect(nav).not.toBe("");
    expect(nav).not.toMatch(/<Button/);
    expect((nav.match(/text-link text-sm underline underline-offset-4/g) ?? []).length).toBe(2);
    expect((nav.match(/aria-disabled="true"/g) ?? []).length).toBe(2);
    expect(nav).toMatch(/aria-label="Library pagination"/);
    expect(nav).toMatch(/Page \{effectivePage\} of \{totalPages\}/);
  });
});

describe("AC12 — a saved row and a draft row are visibly different surfaces (principle 7)", () => {
  // The two surfaces must not converge as either screen evolves. This pins the
  // distinction at the token level, where it actually lives:
  //   saved row  — no fill; the page's own --background (--ink-05) shows through,
  //                separated by the neutral --border hairline (--ink-30).
  //   draft row  — an explicit --surface-draft fill (--ink-10) inside a stronger
  //                --surface-draft-border (--ink-40).
  // A draft is therefore both filled and more heavily outlined than a saved card,
  // which is what keeps "AI proposes, the human decides" visible rather than merely
  // implemented. Colour is not the only carrier: /generate also labels its drafts.
  const draftList = readFileSync(join(SRC_DIR, "components", "generate", "DraftReviewList.tsx"), "utf8");

  it("the draft row carries the draft fill and the draft border", () => {
    expect(draftList).toMatch(/border-surface-draft-border bg-surface-draft/);
  });

  it("the saved row carries neither the draft fill nor any background fill of its own", () => {
    expect(cardRow).not.toMatch(/bg-surface-draft/);
    expect(cardRow).not.toMatch(/<li className="[^"]*\bbg-/);
  });

  it("the two surfaces do not share a class list", () => {
    const savedSurface = /<li className="([^"]*)">/.exec(cardRow)?.[1] ?? "";
    expect(savedSurface).not.toBe("");
    expect(draftList).not.toMatch(new RegExp(`className="${savedSurface}"`));
  });
});

describe("AC10 — each empty branch renders one region, and the empty library has no search row", () => {
  it("the empty-search branch pairs LibrarySearch with LibraryEmpty, outside any Section", () => {
    expect(page).toMatch(
      /\) : q \? \(\s*\n\s*<div class="space-y-4">\s*\n\s*<LibrarySearch q=\{q\} \/>\s*\n\s*<LibraryEmpty q=\{q\} \/>/,
    );
  });

  it("the empty-library branch renders LibraryEmpty alone — nothing to filter", () => {
    expect(page).toMatch(/\) : \(\s*\n\s*<LibraryEmpty \/>\s*\n\s*\)/);
  });

  it("both EmptyState copies are verbatim, with their outline anchor actions", () => {
    expect(libraryEmpty).toMatch(/title="No cards match your search"/);
    expect(libraryEmpty).toMatch(
      /Nothing in your library matches “\$\{q\}”\. Try a different word, or clear the search\./,
    );
    expect(libraryEmpty).toMatch(/<a href="\/library">Clear search<\/a>/);
    expect(libraryEmpty).toMatch(/title="Your library is empty"/);
    expect(libraryEmpty).toMatch(
      /Cards you save appear here\. Create one above, or generate a batch from a passage of text\./,
    );
    expect(libraryEmpty).toMatch(/<a href="\/generate">Generate cards<\/a>/);
    expect((libraryEmpty.match(/<Button asChild variant="outline" size="sm">/g) ?? []).length).toBe(2);
  });
});

describe("the data layer is frozen — this increment rewrote markup only", () => {
  it("the page size, the query filter and the search sanitiser survive verbatim", () => {
    expect(page).toMatch(/const PAGE_SIZE = 20;/);
    expect(page).toMatch(/const safeQ = q\.replace\(\/\[,\(\)"\]\/g, " "\)\.trim\(\);/);
    expect(page).toMatch(/const orFilter = safeQ \? `front\.ilike\.%\$\{safeQ\}%,back\.ilike\.%\$\{safeQ\}%` : null;/);
  });

  it("buildHref and the out-of-range URL rewrite survive verbatim", () => {
    expect(page).toMatch(/const buildHref = \(p: number\) => \{/);
    expect(page).toMatch(/window\.history\.replaceState\(null, "", href\);/);
    expect(page).toMatch(/const shouldFixPageUrl = !loadError && supabase && page > lastPage;/);
  });

  it("all three post-mutation reloads survive", () => {
    const reloads = [createForm, cardRow].reduce(
      (total, source) => total + (source.match(/window\.location\.assign\("\/library"\)/g) ?? []).length,
      0,
    );
    expect(reloads).toBe(3);
  });

  it("the delete confirmation is unchanged", () => {
    expect(cardRow).toMatch(/window\.confirm\("Delete this card\? This cannot be undone\."\)/);
  });
});
