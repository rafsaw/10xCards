import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guards for the /generate screen migration, following the
 * technique src/pages/settings.test.ts established: read a shipped file as
 * text and assert over it, rather than rendering — this repo has no
 * jsdom/RTL harness.
 * Source: .ai/specs/briefs/2026-08-25-screen-migration-generate.md
 */

const PAGES_DIR = fileURLToPath(new URL(".", import.meta.url));
const GENERATE_DIR = fileURLToPath(new URL("../components/generate", import.meta.url));
const UI_DIR = fileURLToPath(new URL("../components/ui", import.meta.url));

const readPage = (name: string) => readFileSync(join(PAGES_DIR, name), "utf8");
const readGenerateComponent = (name: string) => readFileSync(join(GENERATE_DIR, name), "utf8");
const readUiComponent = (name: string) => readFileSync(join(UI_DIR, name), "utf8");

const MIGRATED_FILES: [string, string][] = [
  ["generate.astro", readPage("generate.astro")],
  ["PasteAndGenerateForm.tsx", readGenerateComponent("PasteAndGenerateForm.tsx")],
  ["DraftReviewList.tsx", readGenerateComponent("DraftReviewList.tsx")],
  ["Section.tsx", readUiComponent("Section.tsx")],
];

describe("generate screen migration — no legacy literal survives", () => {
  it.each(MIGRATED_FILES)("%s has no hex, rgb() or oklch() colour literal", (_name, source) => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\brgb\(/);
    expect(source).not.toMatch(/\boklch\(/);
  });

  it.each(MIGRATED_FILES)("%s uses no Tailwind palette literal (e.g. bg-blue-500)", (_name, source) => {
    const paletteHues =
      "slate|gray|zinc|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
    expect(source).not.toMatch(new RegExp(`\\b(?:bg|text|border)-(?:${paletteHues})-\\d{2,3}\\b`));
  });

  it.each(MIGRATED_FILES)("%s has no shadow-*, backdrop-blur-*, or gradient utility", (_name, source) => {
    expect(source).not.toMatch(/\bshadow-[a-z]/);
    expect(source).not.toMatch(/backdrop-blur-/);
    expect(source).not.toMatch(/bg-gradient-/);
  });
});

describe("generate.astro — bg-cosmic is confined to the one deliberate full-bleed wrapper", () => {
  const source = readPage("generate.astro");

  it("carries no bg-cosmic", () => {
    expect(source).not.toMatch(/bg-cosmic/);
  });

  it("its outer wrapper reads bg-background instead", () => {
    expect(source).toMatch(/bg-background text-foreground min-h-screen/);
  });
});

describe("generate.astro — the inline back link is gone, PageHeader is the only heading", () => {
  const source = readPage("generate.astro");

  it('renders PageHeader with title "Generate cards"', () => {
    expect(source).toMatch(/<PageHeader title="Generate cards" \/>/);
  });

  it("has no inline Dashboard back link or raw <h1>", () => {
    expect(source).not.toMatch(/←\s*Dashboard/);
    expect(source).not.toMatch(/<h1\b/);
  });
});

describe("generate.astro — the primary submit is resolved server-side", () => {
  const source = readPage("generate.astro");

  it("passes primary={drafts.length === 0} to PasteAndGenerateForm", () => {
    expect(source).toMatch(/<PasteAndGenerateForm client:load primary=\{drafts\.length === 0\} \/>/);
  });
});

describe("PasteAndGenerateForm.tsx — errors render through Notice, submit is prop-driven", () => {
  const source = readGenerateComponent("PasteAndGenerateForm.tsx");

  it("imports Notice from the ui primitives", () => {
    expect(source).toMatch(/import\s*\{\s*Notice\s*\}\s*from\s*"@\/components\/ui\/Notice"/);
  });

  it('renders the error through <Notice variant="error">, not a hand-rolled box', () => {
    expect(source).toMatch(/<Notice variant="error">\{error\.message\}<\/Notice>/);
  });

  it("the submit button variant is driven by the primary prop", () => {
    expect(source).toMatch(/variant=\{primary \? "default" : "outline"\}/);
  });
});

describe("DraftReviewList.tsx — errors render through Notice, draft rows use the surface-draft tokens", () => {
  const source = readGenerateComponent("DraftReviewList.tsx");

  it("imports Notice from the ui primitives", () => {
    expect(source).toMatch(/import\s*\{\s*Notice\s*\}\s*from\s*"@\/components\/ui\/Notice"/);
  });

  it('renders the error through <Notice variant="error">, not a hand-rolled box', () => {
    expect(source).toMatch(/<Notice variant="error">\{error\.message\}<\/Notice>/);
  });

  it("each draft row uses the surface-draft tokens, never the legacy white literals", () => {
    expect(source).toMatch(/border-surface-draft-border bg-surface-draft/);
    expect(source).not.toMatch(/border-white\/10/);
    expect(source).not.toMatch(/bg-white\/5/);
  });

  it("the submit button always carries the filled variant", () => {
    expect(source).toMatch(/variant="default"/);
  });
});
