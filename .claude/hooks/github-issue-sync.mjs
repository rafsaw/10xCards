#!/usr/bin/env node
/**
 * Tracker stage-sync for the 10x change workflow (GitHub + Linear).
 *
 * Source of truth: each context/changes/<id>/change.md (and its archived copy
 * under context/archive/) carries a `status`. When a change reaches a
 * done-family status (implemented / impl_reviewed / reviewed / archived / done),
 * its mapped trackers should be closed:
 *   • GitHub issue -> CLOSED. Mapping from the "## Issue index" table in
 *     context/foundation/tasks-github.md (change-id -> #N). Uses the `gh` CLI.
 *   • Linear issue -> Done. Mapping from the "## Issue index" table in
 *     context/foundation/tasks-linear.md (change-id -> RAF-N). Uses the Linear
 *     GraphQL API, gated on a LINEAR_API_KEY (env, or .env / .dev.vars). With no
 *     key, the Linear leg is skipped cleanly and GitHub still runs.
 *
 * Modes:
 *   --check   Local-only, NO network. Wired as a Stop hook: emits a
 *             {decision:"block"} nudge listing trackers not yet recorded done in
 *             the local cache. Never calls gh / Linear; never traps a turn.
 *   --apply   Closes open GitHub issues and completes open Linear issues for
 *             done changes, then records them in the cache so --check goes quiet.
 *   (default) Dry-run: reports what --apply WOULD do; no writes.
 *
 * Cache: .claude/.gh-issue-sync-cache.json (local, git-ignored). Rebuilt by --apply.
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

// Read a secret from the process env, falling back to .env / .dev.vars files.
function readEnvKey(root, name) {
  if (process.env[name]) return process.env[name];
  for (const f of [".env", ".dev.vars"]) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`));
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

// changeId -> token, parsed ONLY from the "## Issue index" table of `file`.
// `extract` pulls the tracker token out of a table cell (column index `col`).
function parseMapping(root, file, col, extract) {
  const path = join(root, "context", "foundation", file);
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
    if (cells.length <= col) continue;
    const changeId = (cells[1].match(/`([^`]+)`/)?.[1] ?? cells[1]).trim();
    const token = extract(cells[col] ?? "");
    if (token != null && /^[a-z][a-z0-9-]*$/.test(changeId)) map[changeId] = token;
  }
  return map;
}

// done-family change-ids from both active and archived change folders.
function collectDoneChanges(root) {
  const bases = [join(root, "context", "changes"), join(root, "context", "archive")];
  const done = [];
  const seen = new Set();
  for (const base of bases) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const cm = join(base, entry.name, "change.md");
      if (!existsSync(cm)) continue;
      const fm = frontmatter(readFileSync(cm, "utf8"));
      const changeId = (fm.change_id || "").trim();
      const status = (fm.status || "").toLowerCase();
      if (changeId && !seen.has(changeId) && DONE_FAMILY.has(status)) {
        seen.add(changeId);
        done.push({ changeId, status });
      }
    }
  }
  return done;
}

function cachePath(root) {
  return join(root, ".claude", ".gh-issue-sync-cache.json");
}
function loadCache(root) {
  try {
    const c = JSON.parse(readFileSync(cachePath(root), "utf8"));
    return { closed: c.closed || [], linearDone: c.linearDone || [] };
  } catch {
    return { closed: [], linearDone: [] };
  }
}
function saveCache(root, cache) {
  writeFileSync(cachePath(root), JSON.stringify(cache, null, 2) + "\n");
}

// ---- GitHub (gh CLI) -------------------------------------------------------

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
function ghIssueState(num) {
  try {
    return JSON.parse(gh(["issue", "view", String(num), "--json", "state"])).state; // OPEN | CLOSED
  } catch {
    return null;
  }
}

// ---- Linear (GraphQL API) --------------------------------------------------

async function linearGQL(key, query, variables) {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

// Look up a Linear issue by its identifier (e.g. "RAF-14"). Returns
// { id, stateType, doneStateId } or null. doneStateId is the team's completed
// "Done" workflow state (preferred by name, else first completed-type state).
async function linearFindIssue(key, identifier) {
  const m = identifier.match(/^([A-Za-z]+)-(\d+)$/);
  if (!m) return null;
  const data = await linearGQL(
    key,
    `query Find($team:String!,$number:Float!){
      issues(filter:{team:{key:{eq:$team}}, number:{eq:$number}}, first:1){
        nodes{ id state{ type } team{ states{ nodes{ id name type } } } }
      }
    }`,
    { team: m[1], number: Number(m[2]) },
  );
  const node = data?.issues?.nodes?.[0];
  if (!node) return null;
  const states = node.team?.states?.nodes ?? [];
  const completed = states.filter((s) => s.type === "completed");
  const done = completed.find((s) => /^done$/i.test(s.name)) ?? completed[0];
  return { id: node.id, stateType: node.state?.type, doneStateId: done?.id ?? null };
}
async function linearSetDone(key, issueId, stateId) {
  const data = await linearGQL(
    key,
    `mutation Done($id:String!,$stateId:String!){ issueUpdate(id:$id, input:{stateId:$stateId}){ success } }`,
    { id: issueId, stateId },
  );
  if (!data?.issueUpdate?.success) throw new Error("issueUpdate returned success=false");
}

// ---- main ------------------------------------------------------------------

const mode = process.argv.includes("--apply")
  ? "apply"
  : process.argv.includes("--check")
    ? "check"
    : "dry";

const root = findRepoRoot(process.cwd());
if (!root) process.exit(0);

try {
  const ghMap = parseMapping(root, "tasks-github.md", 2, (c) => {
    const m = c.match(/#(\d+)/);
    return m ? Number(m[1]) : null;
  });
  const linearMap = parseMapping(root, "tasks-linear.md", 2, (c) => {
    const m = c.match(/([A-Za-z]+-\d+)/);
    return m ? m[1] : null;
  });
  const linearKey = readEnvKey(root, "LINEAR_API_KEY");

  const done = collectDoneChanges(root);
  const ghTargets = done.map((d) => ({ ...d, issue: ghMap[d.changeId] })).filter((t) => t.issue);
  const linTargets = done.map((d) => ({ ...d, lin: linearMap[d.changeId] })).filter((t) => t.lin);

  if (mode === "check") {
    const cache = loadCache(root);
    const closedSet = new Set(cache.closed);
    const linDoneSet = new Set(cache.linearDone);
    const pending = [];
    for (const t of ghTargets) if (!closedSet.has(t.issue)) pending.push(`#${t.issue} (${t.changeId})`);
    // Only nag about Linear when a key is configured — otherwise it can't be resolved headlessly.
    if (linearKey) {
      for (const t of linTargets) if (!linDoneSet.has(t.lin)) pending.push(`${t.lin} (${t.changeId})`);
    }
    if (pending.length === 0) process.exit(0);
    const bullets = pending.map((p) => `  • ${p}`).join("\n");
    const reason =
      `Trackers out of sync with done work:\n${bullets}\n\n` +
      "Sync them so the trackers reflect reality: run `npm run sync:issues -- --apply`. " +
      "If leaving one open is intentional, tell the user — they can silence this gate via /hooks.";
    process.stdout.write(JSON.stringify({ decision: "block", reason }));
    process.exit(0);
  }

  // apply / dry — network
  const cache = loadCache(root);
  const closedSet = new Set(cache.closed);
  const linDoneSet = new Set(cache.linearDone);
  const lines = [];
  let ghClosed = 0;
  let ghAlready = 0;
  let ghSkip = 0;
  let linDone = 0;
  let linAlready = 0;
  let linSkip = 0;

  // GitHub
  for (const t of ghTargets) {
    const state = ghIssueState(t.issue);
    if (state === null) {
      ghSkip++;
      lines.push(`?  gh #${t.issue} ${t.changeId}: could not read (gh error / not found)`);
    } else if (state === "CLOSED") {
      closedSet.add(t.issue);
      ghAlready++;
      lines.push(`=  gh #${t.issue} ${t.changeId}: already closed`);
    } else if (mode === "apply") {
      try {
        gh([
          "issue",
          "close",
          String(t.issue),
          "--comment",
          `Closing: change \`${t.changeId}\` is ${t.status} (synced from change.md by github-issue-sync).`,
        ]);
        closedSet.add(t.issue);
        ghClosed++;
        lines.push(`closed  gh #${t.issue} ${t.changeId} (was ${t.status})`);
      } catch (e) {
        ghSkip++;
        lines.push(`FAILED  gh #${t.issue} ${t.changeId}: ${String(e.message || e).split("\n")[0]}`);
      }
    } else {
      lines.push(`would-close  gh #${t.issue} ${t.changeId} (change.md="${t.status}")`);
    }
  }

  // Linear
  if (linTargets.length > 0 && !linearKey) {
    linSkip += linTargets.length;
    lines.push(`-  linear: ${linTargets.length} issue(s) skipped — set LINEAR_API_KEY (env or .env) to enable`);
  } else {
    for (const t of linTargets) {
      let issue;
      try {
        issue = await linearFindIssue(linearKey, t.lin);
      } catch (e) {
        linSkip++;
        lines.push(`FAILED  linear ${t.lin} ${t.changeId}: ${String(e.message || e).split("\n")[0]}`);
        continue;
      }
      if (!issue) {
        linSkip++;
        lines.push(`?  linear ${t.lin} ${t.changeId}: not found`);
      } else if (issue.stateType === "completed" || issue.stateType === "canceled") {
        linDoneSet.add(t.lin);
        linAlready++;
        lines.push(`=  linear ${t.lin} ${t.changeId}: already ${issue.stateType}`);
      } else if (!issue.doneStateId) {
        linSkip++;
        lines.push(`?  linear ${t.lin} ${t.changeId}: no completed "Done" state on team`);
      } else if (mode === "apply") {
        try {
          await linearSetDone(linearKey, issue.id, issue.doneStateId);
          linDoneSet.add(t.lin);
          linDone++;
          lines.push(`done    linear ${t.lin} ${t.changeId} (was ${t.status})`);
        } catch (e) {
          linSkip++;
          lines.push(`FAILED  linear ${t.lin} ${t.changeId}: ${String(e.message || e).split("\n")[0]}`);
        }
      } else {
        lines.push(`would-done   linear ${t.lin} ${t.changeId} (change.md="${t.status}")`);
      }
    }
  }

  if (mode === "apply") {
    cache.closed = [...closedSet].sort((a, b) => a - b);
    cache.linearDone = [...linDoneSet].sort();
    saveCache(root, cache);
  }

  process.stdout.write(
    (mode === "apply" ? "tracker-sync --apply\n" : "tracker-sync (dry-run; pass --apply to act)\n") +
      (lines.length ? lines.join("\n") + "\n" : "no done-family changes with mapped trackers found\n") +
      `\ngithub  closed: ${ghClosed}  already: ${ghAlready}  skipped: ${ghSkip}\n` +
      `linear  done:   ${linDone}  already: ${linAlready}  skipped: ${linSkip}\n`,
  );
  process.exit(0);
} catch (e) {
  if (mode === "check") process.exit(0); // never trap a turn
  process.stderr.write(`tracker-sync error: ${String(e.message || e)}\n`);
  process.exit(1);
}
