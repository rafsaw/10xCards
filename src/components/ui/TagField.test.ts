import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Source-level guard (no jsdom/RTL harness in this repo; see primitives.test.ts).
const source = readFileSync(join(fileURLToPath(new URL(".", import.meta.url)), "TagField.tsx"), "utf8");

describe("TagField", () => {
  it("has a real label bound to the input", () => {
    expect(source).toMatch(/<label htmlFor=\{id\}/);
    expect(source).toContain("Lesson tag (optional)");
  });

  it("caps input at 40 characters", () => {
    expect(source).toMatch(/maxLength=\{40\}/);
  });

  it("binds a datalist of suggestions to the input", () => {
    expect(source).toMatch(/list=\{listId\}/);
    expect(source).toMatch(/<datalist id=\{listId\}>/);
  });
});
