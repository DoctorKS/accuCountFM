/**
 * Calculation constants — MUST match `src-tauri/src/calc.rs`.
 *
 * Any change to these values requires:
 *   1. Update both this file AND calc.rs in lockstep.
 *   2. Update the table in CLAUDE.md.
 *   3. Re-run fixture tests on both sides.
 */
export const OFF_HOUR_SHIFT_PAY = 780;
export const CASE_BONUS_OUT_HOS = 1800;
export const CASE_BONUS_IN_HOS = 1200;
export const DEDUCT_PER_HALF_HOUR = 48.75;
export const IN_HOS_MIN_PER_CASE = 10;
export const GRACE_MIN = 4;

export type ShiftType = "outHos" | "inHos";
export type Slot = "0000-0800" | "0800-1600" | "1600-2400";

export const SLOTS: readonly Slot[] = ["0000-0800", "0800-1600", "1600-2400"] as const;

export const SLOT_LABEL: Record<Slot, string> = {
  "0000-0800": "00.00 – 08.00 น.",
  "0800-1600": "08.00 – 16.00 น.",
  "1600-2400": "16.00 – 24.00 น.",
};

export const SHIFT_TYPE_LABEL: Record<ShiftType, string> = {
  outHos: "เวรชันสูตรนอก",
  inHos: "เวรชันสูตรใน",
};
