import { describe, expect, it } from "vitest";
import {
  isSpaceActivatedTarget,
  isTextEntryTarget,
  resolveReviewShortcut,
  type ReviewShortcutContext,
  type ShortcutTarget,
} from "@/lib/review-shortcuts";

// Oracle discipline: every expected action below is written out by hand from the
// brief's acceptance criteria (.ai/specs/briefs/2026-08-20-review-keyboard-shortcuts.md),
// never derived from the implementation. The helper only fills in the neutral
// defaults (no modifier, no auto-repeat, no focused element) so each test states
// just the one fact it is about.
function ctx(overrides: Partial<ReviewShortcutContext> & Pick<ReviewShortcutContext, "key">): ReviewShortcutContext {
  return {
    repeat: false,
    withModifier: false,
    target: null,
    revealed: false,
    submitting: false,
    ...overrides,
  };
}

const input: ShortcutTarget = { tagName: "INPUT" };
const button: ShortcutTarget = { tagName: "BUTTON" };

describe("resolveReviewShortcut — the acceptance criteria", () => {
  it("AC1: Space reveals the answer while the answer is hidden", () => {
    expect(resolveReviewShortcut(ctx({ key: " ", revealed: false }))).toBe("reveal");
  });

  it("AC2: 1 and 2 do nothing before the answer is revealed", () => {
    expect(resolveReviewShortcut(ctx({ key: "1", revealed: false }))).toBeNull();
    expect(resolveReviewShortcut(ctx({ key: "2", revealed: false }))).toBeNull();
  });

  it("AC3: 1 rates the card Wrong once the answer is revealed", () => {
    expect(resolveReviewShortcut(ctx({ key: "1", revealed: true }))).toBe("rate-wrong");
  });

  it("AC4: 2 rates the card Right once the answer is revealed", () => {
    expect(resolveReviewShortcut(ctx({ key: "2", revealed: true }))).toBe("rate-right");
  });

  it("AC6: rating shortcuts are ignored while a review submission is in flight", () => {
    expect(resolveReviewShortcut(ctx({ key: "1", revealed: true, submitting: true }))).toBeNull();
    expect(resolveReviewShortcut(ctx({ key: "2", revealed: true, submitting: true }))).toBeNull();
  });

  it("AC5: a held-down rating key auto-repeats without producing a second review", () => {
    expect(resolveReviewShortcut(ctx({ key: "2", revealed: true, repeat: true }))).toBeNull();
    expect(resolveReviewShortcut(ctx({ key: "1", revealed: true, repeat: true }))).toBeNull();
  });
});

describe("resolveReviewShortcut — keystrokes it deliberately leaves alone", () => {
  it("ignores Space once the answer is already revealed, so it cannot double-reveal", () => {
    expect(resolveReviewShortcut(ctx({ key: " ", revealed: true }))).toBeNull();
  });

  it("ignores Space on a focused button, which the browser activates itself", () => {
    // Tabbing to "Restart" and pressing Space must restart, not reveal.
    expect(resolveReviewShortcut(ctx({ key: " ", revealed: false, target: button }))).toBeNull();
  });

  it("still accepts a rating key on a focused button — Space is the only key the browser claims", () => {
    expect(resolveReviewShortcut(ctx({ key: "1", revealed: true, target: button }))).toBe("rate-wrong");
  });

  it("ignores every shortcut typed into a text-entry element", () => {
    expect(resolveReviewShortcut(ctx({ key: " ", target: input }))).toBeNull();
    expect(resolveReviewShortcut(ctx({ key: "1", revealed: true, target: input }))).toBeNull();
    expect(resolveReviewShortcut(ctx({ key: "2", revealed: true, target: { isContentEditable: true } }))).toBeNull();
  });

  it("ignores keystrokes carrying a modifier, which belong to the browser or the OS", () => {
    expect(resolveReviewShortcut(ctx({ key: " ", withModifier: true }))).toBeNull();
    expect(resolveReviewShortcut(ctx({ key: "2", revealed: true, withModifier: true }))).toBeNull();
  });

  it("ignores a held Space, so leaning on the key does not fight the reveal state", () => {
    expect(resolveReviewShortcut(ctx({ key: " ", repeat: true }))).toBeNull();
  });

  it("ignores unbound keys in both states", () => {
    for (const key of ["3", "0", "Enter", "a", "ArrowRight"]) {
      expect(resolveReviewShortcut(ctx({ key, revealed: false }))).toBeNull();
      expect(resolveReviewShortcut(ctx({ key, revealed: true }))).toBeNull();
    }
  });

  it("accepts the legacy Spacebar key name older browsers still emit", () => {
    expect(resolveReviewShortcut(ctx({ key: "Spacebar", revealed: false }))).toBe("reveal");
  });
});

describe("target classifiers", () => {
  it("treats inputs, textareas, selects and contenteditable hosts as text entry", () => {
    expect(isTextEntryTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "textarea" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTextEntryTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("does not treat ordinary elements or a missing target as text entry", () => {
    expect(isTextEntryTarget({ tagName: "DIV" })).toBe(false);
    expect(isTextEntryTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });

  it("knows which elements the browser activates with Space", () => {
    expect(isSpaceActivatedTarget({ tagName: "BUTTON" })).toBe(true);
    expect(isSpaceActivatedTarget({ tagName: "a" })).toBe(true);
    expect(isSpaceActivatedTarget({ tagName: "SUMMARY" })).toBe(true);
    expect(isSpaceActivatedTarget({ tagName: "DIV" })).toBe(false);
    expect(isSpaceActivatedTarget(null)).toBe(false);
  });
});
