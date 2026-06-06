// risk: context/foundation/test-plan.md R6 — review progress isn't persisted.
//       After rating a due card "Right", the new schedule (next_due_at) must
//       survive a full session restart. If it doesn't, the card stays due and
//       resurfaces, silently breaking spaced repetition.
//       Risk Response Guidance #6: "After rating, next-due updates and survives
//       a session restart." The rate endpoint is POST /api/reviews (owner-scoped,
//       box-guarded); a manually created card is due immediately (cards.ts sets
//       next_due_at=now), so creating one card seeds exactly one due card.
// seed: modeled on tests/e2e/seed.spec.ts — the exemplar every generated E2E test
//       imitates: role/label/text locators, wait-for-state, Date.now() unique
//       data, a full self-contained setup -> action -> assertion -> cleanup cycle,
//       and a name bound to a specific test-plan.md risk. Auth comes from
//       storageState (playwright.config.ts -> `setup` project); never the UI.

import { test, expect } from "@playwright/test";

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

  test("a card rated Right is no longer due after a session restart", async ({ page }) => {
    // Unique marker: no other worker (or a re-run) can see this card's front, so
    // the due-state assertions below speak only about THIS card.
    marker = `E2E review persistence ${Date.now()}`;

    // Setup — seed exactly one due card: a manually created card has
    // next_due_at=now (cards.ts), so it enters /review immediately. exact: true
    // because the library search box ("Search front or back…") also matches
    // "Front"/"Back" by accessible name.
    await page.goto("/library");
    await page.getByRole("textbox", { name: "Front", exact: true }).fill(marker);
    await page.getByRole("textbox", { name: "Back", exact: true }).fill("review persistence answer");
    await page.getByRole("button", { name: "Create card" }).click();
    await expect(page.getByText(marker)).toBeVisible();

    // Precondition — the new card is genuinely due (cards.ts sets next_due_at=now)
    // and shows up in /review. Each /review load re-runs the SSR due-cards query,
    // so seeing the front proves the card is due (not merely in client state).
    // Wrapped in toPass — a created-then-immediately-read card can briefly lag
    // across the create→navigate boundary; the card IS due, so this is a
    // read-consistency wait, not a logic fudge. The load-bearing assertion stays
    // strict below.
    await expect(async () => {
      await page.goto("/review");
      await expect(page.getByText(marker)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // Action — reveal, then rate the card "Right". Wait on the /api/reviews
    // response so the assertions run only after the server has recorded the
    // rating (the write under test). This endpoint does not navigate, so the
    // response body is safe to read.
    await page.getByRole("button", { name: "Reveal answer" }).click();
    const rateResponse = page.waitForResponse(
      (res) => res.url().includes("/api/reviews") && res.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Right" }).click();
    const rated = await rateResponse;
    expect(rated.status()).toBe(200);
    // applied:true proves the box-guarded update matched the row and persisted
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
    await expect(page.getByText(marker)).toHaveCount(0);
  });
});
