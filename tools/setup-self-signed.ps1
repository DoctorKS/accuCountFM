<#
  setup-self-signed.ps1 — one-time code-signing cert generator for accuCountFM.

  Creates a self-signed cert in CurrentUser\My, then exports:
    tools/signing.pfx                  ← private; sign.ps1 uses this; gitignored
    tools/accuCountFM-publisher.cer    ← public; ship next to the installer

  Usage:
    $env:ACCUCOUNT_SIGN_PASSWORD = "your-strong-password"
    pwsh -File tools/setup-self-signed.ps1

  The password protects the .pfx. Pick something memorable — you'll set it
  again as an env var every time you build. Cert is valid for 3 years.
#>

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

$rawPwd = $env:ACCUCOUNT_SIGN_PASSWORD
if (-not $rawPwd) {
  Write-Host "Enter a password to protect signing.pfx (kept locally only):" -ForegroundColor Yellow
  $secPwd = Read-Host -AsSecureString
} else {
  $secPwd = ConvertTo-SecureString -String $rawPwd -AsPlainText -Force
}

Write-Host "Generating self-signed code-signing certificate…" -ForegroundColor Cyan
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=accuCountFM, O=DoctorKS, C=TH" `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature `
  -KeySpec Signature `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -HashAlgorithm SHA256 `
  -NotAfter ((Get-Date).AddYears(3))

$pfx = Join-Path $PSScriptRoot 'signing.pfx'
$cer = Join-Path $PSScriptRoot 'accuCountFM-publisher.cer'

Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $secPwd | Out-Null
Export-Certificate -Cert $cert -FilePath $cer | Out-Null

Write-Host ""
Write-Host "✓ Done." -ForegroundColor Green
Write-Host ""
Write-Host "Private cert (gitignored, build-only):  $pfx"
Write-Host "Public cert (ship to users):            $cer"
Write-Host "Thumbprint: $($cert.Thumbprint)"
Write-Host ""
Write-Host "Before building, set these in your shell:" -ForegroundColor Yellow
Write-Host "  `$env:ACCUCOUNT_SIGN_PFX = '$pfx'"
Write-Host "  `$env:ACCUCOUNT_SIGN_PASSWORD = '<your password>'"
Write-Host ""
Write-Host "Then: npm run tauri:build  (signCommand picks them up automatically)"
