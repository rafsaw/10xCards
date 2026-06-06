# E2E Testing Rules (read before generating or editing any spec here)

These rules govern every Playwright spec in `tests/e2e/`. They are the project's
second E2E quality lever, alongside the seed exemplar `seed.spec.ts`. Source of
truth: `.claude/skills/10x-e2e/references/` (rules, five anti-patterns, seed
pattern, prompt template). Model every new test on `seed.spec.ts`.

## The rules block

- Use `getByRole`, `getByLabel`, `getByText` as primary locators. Fall back to
  `getByTestId` only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable — no shared state between tests. Own
  setup, action, assertion, and cleanup in one self-contained block.
- Never use `page.waitForTimeout()`. Wait for specific conditions:
  `toBeVisible()`, `waitForURL()`, `waitForResponse()`.
- Assert the business outcome, not implementation details. Control question for
  every assertion: would it fail if the `test-plan.md` risk materialized? If not,
  it's decorative.
- Use unique identifiers (e.g. `Date.now()` suffix) for test data to avoid
  collisions in parallel runs. Clean up in `afterEach`.
- Use `storageState` for authentication (the `setup` project in
  `playwright.config.ts`) — never log in through the UI in individual tests.

## Real vs mocked boundaries

E2E ≠ zero mocking. Internal boundaries stay **real** — auth, routing, API,
Supabase DB — that's where integration risk hides. Mock only expensive or
non-deterministic **external** APIs at the network layer (e.g. OpenRouter/LLM via
`page.route()`). Caveat: an API the app calls **server-side** is not interceptable
by browser `page.route()` — mock it where the server actually calls out, or seed
the precondition directly.

## The five agent anti-patterns to review against

1. **Hallucinated assertion** — passes but never checks the risk's outcome.
2. **Brittle selector** — CSS/nth-child/XPath instead of a role/label/text.
3. **Shared state between tests** — test B assumes test A ran.
4. **`waitForTimeout`** instead of waiting for state.
5. **No cleanup** — created data never torn down; second run collides.

Name the test after the risk (`test('a manually created card persists across a
page reload', ...)`, not `test('test 1', ...)`). A generated test is reviewed
against these five and verified with a deliberate break before it counts as done.
