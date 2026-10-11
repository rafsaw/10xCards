#!/usr/bin/env bash
# om-prepare-test-env: generated entrypoint (contract v2), POSIX/bash flavor
# regenerate with: om-prepare-test-env --regenerate
# Mirrors test-env-up.ps1 (see its history for the repairs baked in): same descriptor
# shape, same lock, build cache, bound-port resolution, configured-banner assertion
# and ephemeral QA user. Supabase is remote and never started/seeded/torn down here.
# history:
#   2026-10-11 generated the .sh flavor for Linux. Node does all JSON work (no jq
#              dependency, no BOM concerns); the server is launched under setsid so
#              teardown can kill the whole process group (npm -> node), not just npm.
#              TEST_ENV_PORT overrides the preferred port (default 4321).
#   2026-10-11 repair: health timeout 120 -> 300 s (TEST_ENV_HEALTH_TIMEOUT). On a 1-CPU host
#              the first requests trigger several Vite dependency-optimization reloads
#              and the app needs >120 s to answer 200.
# usage: test-env-up.sh [--force] [--force-rebuild]
set -euo pipefail

FORCE=0; FORCE_REBUILD=0
for a in "$@"; do
  case "$a" in
    --force|-Force) FORCE=1 ;;
    --force-rebuild|-ForceRebuild) FORCE_REBUILD=1 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

# --- Project-specific variables --------------------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
QA_DIR="$REPO_ROOT/.ai/qa"
DESCRIPTOR="$QA_DIR/test-env.json"
BUILD_CACHE="$QA_DIR/test-env-build-cache.json"
LOCK_DIR="$QA_DIR/test-env.lock"
APP_OUT_LOG="$QA_DIR/test-env-app.out.log"
APP_ERR_LOG="$QA_DIR/test-env-app.err.log"

PREFERRED_PORT="${TEST_ENV_PORT:-4321}"   # Astro dev default; playwright.config.ts expects it
HEALTH_PATH="/"
HEALTH_TIMEOUT="${TEST_ENV_HEALTH_TIMEOUT:-300}"   # cold Vite dep-optimization reloads take minutes on 1 CPU
LOCK_WAIT=300
TTL_SECONDS="${TEST_ENV_CACHE_TTL_SECONDS:-600}"
BUILD_INPUTS=(package.json package-lock.json astro.config.mjs tsconfig.json)
BUILD_ARTIFACTS=(node_modules .astro)
BROWSER_PROVIDER="playwright"; BROWSER_COMMAND="npx playwright"; BROWSER_VERSION="1.60.0"

# --- Helpers ----------------------------------------------------------------
now_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }
alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }

# Kill the whole process group the server was started in (setsid makes pid == pgid),
# so the node child dies with npm and no orphan keeps the port.
stop_tree() {
  local p="$1"
  kill -TERM -- "-$p" 2>/dev/null || kill -TERM "$p" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do alive "$p" || return 0; sleep 0.5; done
  kill -KILL -- "-$p" 2>/dev/null || kill -KILL "$p" 2>/dev/null || true
}

# jget <file> <dotted.path> -> value or empty
jget() { node -e '
  try { let v = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    for (const k of process.argv[2].split(".")) v = v == null ? v : v[k];
    if (v != null) process.stdout.write(String(v)); } catch {}' "$1" "$2"; }

# The requested port is a preference: Astro increments when it is taken, so read the
# bound port from the app's own output.
wait_bound_port() {
  local deadline=$((SECONDS + $1)) m
  while [ $SECONDS -lt $deadline ]; do
    if [ -f "$APP_OUT_LOG" ]; then
      m="$(grep -Eo 'http://(localhost|127\.0\.0\.1):[0-9]+' "$APP_OUT_LOG" 2>/dev/null | head -1 | grep -Eo '[0-9]+$' || true)"
      if [ -n "$m" ]; then echo "$m"; return 0; fi
    fi
    sleep 0.5
  done
  echo 0
}

test_health() { [ "$(curl -s -o /dev/null -m 5 -w '%{http_code}' "$1" 2>/dev/null || true)" = "200" ]; }

# Answering is not usable: without .env the app serves 200 with only the
# config-status banner. Treat that as a failed boot.
test_configured() {
  local body
  body="$(curl -s -m 10 "$1" 2>/dev/null)" || return 1
  ! grep -q 'nie jest skonfigurowany' <<<"$body"
}

fingerprint() {
  local parts="" f
  for f in "${BUILD_INPUTS[@]}"; do
    if [ -f "$REPO_ROOT/$f" ]; then parts+="$f:$(stat -c '%s:%Y' "$REPO_ROOT/$f");"; else parts+="$f:missing;"; fi
  done
  printf '%s' "$parts" | sha256sum | cut -d' ' -f1
}

artifacts_present() { local a; for a in "${BUILD_ARTIFACTS[@]}"; do [ -e "$REPO_ROOT/$a" ] || return 1; done; }

stop_recorded() {
  [ -f "$DESCRIPTOR" ] || return 0
  if [ "$(jget "$DESCRIPTOR" startedByThisRepo)" = "true" ]; then
    local p; p="$(jget "$DESCRIPTOR" app.pid)"
    if alive "$p"; then stop_tree "$p"; fi
  fi
}

# --- Lock: one bootstrap at a time -----------------------------------------
mkdir -p "$QA_DIR"
deadline=$((SECONDS + LOCK_WAIT))
until mkdir "$LOCK_DIR" 2>/dev/null; do
  owner="$(jget "$LOCK_DIR/owner.json" pid)"
  if ! alive "$owner"; then rm -rf "$LOCK_DIR"; continue; fi
  [ $SECONDS -lt $deadline ] || { echo "Another bootstrap (pid $owner) still holds $LOCK_DIR after $LOCK_WAIT s" >&2; exit 1; }
  sleep 3
done
printf '{"pid":%s,"source":"test-env-up.sh","acquiredAt":"%s"}\n' "$$" "$(now_utc)" > "$LOCK_DIR/owner.json"
trap 'rm -rf "$LOCK_DIR"' EXIT

STARTED=$SECONDS

# --- Reuse check: attach, don't reboot -------------------------------------
if [ "$FORCE" = 0 ]; then
  if [ "$(jget "$DESCRIPTOR" status)" = "running" ] && [ -n "$(jget "$DESCRIPTOR" app.pid)" ]; then
    apppid="$(jget "$DESCRIPTOR" app.pid)"
    probe="$(jget "$DESCRIPTOR" baseUrl)$(jget "$DESCRIPTOR" app.healthPath)"
    if alive "$apppid" && test_health "$probe" && test_configured "$probe"; then
      started_epoch="$(date -u -d "$(jget "$DESCRIPTOR" startedAt)" +%s 2>/dev/null || echo 0)"
      fresh=1
      [ $(( $(date -u +%s) - started_epoch )) -lt "$TTL_SECONDS" ] || fresh=0
      for f in "${BUILD_INPUTS[@]}"; do
        if [ -f "$REPO_ROOT/$f" ] && [ "$(stat -c %Y "$REPO_ROOT/$f")" -gt "$started_epoch" ]; then fresh=0; fi
      done
      if [ "$fresh" = 1 ]; then
        echo "TEST_ENV_STATUS=running"
        echo "TEST_ENV_BASE_URL=$(jget "$DESCRIPTOR" baseUrl)"
        echo "TEST_ENV_DESCRIPTOR=.ai/qa/test-env.json"
        echo "TEST_ENV_REUSED=1"
        echo "BROWSER_PROVIDER=$(jget "$DESCRIPTOR" browser.provider)"
        echo "BROWSER_INSTALLED=$([ "$(jget "$DESCRIPTOR" browser.installed)" = true ] && echo 1 || echo 0)"
        exit 0
      fi
    fi
    stop_recorded   # stale claim: tear down what this repo started
  fi
else
  stop_recorded
fi

# --- Build cache: skip preparation that has not changed --------------------
FP="$(fingerprint)"
cache_hit=0
if [ "$FORCE_REBUILD" = 0 ] && [ -f "$BUILD_CACHE" ] && artifacts_present; then
  if [ "$(jget "$BUILD_CACHE" fingerprint)" = "$FP" ] && [ "$(jget "$BUILD_CACHE" projectRoot)" = "$REPO_ROOT" ]; then cache_hit=1; fi
fi
if [ "$cache_hit" = 0 ]; then
  ( cd "$REPO_ROOT"
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
    npx astro sync )
  printf '{"fingerprint":"%s","projectRoot":"%s","preparedAt":"%s"}\n' "$FP" "$REPO_ROOT" "$(now_utc)" > "$BUILD_CACHE"
fi

# --- App start + health wait (no local services: Supabase is remote) -------
rm -f "$APP_OUT_LOG" "$APP_ERR_LOG"
# --host 127.0.0.1 is load-bearing: left alone the dev server may bind [::1] only.
( cd "$REPO_ROOT" && exec setsid npm run dev -- --host 127.0.0.1 --port "$PREFERRED_PORT" >"$APP_OUT_LOG" 2>"$APP_ERR_LOG" </dev/null ) &
APP_PID=$!
disown "$APP_PID" 2>/dev/null || true

PORT="$(wait_bound_port 60)"
if [ "$PORT" = 0 ]; then
  stop_tree "$APP_PID"
  echo "app never reported a bound port within 60 s" >&2; tail -n 20 "$APP_OUT_LOG" >&2 || true; exit 1
fi
[ "$PORT" = "$PREFERRED_PORT" ] || echo "note: port $PREFERRED_PORT was taken; the app bound $PORT instead"
BASE_URL="http://127.0.0.1:$PORT"

healthy=0
hd=$((SECONDS + HEALTH_TIMEOUT))
while [ $SECONDS -lt $hd ]; do
  alive "$APP_PID" || break
  if test_health "$BASE_URL$HEALTH_PATH"; then healthy=1; break; fi
  sleep 2
done
if [ "$healthy" = 0 ]; then
  alive "$APP_PID" && stop_tree "$APP_PID"
  echo "app did not become healthy at $BASE_URL$HEALTH_PATH within $HEALTH_TIMEOUT s" >&2
  tail -n 20 "$APP_ERR_LOG" >&2 || true; exit 1
fi
if ! test_configured "$BASE_URL$HEALTH_PATH"; then
  stop_tree "$APP_PID"
  echo "app is running at $BASE_URL but reports missing configuration (the src/lib/config-status.ts banner is present). Check .env for SUPABASE_URL / SUPABASE_KEY before using this environment for QA." >&2
  exit 1
fi

# --- Ephemeral QA user (non-fatal) -----------------------------------------
QA_EMAIL=""; QA_NOTE=""
cd "$REPO_ROOT"
node .ai/scripts/qa-user.mjs delete >/dev/null 2>&1 || true   # `create` overwrites the creds file; drop the old user first
node .ai/scripts/qa-user.mjs sweep  >/dev/null 2>&1 || true   # leftovers from crashed runs
if qa_out="$(node .ai/scripts/qa-user.mjs create 2>&1)"; then
  QA_EMAIL="$(grep -E '^QA_EMAIL=' <<<"$qa_out" | head -1 | cut -d= -f2-)"
else
  QA_NOTE="QA user could not be minted; authenticated routes are not reachable from this environment"
  echo "warning: $QA_NOTE"; echo "$qa_out"
fi

# --- Descriptor write + result lines ---------------------------------------
BROWSER_PRESENT=false
[ -d "$REPO_ROOT/node_modules/@playwright/test" ] && BROWSER_PRESENT=true

RUN_ID="10xcards-$(date -u +%Y%m%d-%H%M%S)" STARTED_AT="$(now_utc)" \
BASE_URL="$BASE_URL" PORT="$PORT" APP_PID="$APP_PID" HEALTH_PATH="$HEALTH_PATH" \
QA_EMAIL="$QA_EMAIL" QA_NOTE="$QA_NOTE" BROWSER_PRESENT="$BROWSER_PRESENT" \
BROWSER_PROVIDER="$BROWSER_PROVIDER" BROWSER_COMMAND="$BROWSER_COMMAND" BROWSER_VERSION="$BROWSER_VERSION" \
node -e '
const e = process.env, present = e.BROWSER_PRESENT === "true";
const desc = {
  version: 1, runId: e.RUN_ID, status: "running", mode: "dev", baseUrl: e.BASE_URL,
  startedByThisRepo: true,
  startScript: ".ai/scripts/test-env-up.sh", stopScript: ".ai/scripts/test-env-down.sh",
  app: { startCommand: "npm run dev -- --port " + e.PORT, port: Number(e.PORT), healthPath: e.HEALTH_PATH, pid: Number(e.APP_PID) },
  services: [],
  credentials: e.QA_EMAIL ? [{ role: "qa", username: e.QA_EMAIL, passwordEnv: "TEST_QA_PASSWORD" }] : [],
  credentialsFile: e.QA_EMAIL ? ".ai/qa/test-env.env" : "",
  browser: {
    provider: e.BROWSER_PROVIDER, installed: present, command: e.BROWSER_COMMAND, version: e.BROWSER_VERSION,
    descriptor: ".ai/browsers/playwright.md",
    notes: present
      ? "Authenticated QA is proven by .ai/scripts/qa-login-check.mjs, which signs in with the recorded credentials and asserts /dashboard renders for that user."
      : "@playwright/test is not installed; run the dependency install (the up script does this on a cache miss) before driving the browser",
  },
  testRunner: { name: "playwright", config: "playwright.config.ts" },
  platform: "linux", startedAt: e.STARTED_AT,
  notes: ("Supabase is REMOTE and shared - this script never starts, migrates, seeds or tears it down; app credentials come from .env, which Astro loads itself. No local backing services and no Docker. The QA login is an EPHEMERAL user minted at boot via the service_role admin API (.ai/scripts/qa-user.mjs, mirroring tests/e2e/auth.setup.ts) and deleted by test-env-down.sh; its password lives only in the gitignored credentialsFile and is referenced by the passwordEnv name, never inline. Leftovers from a crashed run are swept on the next boot (accounts prefixed qa-agent- older than 6h). Teardown: .ai/scripts/test-env-down.sh (deletes the QA user, then stops the npm/node process group). " + e.QA_NOTE).trim(),
};
require("fs").writeFileSync(process.argv[1], JSON.stringify(desc, null, 2) + "\n");
' "$DESCRIPTOR"

echo "TEST_ENV_STATUS=running"
echo "TEST_ENV_BASE_URL=$BASE_URL"
echo "TEST_ENV_DESCRIPTOR=.ai/qa/test-env.json"
echo "TEST_ENV_REUSED=0"
echo "BROWSER_PROVIDER=$BROWSER_PROVIDER"
echo "BROWSER_INSTALLED=$([ "$BROWSER_PRESENT" = true ] && echo 1 || echo 0)"
echo "TEST_ENV_ELAPSED_SECONDS=$((SECONDS - STARTED))"
