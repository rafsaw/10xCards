#!/usr/bin/env node
/**
 * GitHub issue stage-sync for the 10x change workflow.
 *
 * Source of truth: each context/changes/<id>/change.md (and its archived copy
 * under context/archive/) carries a `status`. When a change reaches a
 * done-family status (implemented / impl_reviewed / reviewed / archived / done),
 * its mapped GitHub issue should be CLOSED. The change-id -> issue# mapping is
 * parsed from the "## Issue index" table in context/foundation/tasks-github.md.
 *
 * Modes:
 *   --check   Local-only, NO network. Wired as a Stop hook: emits a
 *             {decision:"block"} nudge listing done changes whose issue is not
 *             yet recorded closed in the local cache. Never calls gh; never traps
 *             a turn on error (always exits 0).
 *   --apply   Calls `gh` to close every open issue whose change is done-family,
 *             then records all verified-closed issues in the cache so --check goes
 *             quiet. Prints a summary.
 *   (default) Dry-run: queries gh and prints what --apply WOULD do; no writes.
 *
 * Requires the `gh` CLI authenticated (only for --apply / dry-run).
 * Cache: .claude/.gh-issue-sync-cache.json (local, git-ignored). Rebuilt by --apply.
 *
 * Disable the Stop hook anytime via /hooks.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const DONE_FAMILY = new Set([
  "implemented",
  "impl_reviewed",
  "reviewed",
  "archived",
  "done",
  "complete",
  "completed",
]);

function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "context", "foundation", "tasks-github.md"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function frontmatter(text) {
  text = text.replace(/^﻿/, "");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (mm) out[mm[1]] = mm[2].trim();
  }
  return out;
}

// changeId -> issueNumber, parsed ONLY from the "## Issue index" table.
// Row shape: | <Roadmap ID> | `<change-id>` | [#N](url) | ...cells... |
function parseMapping(root) {
  const path = join(root, "context", "foundation", "tasks-github.md");
  const map = {};
  if (!existsSync(path)) return map;
  let inIndex = false;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#")) {
      inIndex = /^#+\s+issue index\s*$/i.test(line);
      continue;
    }
    if (!inIndex || !line.startsWith("|")) continue;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 3) continue;
    const changeId = (cells[1].match(/`([^`]+)`/)?.[1] ?? cells[1]).trim();
    const issueM = cells[2].match(/#(\d+)/);
    if (issueM && /^[a-z][a-z0-9-]*$/.test(changeId)) map[changeId] = Number(issueM[1]);
  }
  return map;
}

// done-family change-ids from both active and archived change folders.
function collectDoneChanges(root) {
  const bases = [join(root, "context", "changes"), join(root, "context", "archive")];
  const done = [];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const cm = join(base, entry.name, "change.md");
      if (!existsSync(cm)) continue;
      const fm = frontmatter(readFileSync(cm, "utf8"));
      const changeId = (fm.change_id || "").trim();
      const status = (fm.status || "").toLowerCase();
      if (changeId && DONE_FAMILY.has(status)) done.push({ changeId, status });
    }
  }
  return done;
}

function cachePath(root) {
  return join(root, ".claude", ".gh-issue-sync-cache.json");
}
function loadCache(root) {
  try {
    return JSON.parse(readFileSync(cachePath(root), "utf8"));
  } catch {
    return { closed: [] };
  }
}
function saveCache(root, cache) {
  writeFileSync(cachePath(root), JSON.stringify(cache, null, 2) + "\n");
}

// Run gh with args as an array (no shell => no quoting pitfalls). Tries gh.exe on
// Windows. Throws on non-ENOENT errors so callers can report a clean failure.
function gh(args) {
  const bins = process.platform === "win32" ? ["gh.exe", "gh"] : ["gh"];
  let lastErr;
  for (const bin of bins) {
    try {
      return execFileSync(bin, args, { encoding: "utf8" });
    } catch (e) {
      lastErr = e;
      if (e.code === "ENOENT") continue;
      throw e;
    }
  }
  throw lastErr ?? new Error("gh CLI not found on PATH");
}
function issueState(num) {
  try {
    return JSON.parse(gh(["issue", "view", String(num), "--json", "state"])).state; // OPEN | CLOSED
  } catch {
    return null;
  }
}

const mode = process.argv.includes("--apply")
  ? "apply"
  : process.argv.includes("--check")
    ? "check"
    : "dry";

const root = findRepoRoot(process.cwd());
if (!root) process.exit(0);

try {
  const mapping = parseMapping(root);
  const seen = new Set();
  const targets = [];
  for (const d of collectDoneChanges(root)) {
    if (seen.has(d.changeId)) continue;
    seen.add(d.changeId);
    const issue = mapping[d.changeId];
    if (issue) targets.push({ ...d, issue });
  }

  if (mode === "check") {
    const closedSet = new Set(loadCache(root).closed || []);
    const pending = targets.filter((t) => !closedSet.has(t.issue));
    if (pending.length === 0) process.exit(0);
    const bullets = pending.map((t) => `  • #${t.issue} (${t.changeId}, change.md="${t.status}")`).join("\n");
    const reason =
      `GitHub issues out of sync with done work:\n${bullets}\n\n` +
      "Close them so the tracker reflects reality: run `npm run sync:issues -- --apply` " +
      "(or `gh issue close <n>`). If leaving an issue open is intentional, tell the user — " +
      "they can silence this gate via /hooks.";
    process.stdout.write(JSON.stringify({ decision: "block", reason }));
    process.exit(0);
  }

  // apply / dry — both need gh
  const cache = loadCache(root);
  const closedSet = new Set(cache.closed || []);
  let closedNow = 0;
  let alreadyClosed = 0;
  let skipped = 0;
  const lines = [];
  for (const t of targets) {
    const state = issueState(t.issue);
    if (state === null) {
      skipped++;
      lines.push(`?  #${t.issue} ${t.changeId}: could not read (gh error / not found)`);
      continue;
    }
    if (state === "CLOSED") {
      closedSet.add(t.issue);
      alreadyClosed++;
      lines.push(`=  #${t.issue} ${t.changeId}: already closed`);
      continue;
    }
    if (mode === "apply") {
      try {
        gh([
          "issue",
          "close",
          String(t.issue),
          "--comment",
          `Closing: change \`${t.changeId}\` is ${t.status} (synced from change.md by github-issue-sync).`,
        ]);
        closedSet.add(t.issue);
        closedNow++;
        lines.push(`closed  #${t.issue} ${t.changeId} (was ${t.status})`);
      } catch (e) {
        skipped++;
        lines.push(`FAILED  #${t.issue} ${t.changeId}: ${String(e.message || e).split("\n")[0]}`);
      }
    } else {
      lines.push(`would-close  #${t.issue} ${t.changeId} (change.md="${t.status}")`);
    }
  }

  if (mode === "apply") {
    cache.closed = [...closedSet].sort((a, b) => a - b);
    saveCache(root, cache);
  }

  process.stdout.write(
    (mode === "apply" ? "github-issue-sync --apply\n" : "github-issue-sync (dry-run; pass --apply to act)\n") +
      (lines.length ? lines.join("\n") + "\n" : "no done-family changes with mapped issues found\n") +
      `\nclosed now: ${closedNow}  already closed: ${alreadyClosed}  skipped: ${skipped}\n`,
  );
  process.exit(0);
} catch (e) {
  if (mode === "check") process.exit(0); // never trap a turn
  process.stderr.write(`github-issue-sync error: ${String(e.message || e)}\n`);
  process.exit(1);
}
