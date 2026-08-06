[CmdletBinding()]
param(
  [string]$Name,
  [string]$Email
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($Name)) {
  $Name = Read-Host "Ten hien thi cua admin"
}
if ([string]::IsNullOrWhiteSpace($Email)) {
  $Email = Read-Host "Email dang nhap admin"
}

$SecurePassword = Read-Host "Mat khau (toi thieu 12 ky tu, co chu hoa, chu thuong va so)" -AsSecureString
$SecureConfirmation = Read-Host "Nhap lai mat khau" -AsSecureString
$PasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
$ConfirmationPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureConfirmation)

try {
  $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($PasswordPointer)
  $PlainConfirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ConfirmationPointer)
  if ($PlainPassword -cne $PlainConfirmation) {
    throw "Mat khau xac nhan khong khop."
  }

  $env:ADMIN_CREATE_NAME = $Name.Trim()
  $env:ADMIN_CREATE_EMAIL = $Email.Trim().ToLowerInvariant()
  $env:ADMIN_CREATE_PASSWORD = $PlainPassword
  Set-Location $ProjectRoot
  & pnpm.cmd --filter "@tws/api" exec tsx --env-file=../../.env prisma/create-admin.ts
  if ($LASTEXITCODE -ne 0) { throw "Khong the tao tai khoan admin." }
}
finally {
  Remove-Item Env:ADMIN_CREATE_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:ADMIN_CREATE_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:ADMIN_CREATE_PASSWORD -ErrorAction SilentlyContinue
  $PlainPassword = $null
  $PlainConfirmation = $null
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($PasswordPointer)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ConfirmationPointer)
}
