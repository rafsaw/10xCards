---
change_id: testing-generation-resilience
title: Runner bootstrap + generation resilience (test-plan Phase 1, R1+R5)
status: impl_reviewed
created: 2026-06-03
updated: 2026-06-03
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Runner bootstrap + generation resilience".
Risks covered: R1 (LLM provider returns invalid/corrupted/partial response and the generation flow breaks — user loses pasted text, sees a hang/500, or garbage candidates render/save as valid) and R5 (server trusts the client on untrusted input — empty front/back, client-supplied user_id/status, oversized paste — validation-parity gap), scoped to the generation slice.
Test types planned: unit + integration. This phase also bootstraps the test runner (test base is currently `none`).
Risk response intent:
- R1: prove that on malformed/partial/empty/timeout LLM output the pasted source text survives, the user gets a clean retry, and nothing invalid is persisted as a card.
- R5: prove the server rejects empty/oversized/ill-typed generation input and ignores client-supplied ownership/status fields, regardless of what the client sends.
After creating the folder, follow the downstream continuation rule (suggest /10x-research next).
