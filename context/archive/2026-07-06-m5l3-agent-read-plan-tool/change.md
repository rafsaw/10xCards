---
change_id: m5l3-agent-read-plan-tool
title: Add read-only readPlan capability to the code-reviewer (first tool-loop agent)
status: archived
created: 2026-07-06
updated: 2026-07-07
archived_at: 2026-07-07T12:42:39Z
---

## Notes

M5L3 optional exercise. Extend the existing `packages/code-reviewer` from a "diff in →
structured verdict out" scorer toward a first tool-loop agent by adding one read-only
capability: `readPlan`, which reads `context/changes/<change-id>/plan.md` and lets the
reviewer compare the git diff against the plan.

Hard constraints:
- Read-only only. No write-tools, no GitHub PR comments/labels, no Jira/Linear/Slack, no
  external side effects.
- Preserve the existing ReviewResult/output contract.
- Path guardrails: only read the intended plan file under `context/changes/<change-id>/plan.md`
  (or a tightly-controlled equivalent). Block path traversal (`../../.env`), absolute paths,
  `.env`/secrets, and arbitrary repo files.
- Prefer a real bounded tool-loop integration over pre-reading plan.md into the prompt; if a
  real migration is too risky, document why and propose the smallest acceptable alternative.
- Do not invent APIs — check package.json and existing imports first.

Workflow: /10x-new → /10x-research → /10x-plan → /10x-plan-review → /10x-implement (phase by phase).
