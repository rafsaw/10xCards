---
project: 10xCards
version: 2
status: active
created: 2026-05-27
updated: 2026-05-30
source: context/foundation/roadmap.md
sibling: context/foundation/tasks-github.md
linear:
  workspace: rafsaw
  team: Rafsaw (key: RAF)
  project: 10xCards
  project_id: 93f69a9c-a1e5-4ff0-91b3-14d42425dcfd
  team_id: 53788563-f09a-4256-bd5a-2a93fe1e2dc2
  project_url: https://linear.app/rafsaw/project/10xcards-c2c463decb8e
---

# Tasks — Linear mirror

Linear Issues mirror the roadmap. `context/foundation/roadmap.md` is canonical; Linear issues są navigational/workflow surface. GitHub Issues mirror'ują tę samą roadmapę równolegle — patrz `tasks-github.md`. Gdy roadmap się zmienia, update obu trackerów (lub cancel + recreate).

> **Sync state (2026-05-27):** Linear w v2 (RAF-10..RAF-15 — odpowiadają roadmap v2 z 6 elementami: F-01 + S-01..S-05). Stare RAF-5..RAF-9 (mirror'owały roadmap v1) ustawione na status `Canceled` — Linear MCP nie wystawia `delete_issue`, więc `Canceled` to operacyjny ekwiwalent skasowania.
>
> **Stream A domknięty (2026-05-30):** cała pętla AI capture ukończona — RAF-10 (F-01) i RAF-11 (S-01) → `Done` 2026-05-28, RAF-12 (S-02, north-star) → `Done` 2026-05-30. GitHub mirrory #6/#7/#8 wszystkie `CLOSED`. Następne aktywne: RAF-13 (S-03, Backlog), RAF-14 (S-04, Backlog, blocked-by RAF-12 teraz spełnione), RAF-15 (S-05, Backlog, blocked na update PRD). Uwaga: pole `**Status:**` w body RAF-10/11/12 wciąż brzmi `ready`/`proposed` — workflow state w Linear jest źródłem prawdy, body Status line to znana, zaakceptowana rozbieżność (tak samo było przy RAF-10/11).

## Workspace shape

- **Workspace:** `rafsaw`
- **Team:** `Rafsaw` (key `RAF`, id `53788563-f09a-4256-bd5a-2a93fe1e2dc2`) — jedyny team w workspace.
- **Project:** `10xCards` (id `93f69a9c-a1e5-4ff0-91b3-14d42425dcfd`).
- **Standardowe statusy w teamie:** `Backlog`, `Todo`, `In Progress`, `Done`, `Canceled`, `Duplicate`.

## Konwencje

- **Title format:** `[<Roadmap ID>] <Suggested issue title>` — identyczny z GitHub. Pozwala wyszukiwać po `[F-01]` w obu trackerach.
- **Description format:** mirror sekcji z roadmap.md (Outcome, PRD refs, Prerequisites, Parallel with, Unknowns, Risk, Next move) + nagłówek z Change ID, Stream, Status, link do GitHub mirror.
- **State:** F-01 jako `ready` startuje w `Todo`, reszta `proposed` startuje w `Backlog`. Po wejściu w `/10x-plan` → `In Progress`. Po `/10x-archive` → `Done`. Anulowane wersje → `Canceled`.
- **Labels:** identyczna paleta jak GitHub — `roadmap:foundation`, `roadmap:slice`, `stream:{a-core-loop,b-library,c-review,d-compliance}`, `north-star`. Labels są team-scoped na Rafsaw.
- **Dependencies:** zakodowane jako natywne Linear `Blocked by` relations (nie adnotacje w body). To główna przewaga Linear nad GitHub w tym mirrorze.
- **GitHub backlinks:** każdy Linear issue ma attachment "GitHub mirror #N" z URL-em do odpowiadającego GH issue.

## Etykiety (team Rafsaw)

| Label | Color | Purpose |
| --- | --- | --- |
| `roadmap:foundation` | `5319e7` | Foundation items (`F-*`) — bounded enablers per roadmap §Foundations. |
| `roadmap:slice` | `0e8a16` | Vertical slices (`S-*`) — user-visible outcomes. |
| `stream:a-core-loop` | `1d76db` | Stream A: `F-01` → `S-01` → `S-02` (north-star chain). |
| `stream:b-library` | `fbca04` | Stream B: `S-03` (library + manual create, parallel after F-01). **Opis w Linear wciąż brzmi v1** (`S-03 → S-04`) — MCP nie wystawia `edit_label`, jest do ręcznej poprawki w UI lub odbudowy etykiety. |
| `stream:c-review` | `bfd4f2` | Stream C: `S-04` (SRS review loop, joins A at S-02). |
| `stream:d-compliance` | `d4c5f9` | Stream D: `S-05` (account lifecycle / compliance, parallel after F-01). |
| `north-star` | `b60205` | Validation milestone for PRD Primary Success Criterion (S-02 only). |

## Issue index

| Roadmap ID | Change ID | Linear | GitHub mirror | Labels | Stream | Linear state | Blocked by |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | `cards-schema-and-rls` | [RAF-10](https://linear.app/rafsaw/issue/RAF-10) | [#6](https://github.com/rafsaw/10xCards/issues/6) | `roadmap:foundation`, `stream:a-core-loop` | A | **Done** (2026-05-28) | — |
| S-01 | `first-gated-generation` | [RAF-11](https://linear.app/rafsaw/issue/RAF-11) | [#7](https://github.com/rafsaw/10xCards/issues/7) | `roadmap:slice`, `stream:a-core-loop` | A | **Done** (2026-05-28) | RAF-10 |
| S-02 | `atomic-save-to-deck` | [RAF-12](https://linear.app/rafsaw/issue/RAF-12) | [#8](https://github.com/rafsaw/10xCards/issues/8) | `roadmap:slice`, `stream:a-core-loop`, `north-star` | A | **Done** (2026-05-30) | RAF-10, RAF-11 |
| S-03 | `deck-edit-delete` | [RAF-13](https://linear.app/rafsaw/issue/RAF-13) | [#9](https://github.com/rafsaw/10xCards/issues/9) | `roadmap:slice`, `stream:b-library` | B | Backlog | RAF-10 |
| S-04 | `srs-review-session` | [RAF-14](https://linear.app/rafsaw/issue/RAF-14) | [#10](https://github.com/rafsaw/10xCards/issues/10) | `roadmap:slice`, `stream:c-review` | C | **Done** (implemented 2026-05-31; Linear not yet updated) | RAF-10, RAF-12 |
| S-05 | `account-deletion-with-retention` | [RAF-15](https://linear.app/rafsaw/issue/RAF-15) | [#11](https://github.com/rafsaw/10xCards/issues/11) | `roadmap:slice`, `stream:d-compliance` | D | Backlog (priority: Medium) | RAF-10 + zewnętrzny: PRD update |

## Anulowane (v1, mirror starej roadmapy)

| Linear | Stary Roadmap ID | Change ID | Status |
| --- | --- | --- | --- |
| [RAF-5](https://linear.app/rafsaw/issue/RAF-5) | F-01 (v1) | `cards-schema-and-rls` | Canceled |
| [RAF-6](https://linear.app/rafsaw/issue/RAF-6) | S-01 (v1) | `ai-candidate-generation-with-accept-reject` | Canceled |
| [RAF-7](https://linear.app/rafsaw/issue/RAF-7) | S-02 (v1, north star) | `srs-review-session` | Canceled |
| [RAF-8](https://linear.app/rafsaw/issue/RAF-8) | S-03 (v1) | `manual-card-creation` | Canceled |
| [RAF-9](https://linear.app/rafsaw/issue/RAF-9) | S-04 (v1) | `card-library-browse-edit-delete` | Canceled |

> **Uwaga:** Linear MCP (`mcp__linear-server__*`) nie wystawia narzędzia `delete_issue`. `Canceled` to najczystszy operacyjny ekwiwalent — issues znikają z aktywnego backlogu, ich `Blocked by` relations na inne anulowane issues pozostają (nieaktywne — nie blokują nic w v2). Dla pełnego skasowania użyj Linear web UI lub Linear GraphQL API.

## Sync rules (Linear-specific)

- **Roadmap is canonical.** Conflict → edit roadmap first, then `mcp__linear-server__save_issue` z `id: "RAF-<n>"`.
- **Dependencies append-only via MCP:** `blockedBy: [...]` dodaje, zerwanie via `removeBlockedBy: [...]`.
- **Status transitions:**
  - Roadmap `Status: ready` → Linear `Todo` (widoczne w Active, gotowe do `In Progress`).
  - Roadmap `Status: proposed` → Linear `Backlog`.
  - `/10x-plan` start → Linear `In Progress`.
  - `/10x-archive` → Linear `Done` (z lookup'em do roadmap `## Done`).
  - Roadmap `Status: blocked` → Linear pozostaje `Backlog` z bannerem w body + `priority: Medium` (jak RAF-15) żeby wyróżnić.
- **GitHub mirror linkage** — przy tworzeniu / aktualizacji użyj `links: [{url: "https://github.com/rafsaw/10xCards/issues/N", title: "GitHub mirror #N"}]`. To pojawia się jako attachment w Linear UI.
- **No new tracker fields** — żadnych priorytetów / estimates / milestones / assignees których nie ma w roadmapie. Wyjątek: priority Medium dla `blocked` issues (visual cue dla Linear backlog view).

## Re-create the whole mirror after a roadmap rewrite

Sekwencja użyta przy migracji v1 → v2:

1. **Anuluj stare issues** (Linear MCP nie ma delete):
   ```
   mcp__linear-server__save_issue  id: "RAF-<n>"  state: "Canceled"     # dla każdego starego
   ```
2. **Dodaj brakujące labels** (MCP nie ma `edit_label`, więc opisy istniejących trzeba poprawić w UI):
   ```
   mcp__linear-server__create_issue_label  name: "stream:<x>"  color: "#..."  description: "..."  teamId: "<team-uuid>"
   ```
3. **Utwórz nowe issues w kolejności zależności** (F-01 najpierw, potem slices z `blockedBy: [RAF-N]`):
   ```
   mcp__linear-server__save_issue  team: "Rafsaw"  project: "10xCards"  title: "[X-NN] …"  description: "…"  labels: [...]  blockedBy: [...]  links: [{url, title}]
   ```
4. **Zaktualizuj `tasks-github.md`** (kolumna Linear) i `tasks-linear.md` (cały plik) z nowymi RAF-N.

## Limity Linear MCP (na 2026-05-27)

Co MCP wystawia, czego nie wystawia — żeby następne migracje nie traciły czasu na próby:

| Operacja | Tool | Notes |
| --- | --- | --- |
| Utwórz issue | `save_issue` (bez `id`) | OK. |
| Update issue | `save_issue` (z `id`) | OK; `blockedBy`/`blocks`/`relatedTo` są append-only — zerwanie via `removeBlockedBy`. |
| Anuluj issue | `save_issue` + `state: "Canceled"` | Operacyjny ekwiwalent skasowania. |
| **Skasuj issue** | — | **Niedostępne via MCP.** Tylko Linear UI lub GraphQL API. |
| Utwórz label | `create_issue_label` | OK; scope = team (`teamId`) lub workspace (bez `teamId`). |
| **Edytuj label** | — | **Niedostępne via MCP.** Opisy/kolory tylko w UI. (Stąd `stream:b-library` ma wciąż v1-owy opis.) |
| Skasuj label | — | Niedostępne via MCP. |
| Lista statuses | `list_issue_statuses` | OK; team-scoped. |
| Dodać GitHub link | `save_issue` + `links: [{url, title}]` | OK; pojawia się jako attachment. Append-only. |

## Useful MCP calls

```text
# Lista bieżących issues
mcp__linear-server__list_issues  project: "10xCards"  state: "Backlog"

# Update issue body z roadmapy
mcp__linear-server__save_issue  id: "RAF-10"  description: "<nowe body>"

# Pokaż jeden issue ze wszystkimi relacjami
mcp__linear-server__get_issue  id: "RAF-12"  includeRelations: true

# Wszystkie labels team Rafsaw
mcp__linear-server__list_issue_labels  team: "Rafsaw"  limit: 100
```
