# 🏗️ Build & Distribute — accuCountFM

This is the developer/release engineer guide for producing a Windows
installer that an end-user can run on a clean machine **without
installing Node, Rust, or any other dev environment**.

> If you're an end user, ignore this file — just double-click the `.msi`
> or `.exe` you were sent and follow the wizard.

---

## 1. Prerequisites on the BUILD machine

These are installed once, on the developer / CI box. Not on the user's PC.

| Tool | Version | Why |
|---|---|---|
| Node.js | 20+ | `npm`, Vite, TanStack Query, etc. |
| Rust toolchain | 1.78+ (stable) | Tauri backend |
| Visual Studio Build Tools 2022 | "Desktop development with C++" workload + Windows 11 SDK | MSVC linker for Rust on Windows |
| WebView2 Runtime | shipped with Win10 1803+ / Win11 | Tauri renders the UI here |

Install Rust + VS Build Tools once:

```powershell
# Rust
winget install --id Rustlang.Rustup -e

# VS Build Tools (run as admin; ~5 GB, 10-15 min)
$bs = "$env:TEMP\vs_BuildTools.exe"
Invoke-WebRequest -Uri "https://aka.ms/vs/17/release/vs_BuildTools.exe" -OutFile $bs
Start-Process -FilePath $bs -ArgumentList @(
  "--quiet", "--wait", "--norestart",
  "--add", "Microsoft.VisualStudio.Workload.VCTools",
  "--add", "Microsoft.VisualStudio.Component.Windows11SDK.22621",
  "--add", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64"
) -Verb RunAs -Wait
```

After install, open a **fresh** PowerShell so `cargo` / `link.exe` show up
on `PATH`.

---

## 2. Build

```powershell
cd C:\dev\accuCountFM
npm install          # first time only — installs JS deps
npm run tauri:build  # ~5-10 min — compile Rust + bundle frontend + make installer
```

What happens under the hood:

1. **Frontend bundle** — Vite builds `src/` → `dist/` (minified JS, CSS,
   hashed assets including TH Sarabun New fonts and the two logo PNGs).
2. **Rust release build** — `cargo build --release` with `lto = true`,
   `codegen-units = 1`, `opt-level = "z"`, `strip = true` (see
   [`Cargo.toml`](src-tauri/Cargo.toml)). The frontend `dist/` gets
   embedded into the binary via Tauri macros.
3. **Installer packaging** — WiX (MSI) and NSIS (.exe) both run because
   `tauri.conf.json::bundle.targets` lists both.

---

## 3. Output

After a successful build, look in:

```
src-tauri\target\release\
├── accucountfm.exe                  ← raw portable binary (~15 MB)
└── bundle\
    ├── msi\
    │   └── accuCountFM_0.1.0_x64_en-US.msi    ← Windows Installer
    └── nsis\
        └── accuCountFM_0.1.0_x64-setup.exe    ← NSIS installer
```

Choose one:

- **MSI** — best for IT / Group Policy / SCCM deployment. Silent install
  via `msiexec /i accuCountFM_*.msi /qn`.
- **NSIS .exe** — simplest for users. Single-click installer with a
  modern wizard. Slightly smaller, faster to install.
- **Raw .exe** — portable mode. No install, no Start Menu shortcut, no
  uninstaller. The app still creates its DB in `%APPDATA%` on first run.

Hand the chosen file to the user via USB / network share / Drive.

---

## 4. End-user installation

Tell the end user:

1. Double-click the installer.
2. If Windows SmartScreen complains "unrecognized app":
   - Click **More info**
   - Click **Run anyway**
   (Happens because the installer isn't code-signed — see §6.)
3. Click **Next → Install → Finish**.
4. Open `accuCountFM` from the Start Menu.
5. First-time setup (optional, only needed if you want OCR):
   - Sidebar → **ตั้งค่า** → paste Anthropic API key → save.
   - Key is stored in Windows Credential Manager (encrypted by DPAPI).

That's it. No environment, no separate runtime install, no admin rights
needed (NSIS installs per-user by default).

---

## 5. Where user data lives

On first launch the app creates:

```
%APPDATA%\com.doctorks.accucountfm\
├── accucountfm.db          ← SQLite (assignments, cases, holidays, autopsy counts)
└── (more files added as features grow)
```

**Backup** = copy the folder.
**Restore** = paste it back.
**Reset** = delete the folder and relaunch.

API key lives in Windows Credential Manager separately (target name
`accuCountFM`), so wiping the appdata folder doesn't clear the key.

---

## 6. WebView2 — when does the user need internet?

WebView2 is the Edge-based renderer Tauri uses for the UI.

| Windows version | WebView2 status | First launch |
|---|---|---|
| Windows 11 | preinstalled | Offline-OK |
| Windows 10 1803+ | preinstalled | Offline-OK |
| Windows 10 < 1803 | missing | Tauri installer downloads it (~1 MB) — **needs internet once** |

To make the installer **truly offline** even on old Win10, edit
[`tauri.conf.json`](src-tauri/tauri.conf.json):

```jsonc
"bundle": {
  "windows": {
    // ~150 MB heavier installer, but no internet needed at install:
    "webviewInstallMode": { "type": "embedBootstrapper" }
  }
}
```

Default is `downloadBootstrapper` (small installer, online once).

---

## 7. SmartScreen + AntiVirus warnings

Unsigned installers always trigger Windows SmartScreen:

> "Microsoft Defender SmartScreen prevented an unrecognized app from starting"

User can click "More info → Run anyway" to bypass.

To get rid of the warning, **code-sign** the installer. The repo ships
two free routes (self-signed and SignPath Foundation) plus a paid menu
— full step-by-step in [**SIGN.md**](SIGN.md).

Quick recap of the self-signed flow (already wired into `tauri.conf.json`):

```powershell
# One-time:
$env:ACCUCOUNT_SIGN_PASSWORD = "your-password"
powershell -ExecutionPolicy Bypass -File tools/setup-self-signed.ps1

# Every build:
$env:ACCUCOUNT_SIGN_PFX      = "C:\dev\accuCountFM\tools\signing.pfx"
$env:ACCUCOUNT_SIGN_PASSWORD = "your-password"
npm run tauri:build
```

Tauri picks up `bundle.windows.signCommand` and runs `tools/sign.ps1`
against every produced artifact automatically.

---

## 8. Versioning & releases

Bump the version in both files in lockstep:

```diff
# package.json
- "version": "0.1.0",
+ "version": "0.2.0",

# src-tauri/tauri.conf.json
- "version": "0.1.0",
+ "version": "0.2.0",

# src-tauri/Cargo.toml
- version = "0.1.0"
+ version = "0.2.0"
```

(Or use `npm version 0.2.0 && (cd src-tauri && cargo set-version 0.2.0)`
if you've installed `cargo-edit`.)

Then `npm run tauri:build` — the new version appears in the output
filename and in About → version.

---

## 9. Optional — GitHub Actions CI build

A workflow that builds the installer on every tag push:

```yaml
# .github/workflows/release.yml
name: release
on:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: dtolnay/rust-toolchain@stable
      - run: npm install
      - run: npm run tauri:build
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/bundle/nsis/*.exe
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`windows-latest` runners already have Rust + MSVC + WebView2 → builds
"just work" without any of the prerequisites in §1.

---

## 10. Sanity checks before shipping

```powershell
# 1. Frontend tests
npm run test          # vitest — 19+ calc fixtures

# 2. Rust tests
cd src-tauri ; cargo test --lib  # calc.rs unit tests

# 3. Type-check
cd .. ; npx tsc --noEmit

# 4. Lint (optional, doesn't block release)
npm run lint

# 5. Build → installer
npm run tauri:build
```

If all four pass and the installer file appears at the path in §3, ship it.
