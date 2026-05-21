---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

**10xCards** — an AI-assisted spaced-repetition flashcard MVP. A user pastes a passage, AI proposes candidate cards, user accepts/rejects each one before it enters their study library. Greenfield, web-app, single-user dogfood for v1, multi-user architecture from day one. PRD is at `context/foundation/prd.md`; raw shape conversation at `context/foundation/shape-notes.md`. No application code exists yet — the project is still in the planning chain (`/10x-shape` → `/10x-prd` → `/10x-tech-stack-selector` → `/10x-bootstrapper`).

## Editing CLAUDE.md — the regeneration trap

Everything between `` is **overwritten** every time the user pulls lesson artifacts (`npx @przeprogramowani/10x-cli@latest get mXlY --tool claude-code`). Place any persistent project guidance **outside** those markers (i.e., below this line or above the BEGIN). The same caveat applies to anything under `.claude/skills/10x-*/` — those directories are CLI-managed and listed in `.claude/.10x-cli-manifest.json`.

## 10x CLI commands the user runs

- `npx @przeprogramowani/10x-cli@latest auth` — one-time login; writes `C:\Users\rafal\AppData\Roaming\10x-cli\auth.json`.
- `npx @przeprogramowani/10x-cli@latest get mXlY` — pull lesson `mXlY` skills into `.claude/skills/`; respects the tool set in `C:\Users\rafal\AppData\Roaming\10x-cli\config.json` (currently `claude-code`). Add `--tool claude-code` to override.
- `npx @przeprogramowani/10x-cli@latest doctor` — diagnose CLI/auth/config issues; first stop when slash commands don't appear.
- `10x ...` is the short alias for `npx @przeprogramowani/10x-cli@latest ...` (works once the package is cached).

Helper meta-skills (`10x-cli-setup`, `10x-cli-guide`) install globally to `C:\Users\rafal\.agents\skills\` via `npx skills add przeprogramowani/10x-cli -g`. With `-g` they don't appear under `.claude/skills/` in this project but are still loaded; without `-g` they scope to the current project only.

## Where the user is in the lesson chain

Current lesson is **m1l2** (per `.claude/.10x-cli-manifest.json`) — tech-stack selection. PRD already exists, so `/10x-tech-stack-selector` is the next intended step; it will write `context/foundation/tech-stack.md`. Do not invent application files (package.json, src/, etc.) — wait for `/10x-bootstrapper` (lesson 3) to scaffold the chosen starter.

## Hard rule from the lesson body

Never write to `context/archive/` or `context/foundation/archive/`. Archived artifacts are immutable; if a resolved write path lands there, abort with: *"This change is archived. Open a new change with `/10x-new` instead."*

## Environment

Windows 11 + PowerShell. Use PowerShell syntax (`$env:VAR`, `Test-Path`, `;` chaining — no `&&`). The user's notes mix Polish and English; respond in whichever language the user used in their latest message.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Module 1, Lesson 3

Scaffold the project for the stack you picked in Lesson 2, with the **bootstrap chain**:

```
(/10x-init  →  /10x-shape  →  /10x-prd)  →  /10x-tech-stack-selector  →  /10x-bootstrapper
```

The PRD chain ships from Lesson 1 and the tech-stack-selector ships from Lesson 2 — both re-included in this lesson so you can fix the PRD or swap the stack mid-flight. `/10x-bootstrapper` is the lesson's main topic. The chain ends here in v1; a future Lesson 4 will set up agent context (`CLAUDE.md`, `AGENTS.md`).

### Task Router — Where to start

| Skill | Use it when |
| --- | --- |
| **Bootstrap (lesson focus)** | |
| `/10x-bootstrapper` | You have a hand-off at `context/foundation/tech-stack.md` (written by `/10x-tech-stack-selector`) and you are ready to scaffold the project into the current directory. The skill reads the hand-off, looks up the chosen card in the starter registry, runs its CLI through one of three cwd strategies (scaffold into a temp directory then move files up; scaffold directly into the current directory; clone a starter repo without keeping its git history), preserves `context/` always, sidelines other clashes as `.scaffold` siblings, runs a light pre-scaffold recency check and a deeper post-scaffold audit, and writes a verification log to `context/changes/bootstrap-verification/verification.md`. Use AFTER `/10x-tech-stack-selector`. |
| **Re-run upstream if needed** | |
| `/10x-init` / `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` | Bundled so you can fix the PRD or swap the stack mid-flight. If `/10x-bootstrapper` surfaces a registry-drift refusal or you change your mind on the starter, re-run `/10x-tech-stack-selector` to regenerate `tech-stack.md` and re-invoke. |

### How the chain hands off

- `/10x-tech-stack-selector` (Lesson 2) writes `context/foundation/tech-stack.md` with a 4-key frontmatter (`starter_id`, `package_manager`, `project_name`, `hints`) plus a one-paragraph `## Why this stack` body.
- `/10x-bootstrapper` reads that file FULLY (no fallback to conversation history). If it is absent, the skill refuses with a one-sentence redirect to `/10x-tech-stack-selector` and stops — no inline mini-handoff, no standalone-mode in v1.
- The chosen `starter_id` is looked up in `/skills/10x-tech-stack-selector/references/starter-registry.yaml`. The skill consumes that registry; it does not own it. A CI validator (`scripts/validate-starter-registry-sync.mjs`) prevents bootstrapper from referencing a `starter_id` absent from the registry.
- The skill writes `context/changes/bootstrap-verification/verification.md` as the audit-trail log for the run. Schema in `/skills/10x-bootstrapper/references/verification-log-schema.md`.

### What bootstrapper captures (and what it does NOT)

- **Captured (v1)**: scaffold via the chosen card's `cmd_template` (CLI delegation, not inline file generation), three cwd strategies dispatched from `bootstrapper-config.yaml` (`subdir-then-move`, `native-cwd`, `git-clone`), strict conflict policy producing `.scaffold` siblings + always preserving `context/`, two verification slots (light pre-scaffold recency check + deep post-scaffold language-aware audit), severity-tiered audit summary, full verification log on disk.
- **NOT captured in v1 (deliberate)**: `AGENTS.md` / `CLAUDE.md` generation (deferred to a future Lesson 4 — "Memory Architecture"); per-starter cert-element placement overlays (live with the future agent-context skill, not here); CI workflow files; AI-as-bridge fallback for stacks outside the registry (deferred to v2 — in v1 chain-mode tech-stack-selector already gates on the registry, so the case cannot arise); standalone-mode where the user names a stack inline without a hand-off (deferred to v2); compensation actions for `bootstrapper_confidence: best-effort` or `quality_override: true` (surfaced in conversation but no automated follow-up — that, too, is the future memory-architecture skill's job).

### The conflict policy

When the skill moves files from a temp scaffold directory up into your current working directory, it applies a strict matrix:

- **`context/**`** — anything the scaffold tried to write under `context/` is **dropped**. Your `context/` is the source of truth for the bootstrap chain (PRD, tech-stack hand-off, plans, frames) and is never overwritten.
- **`.gitignore`** — append-merged: your existing lines stay in order, then the scaffold's lines are de-duped against your set and appended with a separator comment. Git's ignore semantics are additive, so combining is safe.
- **`package.json`, `README.md`, `CLAUDE.md`, `AGENTS.md`, root-level `*.md`** — your existing file wins; the scaffold's copy lands as `<filename>.scaffold` sibling. You can `diff README.md README.md.scaffold` to see what the starter shipped vs what you had.
- **Anything else** — moves silently if no conflict, sidelined as `<filename>.scaffold` if there is one. The matrix never deletes user files.

For the `git-clone` strategy (10x-astro-starter and similar): the cloned `.git/` is deleted before move-up, so the upstream starter's history does not leak into your repo. You initialise your own history afterwards (`git init`).

### Verification log

Every run writes `context/changes/bootstrap-verification/verification.md`. Sections:

- **`## Hand-off`** — verbatim copy of the tech-stack.md frontmatter and `## Why this stack` body.
- **`## Pre-scaffold verification`** — recency findings table (npm package version + `time.modified` for JS starters; GitHub `pushed_at` for any starter with a GitHub `docs_url`).
- **`## Scaffold log`** — the resolved CLI invocation, exit code, files moved, conflicts surfaced as `.scaffold` siblings, `.gitignore` handling.
- **`## Post-scaffold audit`** — full per-language audit output (`npm audit --json` for JS, `pip-audit` for Python, `cargo audit` for Rust, etc.). Severity-tiered: CRITICAL and HIGH surfaced inline in chat, MODERATE and LOW log-only. Direct-vs-transitive split where the tool supports it.
- **`## Hints recorded but not acted on`** — every hint from the hand-off bootstrapper read but did not act on in v1. Audit-trail completeness for the future memory-architecture skill.
- **`## Next steps`** — pointer text. v1 names "your project is scaffolded and verified — happy hacking" and flags the future Lesson 4 skill as the next chain link.

The folder (`context/changes/bootstrap-verification/`) deliberately has no `change.md`. Bootstrap runs are one-shot artifacts, not tracked workflow changes — the folder hosts the log and nothing else. Re-runs apply a warn-and-confirm guard before overwriting; the escape hatch is `verification-v2.md` (and so on).

### Foundation paths used by this lesson

- `context/foundation/tech-stack.md` — input (from Lesson 2)
- `context/changes/bootstrap-verification/verification.md` — output (the audit-trail log)
- `context/foundation/lessons.md` — recurring rules & pitfalls
- `docs/reference/contract-surfaces.md` — load-bearing names registry

### Universal language

The shipped skill carries no 10xDevs / cohort / certification references. The post-scaffold audit dispatches by `language_family` against a small lookup table; cohorts whose stack lands in `java`, `php`, `dart`, or a multi-language combination see a "no built-in audit tool for this ecosystem" log line and a recommended external tool, not a fake "0 findings" record.

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Module 1, Lesson 4

Onboard the agent to the project you scaffolded in Lesson 3 with the **agent-context chain**:

```
(/10x-init  →  /10x-shape  →  /10x-prd  →  /10x-tech-stack-selector  →  /10x-bootstrapper)  →  /10x-agents-md  →  /10x-rule-review  →  /10x-lesson
```

The PRD → tech-stack → bootstrap chain ships from Lessons 1–3 (re-included so you can fix the project mid-flight). `/10x-agents-md`, `/10x-rule-review`, and `/10x-lesson` are the lesson's main topics. The chain extends in Lesson 5 to the infra/deploy step.

### Task Router — Where to start

| Skill | Use it when |
| --- | --- |
| **Agent context (lesson focus)** | |
| `/10x-agents-md` | The repo is scaffolded but the agent has no project-specific onboarding. Inspects the repo (package manifest, README, scripts, lint/test config, layout, commit history) and writes a concise, ordered "Repository Guidelines" to `AGENTS.md` (or, when invoked from a subdirectory, a directory-level `AGENTS.md` reframed around local conventions and the dominant unit). Use as an alternative to the host's built-in `/init` or as a fallback for tools without one. Repo-level body targets ~200 lines; directory-level guides target 120–250 words. |
| `/10x-rule-review <path>` | You have a rules-for-AI file (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`, nested per-area files) and want a 5-axis scorecard: length, embedded code/config snippets, precision of language, redundancy with public knowledge, and rule ordering. Tool-agnostic — scores the artifact's condition, not the project. Default output is read-only; only Check 5 (reorder) may edit, and only with explicit approval. |
| `/10x-lesson [seed]` | You spotted a recurring rule worth surfacing for future runs of `/10x-frame`, `/10x-research`, `/10x-plan`, `/10x-plan-review`, `/10x-implement`, and `/10x-impl-review`. Appends a single entry (Context / Problem / Rule / Applies to) to `context/foundation/lessons.md`. Self-bootstraps the file with the canonical `# Lessons Learned` header on first use. Append-only — never reorders or rewrites prior entries. |
| **Re-run upstream if needed** | |
| `/10x-init` / `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` / `/10x-bootstrapper` / `/10x-stack-assess` / `/10x-health-check` | Bundled so you can fix the PRD, swap the stack, or re-scaffold mid-flight. If `/10x-rule-review` flags a `FAIL` you can't shrink your way out of, that often points back to ambiguous PRD or stack decisions — re-run the upstream skill rather than padding `AGENTS.md` with corrections. |

### How the chain hands off

- `/10x-agents-md` writes (or surgically updates) `AGENTS.md` at the resolved scope. Repo-level scope = the file lives at the repo root and frames the project as a whole; directory-level scope = the file lives next to the code it governs and reframes around the local unit, dropping repo-wide framing entirely. The skill never silently overwrites — it switches to an update flow when the target exists.
- `/10x-rule-review` reads any rules-for-AI markdown file you point it at and prints a 5-check scorecard (`OK` / `WARN` / `FAIL`) with concrete fixes. It does not depend on `/10x-agents-md` having run; you can review `.cursor/rules/`, copilot instructions, or a hand-written `CLAUDE.md` the same way.
- `/10x-lesson` self-bootstraps `context/foundation/lessons.md` on first use, then appends one Context/Problem/Rule/Applies-to entry per invocation. The file is consumed as a prior by the planning- and review-phase skills introduced later in the workflow — `/10x-frame`, `/10x-research`, `/10x-plan`, `/10x-plan-review`, `/10x-implement`, `/10x-impl-review`.

### What the lesson's skills capture (and what they do NOT)

- **`/10x-agents-md` captures**: project structure, build/test/lint commands actually present in scripts, commit conventions inferred from history, repo-specific tripwires the agent would otherwise miss, references to canonical files via `@`-paths instead of pasting their content. Directory-level scope additionally captures: local naming/layout patterns inferred from siblings, allowed/forbidden imports, the test pattern used by neighbours, and tripwires visible in the immediate area.
- **`/10x-agents-md` does NOT** paste in the contents of `tsconfig.json` / `eslint.config` / framework docs the agent already knows; it does NOT generate generic "write clean code" intentions; it does NOT replace the host's built-in `/init` when one exists — it's positioned as an alternative or fallback, not a default.
- **`/10x-rule-review` captures**: a length verdict (OK ≤ 200 non-empty lines, WARN 201–500, FAIL 501+), code/config blocks that should be `@`-references instead, vague-intention language, redundancy with framework docs the agent already has from training, and a Check 5 reorder proposal that surfaces critical rules to the top.
- **`/10x-rule-review` does NOT** edit the file by default; it does NOT score project content (architecture, stack choices) — it scores the rule artifact's condition; it does NOT generate a "fixed version" of the file (Check 5 may move sections with explicit approval, never rewrite rule wording).
- **`/10x-lesson` captures**: one entry per invocation with a short imperative H2 title (the title IS the rule), Context (subsystem / phase / file pattern, specific enough to pattern-match), Problem (what concretely breaks without the rule, ideally with a past incident), Rule (1–2 imperative sentences pasteable verbatim into a future review finding), Applies to (subset of `frame`, `research`, `plan`, `plan-review`, `implement`, `impl-review`, or `all`).
- **`/10x-lesson` does NOT** edit or remove existing lessons — the file is append-only by design (rewriting recurring rules without thought is the failure mode this convention prevents); it does NOT batch multiple rules per invocation; it does NOT pre-fill fields proactively (the user does the writing — that's the price of capturing rules outside a structured review).

### The inclusion test (the filter for AGENTS.md / CLAUDE.md)

Before you add a rule to any rules-for-AI file, ask: *could the agent know this without this file? Could public training data — books, blogs, repos in this stack — have prepared it for this?* If yes, drop it. If no, keep it. The file is onboarding for an agent that already knows TypeScript / Python / your framework but does NOT know your local conventions.

Belongs:
- non-obvious project conventions (error-response shape, file naming, allowed import paths)
- project-specific traps and "embarrassing" workarounds tied to history or dependency bugs
- referenced canonical files via `@`-paths (e.g. `@src/features/users/user.service.ts` as a pattern reference, not pasted code)

Does NOT belong:
- mainstream framework documentation
- README content the agent will read anyway (link with `@README.md`)
- popular generic advice ("use TypeScript strict mode") that's already enforced by config
- intention statements ("write clean code", "follow good practices") — convert to a checkable behaviour or drop

### U-shaped attention and granular rules

LLMs attend most strongly to the start and end of context (Lost-in-the-Middle / U-shaped attention). A long monolithic `CLAUDE.md` puts its middle rules in the weakest attention zone. Two practical consequences:

1. **Most important rules go to the top** of any rule file.
2. **Per-area rules belong next to their code** — nested `AGENTS.md` / `CLAUDE.md` inside `src/api/`, `.cursor/rules/*.mdc` with file globs, etc. Granular files are loaded selectively and arrive whole near the start of their own section, instead of being buried at line 400 of one big file.

`/10x-rule-review` Check 5 (reorder) operationalizes consequence (1); the inclusion test plus directory-level `/10x-agents-md` operationalizes consequence (2).

### The five-pattern calibration drill

Before writing a rule, validate that the agent actually breaks the convention without it. Pick one pattern from your project (error-response shape, file naming, import style, module structure, date handling). Then:

1. Ask the agent to implement against the pattern 3–5 times from a clean state, no rule.
2. Note where it broke the convention; capture run time, files explored, and visible cost/tokens if the host surfaces them.
3. Add a 1–3-sentence rule to the appropriate scope (root or area-level).
4. Re-run the same task in a fresh session and compare convention adherence, time, files, and iterations.

If the agent already trends toward the convention without the rule, you don't need the rule. If it systematically picks the wrong pattern, you've found a high-leverage rule to add. This drill is what "earning a rule from a recurring failure" actually looks like.

### Hierarchy and tool interop

- **Claude Code** loads `CLAUDE.md` from the user dir (`~/.claude/CLAUDE.md`), the repo root, and any subdirectory the agent works under. Deeper files override or supplement higher ones.
- **Codex** and **GitHub Copilot** load `AGENTS.md` from the current directory upward — closest file wins.
- One canonical file is preferable to three duplicates. A common pattern: `AGENTS.md` as source of truth, `CLAUDE.md` as a thin Claude-Code shim with `@AGENTS.md` import, `.github/copilot-instructions.md` only if Copilot needs its own additions. Symlink (`ln -s AGENTS.md CLAUDE.md`) is the simplest deduplication when tools require both names.
- Auto-memory (e.g. Claude Code's `~/.claude/projects/<dir-with-slashes-as-dashes>/memory/MEMORY.md`) is local to the machine and not a substitute for `AGENTS.md`. Team-binding rules live in the repo; auto-memory is a personal cache, periodically reviewable.

### Inner-loop hooks (deterministic feedback without prompting)

Mechanical, non-pickable checks belong in hooks (e.g. Claude Code's `PostToolUse`), not in the rule file. The agent finishes an edit; a formatter or fast lint runs; the result feeds back without you reminding it. Settings template (`settings.json.template`) ships in the lesson pack as the wiring entry point. Keep procedural workflows (deeper review, release checklist, deploy on sandbox) in skills, and reserve hooks for deterministic tool signals.

### Foundation paths used by this lesson

- `AGENTS.md` / `CLAUDE.md` (and per-area variants) — `/10x-agents-md` output
- `context/foundation/lessons.md` — `/10x-lesson` output (append-only register, consumed by future planning/review skills)
- `context/foundation/prd.md`, `context/foundation/tech-stack.md` — inputs from earlier lessons, still present
- `docs/reference/contract-surfaces.md` — load-bearing names registry (scaffolded by `/10x-init`)

### Universal language

The shipped skills carry no 10xDevs / cohort / certification references. `/10x-agents-md` discovers from the repo it's invoked in; `/10x-rule-review` is tool-agnostic and treats every file as "a rules-for-AI artifact"; `/10x-lesson` writes one entry shape regardless of project domain. The 5-pattern calibration drill is illustrative — substitute patterns from your own stack.

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
