Primary project rules are defined in:
@AGENTS.md

Claude-specific guidance:

- For non-trivial work, post a short plan (files to touch + approach) before editing.
- Prefer minimal diffs.
- Avoid speculative refactors.
- Before declaring a task done, run `npm run lint` and `npm run build`, and manually check affected routes — there is no test runner (see @AGENTS.md → Testing Guidelines).