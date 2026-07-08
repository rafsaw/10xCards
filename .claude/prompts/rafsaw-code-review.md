# Shared Code Review Prompt

Review the provided code change as a technical reviewer.

Focus on:
- correctness
- security
- test coverage
- maintainability
- unintended side effects
- whether the change matches the stated intent

Avoid generic advice. Every finding should point to concrete evidence from the diff or files.

Group findings by severity:
- BLOCKER
- HIGH
- MEDIUM
- LOW
- OBSERVATION

If the change looks acceptable, say so clearly and mention what you checked.