import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Source-level guards for the /settings screen migration, following the
 * technique src/styles/tokens.test.ts and src/components/ui/primitives.test.ts
 * established: read a shipped file as text and assert over it, rather than
 * rendering — this repo has no jsdom/RTL harness.
 * Source: .ai/specs/briefs/2026-08-24-screen-migration-settings.md
 */

const PAGES_DIR = fileURLToPath(new URL(".", import.meta.url));
const SETTINGS_DIR = fileURLToPath(new URL("../components/settings", import.meta.url));

const readPage = (name: string) => readFileSync(join(PAGES_DIR, name), "utf8");
const readSettingsComponent = (name: string) => readFileSync(join(SETTINGS_DIR, name), "utf8");

const MIGRATED_FILES: [string, string][] = [
  ["settings.astro", readPage("settings.astro")],
  ["DeleteAccountButton.tsx", readSettingsComponent("DeleteAccountButton.tsx")],
  ["RetentionNotice.tsx", readSettingsComponent("RetentionNotice.tsx")],
];

describe("settings screen migration — no legacy literal survives", () => {
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

  it.each(MIGRATED_FILES)("%s has no backdrop-blur-* or gradient utility", (_name, source) => {
    expect(source).not.toMatch(/backdrop-blur-/);
    expect(source).not.toMatch(/bg-gradient-/);
  });
});

describe("settings.astro — bg-cosmic is confined to the one deliberate full-bleed wrapper", () => {
  const source = readPage("settings.astro");

  it("carries no bg-cosmic", () => {
    expect(source).not.toMatch(/bg-cosmic/);
  });

  it("its outer wrapper reads bg-background instead", () => {
    expect(source).toMatch(/bg-background text-foreground min-h-screen/);
  });
});

describe("settings.astro — the inline back link is gone, PageHeader is the only heading", () => {
  const source = readPage("settings.astro");

  it('renders PageHeader with title "Settings"', () => {
    expect(source).toMatch(/<PageHeader title="Settings" \/>/);
  });

  it("has no inline Dashboard back link or raw <h1>", () => {
    expect(source).not.toMatch(/←\s*Dashboard/);
    expect(source).not.toMatch(/<h1\b/);
  });
});

describe("DeleteAccountButton.tsx — errors render through Notice", () => {
  const source = readSettingsComponent("DeleteAccountButton.tsx");

  it("imports Notice from the ui primitives", () => {
    expect(source).toMatch(/import\s*\{\s*Notice\s*\}\s*from\s*"@\/components\/ui\/Notice"/);
  });

  it('renders the error through <Notice variant="error">, not a hand-rolled box', () => {
    expect(source).toMatch(/<Notice variant="error">\{error\.message\}<\/Notice>/);
  });
});

describe("RetentionNotice.tsx — composes Notice and CancelDeletionButton in one island", () => {
  const source = readSettingsComponent("RetentionNotice.tsx");

  it("uses Notice's warning variant with an action", () => {
    expect(source).toMatch(/variant="warning"/);
    expect(source).toMatch(/action=\{/);
  });

  it("keeps the same retention copy unchanged", () => {
    expect(source).toMatch(/scheduled for deletion on/);
    expect(source).toMatch(/Until then it/);
  });
});
