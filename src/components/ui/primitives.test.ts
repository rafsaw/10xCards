import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guards for the Paper primitives, following the technique
 * src/styles/tokens.test.ts established: read a shipped file as text and
 * assert over it, rather than rendering — this repo has no jsdom/RTL harness.
 * Source: .ai/specs/briefs/2026-08-24-paper-ui-primitives.md
 */

const UI_DIR = fileURLToPath(new URL(".", import.meta.url));
const SRC_DIR = fileURLToPath(new URL("../..", import.meta.url));

const readUi = (name: string) => readFileSync(join(UI_DIR, name), "utf8");

// Scoped to the three primitives this increment adds. LibBadge.astro and the
// pre-existing parts of button.tsx are legacy consumers the increment does not
// touch, and criterion 9 governs what this increment ships, not a retroactive
// sweep of files it was told not to change.
const NEW_PRIMITIVES = ["Notice.tsx", "EmptyState.tsx", "PageHeader.tsx", "Section.tsx", "Field.tsx"];

describe("criterion 1 — Notice role/aria-live mapping", () => {
  const source = readUi("Notice.tsx");

  it('error is the only variant that maps to role="alert"', () => {
    expect(source).toMatch(/variant === "error" \? "alert" : "status"/);
  });

  it('error is the only variant that maps to aria-live="assertive"', () => {
    expect(source).toMatch(/variant === "error" \? "assertive" : "polite"/);
  });

  it("the icon is aria-hidden", () => {
    expect(source).toMatch(/aria-hidden="true"/);
  });
});

describe("criterion 6 — the Button focus ring is corrected", () => {
  const source = readUi("button.tsx");

  it("the base variant carries an alpha-free focus ring", () => {
    expect(source).toMatch(/focus-visible:ring-ring(?!\/)/);
    expect(source).not.toMatch(/focus-visible:ring-ring\/50/);
  });

  it("the destructive variant declares no focus-visible:ring-* override of its own", () => {
    const destructiveVariant = /destructive:\s*"([^"]*)"/.exec(source)?.[1] ?? "";
    expect(destructiveVariant).not.toMatch(/focus-visible:ring-/);
  });
});

describe("criterion 9 — src/components/ui/ carries no literal, shadow, blur, or cosmic background", () => {
  const files = NEW_PRIMITIVES;

  it.each(files)("%s has no hex, rgb() or oklch() colour literal", (name) => {
    const source = readUi(name);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\brgb\(/);
    expect(source).not.toMatch(/\boklch\(/);
  });

  it.each(files)("%s uses no Tailwind palette literal (e.g. bg-blue-500)", (name) => {
    const source = readUi(name);
    const paletteHues =
      "slate|gray|zinc|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
    expect(source).not.toMatch(new RegExp(`\\b(?:bg|text|border)-(?:${paletteHues})-\\d{2,3}\\b`));
  });

  it.each(files)("%s has no shadow-*, backdrop-blur-*, bg-cosmic, or gradient utility", (name) => {
    const source = readUi(name);
    expect(source).not.toMatch(/\bshadow-[a-z]/);
    expect(source).not.toMatch(/backdrop-blur-/);
    expect(source).not.toMatch(/bg-cosmic/);
    expect(source).not.toMatch(/bg-gradient-/);
  });
});

describe("Field — the label-plus-textarea primitive (screen-migration-library)", () => {
  const source = readUi("Field.tsx");

  it("pairs htmlFor with the textarea id, so the label is programmatic", () => {
    expect(source).toMatch(/<label htmlFor=\{id\}/);
    expect(source).toMatch(/<textarea\s+id=\{id\}/);
  });

  it("carries the Paper control recipe, verbatim from PasteAndGenerateForm", () => {
    expect(source).toMatch(
      /border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring w-full resize-y rounded-lg border px-3 py-2 text-sm focus:outline-none disabled:opacity-50/,
    );
  });

  it("rows defaults to 2", () => {
    expect(source).toMatch(/rows = 2/);
  });

  it("onChange takes the string, not the event", () => {
    expect(source).toMatch(/onChange: \(value: string\) => void/);
    expect(source).toMatch(/onChange\(e\.target\.value\)/);
  });

  it("declares no error, icon or hint slot — no consumer exists for any of them", () => {
    // Scoped to the props interface: the file's doc comment explains *why*
    // those slots are absent, and naming them there is the point.
    const props = /export interface FieldProps \{([\s\S]*?)\}/.exec(source)?.[1] ?? "";
    expect(props).not.toBe("");
    expect(props).not.toMatch(/\berror\b/);
    expect(props).not.toMatch(/\bicon\b/);
    expect(props).not.toMatch(/\bhint\b/);
  });
});

describe("PageHeader does not decide the page's measure (screen-migration-library)", () => {
  // Width is the page's concern, not the header's: all three pre-existing
  // consumers (settings, generate, review) already wrap PageHeader in
  // `max-w-content mx-auto`, and /library renders at max-w-3xl instead. A
  // primitive that describes a page header should not also fix its width.
  it("PageHeader.tsx carries no max-w- utility", () => {
    expect(readUi("PageHeader.tsx")).not.toMatch(/\bmax-w-/);
  });
});

describe("criterion 5 — rounded-paper is confined to src/components/ui/", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
  }

  const srcFiles = walk(SRC_DIR).filter((f) => /\.(tsx?|astro)$/.test(f));

  // 38 = 50 (screen-migration-review baseline) minus 12 net from the
  // screen-migration-library increment. /library shed its whole legacy control
  // set as it converted — the two hand-rolled create textareas, the create
  // submit button, the two row edit textareas, both hand-rolled error
  // paragraphs, the row surface's own radius, the search input, the search
  // button, and the four pagination link/disabled surfaces — while the shared
  // Field, Notice and Button primitives carry their radius under
  // src/components/ui/. Added back: Field.tsx's control recipe (once), this
  // file's quotation of that recipe in the Field contract assertion, the row
  // surface converted to the legacy scale, LibrarySearch's input, and
  // library-paper.test.ts's own quotation of the row surface class.
  //
  // 36 = 38 minus 2 net from the screen-migration-dashboard increment: /dashboard's
  // two legacy-scale radius recipes — the gradient-filled primary link and the
  // bespoke red notice paragraph — left with the glass, and the Paper replacements
  // (Button, Notice) carry their radius under src/components/ui/ instead. The two
  // new page-local components introduce no radius at all.
  // 29 = 34 minus 5 net from the same increment's Phase 2: the four screens shed the
  // legacy-scale radii that belonged to the glass recipe — Welcome.astro's feature cards
  // and pill, and the three auth pages' cards — while AuthCard.astro carries the Paper
  // radius instead, which this counter does not include.
  // 34 = 36 minus 2 net from the bg-cosmic-cleanup increment's Phase 1: SubmitButton
  // shed the legacy-scale radius it carried in the second recipe layered over <Button>,
  // and ServerError.tsx — an error paragraph in hardcoded reds with a radius of its own —
  // was deleted in favour of the registry's Notice, which carries its radius under
  // src/components/ui/. Note this counter reads every file under src/ including this one,
  // so a comment here may not spell the utility names out literally.
  it("rounded-(md|lg|xl) occurrences across src/ are accounted for at 29", () => {
    const count = srcFiles.reduce((total, file) => {
      const matches = readFileSync(file, "utf8").match(/rounded-(md|lg|xl)\b/g) ?? [];
      return total + matches.length;
    }, 0);
    expect(count).toBe(29);
  });

  // The invariant this guards is "the transitional Paper radius does not spread by
  // accident", not "src/components/ui/ is the only folder allowed to have a card". The
  // bg-cosmic-cleanup increment adds one deliberate second consumer: auth/AuthCard.astro,
  // the shell the three auth screens share. It is page-local to the auth family by
  // decision — three consumers, all in one folder — so promoting it into the registry to
  // satisfy a path check would assert a generality it does not have, and giving it the
  // legacy radius instead would contradict the geometry it is being migrated to. The
  // allowlist is therefore explicit rather than a widened path prefix: a third file
  // reaching for this token still fails, which is the whole point. Increment 10 deletes
  // --radius-paper and every one of its usages together.
  const PAPER_RADIUS_CONSUMERS = [join("components", "ui"), join("components", "auth", "AuthCard.astro")];

  it("the Paper radius appears only in its two recorded consumers", () => {
    const offenders = srcFiles.filter(
      (f) =>
        !PAPER_RADIUS_CONSUMERS.some((allowed) => f.includes(allowed)) &&
        /rounded-paper/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("criterion 10 — no proving/demo route was added", () => {
  it("src/pages/dev does not exist", () => {
    const devDir = fileURLToPath(new URL("../../pages/dev", import.meta.url));
    expect(() => statSync(devDir)).toThrow();
  });
});
