# om-prepare-test-env: generated entrypoint (contract v2)
# regenerate with: om-prepare-test-env --regenerate
# history:
#   2026-08-18 generated for 10xCards (cold 90s, warm 1s). Astro dev server, no local
#              backing services: Supabase is remote and is never started, migrated,
#              seeded or torn down by this script.
#   2026-08-18 repair: write JSON without a BOM (PS 5.1 Set-Content -Encoding utf8
#              emits one; JS consumers' JSON.parse fails on it), and record the
#              generation-time browser command/version instead of an empty stub.
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
$LaunchArgs     = @('run', 'dev', '--', '--port')   # port appended at launch
$HealthTimeout  = 120                        # seconds to wait for the app to answer
$LockWait       = 300                        # seconds to wait for another bootstrap

# Build cache: preparation is skipped when none of these changed and the
# artifacts are present. `astro sync` regenerates .astro/ types from the config.
$BuildInputs    = @('package.json', 'package-lock.json', 'astro.config.mjs', 'tsconfig.json')
$BuildArtifacts = @('node_modules', '.astro')

$TtlSeconds = 600
if ($env:TEST_ENV_CACHE_TTL_SECONDS) { $TtlSeconds = [int]$env:TEST_ENV_CACHE_TTL_SECONDS }

# Browser provider, verified once at generation time via .ai/browsers/agent-browser.md
# (pinned release, SHA-256 checked, `doctor` green). The warm path never reinstalls;
# `installed` is re-derived from the binary actually being on disk.
$BrowserProvider = 'agent-browser'
$BrowserCommand  = Join-Path $env:LOCALAPPDATA 'agent-tools\agent-browser\v0.34.0\agent-browser-win32-x64.exe'
$BrowserVersion  = 'agent-browser 0.34.0'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Now-Utc { (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }

# Windows PowerShell 5.1's `Set-Content -Encoding utf8` always writes a BOM, and
# the consumers of these files are JS-based (JSON.parse chokes on a leading BOM).
function Write-Utf8NoBom([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-FreePort {
  $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $l.Start(); $port = $l.LocalEndpoint.Port; $l.Stop(); $port
}

function Test-PortFree([int]$Port) {
  try {
    $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $l.Start(); $l.Stop(); $true
  } catch { $false }
}

function Test-Health([string]$Url) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri $Url
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
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
      $healthy  = $pidAlive -and (Test-Health $d.baseUrl)
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
  $port = $PreferredPort
  if (-not (Test-PortFree $port)) { $port = Get-FreePort }
  $baseUrl = "http://localhost:$port"

  Remove-Item -LiteralPath $AppOutLog, $AppErrLog -Force -ErrorAction SilentlyContinue
  $proc = Start-Process -FilePath $LaunchExe -ArgumentList ($LaunchArgs + @("$port")) `
    -WorkingDirectory $RepoRoot -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $AppOutLog -RedirectStandardError $AppErrLog
  $appPid = $proc.Id

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

  # -------------------------------------------------------------------------
  # 7. Descriptor write + result lines
  # -------------------------------------------------------------------------
  $browserPresent = Test-Path $BrowserCommand
  $browser = @{
    provider   = $BrowserProvider
    installed  = $browserPresent
    command    = $BrowserCommand
    version    = $BrowserVersion
    descriptor = '.ai/browsers/agent-browser.md'
    notes      = ''
  }
  if (-not $browserPresent) {
    $browser.notes = 'binary missing from the generation-time cache path; re-run om-prepare-test-env --regenerate to reinstall the provider'
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
    credentials       = @()
    credentialsFile   = ''
    browser           = $browser
    testRunner        = [ordered]@{ name = 'playwright'; config = 'playwright.config.ts' }
    platform          = 'win32'
    startedAt         = (Now-Utc)
    notes             = 'Supabase is REMOTE and shared - this script never starts, migrates, seeds or tears it down; credentials come from .env, which Astro loads itself. No local backing services and no Docker. No QA login is recorded: the committed Playwright suite mints its own ephemeral user in tests/e2e/auth.setup.ts and deletes it in global.teardown.ts, so browser QA driven by this descriptor reaches only unauthenticated routes (/, /auth/signin, /auth/signup) unless a user is provisioned separately. Teardown: .ai/scripts/test-env-down.ps1 (stops the npm/node process tree only).'
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
