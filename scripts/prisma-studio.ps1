[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvironmentFile = Join-Path $ProjectRoot ".env"

if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
  throw "Khong tim thay file .env tai thu muc goc du an."
}

$DatabaseUrlLine = Get-Content -LiteralPath $EnvironmentFile |
  Where-Object { $_ -match "^\s*DATABASE_URL\s*=" } |
  Select-Object -First 1

if (-not $DatabaseUrlLine) {
  throw "Khong tim thay DATABASE_URL trong file .env."
}

$env:DATABASE_URL = ($DatabaseUrlLine -replace "^\s*DATABASE_URL\s*=\s*", "").Trim().Trim('"')

try {
  Set-Location $ProjectRoot
  Write-Host "[TWS] Prisma Studio: http://localhost:5555" -ForegroundColor Cyan
  & pnpm.cmd --filter "@tws/api" exec prisma studio
  if ($LASTEXITCODE -ne 0) {
    throw "Prisma Studio da dung voi ma loi $LASTEXITCODE."
  }
}
finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}
