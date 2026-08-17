Primary project rules are defined in:
@AGENTS.md

Claude-specific guidance:

- For non-trivial work, post a short plan (files to touch + approach) before editing.
- Prefer minimal diffs.
- Avoid speculative refactors.
- Before declaring a task done, run `npm run lint`, `npm run build`, and the relevant tests (`npm test` for unit/integration, `npm run test:e2e` for Playwright), plus a manual check of affected routes (see @AGENTS.md → Testing Guidelines).

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->

<!-- BEGIN @rafsaw/rafsaw-ai-toolkit -->
# Shared AI Rules for 10xCards

## General rules

- Prefer evidence-based reasoning.
- Do not invent repo facts. Inspect files before making claims.
- Separate facts, assumptions, and recommendations.
- Keep changes small and scoped.
- When reviewing code, prioritize correctness, security, and data isolation over formatting.

## Code review rules

- Do not approve changes only because tests pass.
- Check whether tests cover the actual risk.
- For security-sensitive changes, identify the trust boundary.
- For database or RLS changes, verify cross-user isolation assumptions.
- For CI/CD changes, verify secrets, permissions, and failure behavior.
<!-- END @rafsaw/rafsaw-ai-toolkit -->
