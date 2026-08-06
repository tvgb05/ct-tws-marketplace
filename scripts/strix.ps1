$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$strixRoot = Join-Path $projectRoot ".runtime\strix"

$strixExe = Get-ChildItem -LiteralPath $strixRoot -Recurse -Filter "strix*.exe" -File -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1

if (-not $strixExe) {
    Write-Error "Khong tim thay Strix CLI trong $strixRoot. Hay cai Strix truoc khi chay lenh nay."
    exit 1
}

$env:STRIX_TELEMETRY = "0"
& $strixExe.FullName @args
exit $LASTEXITCODE
