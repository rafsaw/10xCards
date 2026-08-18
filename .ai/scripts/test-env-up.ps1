# om-prepare-test-env: generated entrypoint (contract v2)
# regenerate with: om-prepare-test-env --regenerate
# history:
#   2026-08-18 generated for 10xCards (cold 90s, warm 1s). Astro dev server, no local
#              backing services: Supabase is remote and is never started, migrated,
#              seeded or torn down by this script.
#   2026-08-18 repair: write JSON without a BOM (PS 5.1 Set-Content -Encoding utf8
#              emits one; JS consumers' JSON.parse fails on it), and record the
#              generation-time browser command/version instead of an empty stub.
#   2026-08-18 repair: require HTTP 200 and assert the app is configured before
#              declaring the env ready (a missing .env boots and serves 200 with
#              only the config-status banner, which QA would then report instead
#              of the change under test); reuse now probes baseUrl+healthPath.
#   2026-08-18 repair: resolve the port the app actually bound instead of trusting
#              the requested one. Astro increments when the port is taken, and an
#              IPv4-only pre-flight bind check called a port free while a server
#              answered over ::1 — together they made the boot watch a dead port
#              for 120 s and then report a healthy app as failed.
#   2026-08-18 feature: mint an ephemeral QA user at boot (.ai/scripts/qa-user.mjs)
#              so browser QA reaches the authenticated routes; swept on the next
#              boot and deleted at teardown. Non-fatal on failure - the env still
#              serves the public routes and the descriptor says QA is limited.
#   2026-08-18 switch: browser provider agent-browser -> playwright. agent-browser
#              passes doctor and fetches external pages but hangs opening the local
#              dev server here; playwright already drives this app in tests/e2e/.
#              Authenticated QA verified by .ai/scripts/qa-login-check.mjs.
param([switch]$Force, [switch]$ForceRebuild)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Accept POSIX-style flags too, so callers can pass --force / --force-rebuild.
foreach ($a in $args) {
  if ($a -eq '--force') { $Force = $true }
  elseif ($a -eq '--force-rebuild') { $ForceRebuild = $true }
}

# ---------------------------------------------------------------------------
# Project-specific variables — tweak here, never in the logic below.
# ---------------------------------------------------------------------------
$RepoRoot       = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$QaDir          = Join-Path $RepoRoot '.ai\qa'
$Descriptor     = Join-Path $QaDir 'test-env.json'
$BuildCacheFile = Join-Path $QaDir 'test-env-build-cache.json'
$LockDir        = Join-Path $QaDir 'test-env.lock'
$AppOutLog      = Join-Path $QaDir 'test-env-app.out.log'
$AppErrLog      = Join-Path $QaDir 'test-env-app.err.log'

$PreferredPort  = 4321                       # Astro dev default; playwright.config.ts expects it
$HealthPath     = '/'
$LaunchExe      = 'npm.cmd'
# --host 127.0.0.1 is load-bearing, not cosmetic: left to itself the dev server
# binds [::1] only, and the browser provider (which resolves to IPv4 first) then
# cannot reach it at all - the env looks healthy to curl and is useless for QA.
$LaunchArgs     = @('run', 'dev', '--', '--host', '127.0.0.1', '--port')   # port appended at launch
$HealthTimeout  = 120                        # seconds to wait for the app to answer
$LockWait       = 300                        # seconds to wait for another bootstrap

# Build cache: preparation is skipped when none of these changed and the
# artifacts are present. `astro sync` regenerates .astro/ types from the config.
$BuildInputs    = @('package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json')
$BuildArtifacts = @('node_modules', '.astro')

$TtlSeconds = 600
if ($env:TEST_ENV_CACHE_TTL_SECONDS) { $TtlSeconds = [int]$env:TEST_ENV_CACHE_TTL_SECONDS }

# Browser provider: playwright (.ai/browsers/playwright.md). agent-browser was the
# original choice but cannot reach this dev server on this machine (doctor green,
# external fetches fine, `open` on the local URL hangs - see the repo-local skill).
# Playwright already drives this exact app in tests/e2e/, so it is the provider
# that demonstrably works. `installed` is derived from the dependency being present.
$BrowserProvider = 'playwright'
$BrowserCommand  = 'npx playwright'
$BrowserVersion  = '1.60.0'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Now-Utc { (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }

# Windows PowerShell 5.1's `Set-Content -Encoding utf8` always writes a BOM, and
# the consumers of these files are JS-based (JSON.parse chokes on a leading BOM).
function Write-Utf8NoBom([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

# Never trust the port we asked for. Astro auto-increments when the requested port
# is taken ("Port 4321 is in use, trying another one...") and prints the real one,
# and a pre-flight bind check cannot be trusted either: binding 127.0.0.1 succeeds
# while a dev server is reachable over ::1, so the check reported a busy port free
# and the health probe then watched a port nothing served. Read the bound port from
# the app's own output instead.
function Wait-BoundPort([string]$LogPath, [int]$TimeoutSeconds) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $LogPath) {
      $m = Select-String -LiteralPath $LogPath -Pattern 'http://(?:localhost|127\.0\.0\.1):(\d+)' -ErrorAction SilentlyContinue |
             Select-Object -First 1
      if ($m) { return [int]$m.Matches[0].Groups[1].Value }
    }
    Start-Sleep -Milliseconds 500
  }
  return 0
}

function Test-Health([string]$Url) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri $Url
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

# Answering is not the same as being usable. Every env var is `optional: true` in
# astro.config.mjs and src/lib/supabase.ts returns $null without SUPABASE_URL/KEY,
# so an app started with no .env boots, serves 200, and merely renders the
# src/lib/config-status.ts banner. QA driven against that app reports the missing
# configuration instead of the change under test, so treat it as a failed boot.
function Test-Configured([string]$Url) {
  try {
    $body = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 -Uri $Url).Content
    return (-not ($body -match 'nie jest skonfigurowany'))
  } catch { return $false }
}

function Get-Fingerprint {
  $parts = @()
  foreach ($rel in $BuildInputs) {
    $p = Join-Path $RepoRoot $rel
    if (Test-Path $p) {
      $f = Get-Item $p
      $parts += "$rel`:$($f.Length):$($f.LastWriteTimeUtc.Ticks)"
    } else {
      $parts += "$rel`:missing"
    }
  }
  $joined = ($parts -join ';')
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    ($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($joined)) |
      ForEach-Object { $_.ToString('x2') }) -join ''
  } finally { $sha.Dispose() }
}

function Test-ArtifactsPresent {
  foreach ($rel in $BuildArtifacts) {
    if (-not (Test-Path (Join-Path $RepoRoot $rel))) { return $false }
  }
  return $true
}

# Kill a process tree — `npm.cmd` spawns node, so stopping only the parent
# would leave the dev server listening and the next run would "reuse" a
# server nobody owns.
function Stop-Tree([int]$ProcessId) {
  $kids = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
  foreach ($k in $kids) { Stop-Tree ([int]$k.ProcessId) }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Read-Descriptor {
  if (-not (Test-Path $Descriptor)) { return $null }
  try { Get-Content -Raw -LiteralPath $Descriptor | ConvertFrom-Json } catch { $null }
}

function Stop-Recorded {
  $d = Read-Descriptor
  if ($null -eq $d) { return }
  if ($d.startedByThisRepo -and $d.app.pid) {
    if (Get-Process -Id $d.app.pid -ErrorAction SilentlyContinue) { Stop-Tree ([int]$d.app.pid) }
  }
}

# ---------------------------------------------------------------------------
# 2. Lock — one bootstrap at a time
# ---------------------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $QaDir | Out-Null
$haveLock = $false
$deadline = (Get-Date).AddSeconds($LockWait)
while (-not $haveLock) {
  try {
    New-Item -ItemType Directory -Path $LockDir -ErrorAction Stop | Out-Null
    $haveLock = $true
  } catch {
    $ownerFile = Join-Path $LockDir 'owner.json'
    $ownerPid = $null
    if (Test-Path $ownerFile) {
      try { $ownerPid = (Get-Content -Raw -LiteralPath $ownerFile | ConvertFrom-Json).pid } catch { $ownerPid = $null }
    }
    $alive = $false
    if ($ownerPid) { $alive = [bool](Get-Process -Id $ownerPid -ErrorAction SilentlyContinue) }
    if (-not $alive) {
      Remove-Item -LiteralPath $LockDir -Recurse -Force -ErrorAction SilentlyContinue
      continue
    }
    if ((Get-Date) -gt $deadline) { throw "Another bootstrap (pid $ownerPid) still holds $LockDir after $LockWait s" }
    Start-Sleep -Seconds 3
  }
}
Write-Utf8NoBom (Join-Path $LockDir 'owner.json') (
  @{ pid = $PID; source = 'test-env-up.ps1'; acquiredAt = (Now-Utc) } | ConvertTo-Json)

$started = Get-Date
$reused = 0
try {
  # -------------------------------------------------------------------------
  # 3. Reuse check — attach, don't reboot
  # -------------------------------------------------------------------------
  if (-not $Force) {
    $d = Read-Descriptor
    if ($d -and $d.status -eq 'running' -and $d.app.pid) {
      $pidAlive = [bool](Get-Process -Id $d.app.pid -ErrorAction SilentlyContinue)
      # Probe the same URL a fresh boot probes, composed from the descriptor, so
      # reuse and boot cannot drift apart if healthPath ever stops being '/'.
      $probeUrl = $d.baseUrl + $d.app.healthPath
      $healthy  = $pidAlive -and (Test-Health $probeUrl) -and (Test-Configured $probeUrl)
      $fresh    = $false
      if ($healthy) {
        $age = ((Get-Date).ToUniversalTime() - [datetime]::Parse($d.startedAt).ToUniversalTime()).TotalSeconds
        $fresh = $age -lt $TtlSeconds
        if ($fresh) {
          # A changed build input invalidates a running env even inside the TTL.
          foreach ($rel in $BuildInputs) {
            $p = Join-Path $RepoRoot $rel
            if ((Test-Path $p) -and ((Get-Item $p).LastWriteTimeUtc -gt [datetime]::Parse($d.startedAt).ToUniversalTime())) {
              $fresh = $false
            }
          }
        }
      }
      if ($healthy -and $fresh) {
        "TEST_ENV_STATUS=running"
        "TEST_ENV_BASE_URL=$($d.baseUrl)"
        "TEST_ENV_DESCRIPTOR=.ai/qa/test-env.json"
        "TEST_ENV_REUSED=1"
        "BROWSER_PROVIDER=$($d.browser.provider)"
        "BROWSER_INSTALLED=$(if ($d.browser.installed) { 1 } else { 0 })"
        exit 0
      }
      Stop-Recorded   # stale claim — tear down what this repo started
    }
  } else {
    Stop-Recorded
  }

  # -------------------------------------------------------------------------
  # 4. Build cache — skip preparation that has not changed
  # -------------------------------------------------------------------------
  $fingerprint = Get-Fingerprint
  $cacheHit = $false
  if (-not $ForceRebuild -and (Test-Path $BuildCacheFile) -and (Test-ArtifactsPresent)) {
    try {
      $c = Get-Content -Raw -LiteralPath $BuildCacheFile | ConvertFrom-Json
      $cacheHit = ($c.fingerprint -eq $fingerprint -and $c.projectRoot -eq $RepoRoot)
    } catch { $cacheHit = $false }
  }

  if (-not $cacheHit) {
    Push-Location $RepoRoot
    try {
      if (Test-Path (Join-Path $RepoRoot 'package-lock.json')) {
        & npm.cmd ci
      } else {
        & npm.cmd install
      }
      if ($LASTEXITCODE -ne 0) { throw "dependency install failed with exit code $LASTEXITCODE" }
      & npx.cmd astro sync
      if ($LASTEXITCODE -ne 0) { throw "astro sync failed with exit code $LASTEXITCODE" }
    } finally { Pop-Location }
    Write-Utf8NoBom $BuildCacheFile (
      @{ fingerprint = $fingerprint; projectRoot = $RepoRoot; preparedAt = (Now-Utc) } | ConvertTo-Json)
  }

  # -------------------------------------------------------------------------
  # 5. Services — none. Supabase is remote (see .env / astro:env server schema)
  #    and is neither provisioned nor torn down here.
  # 6. App start + health wait
  # -------------------------------------------------------------------------
  Remove-Item -LiteralPath $AppOutLog, $AppErrLog -Force -ErrorAction SilentlyContinue
  $proc = Start-Process -FilePath $LaunchExe -ArgumentList ($LaunchArgs + @("$PreferredPort")) `
    -WorkingDirectory $RepoRoot -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $AppOutLog -RedirectStandardError $AppErrLog
  $appPid = $proc.Id

  # The requested port is a preference, not a fact — resolve the one actually bound.
  $port = Wait-BoundPort $AppOutLog 60
  if ($port -eq 0) {
    if (Get-Process -Id $appPid -ErrorAction SilentlyContinue) { Stop-Tree $appPid }
    $tail = ''
    if (Test-Path $AppOutLog) { $tail = (Get-Content -Tail 20 -LiteralPath $AppOutLog) -join "`n" }
    throw "app never reported a bound port within 60 s`n$tail"
  }
  if ($port -ne $PreferredPort) {
    Write-Host "note: port $PreferredPort was taken; the app bound $port instead"
  }
  # 127.0.0.1, not localhost: the contract's descriptor shape uses it, and it is
  # unambiguous for consumers that resolve IPv4 first.
  $baseUrl = "http://127.0.0.1:$port"

  $healthy = $false
  $healthDeadline = (Get-Date).AddSeconds($HealthTimeout)
  while ((Get-Date) -lt $healthDeadline) {
    if (-not (Get-Process -Id $appPid -ErrorAction SilentlyContinue)) { break }
    if (Test-Health ($baseUrl + $HealthPath)) { $healthy = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $healthy) {
    if (Get-Process -Id $appPid -ErrorAction SilentlyContinue) { Stop-Tree $appPid }
    $tail = ''
    if (Test-Path $AppErrLog) { $tail = (Get-Content -Tail 20 -LiteralPath $AppErrLog) -join "`n" }
    throw "app did not become healthy at $baseUrl$HealthPath within $HealthTimeout s`n$tail"
  }

  # Answering is not usable: refuse to hand QA an app that booted without its
  # configuration (see Test-Configured). .env is gitignored, so a fresh checkout
  # lands here rather than in an obvious crash.
  if (-not (Test-Configured ($baseUrl + $HealthPath))) {
    Stop-Tree $appPid
    throw "app is running at $baseUrl but reports missing configuration (the src/lib/config-status.ts banner is present). Check .env for SUPABASE_URL / SUPABASE_KEY before using this environment for QA."
  }

  # -------------------------------------------------------------------------
  # 6b. Ephemeral QA login for agent-driven browser QA
  # -------------------------------------------------------------------------
  # Delegated to node so it can reuse @supabase/supabase-js and mirror
  # tests/e2e/auth.setup.ts. The helper writes the password straight into the
  # gitignored credentials file and prints only the (non-secret) email and id.
  # A failure here is loud but not fatal: the environment is still usable for the
  # unauthenticated routes, and the descriptor records that QA is limited.
  $qaEmail = ''
  $qaNote = ''
  Push-Location $RepoRoot
  try {
    # Delete the previously recorded user first: `create` overwrites the credentials
    # file, so minting without this would lose the old id and orphan that account
    # in the shared project until the 6h sweep caught it. No-op when none exists.
    & node.exe '.ai/scripts/qa-user.mjs' delete 2>&1 | Out-Null
    & node.exe '.ai/scripts/qa-user.mjs' sweep 2>&1 | Out-Null   # clear leftovers from crashed runs
    $qaOut = & node.exe '.ai/scripts/qa-user.mjs' create 2>&1
    if ($LASTEXITCODE -ne 0) {
      $qaNote = 'QA user could not be minted; authenticated routes are not reachable from this environment'
      Write-Host "warning: $qaNote"
      Write-Host ($qaOut | Out-String).Trim()
    } else {
      $match = $qaOut | Select-String -Pattern '^QA_EMAIL=(.+)$' | Select-Object -First 1
      if ($match) { $qaEmail = $match.Matches[0].Groups[1].Value }
    }
  } finally { Pop-Location }

  $credentials = @()
  $credentialsFile = ''
  if ($qaEmail) {
    $credentials = @(@{ role = 'qa'; username = $qaEmail; passwordEnv = 'TEST_QA_PASSWORD' })
    $credentialsFile = '.ai/qa/test-env.env'
  }

  # -------------------------------------------------------------------------
  # 7. Descriptor write + result lines
  # -------------------------------------------------------------------------
  $browserPresent = Test-Path (Join-Path $RepoRoot 'node_modules\@playwright\test')
  $browser = @{
    provider   = $BrowserProvider
    installed  = $browserPresent
    command    = $BrowserCommand
    version    = $BrowserVersion
    descriptor = '.ai/browsers/playwright.md'
    notes      = 'Authenticated QA is proven by .ai/scripts/qa-login-check.mjs, which signs in with the recorded credentials and asserts /dashboard renders for that user.'
  }
  if (-not $browserPresent) {
    $browser.notes = '@playwright/test is not installed; run the dependency install (the up script does this on a cache miss) before driving the browser'
  }

  $desc = [ordered]@{
    version           = 1
    runId             = "10xcards-" + (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
    status            = 'running'
    mode              = 'dev'
    baseUrl           = $baseUrl
    startedByThisRepo = $true
    startScript       = '.ai/scripts/test-env-up.ps1'
    stopScript        = '.ai/scripts/test-env-down.ps1'
    app               = [ordered]@{
      startCommand = 'npm run dev -- --port ' + $port
      port         = $port
      healthPath   = $HealthPath
      pid          = $appPid
    }
    services          = @()
    credentials       = $credentials
    credentialsFile   = $credentialsFile
    browser           = $browser
    testRunner        = [ordered]@{ name = 'playwright'; config = 'playwright.config.ts' }
    platform          = 'win32'
    startedAt         = (Now-Utc)
    notes             = ('Supabase is REMOTE and shared - this script never starts, migrates, seeds or tears it down; app credentials come from .env, which Astro loads itself. No local backing services and no Docker. The QA login is an EPHEMERAL user minted at boot via the service_role admin API (.ai/scripts/qa-user.mjs, mirroring tests/e2e/auth.setup.ts) and deleted by test-env-down.ps1; its password lives only in the gitignored credentialsFile and is referenced by the passwordEnv name, never inline. Leftovers from a crashed run are swept on the next boot (accounts prefixed qa-agent- older than 6h). Teardown: .ai/scripts/test-env-down.ps1 (deletes the QA user, then stops the npm/node process tree). ' + $qaNote).Trim()
  }
  Write-Utf8NoBom $Descriptor ($desc | ConvertTo-Json -Depth 6)

  "TEST_ENV_STATUS=running"
  "TEST_ENV_BASE_URL=$baseUrl"
  "TEST_ENV_DESCRIPTOR=.ai/qa/test-env.json"
  "TEST_ENV_REUSED=$reused"
  "BROWSER_PROVIDER=$($browser.provider)"
  "BROWSER_INSTALLED=$(if ($browser.installed) { 1 } else { 0 })"
  "TEST_ENV_ELAPSED_SECONDS=$([int]((Get-Date) - $started).TotalSeconds)"
}
finally {
  Remove-Item -LiteralPath $LockDir -Recurse -Force -ErrorAction SilentlyContinue
}
