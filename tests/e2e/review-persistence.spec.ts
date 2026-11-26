// risk: context/foundation/test-plan.md R6 — review progress isn't persisted.
//       After rating a due card "Good", the new schedule (next_due_at) must
//       survive a full session restart. If it doesn't, the card stays due and
//       resurfaces, silently breaking spaced repetition.
//       Risk Response Guidance #6: "After rating, next-due updates and survives
//       a session restart." The rate endpoint is POST /api/reviews (owner-scoped,
//       and guarded on the card's SM-2 state — repetition, ease factor and
//       interval; ADR 0002); a manually created card is due immediately (cards.ts
//       sets next_due_at=now), so creating one card seeds exactly one due card.
// seed: modeled on tests/e2e/seed.spec.ts — the exemplar every generated E2E test
//       imitates: role/label/text locators, wait-for-state, Date.now() unique
//       data, a full self-contained setup -> action -> assertion -> cleanup cycle,
//       and a name bound to a specific test-plan.md risk. Auth comes from
//       storageState (playwright.config.ts -> `setup` project); never the UI.

import { test, expect, type Page } from "@playwright/test";

// Create one due card through the library form, and do not return until the
// server has it. A manually created card gets next_due_at=now (cards.ts), so it
// enters /review immediately. Two races make the short version of this
// unreliable, and both of them show up as a FAILURE IN A LATER SPEC:
//   - the island can hydrate AFTER fill() lands, and React then renders from its
//     own empty state, silently discarding what was typed, so "Create card"
//     stays disabled forever. fill() is idempotent, so re-filling until the
//     button enables converges as soon as the island is live — and an enabled
//     button is the only visible proof that React, not just the DOM, has the text.
//   - on success the form navigates back to /library, so a wait that ANY text
//     match satisfies returns before the card is saved: the two textareas this
//     helper just filled match the front as well. The card's row in the library
//     list is the first thing only a saved card can produce, so that is what we
//     wait for; leaving the navigation in flight instead leaks the card past
//     afterEach, and a leaked due card breaks every "Card 1 of 1" elsewhere.
// exact: true on the textboxes because the library search box ("Search front or
// back…") also matches "Front"/"Back" by accessible name.
async function seedDueCard(page: Page, front: string, back: string) {
  await page.goto("/library");
  const submit = page.getByRole("button", { name: "Create card" });
  await expect(async () => {
    await page.getByRole("textbox", { name: "Front", exact: true }).fill(front);
    await page.getByRole("textbox", { name: "Back", exact: true }).fill(back);
    await expect(submit).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
  await submit.click();
  await expect(page.getByRole("listitem").filter({ hasText: front })).toBeVisible();
}

test.describe("review — rated card is rescheduled and stays so across a restart (R6)", () => {
  // The unique front of the card this test creates, so afterEach can find and
  // remove exactly that row however the test ends.
  let marker: string | null = null;

  test.afterEach(async ({ page }) => {
    // Cleanup (defeats anti-pattern #5): delete this test's card via the UI,
    // located by its unique front. Its Delete button confirms through a dialog,
    // which we auto-accept.
    if (!marker) return;
    page.once("dialog", (dialog) => void dialog.accept());
    await page.goto("/library");
    const row = page.getByRole("listitem").filter({ hasText: marker });
    if ((await row.count()) > 0) {
      await row.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByText(marker)).toHaveCount(0);
    }
    marker = null;
  });

  test("a card rated Good is no longer due after a session restart", async ({ page }) => {
    // Unique marker: no other worker (or a re-run) can see this card's front, so
    // the due-state assertions below speak only about THIS card. Held in a const
    // as well as the describe-scoped `marker`: TypeScript drops the narrowing of
    // a mutable `let` inside a callback (the toPass block below), so the locators
    // in this test use the const, while afterEach keeps the nullable `marker`.
    const front = `E2E review persistence ${Date.now()}`;
    marker = front;

    // Setup — seed exactly one due card.
    await seedDueCard(page, front, "review persistence answer");

    // Precondition — the new card is genuinely due (cards.ts sets next_due_at=now)
    // and shows up in /review. Each /review load re-runs the SSR due-cards query,
    // so seeing the front proves the card is due (not merely in client state).
    // Wrapped in toPass — a created-then-immediately-read card can briefly lag
    // across the create→navigate boundary; the card IS due, so this is a
    // read-consistency wait, not a logic fudge. The load-bearing assertion stays
    // strict below.
    await expect(async () => {
      await page.goto("/review");
      await expect(page.getByText(front)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // Action — reveal, then rate the card "Good". Wait on the /api/reviews
    // response so the assertions run only after the server has recorded the
    // rating (the write under test). This endpoint does not navigate, so the
    // response body is safe to read.
    await page.getByRole("button", { name: "Reveal answer" }).click();
    const rateResponse = page.waitForResponse(
      (res) => res.url().includes("/api/reviews") && res.request().method() === "POST",
    );
    // The button's accessible name is "Good 3" (the digit hint is printed inside
    // it), which this non-exact name match still resolves.
    await page.getByRole("button", { name: "Good" }).click();
    const rated = await rateResponse;
    expect(rated.status()).toBe(200);
    // applied:true proves the state-guarded update matched the row and persisted
    // the new schedule server-side — not just advanced the client index.
    const ratedBody = (await rated.json()) as { applied?: boolean };
    expect(ratedBody.applied).toBe(true);

    // Load-bearing assertion (the risk made concrete): RESTART the session with a
    // full reload, which re-runs the SSR due-cards query against Supabase. We
    // assert only about THIS card (its unique marker): if the new next_due_at was
    // persisted (R6 NOT materialized), the card is scheduled into the future and
    // no longer appears in the due list. If R6 materialized, the reschedule was
    // lost, the card is still due, and its front reappears here — failing this.
    //
    // NB: we deliberately do NOT assert the "All caught up!" empty state. That
    // couples to the whole account's due queue — a parallel test on the same
    // storageState user may have its own due card — i.e. global shared state
    // (anti-pattern #3). The marker-scoped check speaks only about this test.
    await page.reload();
    // The review page finished its SSR load (its h1 always renders)...
    await expect(page.getByRole("heading", { name: "Review session" })).toBeVisible();
    // ...and this rated card is no longer among the due cards.
    await expect(page.getByText(front)).toHaveCount(0);
  });
});
