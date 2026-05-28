<#
  sign.ps1 — Tauri calls this for each installer artifact during build.

  Wired via tauri.conf.json::bundle.windows.signCommand. The `%1`
  placeholder Tauri injects becomes our -File argument.

  Required env vars:
    ACCUCOUNT_SIGN_PFX        absolute path to signing.pfx
    ACCUCOUNT_SIGN_PASSWORD   password for the pfx

  Reads signtool.exe from the latest Windows 10/11 SDK. Timestamps via
  DigiCert's free RFC3161 endpoint so signatures stay valid even after
  the cert itself expires.
#>

param([Parameter(Mandatory=$true)][string]$File)

$ErrorActionPreference = 'Stop'

$pfx = $env:ACCUCOUNT_SIGN_PFX
$pwd = $env:ACCUCOUNT_SIGN_PASSWORD
if (-not $pfx -or -not (Test-Path $pfx)) {
  Write-Error "ACCUCOUNT_SIGN_PFX env var not set or file missing ($pfx). Run tools/setup-self-signed.ps1 first."
  exit 1
}
if (-not $pwd) {
  Write-Error "ACCUCOUNT_SIGN_PASSWORD env var not set."
  exit 1
}

# Locate the most recent signtool.exe from any installed Win10/11 SDK.
$candidates = @(
  "${env:ProgramFiles(x86)}\Windows Kits\10\bin",
  "${env:ProgramFiles}\Windows Kits\10\bin"
) | Where-Object { Test-Path $_ }

$signtool = $candidates |
  ForEach-Object { Get-ChildItem $_ -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue } |
  Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $signtool) {
  Write-Error "signtool.exe not found — install Windows 10/11 SDK (comes with VS Build Tools)."
  exit 1
}

Write-Host "[sign.ps1] $File" -ForegroundColor Cyan
& $signtool sign `
  /fd SHA256 `
  /f $pfx `
  /p $pwd `
  /tr http://timestamp.digicert.com `
  /td SHA256 `
  $File

$exit = $LASTEXITCODE
if ($exit -ne 0) {
  Write-Error "signtool failed with exit $exit"
}
exit $exit
