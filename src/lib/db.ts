/**
 * SQLite access via `@tauri-apps/plugin-sql`.
 *
 * Architecture: frontend owns ALL DB queries; Rust commands are pure
 * compute (calc, OCR, Excel). The DB file lives at
 *   %APPDATA%\com.doctorks.accucountfm\accucountfm.db
 * with the schema defined in `src-tauri/migrations/0001_init.sql` (auto-run
 * on first connect by `tauri-plugin-sql`).
 *
 * NOTE: plugin-sql returns plain objects keyed by column name. We type the
 * return values manually — sqlite has no driver-level type info to lean on.
 */
import Database from "@tauri-apps/plugin-sql";
import type { ShiftType, Slot } from "./constants";
import type { Doctor } from "./doctors";

let _db: Promise<Database> | null = null;

/** Lazy singleton — plugin-sql connection pool, opened on first call. */
export function db(): Promise<Database> {
  if (!_db) _db = Database.load("sqlite:accucountfm.db");
  return _db;
}

// ─── Row types (mirror migration 0001) ──────────────────────────────────────

export interface AssignmentRow {
  id: number;
  shift_type: ShiftType;
  date: string;
  slot: Slot;
  doctor_name: Doctor | null;
  updated_at: string;
}

export interface CaseRow {
  id: number;
  shift_type: ShiftType;
  date: string;
  slot: Slot;
  case_name: string;
  leave_time: string | null;
  return_time: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

// ─── Assignment queries ─────────────────────────────────────────────────────

/** All assignments for one shift_type in one year-month (YYYY-MM). */
export async function listMonthAssignments(
  shiftType: ShiftType,
  yearMonth: string,
): Promise<AssignmentRow[]> {
  return (await db()).select<AssignmentRow[]>(
    `SELECT * FROM shift_assignments
       WHERE shift_type = $1 AND substr(date, 1, 7) = $2
       ORDER BY date, slot`,
    [shiftType, yearMonth],
  );
}

/** All assignments for one (shift_type, date) — up to 3 rows. */
export async function listDayAssignments(
  shiftType: ShiftType,
  date: string,
): Promise<AssignmentRow[]> {
  return (await db()).select<AssignmentRow[]>(
    `SELECT * FROM shift_assignments
       WHERE shift_type = $1 AND date = $2
       ORDER BY slot`,
    [shiftType, date],
  );
}

/**
 * Set the doctor assigned to one (shift_type, date, slot). Pass `null` to
 * un-assign. Upsert via the unique index — never inserts a duplicate row.
 */
export async function setAssignmentDoctor(
  shiftType: ShiftType,
  date: string,
  slot: Slot,
  doctorName: Doctor | null,
): Promise<void> {
  await (await db()).execute(
    `INSERT INTO shift_assignments (shift_type, date, slot, doctor_name, updated_at)
     VALUES ($1, $2, $3, $4, datetime('now'))
     ON CONFLICT(shift_type, date, slot) DO UPDATE SET
       doctor_name = excluded.doctor_name,
       updated_at = excluded.updated_at`,
    [shiftType, date, slot, doctorName],
  );
}

// ─── Case queries ───────────────────────────────────────────────────────────

/** Cases inside one (shift_type, date, slot), ordered by `position`. */
export async function listSlotCases(
  shiftType: ShiftType,
  date: string,
  slot: Slot,
): Promise<CaseRow[]> {
  return (await db()).select<CaseRow[]>(
    `SELECT * FROM shift_cases
       WHERE shift_type = $1 AND date = $2 AND slot = $3
       ORDER BY position, id`,
    [shiftType, date, slot],
  );
}

/** Cases for an entire month — used by month-summary aggregation. */
export async function listMonthCases(
  shiftType: ShiftType,
  yearMonth: string,
): Promise<CaseRow[]> {
  return (await db()).select<CaseRow[]>(
    `SELECT * FROM shift_cases
       WHERE shift_type = $1 AND substr(date, 1, 7) = $2
       ORDER BY date, slot, position, id`,
    [shiftType, yearMonth],
  );
}

/** Insert a new case at the end of the slot. Returns the new row id. */
export async function addCase(
  shiftType: ShiftType,
  date: string,
  slot: Slot,
  init: { caseName?: string; leaveTime?: string | null; returnTime?: string | null } = {},
): Promise<number> {
  const conn = await db();
  // Position = current max + 1 (simple — small slot sizes)
  const rows = await conn.select<{ next_pos: number }[]>(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
       FROM shift_cases
       WHERE shift_type = $1 AND date = $2 AND slot = $3`,
    [shiftType, date, slot],
  );
  const pos = rows[0]?.next_pos ?? 0;
  const r = await conn.execute(
    `INSERT INTO shift_cases
       (shift_type, date, slot, case_name, leave_time, return_time, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      shiftType,
      date,
      slot,
      init.caseName ?? "",
      init.leaveTime ?? null,
      init.returnTime ?? null,
      pos,
    ],
  );
  return r.lastInsertId ?? 0;
}

/** Patch arbitrary case fields by id. */
export async function updateCase(
  id: number,
  patch: Partial<Pick<CaseRow, "case_name" | "leave_time" | "return_time">>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  if (!fields.length) return;
  fields.push(`updated_at = datetime('now')`);
  values.push(id);
  await (await db()).execute(
    `UPDATE shift_cases SET ${fields.join(", ")} WHERE id = $${i}`,
    values,
  );
}

export async function deleteCase(id: number): Promise<void> {
  await (await db()).execute(`DELETE FROM shift_cases WHERE id = $1`, [id]);
}

// ─── Holidays ───────────────────────────────────────────────────────────────

export interface HolidayRow {
  year_month: string;
  day: number;
  note: string | null;
  updated_at: string;
}

/** Days flagged as holidays for the given `year_month`. */
export async function listMonthHolidays(yearMonth: string): Promise<HolidayRow[]> {
  return (await db()).select<HolidayRow[]>(
    `SELECT * FROM holidays WHERE year_month = $1 ORDER BY day`,
    [yearMonth],
  );
}

export async function addHoliday(yearMonth: string, day: number, note?: string | null): Promise<void> {
  await (await db()).execute(
    `INSERT INTO holidays (year_month, day, note, updated_at)
     VALUES ($1, $2, $3, datetime('now'))
     ON CONFLICT(year_month, day) DO UPDATE SET
       note = excluded.note, updated_at = excluded.updated_at`,
    [yearMonth, day, note ?? null],
  );
}

export async function removeHoliday(yearMonth: string, day: number): Promise<void> {
  await (await db()).execute(
    `DELETE FROM holidays WHERE year_month = $1 AND day = $2`,
    [yearMonth, day],
  );
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const rows = await (await db()).select<{ value: string }[]>(
    `SELECT value FROM settings WHERE key = $1`,
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await (await db()).execute(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value, updated_at = excluded.updated_at`,
    [key, value],
  );
}
