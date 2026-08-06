[CmdletBinding()]
param(
  [switch]$KeepDatabase
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDirectory = Join-Path $ProjectRoot ".runtime"
$StateFile = Join-Path $RuntimeDirectory "services.json"

function Write-Step([string]$Message) {
  Write-Host "[TWS] $Message" -ForegroundColor Cyan
}

function Stop-ProcessTree([int]$ProcessId) {
  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    Stop-ProcessTree ([int]$child.ProcessId)
  }
  if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Stop-VerifiedListener([int]$Port) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -and $process.CommandLine.Contains($ProjectRoot)) {
      Stop-ProcessTree ([int]$process.ProcessId)
    }
  }
}

Set-Location $ProjectRoot

try {
  if (Test-Path -LiteralPath $StateFile) {
    $state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json
    Write-Step "Dong Next.js web..."
    Stop-ProcessTree ([int]$state.webPid)
    Write-Step "Dong NestJS API..."
    Stop-ProcessTree ([int]$state.apiPid)
    Remove-Item -LiteralPath $StateFile -Force -ErrorAction SilentlyContinue
  }
  else {
    Write-Step "Khong co PID file; kiem tra service cua project theo port..."
  }

  Stop-VerifiedListener 3000
  Stop-VerifiedListener 4000

  if (-not $KeepDatabase) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
      Write-Step "Dung PostgreSQL..."
      & docker compose stop postgres
      if ($LASTEXITCODE -ne 0) { Write-Warning "Khong the dung PostgreSQL; hay kiem tra Docker Desktop." }
    }
  }

  Write-Host "`nDa dong cac service TWS." -ForegroundColor Green
  if ($KeepDatabase) { Write-Host "PostgreSQL van dang chay do co -KeepDatabase." }
}
catch {
  Write-Host "`nDong service that bai: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

