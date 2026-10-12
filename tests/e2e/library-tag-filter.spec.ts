// risk: .ai/specs/2026-10-10-card-lesson-tag.md (Phase 2, step 11) — the library
//       filter must show only cards of the chosen lesson tag, "No tag" must
//       exclude tagged cards, and the filter must compose with the URL contract
//       (?tag= / ?no_tag=1) so the view is bookmarkable.
// seed: modeled on tests/e2e/lesson-tag.spec.ts — role/label/text locators,
//       wait-for-state, Date.now() unique data, setup -> action -> assertion ->
//       cleanup. Auth comes from storageState (playwright.config.ts).

import { test, expect, type Page } from "@playwright/test";

test.describe("library — lesson tag filter", () => {
  // Unique fronts of the cards this test creates, removed in afterEach however it ends.
  let markers: string[] = [];

  test.afterEach(async ({ page }) => {
    page.on("dialog", (dialog) => void dialog.accept());
    for (const marker of markers) {
      await page.goto("/library");
      const row = page.getByRole("listitem").filter({ hasText: marker });
      if ((await row.count()) > 0) {
        await row.getByRole("button", { name: "Delete" }).click();
        await expect(page.getByText(marker)).toHaveCount(0);
      }
    }
    markers = [];
  });

  async function createCard(page: Page, front: string, tag?: string) {
    markers.push(front);
    await page.goto("/library");
    await page.getByRole("textbox", { name: "Front", exact: true }).fill(front);
    await page.getByRole("textbox", { name: "Back", exact: true }).fill("filter answer");
    if (tag) await page.getByLabel("Lesson tag (optional)").fill(tag);
    await page.getByRole("button", { name: "Create card" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: front })).toBeVisible();
  }

  test("filtering by a tag shows only its cards; No tag excludes them", async ({ page }) => {
    const stamp = Date.now();
    const tagged = `E2E filter tagged ${stamp}`;
    const untagged = `E2E filter untagged ${stamp}`;
    const tag = `e2e-filter-${stamp}`;

    await createCard(page, tagged, tag);
    await createCard(page, untagged);

    // Filter by this test's own unique tag only (shared DB, parallel runs).
    const filter = page.getByRole("navigation", { name: "Filter by lesson tag" });
    await filter.getByRole("link", { name: tag, exact: true }).click();
    await page.waitForURL(new RegExp(`tag=${tag}`));
    await expect(page.getByRole("listitem").filter({ hasText: tagged })).toBeVisible();
    await expect(page.getByText(untagged)).toHaveCount(0);

    // "No tag" excludes the tagged card and includes the untagged one.
    await filter.getByRole("link", { name: "No tag" }).click();
    await page.waitForURL(/no_tag=1/);
    await expect(page.getByRole("listitem").filter({ hasText: untagged })).toBeVisible();
    await expect(page.getByText(tagged)).toHaveCount(0);

    // "All" shows both again.
    await filter.getByRole("link", { name: "All", exact: true }).click();
    await expect(page.getByRole("listitem").filter({ hasText: tagged })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: untagged })).toBeVisible();
  });
});
