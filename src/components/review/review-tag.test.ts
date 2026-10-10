import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Source-level guard (no jsdom/RTL harness): the lesson tag must only render
// inside the `revealed &&` block, so it cannot hint at the answer before reveal.
const session = readFileSync(join(fileURLToPath(new URL(".", import.meta.url)), "ReviewSession.tsx"), "utf8");

describe("ReviewSession lesson tag", () => {
  it("renders card.tag only after the answer is revealed", () => {
    const revealedAt = session.indexOf("{revealed && (");
    const tagAt = session.indexOf("{card.tag &&");
    expect(revealedAt).toBeGreaterThan(-1);
    expect(tagAt).toBeGreaterThan(revealedAt);
    expect(session.split("card.tag").length - 1).toBe(2); // one guard + one render, nowhere else
    // The front block (before the reveal gate) never mentions the tag.
    expect(session.slice(0, revealedAt)).not.toContain("card.tag");
  });
});
