// Keyboard shortcuts for the review session (S-04). Kept as a pure module — with
// no React and no DOM types — so every acceptance criterion is pinned by fast
// unit tests under the hermetic `environment: "node"` Vitest config, which has
// no jsdom and no React Testing Library. `ReviewSession.tsx` owns only the
// `keydown` subscription and dispatches whatever this resolver returns into the
// EXISTING reveal/handleRate flow; it never re-implements rating logic.

/** What a keystroke maps to. `null` (from the resolver) means "not a shortcut — leave it alone". */
export type ReviewShortcutAction = "reveal" | "rate-wrong" | "rate-right";

/**
 * The structural slice of an event target this module needs. Declared instead of
 * using `Element` so the classifiers below are callable from a DOM-less test.
 */
export interface ShortcutTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

export interface ReviewShortcutContext {
  /** `KeyboardEvent.key`. */
  key: string;
  /** `KeyboardEvent.repeat` — true while a key is held down and auto-repeating. */
  repeat: boolean;
  /** Ctrl / Meta / Alt held: the keystroke belongs to a browser or OS shortcut, not to us. */
  withModifier: boolean;
  /** `KeyboardEvent.target`. */
  target: ShortcutTarget | null;
  /** Is the answer currently shown? */
  revealed: boolean;
  /** Is a review POST already in flight? */
  submitting: boolean;
}

const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

// A focused button/link/summary is activated by Space by the browser itself.
// Reacting to Space there would double-fire (reveal *and* activate whatever has
// focus — e.g. "Restart"), so Space defers to the focused control.
const SPACE_ACTIVATED_TAGS = new Set(["BUTTON", "A", "SUMMARY"]);

/** True when the keystroke came from somewhere the user is typing. */
export function isTextEntryTarget(target: ShortcutTarget | null): boolean {
  if (!target) return false;
  if (target.isContentEditable === true) return true;
  return TEXT_ENTRY_TAGS.has((target.tagName ?? "").toUpperCase());
}

/** True when the browser already activates this target on Space. */
export function isSpaceActivatedTarget(target: ShortcutTarget | null): boolean {
  if (!target) return false;
  return SPACE_ACTIVATED_TAGS.has((target.tagName ?? "").toUpperCase());
}

/**
 * Decide which review action a keystroke triggers, or `null` for "ignore it".
 *
 * - `Space` reveals, and only while the answer is hidden.
 * - `1` / `2` rate Wrong / Right, and only after the answer is revealed.
 * - Nothing fires while a review submission is in flight, on an auto-repeating
 *   (held) key, with a modifier held, or from a text-entry element — the three
 *   ways a keyboard could otherwise produce a duplicate or unintended review.
 */
export function resolveReviewShortcut(context: ReviewShortcutContext): ReviewShortcutAction | null {
  const { key, repeat, withModifier, target, revealed, submitting } = context;

  if (repeat || withModifier) return null;
  if (isTextEntryTarget(target)) return null;

  if (key === " " || key === "Spacebar") {
    if (revealed || isSpaceActivatedTarget(target)) return null;
    return "reveal";
  }

  if (!revealed || submitting) return null;
  if (key === "1") return "rate-wrong";
  if (key === "2") return "rate-right";
  return null;
}
