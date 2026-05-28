# 🦴 accuCountFM

> แอปคำนวณเงินเวรแพทย์นิติเวช 4 คน ของโรงพยาบาล — ทำงานบน Windows
> เก็บข้อมูลในเครื่อง · ไม่ต้อง login · OCR ตารางเวรเป็นรูปได้ · Export Excel

A native Windows desktop app for computing on-call shift pay for 4 forensic doctors. Local-first, no auth, with image OCR for monthly duty rosters via Claude vision.

---

## ✨ ฟีเจอร์หลัก · Features

### 📅 ตารางเวรรายเดือน (พ.ศ.)
- ปฏิทินไทย ใช้ พ.ศ. ทั้งหน้าจอ — ภายในเก็บ ค.ศ. ISO เพื่อ portability
- เลือก "เดือน/ปี" ที่มุมซ้ายบน → calendar เด้งมาทางขวา → คลิกวันเพื่อเข้าหน้ากรอกเวร

### 📸 OCR ตารางเวร (Claude vision)
- ปุ่ม **"+ เพิ่มตารางเวร"** อัพโหลดรูปตารางเวรของเดือนนั้น
- ระบบส่งรูปให้ Claude Sonnet 4.6 อ่าน → คืน JSON ของผู้ที่อยู่เวรในแต่ละ slot ของทุกวัน
- preview ก่อน apply — ผิดตรงไหนแก้ก่อนยืนยัน
- 1 รูป fill ทั้ง "ชันสูตรนอก" และ "ชันสูตรใน" (เพราะอยู่ในตารางเดียวกัน)

### 🩺 หน้ารายวัน — Shift Page
- แบ่ง 3 shift card: `00.00–08.00 น.` / `08.00–16.00 น.` / `16.00–24.00 น.`
- แต่ละ shift มี doctor dropdown (อนิรุต / พฤพงศ์ / กนก / กวินท์)
- **"+ เพิ่มเคสชันสูตร"** — กรอกเคสในเวรนั้น ๆ
  - **outHos:** ชื่อเคส + เวลาออก + เวลากลับ (drop-down ชม. + นาที)
  - **inHos:** ชื่อเคสอย่างเดียว (1 เคส = virtual 10 นาที)
- ใต้สุด: **"สรุปเงินเวร"** ต่อวัน + แจกแจงที่มา

### 💰 สรุปเงินเวร
- **/out, /in** — แต่ละ type มี dashboard card ของหมอ 4 คน + ยอดรวมเดือน
- **/summary** — รวมทั้ง outHos + inHos ของหมอแต่ละคนในเดือนที่เลือก
- ทุก card มีปุ่ม **"แจกแจงเงินเวร"** → row by row ของทุก slot ที่หมอคนนั้นอยู่เวร

### 📊 Export Excel
- 1 ไฟล์ `.xlsx` ต่อเดือน 4 sheet:
  1. `assignments` — ตารางเวรทั้งเดือน
  2. `cases` — รายละเอียดเคสทุกเคส
  3. `doctor_breakdown` — แจกแจงต่อหมอ
  4. `totals` — สรุปรวม
- ใช้ `rust_xlsxwriter` → UTF-8 ภาษาไทยตรงเป๊ะ, ไม่ต้อง BOM hack

---

## 🧮 สูตรคำนวณเงินเวร

| สถานะ | ค่าเวร |
|---|---|
| หมอคนเดียวอยู่ 1 shift (8 ชม.) | **780 ฿** ต่อ shift |
| หมอคนเดียวกันอยู่ 2 shift ติด (16 ชม.) | **760 ฿** ต่อ shift = 1,520 ฿ รวม |
| หมอคนเดียวกันอยู่ 3 shift ติด (24 ชม.) | **760 ฿** × 3 = 2,280 ฿ |

> **Chain detection** เช็คภายใน shift_type เดียวกัน — outHos chain แยกจาก inHos chain
> ข้ามวันเช็คจริง: 16-24 ของวันที่ D + 00-08 ของวันที่ D+1 = chain

### หักลบเวลาออกชันสูตร

| เวลาออก (นาที) | หัก |
|---|---|
| 1 – 4 | 0 ฿ (grace period) |
| 5 – 34 | 48.75 ฿ |
| 35 – 64 | 97.50 ฿ |
| 65 – 94 | 146.25 ฿ |
| ... | + 48.75 ฿ ทุก 30 นาที |

สูตร: `if minOut ≤ 4 → 0; else units = ⌈(minOut − 4) / 30⌉; deduction = units × 48.75`

- **outHos:** `minOut` = Σ (เวลากลับ − เวลาออก) ทุกเคสใน slot นั้น
- **inHos:** `minOut` = จำนวนเคส × 10 นาที (virtual)

### โบนัสต่อเคส

| ประเภท | โบนัสต่อ 1 เคส |
|---|---|
| ชันสูตรนอก | **+1,800 ฿** |
| ชันสูตรใน | **+1,200 ฿** |

### สูตรรวมต่อ slot

```
slot_total = max(0, base_pay − deduction) + case_count × case_bonus
```

(`base_pay` คือ 780 หรือ 760 ตาม chain; `case_bonus` คือ 1,800 หรือ 1,200 ตาม shift type)

---

## 🛠️ Tech stack

| Layer | |
|---|---|
| Shell | Tauri 2 (Rust + WebView2) |
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind + shadcn/ui |
| DB | SQLite (`tauri-plugin-sql`) |
| OCR | Claude Sonnet 4.6 vision via Anthropic API |
| Excel | `rust_xlsxwriter` |
| API key | Windows Credential Manager (`keyring` crate) |

Installer ~12 MB · ติดตั้งแล้ว ~25 MB · ต้องการ Windows 10 1809+ (มี WebView2 runtime แล้ว)

---

## 🚀 วิธีติดตั้ง · Install

### ดาวน์โหลด installer
```
GitHub Releases → accuCountFM_<version>_x64-setup.exe → double-click → ติดตั้ง
```

**ไม่ต้องลงอะไรเพิ่มเติม** — installer pack ทุกอย่าง (Rust binary, frontend,
SQLite, fonts, logos) มาในไฟล์เดียว ติดตั้งบนเครื่องเปล่า Windows 10/11 ได้เลย

ครั้งแรกที่เปิด Windows SmartScreen อาจขึ้น warning เพราะยังไม่ code-signed
→ คลิก **More info** → **Run anyway**

> สำหรับนักพัฒนา / release engineer: ดู [BUILD.md](BUILD.md) สำหรับวิธีสร้าง
> installer (`npm run tauri:build`), code-signing, GitHub Actions CI ฯลฯ

### ตั้งค่าครั้งแรก
1. เปิดแอป → Sidebar → **ตั้งค่า**
2. ใส่ **Anthropic API Key** (`sk-ant-...`) — สำหรับ OCR ตารางเวร
   - หาได้ที่ https://console.anthropic.com/settings/keys
   - Key เก็บใน Windows Credential Manager (encrypted by Windows DPAPI)
3. กลับ Dashboard → คลิกปุ่ม **เวรชันสูตรนอก** หรือ **เวรชันสูตรใน**
4. เริ่มกรอกตารางเวรได้เลย

### ปุ่มลัด (keyboard shortcuts)
ในแอปมีหน้า **ปุ่มลัด** (Sidebar) สรุป F1 / F2 / F3 / PageDown / Enter / Esc
ที่ใช้ได้ — ดูเพื่อกรอกข้อมูลเร็วขึ้นโดยไม่ใช้เมาส์

---

## 🧑‍💻 Build จาก source

> Full step-by-step — installing Rust + VS Build Tools, configuring WebView2
> bundling, code-signing, CI — อยู่ใน [**BUILD.md**](BUILD.md)

### Quick start

```powershell
# Prereqs: Node 20+, Rust 1.78+, VS 2022 Build Tools w/ "Desktop dev with C++"
npm install
npm run tauri:dev       # hot-reload dev mode
```

### Production installer

```powershell
npm run tauri:build
# Output:
#   src-tauri\target\release\bundle\msi\accuCountFM_0.1.0_x64_en-US.msi
#   src-tauri\target\release\bundle\nsis\accuCountFM_0.1.0_x64-setup.exe
```

### Test

```powershell
cd src-tauri ; cargo test --lib   # Rust calc unit tests (14)
cd ..        ; npm run test       # TS calc mirror tests (19)
              ; npx tsc --noEmit  # type-check
```

---

## 📁 Storage location

ข้อมูลทั้งหมดเก็บใน:
```
%APPDATA%\accuCountFM\
├── data.db          ← SQLite ฐานข้อมูล
├── images\          ← รูปตารางเวรที่อัพโหลด (อ้างอิงจาก ocr_uploads)
└── exports\         ← ที่ default ของ Excel export
```

**Backup:** copy ทั้ง folder ไปไว้ที่ปลอดภัย — restore ได้โดย paste กลับที่เดิม
**Reset:** ลบ folder ทั้งหมด แล้วเปิดแอปใหม่ จะสร้าง schema ใหม่ให้

---

## 🗺️ ทางเดินในแอป

```
[หน้าแรก]
   │
   ├─ ⬛ "เวรชันสูตรนอก"  ─────→  [/out  เดือน + 4 doctor cards]
   │                                   │
   │                                   ├─ คลิกวันใน calendar  →  [Shift Page วันนั้น]
   │                                   ├─ "+ เพิ่มตารางเวร"   →  [OCR Dialog]
   │                                   └─ "แจกแจงเงินเวร"     →  [Per-doctor Breakdown]
   │
   ├─ ⬛ "เวรชันสูตรใน"   ─────→  [/in   เหมือนกับ /out ทุกอย่าง]
   │
   └─ Sidebar:
        ├─ Dashboard            (กลับมาหน้าแรก)
        ├─ เงินเวรรวมทั้งหมด     (/summary  รวม out + in 4 หมอ)
        ├─ สรุปเงินเวรชันสูตรใน   (/summary/in)
        └─ สรุปเงินเวรชันสูตรนอก  (/summary/out)
```

---

## 🔮 Roadmap

| Phase | Scope |
|---|---|
| **v1.0** (now) | แพทย์ 4 คน, outHos + inHos, OCR, Excel export |
| v1.1 | Multi-month export, comparison charts |
| v2.0 | **เวรพนักงานรักษาศพ** (จำหน่ายศพ/เก็บศพ + นอกเวลาราชการ) |
| v2.1 | **เวรเจ้าหน้าที่ Office** (สูตรอื่น) |
| v3.0 | Optional cloud sync (OneDrive folder watcher) |

---

## 🤝 Contributing

Internal app for one clinic — accepting issues for bugs, not PRs. ถ้าจะ fork ไปใช้ที่อื่น แก้:
- `DOCTORS` const ใน [`src/lib/doctors.ts`](src/lib/doctors.ts)
- Color mapping ใน OCR prompt (`src-tauri/src/ocr.rs`)
- Calculation constants ใน `src/lib/constants.ts` + `src-tauri/src/calc.rs` (lockstep)

---

## 📄 License

Private. Not open-source.

---

## 🙏 Credits

- OCR system prompt + tool schema port จาก [DoctorKS/Shift_count](https://github.com/DoctorKS/Shift_count) (Supabase Edge Function variant)
- ใช้ Claude API ของ Anthropic สำหรับ vision OCR
- UI inspiration จาก [Aesthetic-stock](../Aesthetic-stock) ของ project เดียวกัน
