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
const NEW_PRIMITIVES = ["Notice.tsx", "EmptyState.tsx", "PageHeader.tsx"];

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

describe("criterion 5 — rounded-paper is confined to src/components/ui/", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
  }

  const srcFiles = walk(SRC_DIR).filter((f) => /\.(tsx?|astro)$/.test(f));

  // 61 = 63 (shell-mobile-navigation baseline) minus 2 from the
  // screen-migration-settings increment, which replaces settings.astro's own
  // amber isReadOnly box and DeleteAccountButton.tsx's error box — one legacy
  // radius utility each — with Notice, which already carries the Paper radius
  // under src/components/ui/, so composing it removes a legacy occurrence
  // rather than relocating one. The one legacy-radius control that survives
  // (the Cancel-deletion action button) moves from settings.astro into the
  // new RetentionNotice.tsx with no net change to the count.
  it("rounded-(md|lg|xl) occurrences across src/ are unchanged at 61", () => {
    const count = srcFiles.reduce((total, file) => {
      const matches = readFileSync(file, "utf8").match(/rounded-(md|lg|xl)\b/g) ?? [];
      return total + matches.length;
    }, 0);
    expect(count).toBe(61);
  });

  it("rounded-paper appears only under src/components/ui/", () => {
    const offenders = srcFiles.filter(
      (f) => !f.includes(join("components", "ui")) && /rounded-paper\b/.test(readFileSync(f, "utf8")),
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
