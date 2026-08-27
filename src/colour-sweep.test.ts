import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The repository-wide colour sweep.
 *
 * Every screen-migration increment so far shipped its own guard file scoped to the files
 * it touched, and that is exactly how `settings/CancelDeletionButton.tsx` kept a
 * `text-red-700` through four increments: the /settings guard reads three files, and that
 * was not one of them. A per-screen guard proves a screen was migrated; it cannot prove
 * the migration is finished.
 *
 * This file asserts the property itself, over every shipped `.astro` and `.tsx` under
 * `src/`: no Tailwind palette-scale colour utility, no `white/N` or `black/N` opacity
 * utility, no raw colour literal, and no reference to the deleted `bg-cosmic`. That is
 * the recorded entry condition for the dark-mode increment
 * (`.uxproof/conventions.md`, "Visual direction"), so it is enforced here rather than
 * claimed in a PR body — a claim goes stale the moment someone adds a file.
 *
 * Deliberately NOT covered here, each with its own home:
 *   - `src/styles/global.css` — layer 1 is where colour literals are *supposed* to live.
 *     `tokens.test.ts` governs it, including the rule that the one shadow's literals must
 *     still equal --ink-90.
 *   - `*.test.*` files — a guard has to name what it forbids in order to forbid it.
 *
 * Source: .ai/specs/2026-08-26-bg-cosmic-cleanup.md
 */

const SRC_DIR = fileURLToPath(new URL(".", import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/**
 * Comments are stripped before matching, for the same reason the per-screen guards strip
 * them: a file that explains which utility it replaced has to name that utility, and a
 * class inside a comment ships nothing. Stripping keeps the honest comment and still
 * fails the class.
 */
const stripComments = (source: string): string =>
  source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^ *\/\/.*$/gm, "");

const SHIPPED_FILES: [name: string, source: string][] = walk(SRC_DIR)
  .filter((file) => /\.(tsx|astro)$/.test(file) && !file.includes(".test."))
  .map((file) => [relative(SRC_DIR, file).replace(/\\/g, "/"), stripComments(readFileSync(file, "utf8"))]);

const PALETTE_HUES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

describe("src/ ships no hardcoded colour — the dark-mode entry condition", () => {
  it("finds files to sweep at all", () => {
    // Without this, a broken walk would make every assertion below vacuously true — the
    // failure mode this run already hit once, in a guard that matched nothing and passed.
    expect(SHIPPED_FILES.length).toBeGreaterThan(30);
  });

  it.each(SHIPPED_FILES)("%s uses no Tailwind palette-scale colour utility", (_name, source) => {
    expect(source).not.toMatch(
      new RegExp(`\\b(?:bg|text|border|from|to|via|ring|fill|stroke)-(?:${PALETTE_HUES})-\\d{2,3}\\b`),
    );
  });

  // The opacity suffix is OPTIONAL, and that is the whole point of this assertion.
  //
  // It first shipped as `-(white|black)/\d{1,3}` — opacity required — which meant a bare
  // `text-white` matched nothing here (no numeric scale, so the palette pattern misses it
  // too) and sailed through the entire suite. `text-white` is the class the removal
  // condition at global.css:317-323 was written around: "the same commit that removes the
  // last text-white". The sweep that exists to stop it coming back could not see it.
  //
  // Verified by injecting `text-white` into a file with no per-screen guard: before this
  // fix all 23 test files stayed green; after it, the file fails by name.
  it.each(SHIPPED_FILES)("%s uses no white or black colour utility, with or without opacity", (_name, source) => {
    expect(source).not.toMatch(
      /\b(?:bg|text|border|from|to|via|ring|placeholder|fill|stroke|divide|outline|decoration|accent|caret)-(?:white|black)(?:\/\d{1,3})?\b/,
    );
  });

  it.each(SHIPPED_FILES)("%s carries no raw hex, rgb() or oklch() colour literal", (_name, source) => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\brgba?\(/);
    expect(source).not.toMatch(/\boklch\(/);
  });

  it.each(SHIPPED_FILES)("%s does not reference the deleted bg-cosmic utility", (_name, source) => {
    // Once the @utility is gone, `class="bg-cosmic"` is a silent no-op — Tailwind emits
    // nothing for an unknown class, so a reintroduction would look fine and render wrong.
    // This assertion is what turns that silence into a failure.
    expect(source).not.toMatch(/\bbg-cosmic\b/);
  });
});
