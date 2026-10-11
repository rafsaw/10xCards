#!/usr/bin/env bash
# om-prepare-test-env: generated entrypoint (contract v2), POSIX/bash flavor
# regenerate with: om-prepare-test-env --regenerate
# Mirrors test-env-down.ps1: deletes the ephemeral QA user, stops the npm/node process
# group this repo started, marks the descriptor stopped. Remote Supabase is untouched.
# history:
#   2026-10-11 generated the .sh flavor for Linux (kills the setsid process group).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESCRIPTOR="$REPO_ROOT/.ai/qa/test-env.json"
LOCK_DIR="$REPO_ROOT/.ai/qa/test-env.lock"

jget() { node -e '
  try { let v = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    for (const k of process.argv[2].split(".")) v = v == null ? v : v[k];
    if (v != null) process.stdout.write(String(v)); } catch {}' "$1" "$2"; }
alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }

if [ ! -f "$DESCRIPTOR" ]; then
  echo "TEST_ENV_STATUS=stopped"
  echo "TEST_ENV_NOTES=no descriptor found; nothing to stop"
  exit 0
fi

# Never tear down an environment this repo did not start.
if [ "$(jget "$DESCRIPTOR" startedByThisRepo)" != "true" ]; then
  echo "TEST_ENV_STATUS=$(jget "$DESCRIPTOR" status)"
  echo "TEST_ENV_NOTES=environment was not started by this repo; left untouched"
  exit 0
fi

# Non-fatal: a leaked account is swept on the next boot.
( cd "$REPO_ROOT" && node .ai/scripts/qa-user.mjs delete >/dev/null 2>&1 ) \
  || echo "warning: the QA user could not be deleted; it will be swept on the next boot"

APP_PID="$(jget "$DESCRIPTOR" app.pid)"
if alive "$APP_PID"; then
  kill -TERM -- "-$APP_PID" 2>/dev/null || kill -TERM "$APP_PID" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do alive "$APP_PID" || break; sleep 0.5; done
  if alive "$APP_PID"; then kill -KILL -- "-$APP_PID" 2>/dev/null || kill -KILL "$APP_PID" 2>/dev/null || true; fi
fi

node -e '
const fs = require("fs"), d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
d.status = "stopped"; fs.writeFileSync(process.argv[1], JSON.stringify(d, null, 2) + "\n");' "$DESCRIPTOR"
rm -rf "$LOCK_DIR"

echo "TEST_ENV_STATUS=stopped"
echo "TEST_ENV_DESCRIPTOR=.ai/qa/test-env.json"
