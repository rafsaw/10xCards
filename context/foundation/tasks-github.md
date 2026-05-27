---
project: 10xCards
version: 2
status: active
created: 2026-05-26
updated: 2026-05-27
source: context/foundation/roadmap.md
mirrors:
  - github-issues (rafsaw/10xCards)
  - linear (Rafsaw / 10xCards)
---

# Tasks (GitHub + Linear mirrors)

GitHub Issues and Linear Issues are parallel mirrors of the roadmap. `context/foundation/roadmap.md` remains the source of truth for outcomes, prerequisites, risks, and unknowns — issues in either tracker are a navigational mirror. When roadmap content changes, update the matching issues in **both** trackers (or close + recreate); do not let any of the three drift silently.

## Conventions

- **Title format:** `[<Roadmap ID>] <Suggested issue title from roadmap §Backlog Handoff>`.
- **One issue per roadmap item** (foundations + slices). Parked, Open Questions, and Streams do not get issues.
- **Body** mirrors the roadmap entry: Outcome, Change ID, PRD refs, Prerequisites, Parallel with, Blockers, Unknowns, Risk, Status, plus a back-link to `context/foundation/roadmap.md#<anchor>`.
- **Order:** by roadmap dependency chain (F-01 → S-01 → S-02; S-03 → S-04 parallel after F-01). Issue numbers reflect creation order, not priority.

## Labels

| Label | Color | Purpose |
| --- | --- | --- |
| `roadmap:foundation` | `5319e7` | Foundation items (`F-*`) — bounded enablers per roadmap §Foundations. |
| `roadmap:slice` | `0e8a16` | Vertical slices (`S-*`) — user-visible outcomes. |
| `stream:a-core-loop` | `1d76db` | Stream A: `F-01` → `S-01` → `S-02` (north-star chain). |
| `stream:b-library` | `fbca04` | Stream B: `S-03` → `S-04` (library completeness, parallel after F-01). |
| `north-star` | `b60205` | Validation milestone for PRD Primary Success Criterion (S-02 only). |

## Issue index

| Roadmap ID | Change ID | GitHub | Linear | Labels | Stream | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | `cards-schema-and-rls` | [#1](https://github.com/rafsaw/10xCards/issues/1) | [RAF-5](https://linear.app/rafsaw/issue/RAF-5) | `roadmap:foundation`, `stream:a-core-loop` | A | ready |
| S-01 | `ai-candidate-generation-with-accept-reject` | [#2](https://github.com/rafsaw/10xCards/issues/2) | [RAF-6](https://linear.app/rafsaw/issue/RAF-6) | `roadmap:slice`, `stream:a-core-loop` | A | proposed |
| S-03 | `manual-card-creation` | [#3](https://github.com/rafsaw/10xCards/issues/3) | [RAF-8](https://linear.app/rafsaw/issue/RAF-8) | `roadmap:slice`, `stream:b-library` | B | proposed |
| S-02 | `srs-review-session` | [#4](https://github.com/rafsaw/10xCards/issues/4) | [RAF-7](https://linear.app/rafsaw/issue/RAF-7) | `roadmap:slice`, `stream:a-core-loop`, `north-star` | A | proposed |
| S-04 | `card-library-browse-edit-delete` | [#5](https://github.com/rafsaw/10xCards/issues/5) | [RAF-9](https://linear.app/rafsaw/issue/RAF-9) | `roadmap:slice`, `stream:b-library` | B | proposed |

Linear-specific: dependencies are encoded as `Blocked by` relations on the issue itself (RAF-6 ← RAF-5; RAF-7 ← RAF-5, RAF-6; RAF-8 ← RAF-5; RAF-9 ← RAF-5, RAF-6). Each Linear issue links back to its GitHub mirror via an attachment.

## Sync rules

- **Roadmap is canonical.** When the two disagree, edit the roadmap first, then update the issue (`gh issue edit <n>`).
- **Status transitions:** `Status: ready` in roadmap → issue stays open and is eligible for `/10x-plan`. `Status: done` → close the issue (and `/10x-archive` records it under roadmap §Done).
- **No new tracker fields in GitHub.** Do not invent priorities, estimates, milestones, or assignees not present in the roadmap — that drift was the point of mirroring rather than re-shaping.
- **Roadmap §Parked items** stay out of GitHub. If a parked item is promoted, add it to the roadmap first, then mirror.

## Useful commands

```bash
# Re-list mirror
gh issue list --label roadmap:foundation,roadmap:slice --state all

# Open the next ready item
gh issue list --label roadmap:foundation --state open --search "ready in:body"

# Update an issue body from the roadmap
gh issue edit <n> --body-file -
```

For Linear, use the Linear MCP tools (`mcp__linear-server__save_issue` with `id: "RAF-<n>"` to update an existing issue, `list_issues` with `project: "10xCards"` to enumerate).
