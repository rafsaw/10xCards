---
project: 10xCards
version: 1
status: active
created: 2026-05-27
updated: 2026-05-27
source: context/foundation/roadmap.md
mirror: linear
workspace: rafsaw
team: Rafsaw (RAF)
linear_project: 10xCards
linear_project_url: https://linear.app/rafsaw/project/10xcards-c2c463decb8e
---

# Tasks (Linear mirror)

Linear Issues mirror the roadmap alongside the GitHub mirror (see `tasks-github.md`). `context/foundation/roadmap.md` remains the source of truth for outcomes, prerequisites, risks, and unknowns — Linear issues are a navigational mirror that adds proper dependency graphs (`Blocked by` / `Blocks`) which the GitHub mirror encodes only in prose.

This mirror was created on 2026-05-27 via the Linear MCP server (no manual Linear web UI work).

## Workspace shape

- **Workspace:** `rafsaw`
- **Team:** `Rafsaw` (key `RAF`) — currently the only team in the workspace.
- **Project:** `10xCards` (id `93f69a9c-a1e5-4ff0-91b3-14d42425dcfd`).
- **Status (project):** Backlog. All issues created at default state `Backlog`.

## Conventions

- **Title format:** `[<Roadmap ID>] <Suggested issue title from roadmap §Backlog Handoff>` — identical to the GitHub mirror so issues are searchable across trackers by `[F-01]` etc.
- **One issue per roadmap item** (foundations + slices). Parked, Open Questions, and Streams do not get Linear issues.
- **Body** mirrors the roadmap entry: Outcome, PRD refs, Prerequisites, Parallel with, Unknowns, Risk. Header lists Roadmap ID, Change ID, Status, GitHub mirror link, and back-pointer to `context/foundation/roadmap.md`.
- **GitHub mirror link:** every Linear issue carries a Link Attachment to its GitHub counterpart (`rafsaw/10xCards#<n>`) so the cross-reference shows up in Linear's sidebar.
- **Dependencies:** encoded as native Linear `Blocked by` relations on the issue itself — not as label text. This is the main expressive gain over the GitHub mirror.

## Labels (team-scoped)

All five labels live on the `Rafsaw` team and match the GitHub label scheme name-for-name and color-for-color.

| Label | Color | Linear ID | Purpose |
| --- | --- | --- | --- |
| `roadmap:foundation` | `#5319e7` | `c9f438f9-9048-4688-99a7-4b8b4b2ed3ee` | Foundation items (`F-*`) — bounded enablers per roadmap §Foundations. |
| `roadmap:slice` | `#0e8a16` | `5cb8afe6-44a2-4b77-94c5-8f8bbd7e60cc` | Vertical slices (`S-*`) — user-visible outcomes. |
| `stream:a-core-loop` | `#1d76db` | `c082a0d9-2ea4-406e-9241-eea8aa30711f` | Stream A: `F-01` → `S-01` → `S-02` (north-star chain). |
| `stream:b-library` | `#fbca04` | `8d687a55-c78a-406f-8d2b-f188c3f57afd` | Stream B: `S-03` → `S-04` (library completeness, parallel after F-01). |
| `north-star` | `#b60205` | `08f4393c-f352-43b5-8c6a-9fc69b97efc4` | Validation milestone for PRD Primary Success Criterion (S-02 only). |

## Issue index

| Roadmap ID | Change ID | Linear | GitHub | Labels | Blocked by | Stream | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | `cards-schema-and-rls` | [RAF-5](https://linear.app/rafsaw/issue/RAF-5) | [#1](https://github.com/rafsaw/10xCards/issues/1) | `roadmap:foundation`, `stream:a-core-loop` | — | A | ready |
| S-01 | `ai-candidate-generation-with-accept-reject` | [RAF-6](https://linear.app/rafsaw/issue/RAF-6) | [#2](https://github.com/rafsaw/10xCards/issues/2) | `roadmap:slice`, `stream:a-core-loop` | RAF-5 | A | proposed |
| S-02 | `srs-review-session` | [RAF-7](https://linear.app/rafsaw/issue/RAF-7) | [#4](https://github.com/rafsaw/10xCards/issues/4) | `roadmap:slice`, `stream:a-core-loop`, `north-star` | RAF-5, RAF-6 | A | proposed |
| S-03 | `manual-card-creation` | [RAF-8](https://linear.app/rafsaw/issue/RAF-8) | [#3](https://github.com/rafsaw/10xCards/issues/3) | `roadmap:slice`, `stream:b-library` | RAF-5 | B | proposed |
| S-04 | `card-library-browse-edit-delete` | [RAF-9](https://linear.app/rafsaw/issue/RAF-9) | [#5](https://github.com/rafsaw/10xCards/issues/5) | `roadmap:slice`, `stream:b-library` | RAF-5, RAF-6 | B | proposed |

Identifier note: Linear sequence starts at `RAF-5` because identifiers `RAF-1..RAF-4` were already consumed by earlier workspace activity before this mirror was created. There is no `RAF-1..RAF-4` gap to interpret — the offset is incidental, not semantic.

## Dependency graph

```
              RAF-5 (F-01)
              /  |  \
             /   |   \
         RAF-6  RAF-8  (Stream A vs B branch after F-01)
         (S-01) (S-03)
          /  \
         /    \
     RAF-7   RAF-9
     (S-02   (S-04)
      north
      star)
```

- **Stream A (north-star chain):** RAF-5 → RAF-6 → RAF-7.
- **Stream B (library):** RAF-5 → RAF-8; RAF-5 + RAF-6 → RAF-9 (S-04 needs S-01 because library lists / edits AI-saved cards too).
- **Hard dependency on RAF-5:** all four slices. RAF-5 is the unblocker for everything else.

## How this mirror was created (session log, 2026-05-27)

1. **Discovery.** `list_teams` returned the single team `Rafsaw`; `list_projects` found an existing `10xCards` project; `list_issues` on the project was empty; `list_issue_labels` showed only default labels (`Bug`, `Feature`, `Improvement`) — none of the roadmap-shaped labels existed yet.
2. **Labels first.** Created the five team-scoped labels above with `create_issue_label`, matching GitHub colors and descriptions so the two mirrors are visually identical.
3. **Issues in dependency order.** Created F-01 (`RAF-5`) first so the four slices could reference it via `blockedBy` at creation time. Then S-01 (`RAF-6`, blocked by RAF-5). Then S-02, S-03, S-04 were created in parallel — each referencing its prerequisites via `blockedBy: ["RAF-5", ...]`.
4. **GitHub back-links.** Every issue was created with a `links` attachment pointing at the matching `rafsaw/10xCards#<n>` GitHub issue so both directions of the mirror are walkable.
5. **Index updated.** `context/foundation/tasks-github.md` now has a GitHub + Linear two-column index; this file is the Linear-side companion.

## Sync rules

- **Roadmap is canonical.** When roadmap, GitHub, and Linear disagree: edit the roadmap first, then update both mirrors. Never resolve a disagreement by "letting Linear win".
- **Status transitions:** `Status: ready` in roadmap → Linear issue stays in `Backlog` (or moves to `Todo`/`In Progress` once `/10x-plan` runs). `Status: done` in roadmap → close the Linear issue (state `Done`) and `/10x-archive` records it under roadmap §Done.
- **Dependency edits:** keep `Blocked by` in sync if the roadmap changes a Prerequisites line. Use `save_issue` with `blockedBy: [...]` (append-only) or `removeBlockedBy: [...]` to detach.
- **No new tracker fields in Linear.** Do not invent priorities, estimates, cycles, or assignees not present in the roadmap. The roadmap explicitly avoids dates/story points/velocity (`§Roadmap boundaries`); this mirror inherits that discipline.
- **Roadmap §Parked items** stay out of Linear. If a parked item is promoted, add it to the roadmap first, then mirror to both GitHub and Linear.

## Useful Linear MCP calls

```text
# List all mirrored issues
mcp__linear-server__list_issues(project="10xCards")

# Update an existing issue body from the roadmap (e.g. RAF-6)
mcp__linear-server__save_issue(id="RAF-6", description="...")

# Add a new blocker after a roadmap edit
mcp__linear-server__save_issue(id="RAF-9", blockedBy=["RAF-6"])

# Close on archive
mcp__linear-server__save_issue(id="RAF-5", state="Done")
```

When calling `save_issue` from this skill, send Markdown content with **literal newlines and characters** — the MCP server documentation explicitly says not to escape `\n` as a backslash-n string. (Linear MCP's server instructions, surfaced on first call.)
