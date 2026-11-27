// risk: issue #82 (spec #76, testing seam 5) — the predicted interval must be
//       peekable from one fixed-height line above the rating row. Three ways
//       that goes wrong and only a browser can catch:
//       (a) the line never changes, because hover/focus never reach the
//       component (handlers on the wrong element, or the hint computed once);
//       (b) the hint is mouse-only, so a keyboard user never sees it — AC2 is a
//       claim about real browser focus, which no source grep can settle;
//       (c) the line grows or collapses between its empty and populated states,
//       so the rating row jumps under the cursor and a rating gets mis-clicked.
//       Acceptance criteria exercised here: AC1, AC2, AC3, AC4 (the row does not
//       move), and AC6 for the one interval a reachable card can produce.
//       The structural facts — the line exists, is always rendered, and no
//       button prints an interval — are source-grepped in
//       src/components/review/review-paper.test.ts; the SM-2 arithmetic itself
//       is pinned in src/lib/sm2.test.ts.
// oracle: a freshly created card is at the scheduler's initial state
//       (repetition 0, ease factor 2.50, interval 0 days), where SM-2 gives
//       every rating a 1-day interval: Again resets to 1, and a first success is
//       I(1) = 1 regardless of grade (ADR 0002). So the NUMBER here cannot
//       distinguish the four ratings — the LABEL is what proves the line follows
//       the rating being inspected. Distinguishing intervals (15 / 15 / 16 for a
//       mature card) needs a card this suite cannot reach without writing
//       scheduler state directly, and is covered at seam 1 instead.
// seed: modeled on tests/e2e/seed.spec.ts and review-keyboard-shortcuts.spec.ts —
//       role/label/text locators, wait-for-state, Date.now() unique data, a full
//       self-contained setup -> action -> assertion -> cleanup cycle. Auth comes
//       from storageState (playwright.config.ts -> `setup` project), never the UI.

import { test, expect } from "@playwright/test";
import { seedDueCard, visibleText } from "./helpers";

const PLACEHOLDER = "hover or tab a rating to see when it comes back";

test.describe("review — the predicted interval is peekable on hover and on focus", () => {
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

  test("hovering or focusing a rating reports its interval in the line, without moving the row", async ({ page }) => {
    const front = `E2E interval hint ${Date.now()}`;
    const back = `interval hint answer ${Date.now()}`;
    marker = front;

    // The hint must never submit anything: it is a read of the scheduler, not a
    // rating. A POST here would reschedule a card the user only looked at.
    let reviewPosts = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/reviews") && request.method() === "POST") reviewPosts += 1;
    });

    // Setup — seed exactly one due card.
    await seedDueCard(page, front, back);

    // Precondition — the card is genuinely due and is the card the session shows.
    // Wrapped in toPass because a created-then-immediately-read card can briefly
    // lag across the create -> navigate boundary; the assertions below stay strict.
    await expect(async () => {
      await page.goto("/review");
      await expect(visibleText(page, front)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // Before the reveal there is no rating to inspect, so the shared line carries
    // the Space shortcut hint — the slot's third state, and the one that keeps
    // Space discoverable while it is the only key that does anything.
    await expect(page.getByText("Space", { exact: true }).filter({ visible: true })).toBeVisible();

    // Reveal through the button (not the keyboard) — this also gates on hydration:
    // the hint lives in a client island, so every "the line changed" assertion
    // below would otherwise be able to pass for the wrong reason.
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await expect(visibleText(page, back)).toBeVisible();

    // AC3 — with the ratings on screen but nothing hovered or focused, the line
    // shows the discoverability placeholder. Clicking Reveal left focus on a
    // button that no longer exists, so the document is the focus owner here.
    await expect(visibleText(page, PLACEHOLDER)).toBeVisible();

    const good = page.getByRole("button", { name: "Good" });

    // AC4 — the row's position with the line in its EMPTY state, to compare
    // against its position with the line populated. A line that grew by one text
    // row would move the button down by ~19px here.
    const rowBefore = await good.boundingBox();
    expect(rowBefore).not.toBeNull();

    // AC1 — hovering a rating reports that rating's interval.
    await good.hover();
    await expect(visibleText(page, "Good → back in 1 d")).toBeVisible();
    await expect(visibleText(page, PLACEHOLDER)).toHaveCount(0);

    // AC4, the load-bearing half — the rating row did not move while the line
    // went from placeholder to hint. This is the assertion the fixed height
    // exists for; a source grep can only see the class name.
    const rowDuring = await good.boundingBox();
    expect(rowDuring?.y).toBe(rowBefore?.y);
    expect(rowDuring?.height).toBe(rowBefore?.height);

    // AC1 for a second rating, proving the line tracks what is under the pointer
    // rather than printing one fixed string.
    await page.getByRole("button", { name: "Again" }).hover();
    await expect(visibleText(page, "Again → back in 1 d")).toBeVisible();
    await expect(visibleText(page, "Good → back in 1 d")).toHaveCount(0);

    // AC2 — the same hint with no mouse involved. focus() fires the real browser
    // focus event without a pointer, and Tab then walks to the next rating, so
    // this covers both "focus shows the hint" and "the hint follows the focus
    // ring as the user tabs along the row".
    await page.getByRole("heading", { name: "Review session" }).click();
    await expect(visibleText(page, PLACEHOLDER)).toBeVisible();
    await page.getByRole("button", { name: "Hard" }).focus();
    await expect(visibleText(page, "Hard → back in 1 d")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(good).toBeFocused();
    await expect(visibleText(page, "Good → back in 1 d")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(visibleText(page, "Easy → back in 1 d")).toBeVisible();

    // AC3, the other half — the line goes back to the placeholder when the
    // reviewer stops asking. Clicking the heading drops focus to the document and
    // leaves the pointer off the row.
    await page.getByRole("heading", { name: "Review session" }).click();
    await expect(visibleText(page, PLACEHOLDER)).toBeVisible();
    await expect(visibleText(page, "back in 1 d")).toHaveCount(0);

    // Looking is not rating: the card is still here, unrated, and nothing was
    // POSTed by any hover, focus or Tab above.
    await expect(visibleText(page, front)).toBeVisible();
    expect(reviewPosts).toBe(0);
  });
});
