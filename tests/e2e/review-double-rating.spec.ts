// risk: issue #81 (spec #76) — "Rating advances to the next due Card
//       immediately, and a double-click produces exactly one Review." The
//       session advances its index on every response, so a second POST for one
//       activation does not look like an error: it advances twice and SILENTLY
//       SKIPS the next due Card, which the user never sees and never rates.
//       Only a browser can catch it: `submitting` is async React state, so
//       neither the disabled attribute nor the resolver's in-flight check is
//       guaranteed to be in place by the time a same-frame second activation
//       lands — the synchronous `lockRef` in ReviewSession.tsx is the backstop,
//       and its presence (not its effect) is all a source grep can settle
//       (src/components/review/review-paper.test.ts).
// oracle: TWO due cards are seeded, so the skip is observable on screen and not
//       only in a request count. One double-click on the first card must leave
//       the session on "Card 2 of 2" — a second review would have carried it
//       past the second card to "Session complete" — and must send exactly one
//       POST /api/reviews. The counter technique is lifted from
//       tests/e2e/review-keyboard-shortcuts.spec.ts, where the same claim is
//       made for a single keystroke.
// note: /api/reviews is deliberately SLOWED, not mocked — the real endpoint, the
//       real database and real RLS still answer it — so the in-flight window the
//       second activation has to survive is wide and observable instead of
//       depending on how fast the dev server happens to respond.
// seed: modeled on tests/e2e/seed.spec.ts and review-keyboard-shortcuts.spec.ts —
//       role/label/text locators, wait-for-state, Date.now() unique data, a full
//       self-contained setup -> action -> assertion -> cleanup cycle. Auth comes
//       from storageState (playwright.config.ts -> `setup` project), never the UI.

import { test, expect, type Page } from "@playwright/test";

// Text the USER can actually see. In dev mode the Astro dev toolbar mirrors each
// island's serialized props into a hidden <pre> inside its shadow root, and
// Playwright locators pierce shadow DOM — so a bare getByText() for a card front
// also matches that hidden copy. Every visibility claim below goes through this
// helper so it speaks about the rendered session, not the toolbar mirror.
function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

test.describe("review — an impatient second click cannot rate a card twice", () => {
  // The unique fronts of the cards this test creates, so afterEach can find and
  // remove exactly those rows however the test ends.
  let markers: string[] = [];

  test.afterEach(async ({ page }) => {
    // Cleanup (defeats anti-pattern #5): delete this test's cards via the UI,
    // located by their unique fronts. Each Delete button confirms through a
    // dialog, which we auto-accept.
    if (markers.length === 0) return;
    for (const marker of markers) {
      await page.goto("/library");
      const row = page.getByRole("listitem").filter({ hasText: marker });
      if ((await row.count()) > 0) {
        page.once("dialog", (dialog) => void dialog.accept());
        await row.getByRole("button", { name: "Delete" }).click();
        await expect(page.getByText(marker)).toHaveCount(0);
      }
    }
    markers = [];
  });

  test("double-clicking a rating fires one review and does not skip the next card", async ({ page }) => {
    // Unique markers: no other worker (or a re-run) can see these cards, so
    // every assertion below speaks only about THEM.
    const stamp = Date.now();
    const fronts = [`E2E double rating A ${stamp}`, `E2E double rating B ${stamp}`];
    markers = [...fronts];

    // Count every review POST this page makes. "Exactly one review" is only
    // directly observable as a REQUEST count; the screen assertions below are
    // what make the count meaningful rather than decorative.
    let reviewPosts = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/reviews") && request.method() === "POST") reviewPosts += 1;
    });

    // Widen the in-flight window the guard has to cover. The request is passed
    // straight through afterwards, so the rating is recorded by the real
    // endpoint against the real database.
    await page.route("**/api/reviews", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    // Setup — seed exactly two due cards: a manually created card has
    // next_due_at=now (cards.ts), so both enter /review immediately. exact: true
    // because the library search box ("Search front or back…") also matches
    // "Front"/"Back" by accessible name.
    await page.goto("/library");
    for (const front of fronts) {
      await page.getByRole("textbox", { name: "Front", exact: true }).fill(front);
      await page.getByRole("textbox", { name: "Back", exact: true }).fill(`answer for ${front}`);
      await page.getByRole("button", { name: "Create card" }).click();
      await expect(page.getByText(front)).toBeVisible();
    }

    // Precondition — both cards are genuinely due, so the session has a SECOND
    // card for a duplicate review to skip past. Wrapped in toPass because
    // created-then-immediately-read cards can briefly lag across the create ->
    // navigate boundary; the load-bearing assertions below stay strict.
    await expect(async () => {
      await page.goto("/review");
      await expect(visibleText(page, "Card 1 of 2")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // Which of the two the queue put first is not ours to choose (both were
    // created with next_due_at=now), so read it off the screen. Naming both
    // cards makes the assertions after the rating speak about THESE cards and
    // not only about a counter.
    const firstIsA = (await visibleText(page, fronts[0]).count()) > 0;
    const [first, second] = firstIsA ? fronts : [fronts[1], fronts[0]];
    await expect(visibleText(page, first)).toBeVisible();

    // The ratings only exist once the answer is revealed. Clicking Reveal also
    // proves the island is hydrated, so the double-click below cannot be
    // swallowed before hydration and pass for the wrong reason (anti-pattern #1).
    await page.getByRole("button", { name: "Reveal answer" }).click();
    const good = page.getByRole("button", { name: "Good" });
    await expect(good).toBeEnabled();

    // The action under test: two activations of the same rating, as close
    // together as a real user's double-click.
    const rateResponse = page.waitForResponse(
      (res) => res.url().includes("/api/reviews") && res.request().method() === "POST",
    );
    await good.dblclick();

    // Mid-flight: the rating is in progress and the row refuses further input.
    await expect(good).toBeDisabled();

    const rated = await rateResponse;
    expect(rated.status()).toBe(200);
    // applied:true proves the state-guarded update matched the row — this was a
    // real review, so "exactly one POST" below is not "exactly one no-op".
    expect(((await rated.json()) as { applied?: boolean }).applied).toBe(true);

    // The decisive assertion, in both shapes. On screen: the session advanced by
    // ONE card, so the second card is still in front of the user. A second
    // review would have advanced the index twice and shown "Session complete",
    // skipping that card without ever rating it.
    await expect(visibleText(page, "Card 2 of 2")).toBeVisible();
    await expect(visibleText(page, second)).toBeVisible();
    await expect(visibleText(page, first)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Session complete" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reveal answer" })).toBeVisible();
    // And on the wire: one activation, one review.
    expect(reviewPosts).toBe(1);

    // Server-side, too: a full reload re-runs the SSR due-cards query, and only
    // the card that was actually rated is scheduled into the future — so exactly
    // one of the two is still due, and it is the one that was never rated.
    await page.unroute("**/api/reviews");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Review session" })).toBeVisible();
    await expect(visibleText(page, "Card 1 of 1")).toBeVisible();
    await expect(visibleText(page, second)).toBeVisible();
    await expect(visibleText(page, first)).toHaveCount(0);
    expect(reviewPosts).toBe(1);
  });
});
