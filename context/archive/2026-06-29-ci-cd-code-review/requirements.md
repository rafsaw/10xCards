## Overall concept

- GitHub Actions workflow for pull requests to master
- Review is executed by our existing M5L2 code review agent
- Use composite action so the workflow stays readable

## Input parameters

- pull request title
- pull request description (?? cost tradeoff)
- git diff

## Code Review Criteria

- **implementation correctness** — does the code do what it intends, without logic errors, broken edge cases, or regressions?
  - **1**: clearly broken; wrong results, crashes, or fails its stated purpose.
  - **10**: correct for all paths and edge cases; no logic or data-handling bugs.
- **idiomaticity** — does the code follow language, framework, and project conventions and patterns?
  - **1**: fights the stack; ignores existing patterns, naming, and idioms.
  - **10**: reads like the surrounding codebase; idiomatic and consistent throughout.
- **complexity / maintainability** — is the change as simple as possible and easy to change later?
  - **1**: tangled, duplicated, or over-engineered; hard to follow or extend.
  - **10**: minimal, well-factored, and clear; easy for the next person to modify.
- **tests and risk coverage** — are the riskiest behaviors exercised by meaningful tests?
  - **1**: no tests, or tests that miss the key risks and edge cases.
  - **10**: high-risk paths and edge cases covered by focused, reliable tests.
- **documentation** — are non-obvious decisions, public APIs, and usage explained where needed?
  - **1**: missing or misleading docs/comments for non-obvious behavior.
  - **10**: just-enough docs and comments; intent and usage are clear without clutter.
- **security and safety** — does the change avoid introducing vulnerabilities or unsafe handling of data and secrets?
  - **1**: introduces a real vulnerability or leaks/ mishandles sensitive data.
  - **10**: inputs validated, secrets protected, no new attack surface or unsafe operations.

## Parked for later

- business alignment (require broader context)
- architecture fit across wider system context (require broader context)

## Expected side-effects

- PR comment with review summary
- label: `ai-cr:failed` (red) OR `ai-cr:passed` (green)

## Expected behavior

- first review runs on new PR
- retry review when label `ai-cr:review` is added
- advisory only for now: failed AI review should not block merge yet