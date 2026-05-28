/**
 * Live-preview calc — MUST stay byte-for-byte equivalent to `src-tauri/src/calc.rs`.
 *
 * Shared test fixtures live at `tests/calc-fixtures.json`. Both Rust and TS
 * suites load them. If you change anything here, you MUST also change calc.rs
 * and re-run both test suites.
 *
 * The Rust side is the source of truth at save time — this TS copy exists
 * only so the UI can show a running total as the user types.
 */
import type { Slot, ShiftType } from "./constants";
import {
  SHIFT_PAY_SOLO_8H,
  SHIFT_PAY_CHAIN_16H,
  CASE_BONUS_OUT_HOS,
  CASE_BONUS_IN_HOS,
  DEDUCT_PER_HALF_HOUR,
  IN_HOS_MIN_PER_CASE,
  GRACE_MIN,
  SLOTS,
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
  base: number;          // 780 | 760 | 0
  deduction: number;     // ≥ 0
  caseBonus: number;     // ≥ 0
  total: number;         // max(0, base - deduction) + caseBonus
  reason: string;        // human-readable for breakdown UI
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
 * Returns the immediately-preceding (slot, date) and immediately-following
 * (slot, date) for chain detection. Crosses date boundary for 00-08 prev
 * and 16-24 next.
 */
export function adjacentSlots(date: string, slot: Slot): { prev: [string, Slot]; next: [string, Slot] } {
  const idx = SLOTS.indexOf(slot);
  const prevDay = (d: string) => {
    const dt = new Date(d + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  };
  const nextDay = (d: string) => {
    const dt = new Date(d + "T00:00:00Z");
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  };
  const prev: [string, Slot] = idx === 0 ? [prevDay(date), SLOTS[2]] : [date, SLOTS[idx - 1]];
  const next: [string, Slot] = idx === 2 ? [nextDay(date), SLOTS[0]] : [date, SLOTS[idx + 1]];
  return { prev, next };
}

/** Per-slot pay. `lookup` is a getter for the doctor assigned to (date, slot) in the same shift_type. */
export function computeSlotPay(
  assignment: Assignment,
  cases: ShiftCase[],
  lookup: (date: string, slot: Slot) => string | null,
): SlotPay {
  if (!assignment.doctorName) {
    return { base: 0, deduction: 0, caseBonus: 0, total: 0, reason: "ไม่มีแพทย์ในเวรนี้" };
  }
  const { prev, next } = adjacentSlots(assignment.date, assignment.slot);
  const chained =
    lookup(prev[0], prev[1]) === assignment.doctorName ||
    lookup(next[0], next[1]) === assignment.doctorName;
  const base = chained ? SHIFT_PAY_CHAIN_16H : SHIFT_PAY_SOLO_8H;

  const isOut = assignment.shiftType === "outHos";
  const caseCount = cases.length;

  let minutesOut: number;
  let reason: string;
  if (isOut) {
    minutesOut = cases.reduce((sum, c) => sum + caseMinutes(c.leaveTime, c.returnTime), 0);
    reason = `${caseCount} เคส, ออกรวม ${minutesOut} นาที`;
  } else {
    minutesOut = caseCount * IN_HOS_MIN_PER_CASE;
    reason = `${caseCount} เคส × ${IN_HOS_MIN_PER_CASE} นาที = ${minutesOut} นาที`;
  }

  const units = deductionUnits(minutesOut);
  const deduction = units * DEDUCT_PER_HALF_HOUR;
  const cappedDeduct = Math.min(deduction, base);
  const caseBonus = caseCount * (isOut ? CASE_BONUS_OUT_HOS : CASE_BONUS_IN_HOS);
  const total = (base - cappedDeduct) + caseBonus;

  return {
    base,
    deduction: cappedDeduct,
    caseBonus,
    total,
    reason: `${chained ? "16ชม.chain" : "8ชม."} · ${reason}${units ? ` → หัก ${units}×${DEDUCT_PER_HALF_HOUR}` : ""}`,
  };
}
