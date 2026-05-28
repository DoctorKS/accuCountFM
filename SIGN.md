# 🔏 Code-signing — accuCountFM

Goal: get rid of Windows SmartScreen's "Microsoft Defender SmartScreen
prevented an unrecognized app from starting" pop-up when end users run
the installer.

Two free routes are documented here. Pick one based on whether the repo
is private (use **§A self-sign**) or you're willing to make it public
open source (use **§B SignPath Foundation** — better SmartScreen result).

---

## §A — Self-signed certificate (truly free, semi-effective)

What you get:
- Installer's "Publisher" reads `accuCountFM` instead of `Unknown publisher`.
- SmartScreen warning still appears the first time on a given machine, but
  if the user imports the public cert into **Trusted Publishers** (one-time
  click), subsequent installs of any signed version skip the warning.
- Cert is valid 3 years (set in `setup-self-signed.ps1`).

### One-time setup (on the BUILD machine)

```powershell
cd C:\dev\accuCountFM
$env:ACCUCOUNT_SIGN_PASSWORD = "pick-a-strong-password"
powershell -ExecutionPolicy Bypass -File tools/setup-self-signed.ps1
```

Output:
```
tools/signing.pfx                       ← private cert + key (gitignored)
tools/accuCountFM-publisher.cer         ← public cert; ship to users
```

> **Back up `signing.pfx` somewhere safe** (USB / password manager). If you
> lose it you can't sign new releases with the same publisher identity —
> you'd have to regenerate and ask every user to re-trust a new cert.

### Sign during build

Tauri's `tauri.conf.json::bundle.windows.signCommand` is already wired to
call `tools/sign.ps1` after each installer artifact is produced.

Before `npm run tauri:build`, set the env vars:

```powershell
$env:ACCUCOUNT_SIGN_PFX      = "C:\dev\accuCountFM\tools\signing.pfx"
$env:ACCUCOUNT_SIGN_PASSWORD = "pick-a-strong-password"
npm run tauri:build
```

Verify the signature on the produced installer:

```powershell
$exe = "src-tauri\target\release\bundle\nsis\accuCountFM_0.1.0_x64-setup.exe"
Get-AuthenticodeSignature $exe | Select-Object Status, SignerCertificate
```

`Status` should read `Valid` (or `UnknownError` if not yet trusted — that's
normal for self-signed).

### Ship to users

Hand over two files together:
1. `accuCountFM_<ver>_x64-setup.exe` — the installer
2. `accuCountFM-publisher.cer` — the public cert

Tell the user to **once** (per machine):

```powershell
# Run in elevated PowerShell on the user's machine:
Import-Certificate -FilePath .\accuCountFM-publisher.cer `
  -CertStoreLocation Cert:\LocalMachine\TrustedPublisher
```

Or via GUI: right-click the .cer → Install Certificate → Local Machine →
"Place all certificates in the following store" → Browse → **Trusted Publishers**
→ OK.

After that, the installer (and every future version signed with the same
cert) installs without the SmartScreen warning.

---

## §B — SignPath Foundation (free for open-source projects)

What you get:
- Real CA-issued code-signing certificate.
- **No SmartScreen warning at all** once Microsoft's reputation system
  catches up (~weeks of downloads).
- No per-user cert import.

Requirements:
- Repo must be **public** on GitHub.
- Open-source license (MIT / Apache-2 / etc.) — accuCountFM is currently
  `Private` so this needs a license change first.
- Sign up at https://signpath.org/foundation, link the GitHub repo, wait
  for approval (~few days).
- Integrate via GitHub Actions: SignPath has a CI step that uploads
  artifacts, signs them server-side with their cert, and downloads the
  signed result.

Once approved, the GitHub Actions workflow stub in BUILD.md §9 gains an
extra step:

```yaml
- name: Sign with SignPath
  uses: signpath/github-action-submit-signing-request@v1
  with:
    api-token:        ${{ secrets.SIGNPATH_API_TOKEN }}
    organization-id:  ${{ secrets.SIGNPATH_ORG_ID }}
    project-slug:     accuCountFM
    signing-policy-slug: release-signing
    artifact-configuration-slug: installer
    github-artifact-id: ${{ steps.upload.outputs.artifact-id }}
    wait-for-completion: true
    output-artifact-directory: signed/
```

The signed installer in `signed/` then gets attached to the GitHub Release.

---

## §C — Paid options (for completeness)

If neither free route works for the deployment:

| Provider | Cost | Notes |
|---|---|---|
| Sectigo OV | ~$70/yr | Standard OV cert; cheapest paid option. Still triggers SmartScreen until reputation builds. |
| Sectigo EV | ~$250/yr | Extended Validation. Instant SmartScreen trust, no reputation warmup. Requires HSM/USB token shipping. |
| DigiCert EV | ~$500/yr | Same as Sectigo EV, premium support. |
| Azure Trusted Signing | ~$10/mo | Microsoft's managed service. KMS-style; sign in CI without holding a cert file. Cheaper than EV, similar trust. |

Wire-up is identical to §A: `signtool sign` with `/f` pointing at your
cert (or a thumbprint from the cert store for Azure Trusted Signing).

---

## Troubleshooting

**`signtool.exe not found`** — install Windows 10/11 SDK (it's included
in the "Desktop development with C++" VS Build Tools workload — see
[BUILD.md §1](BUILD.md#1-prerequisites-on-the-build-machine)).

**`error: SignerSign() failed (...)` from signtool** — wrong password,
or PFX file corrupted. Re-run `setup-self-signed.ps1`.

**`Status = NotSigned` after build** — signCommand didn't run. Verify:
- `tauri.conf.json::bundle.windows.signCommand` is present
- Env vars are set in the SAME PowerShell session that runs `npm run tauri:build`

**`Status = HashMismatch`** — installer was modified after signing. Don't
edit the .msi / .exe after the build.

**SmartScreen STILL warns after importing the .cer on the user machine**
— Defender's URL reputation kicks in too; clicking "More info → Run
anyway" is unfortunately needed once. The cert import only kills the
warning when running the installer locally on subsequent installs.

---

## Files in this scheme

```
tools/
├── setup-self-signed.ps1                  one-time cert generator
├── sign.ps1                                called by Tauri per artifact
├── signing.pfx                             [gitignored] private cert
└── accuCountFM-publisher.cer               [gitignored] public — ship to users
```

`.gitignore` excludes `*.pfx` and `tools/*.cer` so signing material
never leaves the build machine accidentally. The `tools/*.ps1` scripts
ARE committed — they're code, not secrets.
