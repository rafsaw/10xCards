// risk: context/foundation/test-plan.md R5 — the server is the authority on a
//       user-created card; what the user enters must be persisted faithfully and
//       survive a full SSR reload, not merely live in client state.
// seed: this IS the seed — the exemplar every generated E2E test is modeled on
//       (see .claude/skills/10x-e2e/references/seed-test-pattern.md).
//
// It demonstrates the five conventions every generated test MUST imitate
// (encoded in tests/e2e/AGENTS.md):
//   1. Role/label/text locators only — never CSS, XPath, or DOM structure.
//   2. Wait for STATE (toBeVisible / waitForResponse), never for time.
//   3. Unique test data (Date.now()) so parallel workers and re-runs never collide.
//   4. A full self-contained cycle: setup -> action -> assertion -> cleanup.
//   5. A test name bound to a specific test-plan.md risk.
// Auth is supplied by storageState (playwright.config.ts -> `setup` project);
// tests never log in through the UI.

import { test, expect } from "@playwright/test";

test.describe("library — created card persistence (R5)", () => {
  // The unique front of the card this test creates, so afterEach can find and
  // remove exactly that row however the test ends.
  let marker: string | null = null;

  test.afterEach(async ({ page }) => {
    // Cleanup (defeats anti-pattern #5): delete this test's card via the UI,
    // located by its unique front. Its Delete button confirms through a dialog,
    // which we auto-accept. Unique data + cleanup keep parallel workers and
    // re-runs after a crash from colliding.
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

  test("a manually created card persists across a page reload", async ({ page }) => {
    // Unique marker: no other worker (or a re-run) can see this card's front.
    marker = `E2E seed card ${Date.now()}`;

    // Setup — open the library; storageState already authenticated us.
    await page.goto("/library");

    // Action — fill the create-card form with role/label locators. exact: true
    // because the library search box ("Search front or back…") also matches the
    // substrings "Front"/"Back" by accessible name.
    await page.getByRole("textbox", { name: "Front", exact: true }).fill(marker);
    await page.getByRole("textbox", { name: "Back", exact: true }).fill("seed answer");

    // Submit; the form returns to /library on success. Wait for STATE — the new
    // card rendered — not for time.
    await page.getByRole("button", { name: "Create card" }).click();
    await expect(page.getByText(marker)).toBeVisible();

    // The risk made concrete: did the card actually PERSIST server-side, or did
    // it only live in client state? A full reload re-runs the SSR query — the
    // card is here on reload ONLY if it was truly saved. This assertion fails if
    // R5 materializes (the write is dropped or not faithfully persisted).
    await page.reload();
    await expect(page.getByText(marker)).toBeVisible();
  });
});
