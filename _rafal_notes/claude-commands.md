# Configuring `.claude/commands/` — custom slash commands

## What it is

`.claude/commands/` holds **custom slash commands** — reusable prompts you trigger by typing `/name`. Each command is a single Markdown file; the filename (minus `.md`) becomes the command name. The file body is the prompt that gets sent to Claude, with your arguments spliced in.

## Two locations (scope)

| Location | Scope | Shows up as |
| --- | --- | --- |
| `.claude/commands/` (in the repo) | **Project** — shared with anyone who clones the repo, committed to git | `/name (project)` |
| `~/.claude/commands/` (home dir) | **Personal** — available in every project, just for you | `/name (user)` |

On Windows the home dir is `C:\Users\<you>\.claude\commands\`.

## Creating one

The minimal version is just a file with prompt text:

```
.claude/commands/lint-fix.md
```

```markdown
Run `npm run lint` and `npm run build`, then fix any errors you find.
Report what you changed.
```

Now typing `/lint-fix` sends that prompt.

## Arguments

- `$ARGUMENTS` — everything typed after the command name, as one string.
- `$1`, `$2`, … — positional args (like shell).

```markdown
<!-- .claude/commands/fix-issue.md -->
Look at GitHub issue #$1 and implement a fix. Use label "$2" when done.
```

Invoked as `/fix-issue 42 bug` → `$1`=42, `$2`=bug.

## Frontmatter (optional config)

A YAML header at the top configures the command:

```markdown
---
description: Sync a Linear issue status from its change.md
argument-hint: <RAF-id>
allowed-tools: Bash(gh issue view:*), Read
model: claude-haiku-4-5-20251001
disable-model-invocation: false
---

Read context for $ARGUMENTS and update the matching Linear issue.
```

| Field | Purpose |
| --- | --- |
| `description` | Shown in the `/` menu and autocomplete. Defaults to the first line if omitted. |
| `argument-hint` | Autocomplete hint for expected args, e.g. `<RAF-id>`. |
| `allowed-tools` | Restricts which tools the command may use (same syntax as settings permissions). |
| `model` | Force a specific model for this command. |
| `disable-model-invocation` | If `true`, Claude can't auto-trigger it via the SlashCommand tool — only the user can type it. |

## Dynamic content: `!` and `@`

- **`!command`** — runs a bash command and inlines its output into the prompt (requires `allowed-tools` to permit that Bash call).
- **`@path/to/file`** — inlines a file's contents.

```markdown
---
allowed-tools: Bash(git status:*), Bash(git diff:*)
description: Summarize the working-tree changes
---

Current status:
!`git status`

Diff:
!`git diff HEAD`

Summarize the above and propose a commit message.
```

## Namespacing with subfolders

Subdirectories group commands and add a namespace label (they don't change how you invoke it):

```
.claude/commands/
  git/
    commit.md      -> /commit   (shown as "project:git")
  10x/
    sync.md        -> /sync
```

## Commands vs. skills vs. prompts (this repo)

- This project uses **`.claude/skills/`** (the `/10x-*` skills) — skills are richer: a folder with `SKILL.md` plus supporting files, model-invocable, better for multi-step capabilities.
- **`.claude/prompts/`** here is a 10x-CLI convention, not a Claude Code built-in.
- **Commands** are the lightweight option: one Markdown file = one reusable prompt. Reach for a command when you just want a parameterized prompt; reach for a skill when you need bundled logic/files and progressive disclosure.
</content>
</invoke>
