# 🦴 accuCountFM — Claude / Codex guardrails

แอปคำนวณเงินเวรแพทย์นิติเวช 4 คน (อนิรุต, พฤพงศ์, กนก, กวินท์)
Native Windows app, ไม่มี auth, เก็บ local-first บนเครื่อง user, OCR ตารางเวรผ่าน Claude vision API

อ่านไฟล์นี้ก่อนแตะ `src-tauri/src/calc.rs`, `src-tauri/src/db.rs`, หรือ migration ทุกครั้ง — มี contract ว่า
"ถ้าเปลี่ยน calculation rule / DB schema shape / OCR JSON contract ต้องหยุดถามเจ้าของแอปก่อน"
(ดูหัวข้อ "Standing instruction" ท้ายไฟล์)

---

## Overview

| | |
|---|---|
| Purpose | คำนวณเงินเวร "ชันสูตรนอก" + "ชันสูตรใน" ของแพทย์ 4 คน, ใช้ OCR ตารางเวรเป็นรูป เติม assignments อัตโนมัติ |
| Users | คนเดียว (single seat, ไม่มี multi-device sync) |
| Distribution | `.msi` installer สำหรับ Windows 10/11 |
| Storage | SQLite ใน `%APPDATA%\accuCountFM\data.db` + รูปต้นฉบับใน `%APPDATA%\accuCountFM\images\` |
| Auth | ไม่มี — เปิดมาใช้ได้เลย |
| OCR | Claude Sonnet 4.6 vision API; API key เก็บใน Windows Credential Manager |
| Export | Excel (`.xlsx`) — 1 file ต่อเดือน, มี 4 sheets |

---

## Tech stack

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Rust + WebView2) |
| Frontend | React 18 + TypeScript + Vite |
| Routing | React Router 6 — HashRouter (Tauri-safe) |
| UI | Tailwind + shadcn/ui (zinc base, indigo accent) — มาจาก convention เดียวกับ Aesthetic-stock |
| State | Zustand (UI state) + TanStack Query (server state via Tauri IPC) |
| Fonts | IBM Plex Sans Thai (bundled local woff2 — ไม่พึ่ง Google Fonts) |
| Date | `chrono` (Rust) + `dayjs` + `lib/buddhist.ts` (TS) |
| DB | SQLite ผ่าน `tauri-plugin-sql` (sqlx-backed) |
| OCR | `reqwest` → `api.anthropic.com/v1/messages` (model `claude-sonnet-4-6`) + tool_use schema |
| Keyring | `keyring` crate (Windows Credential Manager) |
| Excel | `rust_xlsxwriter` (Rust) — UTF-8 ภาษาไทยปลอดภัย ไม่ต้อง BOM hack |
| Type sharing | `ts-rs` — Rust types → `src/lib/generated/*.ts` |

**Bundle target:** < 15 MB installer.

---

## Domain language (ใช้ใน code ห้ามผิด)

| ความหมาย | ตัวแปร JS/Rust | ภาษาไทย UI |
|---|---|---|
| ชันสูตรพลิกศพนอกรพ. | `outHos` (string literal) | "ชันสูตรนอก" / "เวรชันสูตรนอก" |
| ชันสูตรพลิกศพในรพ. + รับปรึกษารพช. | `inHos` (string literal) | "ชันสูตรใน" / "เวรชันสูตรใน" |
| ช่วงเวลาเวร | `slot` = `'0000-0800' \| '0800-1600' \| '1600-2400'` | "00.00–08.00 น." ฯลฯ |
| ค่าเวร per slot (อยู่คนเดียว 8 ชม.) | `SHIFT_PAY_SOLO_8H = 780` | "เงินเวรพื้นฐาน 8 ชม." |
| ค่าเวร per slot (chain 16 ชม.) | `SHIFT_PAY_CHAIN_16H = 760` | "เงินเวร 16 ชม." |
| โบนัสต่อเคส (ชันสูตรนอก) | `CASE_BONUS_OUT_HOS = 1800` | "โบนัสเคสนอก" |
| โบนัสต่อเคส (ชันสูตรใน) | `CASE_BONUS_IN_HOS = 1200` | "โบนัสเคสใน" |
| หักครึ่ง ชม. ที่ออกจากเวร | `DEDUCT_PER_HALF_HOUR = 48.75` | |
| Virtual time ต่อ 1 เคสใน (inHos) | `IN_HOS_MIN_PER_CASE = 10` | |

```rust
// src-tauri/src/calc.rs — ห้ามเปลี่ยนค่าเหล่านี้โดยไม่ถาม
pub const SHIFT_PAY_SOLO_8H:    f64 = 780.0;
pub const SHIFT_PAY_CHAIN_16H:  f64 = 760.0;
pub const CASE_BONUS_OUT_HOS:   f64 = 1800.0;
pub const CASE_BONUS_IN_HOS:    f64 = 1200.0;
pub const DEDUCT_PER_HALF_HOUR: f64 = 48.75;
pub const IN_HOS_MIN_PER_CASE:  i32 = 10;
pub const GRACE_MIN:            i32 = 4;   // 1..=4 นาที = ไม่หัก
```

**Doctors — order matters for UI card layout:**
```ts
export const DOCTORS = ['อนิรุต', 'พฤพงศ์', 'กนก', 'กวินท์'] as const;
export type Doctor = typeof DOCTORS[number];
```

---

## Calculation rules — single source of truth = `src-tauri/src/calc.rs`

`src/lib/calc.ts` คือ mirror สำหรับ live preview ตอน user พิมพ์ ห้าม diverge — ทั้งสองอ่าน fixture จาก `tests/calc-fixtures.json` (ดู §Testing)

### Per-slot pay

```
สำหรับ shift_assignment row หนึ่ง (shift_type, date, slot, doctor_name):

1. base_pay:
   - ถ้า doctor_name = NULL → 0 (slot ไม่มีคน, เคสในนี้ไม่จ่ายให้ใคร)
   - ถ้ามีคน เช็ค chain:
       prev_slot = slot ก่อนหน้า (16-24 ของ date-1 ถ้า slot = 00-08; ไม่งั้น slot ก่อนของ date เดียวกัน)
       next_slot = slot ถัดไป  (00-08 ของ date+1 ถ้า slot = 16-24; ไม่งั้น slot ถัดไปของ date เดียวกัน)
       chained = (assignment[prev_slot].doctor == doctor) OR (assignment[next_slot].doctor == doctor)
       base_pay = if chained then 760 else 780
   หมายเหตุ: chain ถูกตรวจ **เฉพาะภายใน shift_type เดียวกัน** — outHos chain แยกจาก inHos chain

2. minutes_out (per slot):
   - outHos: minutes_out = Σ (return_time − leave_time) ทุก case ใน slot นั้น
              negative diff (ลืมกรอกหรือกรอกผิด) → clamp ที่ 0 และ warn ใน UI
              ข้ามเที่ยงคืน (return < leave) → +24h
   - inHos:  minutes_out = case_count × IN_HOS_MIN_PER_CASE (= 10)

3. deduction_units:
   if minutes_out <= GRACE_MIN (4) → 0
   else                            → ceil((minutes_out − GRACE_MIN) / 30)
   deduction = deduction_units × DEDUCT_PER_HALF_HOUR

4. case_bonus:
   outHos: case_count × CASE_BONUS_OUT_HOS (1800)
   inHos:  case_count × CASE_BONUS_IN_HOS  (1200)

5. slot_total = max(0, base_pay − deduction) + case_bonus
   หมายเหตุ: deduction ใช้ base_pay เป็น cap; ไม่ทำให้ base ติดลบ.
            case_bonus จ่ายเสมอตามจำนวนเคส แม้ deduction = base
```

### Per-doctor month breakdown

```
ทุก slot ของเดือนที่ doctor_name = D, แยกตาม shift_type:
  outHos_total = Σ slot_total ของทุก slot ที่ doctor=D และ shift_type='outHos'
  inHos_total  = Σ slot_total ของทุก slot ที่ doctor=D และ shift_type='inHos'
  grand_total  = outHos_total + inHos_total
```

### "แจกแจงเงินเวร" breakdown view

แสดง row ต่อ slot ที่ doctor=D ในเดือนนั้น, แต่ละ row โชว์:
`[date | weekday(พ.ศ.) | slot | shift_type | base | deduction (− reason) | case_bonus (× count) | total]`

โดย reason ของ deduction = `"เคส X ใช้เวลา Yนาที → Z half-hours"` หรือ `"3 เคส × 10 = 30 นาที"` แล้วแต่ type

---

## OCR JSON contract

POST `/v1/messages` พร้อม tool_use schema (port จาก `Shift_count/supabase/functions/ocr/index.ts` — **ตัด `patient` column ออก**)

### Tool input schema (per upload — 1 image, 1 month)

```jsonc
{
  "month": "2026-05",          // YYYY-MM, ตรงกับ ym ที่ user ดู
  "days": [
    {
      "date": 1, "weekday": "ศ",
      "shifts": {
        "0000-0800": { "outHos": "อนิรุต", "inHos": "พฤพงศ์" },
        "0800-1600": { "outHos": "พฤพงศ์", "inHos": "อนิรุต" },
        "1600-2400": { "outHos": "กวินท์", "inHos": "กนก"   }
      }
    }
    /* ... 28-31 days */
  ]
}
```

**Schema rules:**
- ทุก slot มี 2 keys: `outHos`, `inHos` (ไม่มี `patient` แล้ว — แตกต่างจาก Shift_count เดิม)
- ค่าเป็นชื่อหมอจาก `DOCTORS` หรือ `""` (empty)
- `days.length` ต้องตรง `daysInMonth(ym)` เป๊ะ
- color hint ใน system prompt (port มา): ม่วง=อนิรุต / เขียว=กวินท์ / น้ำเงิน=กนก / แดง=พฤพงศ์ — ถ้าตัวอักษรกับสีขัด เชื่อสี

### Apply flow

```
1. User กด "+เพิ่มตารางเวร" (จากหน้า outHos หรือ inHos — ไฟล์เดียวกัน)
2. เลือกรูป → preview → กด "ส่งให้ OCR อ่าน"
3. Rust ดู %APPDATA%\accuCountFM\images\ — copy รูปเข้ามา, gen uuid
4. Rust → Claude API → tool_use response
5. validate JSON ตาม schema; ผิด → toast "ตารางเวรผิด pattern" + เก็บ raw_json + image
6. ผ่าน → UI แสดง preview side-by-side: รูป | ตารางสรุปต่อวัน
7. user กด "ยืนยัน" → upsert shift_assignments ทั้งเดือน (REPLACE existing rows ที่ same month + shift_type)
   - "เพิ่มตารางเวร" จากหน้า outHos หรือ inHos ก็ apply ทั้งคู่ — เพราะ source image มีทั้งสอง column
8. cases ไม่ถูกแตะ (เคสคนเข้ามาเอง)
```

### Validation

- `month === ym` ที่ user เปิดดู
- `days.length === daysInMonth(ym)`
- `day.date` ∈ [1, daysInMonth]
- ทุก `outHos` / `inHos` ∈ `DOCTORS ∪ {""}` — ถ้ามีชื่อไม่อยู่ในรายการ → mark invalid, ให้ user แก้
- ผิด → `ocr_error` + ไม่ overwrite shift_assignments

---

## Storage layout

```
%APPDATA%\accuCountFM\
├─ data.db                  SQLite (ดู schema ใน supabase_schema.sql … wait, ไม่มี supabase. ดู src-tauri/migrations/)
├─ images\
│   └─ <uuid>.jpg           รูปตารางเวรต้นฉบับ (referenced จาก ocr_uploads.image_path)
└─ exports\                 default folder ที่ user เลือก save .xlsx
```

**Windows Credential Manager (ผ่าน `keyring` crate):**
```
target: "accuCountFM.anthropic_api_key"
user:   "default"
secret: <sk-ant-...>
```

---

## DB schema — `src-tauri/migrations/0001_init.sql`

(ดูสำเนาเต็มใน `src-tauri/migrations/` — สรุป shape ที่นี่)

| Table | Purpose | Unique key |
|---|---|---|
| `shift_assignments` | 1 row per (shift_type, date, slot) → doctor | (shift_type, date, slot) |
| `shift_cases` | N rows per slot, ordered by `position` | id |
| `ocr_uploads` | history ของรูปที่อัพ + raw JSON | id |
| `settings` | misc key/value (last_view ฯลฯ; **ไม่เก็บ API key ที่นี่**) | key |

**Migrations rules:**
- ทุก migration ต้อง idempotent ภายในตัวเอง — ใช้ `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN` ใน `BEGIN; ... COMMIT;`
- ห้ามแก้ migration ที่ ship ไปแล้ว — add new migration เสมอ
- ลำดับ: `0001_init.sql`, `0002_*.sql`, ...

---

## Rust ↔ TS IPC commands (commands.rs)

```rust
// Read
get_month_assignments(shift_type, year_month) -> Vec<ShiftAssignment>
get_day_cases(shift_type, date, slot) -> Vec<ShiftCase>
get_doctor_month_breakdown(doctor, year_month) -> DoctorMonthBreakdown
get_month_total_breakdown(year_month) -> MonthTotalBreakdown   // for /summary

// Write
upsert_assignment(shift_type, date, slot, doctor_name: Option<String>)
add_case(shift_type, date, slot, case_name, leave_time?, return_time?) -> i64
update_case(id, fields...)
delete_case(id)
reorder_cases(shift_type, date, slot, ids_in_order: Vec<i64>)

// OCR
ocr_upload_image(file_path, year_month) -> OcrPreview
ocr_apply_preview(preview_id) -> { affected_rows: u32 }

// Settings + keyring
get_setting(key) -> Option<String>
set_setting(key, value)
get_api_key() -> Option<String>            // ดึงจาก keyring
set_api_key(value)                          // ใส่ keyring
clear_api_key()

// Export
export_month_xlsx(year_month, out_path) -> { path: String }
export_doctor_xlsx(doctor, year_month, out_path)

// Misc
get_app_info() -> { version, db_path, images_dir }
```

ทุก command return `Result<T, AppError>` — `AppError` มี `code` (machine-readable) + `message` (TH for UI)

---

## Testing strategy

| Layer | Tool | Coverage focus |
|---|---|---|
| `calc.rs` | `cargo test` | chain detection, deduction, edge cases (cross-midnight, negative diff, empty slot) |
| `calc.ts` mirror | Vitest | identical fixtures as Rust — ensure JS ≡ Rust |
| DB queries | sqlx test macros + in-memory SQLite | upsert idempotency, cascade on delete |
| OCR contract | snapshot of mocked Anthropic response → assert apply produces expected assignments | |
| E2E (smoke) | Playwright through `tauri dev` (manual trigger) | upload → preview → apply → calculate → export Excel |

Shared fixtures: `tests/calc-fixtures.json` — `{ input: {assignments, cases}, expected: { perSlot, perDoctor } }`. Both Rust & TS load this.

---

## UI conventions

- **ภาษา:** ไทยทุก label, ทุก toast, ทุก error message. Code identifier เป็น `camelCase` (TS) / `snake_case` (Rust)
- **สกุลเงิน:** `฿` prefix, 2 decimal ถ้าจำนวนไม่ลงตัว ไม่งั้น 0 decimal (helper: `fmtBaht(n)`)
- **ปฏิทิน:** Buddhist era ในทุกที่ที่แสดงปี ทั้ง month picker, breakdown table, Excel header.
  - storage = Gregorian ค.ศ. เสมอ (ISO `YYYY-MM-DD`)
  - convert ตอน render ผ่าน `formatBE(date)` → "พฤษภาคม ๒๕๖๙"
  - **ห้ามเก็บ พ.ศ. ใน DB** — แปลงทาง edge เท่านั้น
- **Doctor color** (consistent ทุกหน้า — ใช้สีเดียวกับ OCR hint):
  - อนิรุต = violet `#7c3aed`
  - กวินท์ = emerald `#059669`
  - กนก   = blue `#2563eb`
  - พฤพงศ์ = rose `#e11d48`
- **Toast:** ไม่ใช้ alert() — ใช้ shadcn `<Sonner>` หรือ inline banner; success 3s, error 8s
- **Layout:**
  - Sidebar fixed 240px (lg+); collapse เป็น hamburger เมื่อกว้าง < 768px
  - หน้า Dashboard Home: 2 cards เต็มหน้า, hover เปลี่ยน accent + scale 1.02

---

## Routing map

```
/                              Dashboard home (2 big buttons)
/out                           OutHos month page (calendar + 4 doctor cards)
/in                            InHos month page
/shift/:type/:date             Shift page for one day, type ∈ {out, in}, date = YYYY-MM-DD
/breakdown/:type/:doctor/:ym   Per-doctor breakdown for one type one month
/summary                       Total summary (all types, all doctors, one month)
/summary/out                   OutHos summary only
/summary/in                    InHos summary only
/settings                      API key + export folder + about
```

---

## Common pitfalls (อ่านก่อนแก้ code)

1. **อย่าใช้ Buddhist year ใน DB** — เก็บ ISO Gregorian (`2026-05-12`) เสมอ; แปลงเฉพาะตอน format
2. **Chain detection ข้าม shift_type ไม่ได้** — หมอที่อยู่ outHos 16-24 + inHos 00-08 ของวันถัดไป **ไม่นับเป็น chain** (คนละประเภทเวร)
3. **Cases ผูกกับ slot ไม่ใช่กับ doctor** — ถ้า user เปลี่ยน doctor ใน assignment, cases เดิมตาม slot ยังอยู่และเงินไปคนใหม่ (intended behavior; แจ้ง user via toast ตอนเปลี่ยน)
4. **Cross-midnight time** — case ที่ออก 23:30 กลับ 00:15 → return < leave → ต้อง +24h ใน diff
5. **Deduction cap** — `base − deduction` ห้ามต่ำกว่า 0 (ถึงแม้คนออกไป 8 ชม. เต็ม) — `case_bonus` ยังจ่ายปกติ
6. **OCR apply = REPLACE month, not merge** — confirm dialog ต้องบอกชัดว่าจะทับของเดิม. แต่ `shift_cases` ของเดือนนั้นไม่ถูกแตะ — cases ผูกกับ slot, assignment ถูก overwrite ก็ยังหา slot เดิมเจอ
7. **Empty slot pays 0** — assignment.doctor=NULL + cases อยู่ → cases ไม่จ่ายให้ใคร แต่ DB เก็บไว้ (user มา assign ทีหลังได้)
8. **`tauri-plugin-sql` migration runs at first connect** — ต้อง register ทุก migration ใน `src-tauri/src/main.rs` ไม่ใช่แค่วางไฟล์ใน folder
9. **`ts-rs` ต้องรัน `cargo test` เพื่อ regenerate** — เพิ่ม `#[derive(TS)]` แล้วต้อง run `cargo test export_bindings` หนึ่งรอบ
10. **Webview2 บน Windows ใช้ Edge engine** — CSS ใหม่ ๆ ใช้ได้แทบหมด แต่ระวัง `:has()` selector ในเครื่องที่ Edge runtime เก่า — fallback ด้วย JS state class

---

## Future scope (out of v1)

- **เวรพนักงานรักษาศพ** (morgue assistant — `assistant` role ใน Shift_count เดิม): ผ่ายากกว่า เพราะ 4 columns + วันหยุดแบ่งครึ่ง ใช้ schema คนละ shape — เก็บเป็น `roles` table แล้วทำ table abstraction
- **เวรเจ้าหน้าที่ office** (กฎคำนวณยังไม่ระบุ)
- **iCloud / OneDrive backup** ของ DB file — provider-agnostic via folder sync
- **Multi-seat** — ถ้าจะ sync ข้ามเครื่อง, ต้องเพิ่ม `device_id` + LWW (`updated_at`) แต่ตอนนี้ single-seat พอ

---

## Standing instruction to Claude / Codex

ก่อนแก้ใด ๆ ใน `src-tauri/src/calc.rs`, `src-tauri/src/db.rs`, `src-tauri/migrations/`, หรือ OCR contract:

1. **อ่าน CLAUDE.md ก่อน**
2. **ยืนยันว่า change ตรงกับ rule ใน "Calculation rules" section** — ถ้าไม่ตรงต้องอัพเดทเอกสารก่อนเขียน code
3. **ถ้า change แตะ**:
   - ค่าคงที่ใน "Domain language" table (780/760/1800/1200/48.75/10/4)
   - shape ของ shift_assignments / shift_cases / ocr_uploads
   - OCR tool_use input_schema
   - chain detection rule
   - deduction formula
   → **STOP บอกเจ้าของแอปก่อน รอ go-ahead**
4. **ห้ามเปลี่ยน Rust ↔ TS calc โดยไม่อัพเดททั้งคู่** — ไม่ allow drift
5. **ห้ามเก็บ Claude API key ใน DB หรือ disk plaintext** — ใช้ keyring เท่านั้น
6. **ห้ามใช้ external dependency หนัก** (เช่น tesseract bundle ในตัว, ffmpeg) โดยไม่ถาม — bundle size เป็น constraint
7. **Functions ในขอบเขตของกฎนี้:**
   - `calc.rs::compute_slot_pay`, `compute_chain`, `deduction_units`, `compute_month_breakdown`
   - `db.rs::upsert_assignment`, `replace_month_assignments`, `apply_ocr_preview`
   - `ocr.rs::call_claude`, `validate_ocr_response`

---

## Coding conventions

- Rust: `cargo fmt` + `cargo clippy -- -D warnings` ต้องผ่านก่อน commit
- TS: ESLint + Prettier (config copy จาก Aesthetic-stock), `tsc --noEmit` ต้องผ่าน
- Component files: PascalCase (`ShiftCard.tsx`); util files: kebab-case (`buddhist-era.ts`)
- All async Rust commands return `Result<T, AppError>`; ทุก TS caller ใช้ TanStack Query — ไม่ raw await ใน handler
- Render ต้อง idempotent: components อ่านจาก query cache, mutations call invoke แล้ว invalidate
- Toast ภาษาไทย: success "บันทึกแล้ว", error "บันทึกล้มเหลว: <reason>"
- ห้าม hardcode label ไทยกลาง function — ดึงจาก `src/lib/strings.ts` const map

---

## Pair this with

- `.claude/skills/engineering/explain-before-edit/SKILL.md` (preview-before-edit สำหรับ change ใหญ่)
- `.claude/skills/engineering/scrutinize/SKILL.md` (รอบ review ก่อน submit)
- repo `Shift_count` (https://github.com/DoctorKS/Shift_count) เป็น OCR contract reference — copy system prompt + tool schema มาแต่ ตัด `patient` ทิ้ง
