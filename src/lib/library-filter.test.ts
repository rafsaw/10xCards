import { describe, expect, it } from "vitest";
import { applyLibraryFilter, buildLibraryHref, parseLibraryFilter } from "./library-filter";

function recorder() {
  const calls: unknown[][] = [];
  const q = {
    eq: (...a: [string, string]) => (calls.push(["eq", ...a]), q),
    is: (...a: [string, null]) => (calls.push(["is", ...a]), q),
    or: (...a: [string]) => (calls.push(["or", ...a]), q),
  };
  return { q, calls };
}

describe("parseLibraryFilter", () => {
  it("reads q, tag and no_tag", () => {
    expect(parseLibraryFilter(new URLSearchParams("q= cat &tag=Lesson 5"))).toEqual({
      q: "cat",
      safeQ: "cat",
      tag: "Lesson 5",
      noTag: false,
    });
  });
  it("lets no_tag=1 win over tag", () => {
    expect(parseLibraryFilter(new URLSearchParams("tag=x&no_tag=1"))).toMatchObject({ tag: null, noTag: true });
  });
  it("treats an empty tag as All and strips or()-breaking characters from safeQ", () => {
    const f = parseLibraryFilter(new URLSearchParams('tag=&q=a,b(c)"d'));
    expect(f.tag).toBeNull();
    expect(f.safeQ).toBe("a b c  d");
  });
});

describe("applyLibraryFilter", () => {
  it("always filters saved status only by default", () => {
    const { q, calls } = recorder();
    applyLibraryFilter(q, parseLibraryFilter(new URLSearchParams()));
    expect(calls).toEqual([["eq", "status", "saved"]]);
  });
  it("composes q and an exact tag (eq, never ilike)", () => {
    const { q, calls } = recorder();
    applyLibraryFilter(q, parseLibraryFilter(new URLSearchParams("q=x&tag=50%_off")));
    expect(calls).toEqual([
      ["eq", "status", "saved"],
      ["or", "front.ilike.%x%,back.ilike.%x%"],
      ["eq", "tag", "50%_off"],
    ]);
  });
  it("filters tag IS NULL for no_tag", () => {
    const { q, calls } = recorder();
    applyLibraryFilter(q, parseLibraryFilter(new URLSearchParams("no_tag=1&tag=x")));
    expect(calls).toEqual([
      ["eq", "status", "saved"],
      ["is", "tag", null],
    ]);
  });
});

describe("buildLibraryHref", () => {
  it("carries q, tag and page", () => {
    expect(buildLibraryHref({ q: "a", tag: "L 1", noTag: false }, 2)).toBe("/library?q=a&tag=L+1&page=2");
  });
  it("prefers no_tag and omits defaults", () => {
    expect(buildLibraryHref({ q: "", tag: "x", noTag: true })).toBe("/library?no_tag=1");
    expect(buildLibraryHref({ q: "", tag: null, noTag: false })).toBe("/library");
  });
});
