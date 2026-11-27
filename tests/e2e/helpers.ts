// Shared helpers for the /review specs. These are PURE FUNCTIONS OVER A `page` —
// no module-level state — so "each test must be independently runnable" (see
// AGENTS.md) still holds: nothing here is carried between tests, only the code
// that was previously copy-pasted into four spec files.
//
// `tests/e2e/seed.spec.ts` deliberately keeps its own inline copy of the seeding
// step: it is the exemplar every generated spec is modelled on, so it has to show
// the whole cycle in one readable file rather than delegate the interesting part.

import { expect, type Page } from "@playwright/test";

/**
 * Text the USER can actually see. In dev mode the Astro dev toolbar mirrors each
 * island's serialized props into a hidden `<pre>` inside its shadow root, and
 * Playwright locators pierce shadow DOM — so a bare `getByText()` for a card
 * front also matches that hidden copy. Route every visibility claim through this
 * helper so it speaks about the rendered session, not the toolbar mirror.
 */
export function visibleText(page: Page, text: string) {
  return page.getByText(text).filter({ visible: true });
}

/**
 * Create one due card through the library form, and do not return until the
 * server has it. A manually created card gets next_due_at=now (cards.ts), so it
 * enters /review immediately. Two races make the short version of this
 * unreliable, and both of them show up as a FAILURE IN A LATER SPEC:
 *
 * - the island can hydrate AFTER fill() lands, and React then renders from its
 *   own empty state, silently discarding what was typed, so "Create card" stays
 *   disabled forever. fill() is idempotent, so re-filling until the button
 *   enables converges as soon as the island is live — and an enabled button is
 *   the only visible proof that React, not just the DOM, has the text.
 * - on success the form navigates back to /library, so a wait that ANY text
 *   match satisfies returns before the card is saved: the two textareas this
 *   helper just filled match the front as well. The card's row in the library
 *   list is the first thing only a saved card can produce, so that is what we
 *   wait for; leaving the navigation in flight instead leaks the card past
 *   afterEach, and a leaked due card breaks every "Card 1 of 1" elsewhere.
 *
 * `exact: true` on the textboxes because the library search box ("Search front
 * or back…") also matches "Front"/"Back" by accessible name.
 */
export async function seedDueCard(page: Page, front: string, back: string, tag?: string) {
  await page.goto("/library");
  const submit = page.getByRole("button", { name: "Create card" });
  await expect(async () => {
    await page.getByRole("textbox", { name: "Front", exact: true }).fill(front);
    await page.getByRole("textbox", { name: "Back", exact: true }).fill(back);
    if (tag) await page.getByLabel("Lesson tag (optional)").fill(tag);
    await expect(submit).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 20000 });
  await submit.click();
  await expect(page.getByRole("listitem").filter({ hasText: front })).toBeVisible();
}
