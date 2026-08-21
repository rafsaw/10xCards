// What the dashboard should say, decided as a pure function.
//
// `/dashboard` answers one question — what should I do now? — from three counts
// the app already gathers on other pages: cards due for review, drafts awaiting a
// keep-or-discard decision, and the size of the saved library. This module owns
// that decision and the sentences it produces; `dashboard.astro` only renders
// whatever comes back. Same split as `review-shortcuts.ts`: a pure, unit-tested
// resolver keeps a multi-state screen testable under the hermetic
// `environment: "node"` Vitest config, with no DOM and no browser.
//
// Source of every decision and every string below:
// `.ai/specs/briefs/2026-08-21-dashboard-what-now.md`.

/** Counts and flags the page has resolved before calling in. */
export interface DashboardInput {
  /** False when `createClient(...)` returned null — an operator problem, not a user one. */
  configured: boolean;
  /** True when ANY of the three count queries errored. */
  loadError: boolean;
  /** `Astro.locals.isReadOnly` — the account is pending deletion. */
  isReadOnly: boolean;
  /** Cards with `status='saved'` whose `next_due_at` has passed. */
  dueCount: number;
  /** Cards still sitting in `status='draft'`. */
  draftCount: number;
  /** Cards with `status='saved'`, regardless of due date. */
  libraryCount: number;
}

/**
 * The library sentence is context, never an action, and is suppressed wherever a
 * count would be a lie (load error) or meaningless (nothing configured, empty
 * account). `null` means "do not render the sentence".
 */
export type LibraryContext = number | null;

export type DashboardState =
  | { kind: "not-configured" }
  | { kind: "error" }
  | { kind: "read-only"; libraryCount: LibraryContext }
  | {
      kind: "review-waiting";
      dueCount: number;
      /** Drafts to mention under "Also waiting", or `null` when there are none. */
      alsoWaitingDrafts: number | null;
      libraryCount: LibraryContext;
    }
  | { kind: "drafts-waiting"; draftCount: number; libraryCount: LibraryContext }
  | { kind: "caught-up"; libraryCount: LibraryContext }
  | { kind: "new-account" };

/**
 * Pick the one thing the dashboard leads with.
 *
 * The priority rule — **due cards outrank pending drafts** — is the only product
 * judgement in this file, and it is here so it can be argued with in one place: a
 * review is time-sensitive (a card due today and reviewed in three days degrades
 * the interval the whole product depends on), while drafts sit in `status='draft'`
 * indefinitely at no cost. So when both are waiting, review is the action and
 * drafts are the reminder — never a second, competing primary action.
 *
 * Order of the guards matters and is itself the contract:
 * unconfigured → failed → read-only → due → drafts → caught up → brand new.
 * A failed count never renders a zero: `0 cards are due for review` after a failed
 * query is a lie that stops someone from studying.
 */
export function resolveDashboardState(input: DashboardInput): DashboardState {
  const { configured, loadError, isReadOnly, dueCount, draftCount, libraryCount } = input;

  if (!configured) return { kind: "not-configured" };
  if (loadError) return { kind: "error" };

  const library: LibraryContext = libraryCount > 0 ? libraryCount : null;

  // Pending deletion: the account can browse but not review, generate or edit, so
  // no count for a blocked action is shown — `12 cards are due` next to a dead
  // action is a tease. The library sentence survives because browsing still works.
  if (isReadOnly) return { kind: "read-only", libraryCount: library };

  if (dueCount > 0) {
    return {
      kind: "review-waiting",
      dueCount,
      alsoWaitingDrafts: draftCount > 0 ? draftCount : null,
      libraryCount: library,
    };
  }

  if (draftCount > 0) return { kind: "drafts-waiting", draftCount, libraryCount: library };

  if (libraryCount > 0) return { kind: "caught-up", libraryCount: library };

  // Nothing due, nothing drafted, nothing saved: a brand-new account, where a
  // count of zero is noise and one sentence about the product is the point.
  return { kind: "new-account" };
}

// ---------------------------------------------------------------------------
// Copy
//
// The counts live in sentence text — never conveyed by size, weight or colour —
// and every sentence reads correctly at one. `card(s)` is not an option, so each
// sentence is written out in both numbers. These are separate pure functions
// rather than logic inside the resolver so the singular boundaries are pinned by
// unit tests without rendering a page.
// ---------------------------------------------------------------------------

/** "12 cards are due for review." / "1 card is due for review." */
export function dueSentence(count: number): string {
  return count === 1 ? "1 card is due for review." : `${count} cards are due for review.`;
}

/** "7 generated cards are waiting for your decision." / "1 generated card is waiting …" */
export function draftsWaitingSentence(count: number): string {
  return count === 1
    ? "1 generated card is waiting for your decision."
    : `${count} generated cards are waiting for your decision.`;
}

/**
 * "7 generated cards still need a keep-or-discard decision." / singular with
 * "needs". The brief writes the plural; the singular is derived from it under the
 * no-`card(s)` rule, with the verb agreed.
 */
export function alsoWaitingSentence(count: number): string {
  return count === 1
    ? "1 generated card still needs a keep-or-discard decision."
    : `${count} generated cards still need a keep-or-discard decision.`;
}

/** "Your library holds 24 saved cards." / "Your library holds 1 saved card." */
export function librarySentence(count: number): string {
  return count === 1 ? "Your library holds 1 saved card." : `Your library holds ${count} saved cards.`;
}
