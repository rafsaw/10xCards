import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Criterion 2 of .ai/specs/briefs/2026-08-24-paper-ui-primitives.md: Banner.astro's
 * style block must resolve every colour through the info, warning and destructive
 * role tokens, never a hex, rgb() or oklch() literal.
 */

const SOURCE = readFileSync(fileURLToPath(new URL("./Banner.astro", import.meta.url)), "utf8");
const STYLE_BLOCK = /<style>([\s\S]*?)<\/style>/.exec(SOURCE)?.[1] ?? "";

describe("Banner.astro adopts the semantic surface tokens", () => {
  it("has a non-empty <style> block", () => {
    expect(STYLE_BLOCK).not.toBe("");
  });

  it("contains no hex, rgb() or oklch() colour literal", () => {
    expect(STYLE_BLOCK).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(STYLE_BLOCK).not.toMatch(/\brgb\(/);
    expect(STYLE_BLOCK).not.toMatch(/\boklch\(/);
  });

  it.each(["info", "warning", "error"])(
    "the %s variant resolves through --info*/--warning*/--destructive* only",
    (variant) => {
      const role = variant === "error" ? "destructive" : variant;
      const rule = new RegExp(`\\.banner--${variant}\\s*{([^}]*)}`).exec(STYLE_BLOCK)?.[1] ?? "";
      expect(rule).toMatch(new RegExp(`background:\\s*var\\(--${role}-surface\\)`));
      expect(rule).toMatch(new RegExp(`color:\\s*var\\(--${role}\\)`));
      expect(rule).toMatch(new RegExp(`border-color:\\s*var\\(--${role}\\)`));
    },
  );
});
