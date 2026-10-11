// risk: .ai/specs/2026-10-10-card-lesson-tag.md (Phase 1, step 9) — a lesson tag
//       entered when creating a card must be persisted server-side and shown on
//       the library card; in /review it is part of the answer side, so it must
//       NOT be visible before "Reveal answer" (it would leak a hint) and MUST be
//       visible after.
// seed: modeled on tests/e2e/seed.spec.ts — role/label/text locators,
//       wait-for-state, Date.now() unique data, setup -> action -> assertion ->
//       cleanup. Auth comes from storageState (playwright.config.ts).

import { test, expect } from "@playwright/test";

test.describe("lesson tag — library display and review reveal", () => {
  // The unique front of the card this test creates, so afterEach can find and
  // remove exactly that row however the test ends.
  let marker: string | null = null;

  test.afterEach(async ({ page }) => {
    // Cleanup: delete this test's card via the UI; its Delete button confirms
    // through a dialog, which we auto-accept.
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

  test("a card's lesson tag shows in the library and only after Reveal answer in review", async ({ page }) => {
    const stamp = Date.now();
    const front = `E2E lesson tag ${stamp}`;
    const tag = `e2e-lesson-${stamp}`;
    marker = front;

    // Setup/action — create a card with a unique tag. exact: true because the
    // library search box also matches "Front"/"Back" by accessible name.
    await page.goto("/library");
    await page.getByRole("textbox", { name: "Front", exact: true }).fill(front);
    await page.getByRole("textbox", { name: "Back", exact: true }).fill("lesson tag answer");
    await page.getByLabel("Lesson tag (optional)").fill(tag);
    await page.getByRole("button", { name: "Create card" }).click();

    // The tag is persisted and rendered on THIS card's row after the SSR reload.
    const row = page.getByRole("listitem").filter({ hasText: front });
    await expect(row).toBeVisible();
    await expect(row.getByText(tag)).toBeVisible();

    // /review: a created card is due immediately. Wrapped in toPass for the
    // create -> navigate read-consistency lag (same as review-persistence.spec).
    await expect(async () => {
      await page.goto("/review");
      await expect(page.getByText(front)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // Load-bearing: the tag is hidden before reveal (no hint leak)...
    // Scoped to the rendered "Lesson: <tag>" line: the Astro dev overlay also prints
    // island props as raw JSON, which would make a bare getByText(tag) ambiguous.
    const lesson = page.getByText(`Lesson: ${tag}`);
    await expect(lesson).toHaveCount(0);

    // ...and visible once the answer is revealed.
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await expect(lesson).toBeVisible();
  });
});
