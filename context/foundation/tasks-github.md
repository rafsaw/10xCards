---
project: 10xCards
version: 4
status: active
created: 2026-05-26
updated: 2026-05-27
source: context/foundation/roadmap.md
mirrors:
  - github-issues (rafsaw/10xCards)
  - linear (Rafsaw / 10xCards) — see context/foundation/tasks-linear.md
---

# Tasks (GitHub + Linear mirrors)

GitHub Issues and Linear Issues are parallel mirrors of the roadmap. `context/foundation/roadmap.md` remains the source of truth for outcomes, prerequisites, risks, and unknowns — issues in either tracker are a navigational mirror. When roadmap content changes, update the matching issues in **both** trackers (or close + recreate); do not let any of the three drift silently.

> **Sync state (2026-05-27):** Roadmap v2, GitHub w #6-#11, Linear w RAF-10..RAF-15. Stare issues (GitHub #1-#5, Linear RAF-5..RAF-9 jako `Canceled`) wycofane razem z roadmap v1. Linear-specific notes: `context/foundation/tasks-linear.md`.

## Conventions

- **Title format:** `[<Roadmap ID>] <Suggested issue title from roadmap §Backlog Handoff>`.
- **One issue per roadmap item** (foundations + slices). Parked, Open Questions, and Streams do not get issues.
- **Body** mirrors the roadmap entry: Outcome, Change ID, PRD refs, Prerequisites, Parallel with, Blockers, Unknowns, Risk, Status, plus a back-link to `context/foundation/roadmap.md`.
- **Order:** by roadmap dependency chain (F-01 → S-01 → S-02; S-03 parallel after F-01; S-04 joins at S-02; S-05 parallel after F-01 but blocked on PRD update). Issue numbers reflect creation order, not priority.

## Labels

| Label | Color | Purpose |
| --- | --- | --- |
| `roadmap:foundation` | `5319e7` | Foundation items (`F-*`) — bounded enablers per roadmap §Foundations. |
| `roadmap:slice` | `0e8a16` | Vertical slices (`S-*`) — user-visible outcomes. |
| `stream:a-core-loop` | `1d76db` | Stream A: `F-01` → `S-01` → `S-02` (north-star chain). |
| `stream:b-library` | `fbca04` | Stream B: `S-03` (library + manual create, parallel after F-01). |
| `stream:c-review` | `bfd4f2` | Stream C: `S-04` (SRS review loop, joins A at S-02). |
| `stream:d-compliance` | `d4c5f9` | Stream D: `S-05` (account lifecycle / compliance, parallel after F-01). |
| `north-star` | `b60205` | Validation milestone for PRD Primary Success Criterion (S-02 only). |

## Issue index

| Roadmap ID | Change ID | GitHub | Linear | Labels | Stream | Status |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | `cards-schema-and-rls` | [#6](https://github.com/rafsaw/10xCards/issues/6) | [RAF-10](https://linear.app/rafsaw/issue/RAF-10) | `roadmap:foundation`, `stream:a-core-loop` | A | ready |
| S-01 | `first-gated-generation` | [#7](https://github.com/rafsaw/10xCards/issues/7) | [RAF-11](https://linear.app/rafsaw/issue/RAF-11) | `roadmap:slice`, `stream:a-core-loop` | A | proposed |
| S-02 | `atomic-save-to-deck` | [#8](https://github.com/rafsaw/10xCards/issues/8) | [RAF-12](https://linear.app/rafsaw/issue/RAF-12) | `roadmap:slice`, `stream:a-core-loop`, `north-star` | A | proposed |
| S-03 | `deck-edit-delete` | [#9](https://github.com/rafsaw/10xCards/issues/9) | [RAF-13](https://linear.app/rafsaw/issue/RAF-13) | `roadmap:slice`, `stream:b-library` | B | proposed |
| S-04 | `srs-review-session` | [#10](https://github.com/rafsaw/10xCards/issues/10) | [RAF-14](https://linear.app/rafsaw/issue/RAF-14) | `roadmap:slice`, `stream:c-review` | C | proposed |
| S-05 | `account-deletion-with-retention` | [#11](https://github.com/rafsaw/10xCards/issues/11) | [RAF-15](https://linear.app/rafsaw/issue/RAF-15) | `roadmap:slice`, `stream:d-compliance` | D | **blocked** (wymaga update PRD) |

Linear-specific: dependencies kodowane jako `Blocked by` relations na issue (RAF-11 ← RAF-10; RAF-12 ← RAF-10, RAF-11; RAF-13 ← RAF-10; RAF-14 ← RAF-10, RAF-12; RAF-15 ← RAF-10 + zewnętrzny blocker: PRD update). Każdy Linear issue linkuje z powrotem do GitHub mirror via attachment. Pełniejsze omówienie w `context/foundation/tasks-linear.md`.

## Sync rules

- **Roadmap is canonical.** When the two disagree, edit the roadmap first, then update the issue (`gh issue edit <n>`).
- **Status transitions:** `Status: ready` in roadmap → issue stays open and is eligible for `/10x-plan`. `Status: done` → close the issue (and `/10x-archive` records it under roadmap §Done). `Status: blocked` → issue stays open with banner in body + bracket in title (no native blocked state on GitHub).
- **No new tracker fields in GitHub.** Do not invent priorities, estimates, milestones, or assignees not present in the roadmap — that drift was the point of mirroring rather than re-shaping.
- **Roadmap §Parked items** stay out of GitHub. If a parked item is promoted, add it to the roadmap first, then mirror.

## Useful commands

```bash
# Re-list mirror
gh issue list --label roadmap:foundation,roadmap:slice --state all

# Open the next ready item (F-01 jako jedyny obecnie ready)
gh issue view 6

# Update an issue body from the roadmap
gh issue edit <n> --body-file -

# Re-create the whole mirror after a roadmap rewrite (jak v1 → v2):
#   1. gh issue delete <n> --yes  (dla każdego starego issue)
#   2. gh label edit/create  (jeśli streamy lub roadmap-* labels się zmieniły)
#   3. gh issue create --title "[X-NN] …" --body-file <body.md> --label … (dla każdego nowego)
```

For Linear, use the Linear MCP tools (`mcp__linear-server__save_issue` with `id: "RAF-<n>"` to update an existing issue, `list_issues` with `project: "10xCards"` to enumerate). **Aktualnie Linear mirror jest stale** (RAF-5..RAF-9 odzwierciedlają roadmap v1) — zanim wrócisz do `/10x-plan`-owania, zsynchronizuj Linear z roadmap v2 (delete + recreate, analogicznie do GitHub).
