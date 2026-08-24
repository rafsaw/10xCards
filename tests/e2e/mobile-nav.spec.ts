// risk: .ai/specs/briefs/2026-08-24-shell-mobile-navigation.md — at a 390px-wide
//       viewport the shell must fit one row (no horizontal scroll) and every one
//       of the 5 destinations plus Sign out must stay reachable from a keyboard-
//       operable disclosure control, with focus returning to the trigger on close.
//       A wrong wiring — the dialog never opening, a link missing from the panel,
//       or focus getting lost on close — is exactly what only a browser can catch.
//       Acceptance criteria exercised here: AC1, AC2, AC3, AC4, AC6.
// seed: modeled on tests/e2e/seed.spec.ts — role/label locators, wait-for-state,
//       a self-contained cycle. No data is created, so no cleanup is needed; auth
//       comes from storageState (playwright.config.ts -> `setup` project).

import { test, expect } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const PROTECTED_ROUTES = ["/dashboard", "/generate", "/review", "/library", "/settings"];

test.describe("shell — mobile navigation panel (390px)", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("the menu button opens a dialog with every destination and Sign out, and Escape returns focus to it", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const trigger = page.getByRole("button", { name: "Open navigation" });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // No link, email, or Sign out control should be reachable without opening
    // the panel first — the collapsed bar is only the trigger.
    await expect(page.getByRole("link", { name: "Generate", exact: true })).toBeHidden();

    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Main" });
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    for (const name of ["Generate", "Review", "Library", "Dashboard", "Settings"]) {
      await expect(dialog.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(dialog.getByRole("button", { name: "Sign out" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  for (const route of PROTECTED_ROUTES) {
    test(`${route} fits one row at 390px — no horizontal scroll`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();

      const [scrollWidth, clientWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});
