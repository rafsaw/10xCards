import { describe, expect, it } from "vitest";
import {
  alsoWaitingSentence,
  draftsWaitingSentence,
  dueSentence,
  librarySentence,
  resolveDashboardState,
  type DashboardInput,
} from "@/lib/dashboard-state";

// Oracle discipline: every expectation below is written out by hand from the state
// matrix and acceptance criteria in
// `.ai/specs/briefs/2026-08-21-dashboard-what-now.md`, never read back off the
// implementation. The helper supplies only the neutral defaults — configured, no
// error, not read-only, everything at zero — so each test states just the one fact
// it is about.
function input(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    configured: true,
    loadError: false,
    isReadOnly: false,
    dueCount: 0,
    draftCount: 0,
    libraryCount: 0,
    ...overrides,
  };
}

describe("resolveDashboardState — the state matrix", () => {
  it("AC1: cards due and no drafts is the review-waiting state, carrying the due count", () => {
    const state = resolveDashboardState(input({ dueCount: 12 }));
    expect(state).toEqual({
      kind: "review-waiting",
      dueCount: 12,
      alsoWaitingDrafts: null,
      libraryCount: null,
    });
  });

  it("AC2: nothing due but drafts pending is the drafts-waiting state, and offers no review", () => {
    const state = resolveDashboardState(input({ draftCount: 7, libraryCount: 24 }));
    expect(state).toEqual({ kind: "drafts-waiting", draftCount: 7, libraryCount: 24 });
  });

  it("AC3: with both waiting, review wins and the drafts appear once, as a reminder", () => {
    const state = resolveDashboardState(input({ dueCount: 12, draftCount: 7 }));
    expect(state).toEqual({
      kind: "review-waiting",
      dueCount: 12,
      alsoWaitingDrafts: 7,
      libraryCount: null,
    });
  });

  it("AC4: saved cards with nothing due and no drafts is the caught-up state", () => {
    const state = resolveDashboardState(input({ libraryCount: 24 }));
    expect(state).toEqual({ kind: "caught-up", libraryCount: 24 });
  });

  it("AC5: no cards, no drafts and an empty library is the new-account state, carrying no count", () => {
    expect(resolveDashboardState(input())).toEqual({ kind: "new-account" });
  });

  it("AC6: a failed count produces the error state and no count at all — never a zero", () => {
    const state = resolveDashboardState(input({ loadError: true, dueCount: 12, draftCount: 7, libraryCount: 24 }));
    expect(state).toEqual({ kind: "error" });
  });

  it("AC7: a read-only account gets the read-only state, with no due or draft count exposed", () => {
    const state = resolveDashboardState(input({ isReadOnly: true, dueCount: 12, draftCount: 7, libraryCount: 24 }));
    expect(state).toEqual({ kind: "read-only", libraryCount: 24 });
  });

  it("an unconfigured Supabase outranks every other signal, including a load error", () => {
    const state = resolveDashboardState(input({ configured: false, loadError: true, dueCount: 12 }));
    expect(state).toEqual({ kind: "not-configured" });
  });

  it("a load error outranks read-only, so a failed count is never dressed up as a restriction", () => {
    expect(resolveDashboardState(input({ loadError: true, isReadOnly: true, libraryCount: 24 }))).toEqual({
      kind: "error",
    });
  });
});

describe("resolveDashboardState — the priority rule (due outranks drafts)", () => {
  it("one due card still outranks any number of drafts", () => {
    const state = resolveDashboardState(input({ dueCount: 1, draftCount: 50 }));
    expect(state.kind).toBe("review-waiting");
  });

  it("drafts lead only once nothing is due", () => {
    expect(resolveDashboardState(input({ dueCount: 0, draftCount: 1 })).kind).toBe("drafts-waiting");
  });

  it("read-only suppresses the review action even with cards due", () => {
    expect(resolveDashboardState(input({ isReadOnly: true, dueCount: 12 })).kind).toBe("read-only");
  });
});

describe("resolveDashboardState — the library sentence", () => {
  it("is carried alongside the review, drafts, caught-up and read-only states", () => {
    expect(resolveDashboardState(input({ dueCount: 3, libraryCount: 24 }))).toMatchObject({ libraryCount: 24 });
    expect(resolveDashboardState(input({ draftCount: 3, libraryCount: 24 }))).toMatchObject({ libraryCount: 24 });
    expect(resolveDashboardState(input({ libraryCount: 24 }))).toMatchObject({ libraryCount: 24 });
    expect(resolveDashboardState(input({ isReadOnly: true, libraryCount: 24 }))).toMatchObject({ libraryCount: 24 });
  });

  it("is suppressed when the library is empty, so no section says zero", () => {
    expect(resolveDashboardState(input({ dueCount: 3, libraryCount: 0 }))).toMatchObject({ libraryCount: null });
    expect(resolveDashboardState(input({ isReadOnly: true, libraryCount: 0 }))).toMatchObject({ libraryCount: null });
  });

  it("is absent from the states that carry no counts at all", () => {
    expect(resolveDashboardState(input({ loadError: true, libraryCount: 24 }))).toEqual({ kind: "error" });
    expect(resolveDashboardState(input({ configured: false, libraryCount: 24 }))).toEqual({ kind: "not-configured" });
  });
});

describe("AC8: every sentence reads in the singular at a count of one", () => {
  it("the due sentence", () => {
    expect(dueSentence(1)).toBe("1 card is due for review.");
    expect(dueSentence(12)).toBe("12 cards are due for review.");
  });

  it("the drafts-waiting sentence", () => {
    expect(draftsWaitingSentence(1)).toBe("1 generated card is waiting for your decision.");
    expect(draftsWaitingSentence(7)).toBe("7 generated cards are waiting for your decision.");
  });

  it("the also-waiting sentence, whose verb agrees too", () => {
    expect(alsoWaitingSentence(1)).toBe("1 generated card still needs a keep-or-discard decision.");
    expect(alsoWaitingSentence(7)).toBe("7 generated cards still need a keep-or-discard decision.");
  });

  it("the library sentence", () => {
    expect(librarySentence(1)).toBe("Your library holds 1 saved card.");
    expect(librarySentence(24)).toBe("Your library holds 24 saved cards.");
  });

  it("no sentence ever renders the `card(s)` shorthand", () => {
    const everySentence = [dueSentence, draftsWaitingSentence, alsoWaitingSentence, librarySentence].flatMap((fn) => [
      fn(1),
      fn(2),
      fn(50),
    ]);
    for (const sentence of everySentence) {
      expect(sentence).not.toContain("(s)");
    }
  });

  it("reads sensibly at a large, unbounded draft backlog", () => {
    expect(draftsWaitingSentence(50)).toBe("50 generated cards are waiting for your decision.");
    expect(alsoWaitingSentence(50)).toBe("50 generated cards still need a keep-or-discard decision.");
  });
});
