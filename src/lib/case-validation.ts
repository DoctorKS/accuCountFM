/**
 * Case completeness checks — shared by CaseRow (Enter guard) and
 * ShiftDayPage (back-nav guard, PageDown handler).
 *
 * Rule per user spec:
 *   outHos case is complete when case_name has a non-empty digit prefix
 *     AND leave_time AND return_time are both set.
 *   inHos case is complete when case_name has a non-empty digit prefix.
 *     (No times tracked for inHos — each case counts as 10min virtual time.)
 */
import type { CaseRow } from "./db";
import type { ShiftType } from "./constants";

/** Strip a trailing "/NN" Buddhist-year suffix added by CaseRow. */
export function stripCaseSuffix(caseName: string): string {
  return caseName.replace(/\/\d{2}$/, "");
}

/** True when the case row has the minimum fields required for its shift type. */
export function isCaseComplete(row: CaseRow, shiftType: ShiftType): boolean {
  if (!stripCaseSuffix(row.case_name).trim()) return false;
  if (shiftType === "outHos") {
    if (!row.leave_time || !row.return_time) return false;
  }
  return true;
}

/** Cases in `cases` that fail `isCaseComplete`. Caller filters by date/slot. */
export function findIncompleteCases(cases: CaseRow[], shiftType: ShiftType): CaseRow[] {
  return cases.filter((c) => !isCaseComplete(c, shiftType));
}

/** Variant that checks raw values (used by CaseRow's onEnter while editing). */
export function isLiveCaseComplete(
  prefix: string,
  leaveTime: string | null,
  returnTime: string | null,
  shiftType: ShiftType,
): boolean {
  if (!prefix.trim()) return false;
  if (shiftType === "outHos") {
    if (!leaveTime || !returnTime) return false;
  }
  return true;
}
