// risk: .ai/specs/briefs/2026-08-20-review-keyboard-shortcuts.md — the review
//       session must be drivable from the keyboard WITHOUT growing a second
//       rating path. Two ways that goes wrong and only a browser can catch:
//       (a) the keystroke never reaches the component (listener on the wrong
//       node, effect skipped by an early return), so the shortcut is dead;
//       (b) the keystroke reaches BOTH the shortcut handler and a focused
//       control, or auto-repeats, and one card produces two POST /api/reviews —
//       silently double-advancing the Leitner box (AC5/AC6).
//       Acceptance criteria exercised here: AC1, AC2, AC4, AC5, AC7, AC8, AC9.
//       The pure decision table behind them is unit-tested in
//       src/lib/review-shortcuts.test.ts; this spec proves the wiring is real.
// seed: modeled on tests/e2e/seed.spec.ts and review-persistence.spec.ts —
//       role/label/text locators, wait-for-state, Date.now() unique data, a full
//       self-contained setup -> action -> assertion -> cleanup cycle. Auth comes
//       from storageState (playwright.config.ts -> `setup` project), never the UI.

import { test, expect, type Page } from "@playwright/test";

// Text the USER can actually see. In dev mode the Astro dev toolbar mirrors each
// island's serialized props into a hidden <pre> inside its shadow root, and
// Playwright locators pierce shadow DOM — so a bare getByText() for a card front
// or back also matches that hidden copy, and a raw DOM count would "find" an
// answer that is nowhere on screen. Every visibility claim below goes through
// this helper so it speaks about the rendered session, not the toolbar mirror.
function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

test.describe("review — the card loop is drivable from the keyboard", () => {
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

  test("Space reveals the answer and 2 rates the card Right, firing exactly one review", async ({ page }) => {
    // Unique markers: no other worker (or a re-run) can see this card, so every
    // assertion below speaks only about THIS card. Held in consts as well as the
    // describe-scoped `marker` because TypeScript drops the narrowing of a
    // mutable `let` inside the toPass callback.
    const front = `E2E keyboard shortcuts ${Date.now()}`;
    const back = `keyboard shortcuts answer ${Date.now()}`;
    marker = front;

    // Count every review POST this page makes. AC5 ("keyboard interaction cannot
    // cause duplicate review submissions") is only observable as a REQUEST count —
    // a UI that advanced correctly while POSTing twice would still look fine.
    let reviewPosts = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/reviews") && request.method() === "POST") reviewPosts += 1;
    });

    // Setup — seed exactly one due card: a manually created card has
    // next_due_at=now (cards.ts), so it enters /review immediately. exact: true
    // because the library search box ("Search front or back…") also matches
    // "Front"/"Back" by accessible name.
    await page.goto("/library");
    await page.getByRole("textbox", { name: "Front", exact: true }).fill(front);
    await page.getByRole("textbox", { name: "Back", exact: true }).fill(back);
    await page.getByRole("button", { name: "Create card" }).click();
    await expect(page.getByText(front)).toBeVisible();

    // Precondition — the card is genuinely due and is the card the session shows.
    // Wrapped in toPass because a created-then-immediately-read card can briefly
    // lag across the create -> navigate boundary; the load-bearing assertions
    // below stay strict.
    await expect(async () => {
      await page.goto("/review");
      await expect(visibleText(page, front)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // AC7 — the shortcuts are discoverable in the UI itself, not only in docs.
    await expect(page.getByText("Space", { exact: true }).filter({ visible: true })).toBeVisible();

    // AC8 + hydration gate. The shortcuts live in a client island, so a keystroke
    // sent before hydration would be swallowed — and every "pressing this does
    // nothing" assertion below would then pass for the wrong reason (anti-pattern
    // #1). Driving the existing buttons first proves the island is live AND that
    // mouse interaction still works: reveal shows the answer, Restart hides it
    // again, putting us back on the same (only) due card with the answer hidden.
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await expect(visibleText(page, back)).toBeVisible();
    await page.getByRole("button", { name: "Restart" }).click();
    await expect(page.getByRole("button", { name: "Reveal answer" })).toBeVisible();
    await expect(visibleText(page, back)).toHaveCount(0);

    // Clicking Restart left the browser focus on that button, where the browser
    // itself activates it on Space — which the shortcut layer deliberately defers
    // to. Click the page heading to drop focus back to the document: the state a
    // user is in while simply reading a card.
    await page.getByRole("heading", { name: "Review session" }).click();

    // AC2 — before the reveal, the rating keys must do NOTHING: no answer leak,
    // no review submitted, same card still waiting to be revealed.
    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await expect(visibleText(page, back)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reveal answer" })).toBeVisible();
    expect(reviewPosts).toBe(0);

    // AC1 — Space reveals the answer. The back of the card appearing is the
    // observable outcome, and it is unique to this card.
    await page.keyboard.press(" ");
    await expect(visibleText(page, back)).toBeVisible();

    // AC4 + AC9 — `2` performs the same action as clicking "Right": one POST to
    // /api/reviews that the server actually applied. Waiting on the response
    // (never on time) is what makes the count assertion below meaningful.
    const rateResponse = page.waitForResponse(
      (res) => res.url().includes("/api/reviews") && res.request().method() === "POST",
    );
    await page.keyboard.press("2");
    const rated = await rateResponse;
    expect(rated.status()).toBe(200);
    // applied:true proves the box-guarded update matched the row and persisted the
    // new schedule server-side — the keyboard went through the real review flow,
    // not a client-side shortcut around it.
    const ratedBody = (await rated.json()) as { applied?: boolean };
    expect(ratedBody.applied).toBe(true);

    // AC5 — exactly one review was submitted for this card. The session has moved
    // past it (its front is gone from the card face) and no second POST followed.
    await expect(visibleText(page, front)).toHaveCount(0);
    expect(reviewPosts).toBe(1);

    // AC9 — persistence and scheduling are unchanged: a full reload re-runs the
    // SSR due-cards query, and a card rated Right is scheduled into the future, so
    // it is no longer due. Had the keyboard path bypassed the real submission,
    // this card would still be due here.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Review session" })).toBeVisible();
    await expect(visibleText(page, front)).toHaveCount(0);
  });
});
