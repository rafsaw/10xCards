#!/usr/bin/env node
/**
 * Stop-hook drift check for context/foundation/roadmap.md.
 *
 * Compares each context/changes/<id>/change.md `status` against the status the
 * roadmap "At a glance" table records for that change_id. When a change has been
 * implemented/reviewed (a "done-family" status) but the roadmap still shows it as
 * a pre-done state (proposed / ready / in progress / blocked / new), it emits a
 * Stop `decision: block` so the roadmap gets updated before the turn ends.
 *
 * Defensive by design: any parse failure, missing file, or change_id absent from
 * the roadmap table results in NO block (exit 0) — it never traps a turn on
 * ambiguity. Disable anytime via /hooks.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "context", "foundation", "roadmap.md"))) return dir;
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

try {
  const root = findRepoRoot(process.cwd());
  if (!root) process.exit(0);

  const changesDir = join(root, "context", "changes");
  if (!existsSync(changesDir)) process.exit(0);

  const roadmap = readFileSync(join(root, "context", "foundation", "roadmap.md"), "utf8");

  // changeId -> roadmap status, parsed ONLY from the "## At a glance" table.
  // Row shape: | <Roadmap ID> | <change-id> | ...cells... | <status> |
  // Scoped to that section because other tables (e.g. Backlog Handoff) also carry
  // the change-id in column 2 but end in a different column (Notes), which would
  // otherwise clobber the real status.
  const roadmapStatus = {};
  let inAtAGlance = false;
  for (const raw of roadmap.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("#")) {
      inAtAGlance = /^#+\s+at a glance\s*$/i.test(line);
      continue;
    }
    if (!inAtAGlance || !line.startsWith("|")) continue;
    const parts = line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    if (parts.length < 3) continue;
    const changeId = parts[1];
    const status = parts[parts.length - 1].toLowerCase();
    if (/^[a-z][a-z0-9-]*$/.test(changeId)) roadmapStatus[changeId] = status;
  }

  // change.md statuses that mean implementation is complete/reviewed.
  const DONE_FAMILY = new Set([
    "implemented", "impl_reviewed", "reviewed", "archived", "done", "complete", "completed",
  ]);
  // roadmap statuses that are "not yet done" (i.e. drift if change is done-family).
  const PRE_DONE = new Set([
    "proposed", "ready", "in progress", "in_progress", "blocked", "new",
  ]);

  const drifts = [];
  for (const entry of readdirSync(changesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const cmPath = join(changesDir, entry.name, "change.md");
    if (!existsSync(cmPath)) continue;
    const fm = frontmatter(readFileSync(cmPath, "utf8"));
    const changeId = (fm.change_id || entry.name).trim();
    const changeStatus = (fm.status || "").toLowerCase();
    if (!DONE_FAMILY.has(changeStatus)) continue;
    const rStatus = roadmapStatus[changeId];
    if (rStatus === undefined) continue; // not in the roadmap table — don't guess
    if (PRE_DONE.has(rStatus)) {
      drifts.push({ changeId, changeStatus, roadmapStatus: rStatus });
    }
  }

  if (drifts.length === 0) process.exit(0);

  const bullets = drifts
    .map((d) => `  • ${d.changeId}: change.md="${d.changeStatus}" but roadmap "At a glance" shows "${d.roadmapStatus}"`)
    .join("\n");

  const reason =
    `roadmap.md is out of sync with implemented work:\n${bullets}\n\n` +
    `Before finishing, update context/foundation/roadmap.md to mark the change(s) done in all three places: ` +
    `the "At a glance" table, the item's own **Status:** line, and the Backlog Handoff row. ` +
    `If leaving it stale is intentional (e.g. deferring the flip until /10x-archive), say so to the user — ` +
    `they can silence this gate via /hooks.`;

  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
} catch {
  // Never trap a turn on an unexpected error.
  process.exit(0);
}
