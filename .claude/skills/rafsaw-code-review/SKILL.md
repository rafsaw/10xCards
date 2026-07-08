---
name: code-review
description: Shared code review skill for AI-assisted reviews.
---

# Code Review Skill

Use this skill when reviewing application code, GitHub pull requests, or CI/CD changes.

## Goals

- Identify correctness issues.
- Identify security and data isolation risks.
- Check whether the change matches the intended scope.
- Prefer evidence-based comments over generic style advice.
- Separate blocking issues from observations.

## Review dimensions

1. Implementation correctness
2. Security and privacy
3. Test coverage
4. Maintainability
5. Operational risk
6. Scope control

## Output format

Return review findings grouped by severity:

- BLOCKER
- HIGH
- MEDIUM
- LOW
- OBSERVATION

Each finding should include:

- finding
- evidence
- impact
- suggested fix