# om-prepare-test-env: generated entrypoint (contract v2)
# regenerate with: om-prepare-test-env --regenerate
# history:
#   2026-08-18 generated for 10xCards (stops only the npm/node process tree this
#              repo started; remote Supabase is never touched)
#   2026-08-18 repair: write the descriptor without a BOM (see test-env-up.ps1)
#   2026-08-18 feature: delete the ephemeral QA user before stopping the app
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$QaDir      = Join-Path $RepoRoot '.ai\qa'
$Descriptor = Join-Path $QaDir 'test-env.json'
$LockDir    = Join-Path $QaDir 'test-env.lock'

# Windows PowerShell 5.1's `Set-Content -Encoding utf8` always writes a BOM, and
# the consumers of this descriptor are JS-based (JSON.parse chokes on a leading BOM).
function Write-Utf8NoBom([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

function Stop-Tree([int]$ProcessId) {
  $kids = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
  foreach ($k in $kids) { Stop-Tree ([int]$k.ProcessId) }
  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path $Descriptor)) {
  "TEST_ENV_STATUS=stopped"
  "TEST_ENV_NOTES=no descriptor found; nothing to stop"
  exit 0
}

$d = Get-Content -Raw -LiteralPath $Descriptor | ConvertFrom-Json

# Never tear down an environment this repo did not start.
if (-not $d.startedByThisRepo) {
  "TEST_ENV_STATUS=$($d.status)"
  "TEST_ENV_NOTES=environment was not started by this repo; left untouched"
  exit 0
}

# Delete the ephemeral QA user before the app goes away. Non-fatal: a leaked
# account is swept on the next boot, and failing here would leave the dev server
# running, which is worse.
Push-Location $RepoRoot
try {
  & node.exe '.ai/scripts/qa-user.mjs' delete 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'warning: the QA user could not be deleted; it will be swept on the next boot'
  }
} finally { Pop-Location }

if ($d.app.pid -and (Get-Process -Id $d.app.pid -ErrorAction SilentlyContinue)) {
  Stop-Tree ([int]$d.app.pid)
}

# No containers or volumes are created by the up script (no local services),
# so there is nothing else scoped to this environment to remove.

$d.status = 'stopped'
Write-Utf8NoBom $Descriptor ($d | ConvertTo-Json -Depth 6)
Remove-Item -LiteralPath $LockDir -Recurse -Force -ErrorAction SilentlyContinue

"TEST_ENV_STATUS=stopped"
"TEST_ENV_DESCRIPTOR=.ai/qa/test-env.json"
