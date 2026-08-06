[CmdletBinding()]
param(
  [switch]$SkipDatabaseSetup
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDirectory = Join-Path $ProjectRoot ".runtime"
$StateFile = Join-Path $RuntimeDirectory "services.json"

function Write-Step([string]$Message) {
  Write-Host "[TWS] $Message" -ForegroundColor Cyan
}

function Assert-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Khong tim thay '$Name'. $InstallHint"
  }
}

function Test-ListeningPort([int]$Port) {
  return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Test-DockerReady {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  $dockerVersion = & docker info --format "{{.ServerVersion}}" 2>$null
  $ErrorActionPreference = $previousPreference
  return -not [string]::IsNullOrWhiteSpace(($dockerVersion | Out-String))
}

function Wait-ListeningPort([int]$Port, [int]$TimeoutSeconds) {
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  while ($watch.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    if (Test-ListeningPort $Port) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
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

function Show-LogTail([string]$Path) {
  if (Test-Path -LiteralPath $Path) {
    Write-Host "`n--- $Path ---" -ForegroundColor Yellow
    Get-Content -LiteralPath $Path -Tail 30
  }
}

Set-Location $ProjectRoot
New-Item -ItemType Directory -Path $RuntimeDirectory -Force | Out-Null

try {
  Assert-Command "node" "Hay cai Node.js 24+."
  Assert-Command "pnpm.cmd" "Hay cai pnpm bang: npm install -g pnpm"
  Assert-Command "docker" "Hay cai va mo Docker Desktop."

  if ((Test-ListeningPort 3000) -and (Test-ListeningPort 4000)) {
    Write-Host "Web va API da dang chay." -ForegroundColor Green
    Write-Host "Web:     http://localhost:3000"
    Write-Host "API:     http://localhost:4000/api/v1"
    Write-Host "Swagger: http://localhost:4000/api/docs"
    exit 0
  }

  foreach ($port in @(3000, 4000)) {
    if (Test-ListeningPort $port) {
      throw "Port $port dang duoc tien trinh khac su dung. Hay chay stop-all.cmd hoac dong tien trinh do."
    }
  }

  if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot ".env"))) {
    Copy-Item -LiteralPath (Join-Path $ProjectRoot ".env.example") -Destination (Join-Path $ProjectRoot ".env")
    Write-Step "Da tao .env tu .env.example (cau hinh local)."
  }

  $envFile = Join-Path $ProjectRoot ".env"
  $databaseUrlLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^\s*DATABASE_URL\s*=" } | Select-Object -First 1
  if (-not $databaseUrlLine) { throw "Khong tim thay DATABASE_URL trong .env." }
  $env:DATABASE_URL = ($databaseUrlLine -replace "^\s*DATABASE_URL\s*=\s*", "").Trim()

  if (-not (Test-DockerReady)) {
    $dockerDesktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path -LiteralPath $dockerDesktop)) {
      throw "Docker Desktop chua san sang va khong tim thay file cai dat."
    }

    Write-Step "Mo Docker Desktop va cho engine san sang..."
    Start-Process -FilePath $dockerDesktop -WindowStyle Hidden | Out-Null
    $dockerWatch = [System.Diagnostics.Stopwatch]::StartNew()
    $dockerReady = $false
    while ($dockerWatch.Elapsed.TotalSeconds -lt 120) {
      if (Test-DockerReady) {
        $dockerReady = $true
        break
      }
      Start-Sleep -Seconds 2
    }
    if (-not $dockerReady) { throw "Docker Desktop khong san sang sau 120 giay." }
  }

  Write-Step "Khoi dong PostgreSQL..."
  & docker compose up -d postgres
  if ($LASTEXITCODE -ne 0) { throw "Khong the khoi dong PostgreSQL." }
  if (-not (Wait-ListeningPort 5432 45)) { throw "PostgreSQL khong san sang sau 45 giay." }

  if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules\.modules.yaml"))) {
    Write-Step "Cai dat dependencies..."
    & pnpm.cmd install
    if ($LASTEXITCODE -ne 0) { throw "pnpm install that bai." }
  }

  if (-not $SkipDatabaseSetup) {
    Write-Step "Dong bo Prisma schema va seed du lieu local..."
    & pnpm.cmd db:generate
    if ($LASTEXITCODE -ne 0) { throw "Prisma generate that bai." }
    & pnpm.cmd --filter "@tws/api" exec prisma db push --skip-generate
    if ($LASTEXITCODE -ne 0) { throw "Prisma db push that bai." }
    & pnpm.cmd db:seed
    if ($LASTEXITCODE -ne 0) { throw "Database seed that bai." }
  }

  $apiOut = Join-Path $RuntimeDirectory "api.out.log"
  $apiErr = Join-Path $RuntimeDirectory "api.err.log"
  $webOut = Join-Path $RuntimeDirectory "web.out.log"
  $webErr = Join-Path $RuntimeDirectory "web.err.log"
  Set-Content -LiteralPath $apiOut -Value "" -Encoding UTF8
  Set-Content -LiteralPath $apiErr -Value "" -Encoding UTF8
  Set-Content -LiteralPath $webOut -Value "" -Encoding UTF8
  Set-Content -LiteralPath $webErr -Value "" -Encoding UTF8

  Write-Step "Khoi dong NestJS API..."
  $apiProcess = Start-Process -FilePath "pnpm.cmd" -ArgumentList @("--filter", "@tws/api", "dev") -WorkingDirectory $ProjectRoot -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr -WindowStyle Hidden -PassThru

  Write-Step "Khoi dong Next.js web..."
  $webProcess = Start-Process -FilePath "pnpm.cmd" -ArgumentList @("--filter", "@tws/web", "dev") -WorkingDirectory $ProjectRoot -RedirectStandardOutput $webOut -RedirectStandardError $webErr -WindowStyle Hidden -PassThru

  [ordered]@{
    projectRoot = $ProjectRoot
    apiPid = $apiProcess.Id
    webPid = $webProcess.Id
    startedAt = (Get-Date).ToString("o")
  } | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding UTF8

  $apiReady = Wait-ListeningPort 4000 60
  $webReady = Wait-ListeningPort 3000 60
  if (-not $apiReady -or -not $webReady) {
    Stop-ProcessTree $webProcess.Id
    Stop-ProcessTree $apiProcess.Id
    Show-LogTail $apiErr
    Show-LogTail $apiOut
    Show-LogTail $webErr
    Show-LogTail $webOut
    throw "Web hoac API khong khoi dong dung han. Xem log trong .runtime."
  }

  Write-Host "`nTat ca service da san sang." -ForegroundColor Green
  Write-Host "Web:     http://localhost:3000"
  Write-Host "API:     http://localhost:4000/api/v1"
  Write-Host "Swagger: http://localhost:4000/api/docs"
  Write-Host "Logs:    $RuntimeDirectory"
  Write-Host "Dung:    .\stop-all.cmd"
}
catch {
  Write-Host "`nKhoi dong that bai: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
