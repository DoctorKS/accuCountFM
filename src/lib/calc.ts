/**
 * Live-preview calc — MUST stay byte-for-byte equivalent to `src-tauri/src/calc.rs`.
 *
 * The Rust side is the source of truth at save time — this TS copy exists
 * only so the UI can show a running total as the user types. Both sides load
 * the same fixtures from `tests/calc.test.ts` / Rust unit tests.
 *
 * v2 pay model (post chain-detection):
 *   - Each slot evaluated independently via `isOffHour(date, slot, holidays)`
 *   - Off-hour slot → base 780 ฿; in-hour → base 0
 *   - Deduction applies only to off-hour base
 *   - Case bonus paid per case regardless of off/in hour
 */
import type { Slot, ShiftType } from "./constants";
import {
  OFF_HOUR_SHIFT_PAY,
  CASE_BONUS_OUT_HOS,
  CASE_BONUS_IN_HOS,
  DEDUCT_PER_HALF_HOUR,
  IN_HOS_MIN_PER_CASE,
  GRACE_MIN,
} from "./constants";

export interface Assignment {
  shiftType: ShiftType;
  date: string;       // YYYY-MM-DD
  slot: Slot;
  doctorName: string | null;
}

export interface ShiftCase {
  shiftType: ShiftType;
  date: string;
  slot: Slot;
  leaveTime: string | null;   // "HH:MM"
  returnTime: string | null;  // "HH:MM"
}

export interface SlotPay {
  base: number;          // 780 (off-hour) | 0 (in-hour)
  deduction: number;     // ≥ 0, capped at base
  caseBonus: number;     // ≥ 0
  total: number;         // (base − deduction) + caseBonus
  offHour: boolean;
  reason: string;        // human-readable for breakdown UI
}

/**
 * `true` when the slot pays the off-hour rate (780 ฿).
 *
 * `holidays` is the day-of-month list for the SAME month as `date`.
 */
export function isOffHour(date: string, slot: Slot, holidays: number[]): boolean {
  // Parse as UTC to avoid local-timezone Sat/Sun drift on dates near midnight.
  const dt = new Date(date + "T00:00:00Z");
  const dow = dt.getUTCDay();                    // 0=Sun..6=Sat
  const isWeekend = dow === 0 || dow === 6;
  const day = dt.getUTCDate();
  const isHoliday = holidays.includes(day);
  const isNightSlot = slot === "0000-0800" || slot === "1600-2400";

  return (isNightSlot && !isWeekend && !isHoliday) || isWeekend || isHoliday;
}

/** Returns half-hour deduction units; 0 if minutes_out ≤ GRACE_MIN. */
export function deductionUnits(minutesOut: number): number {
  if (minutesOut <= GRACE_MIN) return 0;
  return Math.ceil((minutesOut - GRACE_MIN) / 30);
}

/** Parse "HH:MM" → minutes-from-midnight. Returns null if malformed. */
function parseHM(hm: string | null): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

/** Minutes between leave and return; handles cross-midnight by adding 24h. */
export function caseMinutes(leave: string | null, ret: string | null): number {
  const L = parseHM(leave), R = parseHM(ret);
  if (L == null || R == null) return 0;
  let diff = R - L;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

/**
 * Per-slot pay. `holidays` is the day-of-month list for the SAME month as
 * `assignment.date` — caller is responsible for pre-filtering.
 */
export function computeSlotPay(
  assignment: Assignment,
  cases: ShiftCase[],
  holidays: number[],
): SlotPay {
  if (!assignment.doctorName) {
    return { base: 0, deduction: 0, caseBonus: 0, total: 0, offHour: false, reason: "ไม่มีแพทย์ในเวรนี้" };
  }

  const offHour = isOffHour(assignment.date, assignment.slot, holidays);
  const base = offHour ? OFF_HOUR_SHIFT_PAY : 0;

  const isOut = assignment.shiftType === "outHos";
  const caseCount = cases.length;

  // Deduction only computed for off-hour slots — in-hour base is 0 so any
  // deduction would just stay capped at 0 anyway.
  let minutesOut = 0;
  let minutesLabel = "";
  if (offHour) {
    if (isOut) {
      minutesOut = cases.reduce((sum, c) => sum + caseMinutes(c.leaveTime, c.returnTime), 0);
      minutesLabel = `ออกรวม ${minutesOut} นาที`;
    } else {
      minutesOut = caseCount * IN_HOS_MIN_PER_CASE;
      minutesLabel = `${caseCount}×${IN_HOS_MIN_PER_CASE}=${minutesOut} นาที`;
    }
  }

  const units = deductionUnits(minutesOut);
  const deduction = units * DEDUCT_PER_HALF_HOUR;
  const cappedDeduct = Math.min(deduction, base);
  const caseBonus = caseCount * (isOut ? CASE_BONUS_OUT_HOS : CASE_BONUS_IN_HOS);
  const total = (base - cappedDeduct) + caseBonus;

  const tag = offHour ? "นอกเวลา" : "ในเวลา";
  const pieces = [
    tag,
    `${caseCount} เคส`,
    minutesLabel,
    units > 0 ? `หัก ${units}×${DEDUCT_PER_HALF_HOUR}` : "",
  ].filter(Boolean);

  return { base, deduction: cappedDeduct, caseBonus, total, offHour, reason: pieces.join(" · ") };
}
