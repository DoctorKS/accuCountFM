/**
 * Buddhist-era helpers — DB stores Gregorian ISO strings, UI displays พ.ศ.
 *
 * Rule: NEVER store the +543 year. Convert only at the render boundary.
 */
import dayjs from "dayjs";

export const MONTHS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
] as const;

export const WEEKDAY_TH_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;
export const WEEKDAY_TH_LONG = [
  "อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์",
] as const;

/** Format "พฤษภาคม ๒๕๖๙" from any dayjs-parsable date. */
export function formatBEMonth(d: dayjs.ConfigType): string {
  const dj = dayjs(d);
  return `${MONTHS_TH[dj.month()]} ${toThaiNumerals(dj.year() + 543)}`;
}

/** Format "วันศุกร์ ที่ ๑๒ พฤษภาคม ๒๕๖๙". */
export function formatBEFullDate(d: dayjs.ConfigType): string {
  const dj = dayjs(d);
  return `วัน${WEEKDAY_TH_LONG[dj.day()]} ที่ ${toThaiNumerals(dj.date())} ${MONTHS_TH[dj.month()]} ${toThaiNumerals(dj.year() + 543)}`;
}

/** Convert ASCII digits to Thai numerals (๐-๙). Used for date display. */
export function toThaiNumerals(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => "๐๑๒๓๔๕๖๗๘๙"[+d]);
}

/** YYYY-MM of current month, for default cursor state. */
export function currentYearMonth(): string {
  return dayjs().format("YYYY-MM");
}

/** Days in a YYYY-MM string. */
export function daysInMonth(ym: string): number {
  return dayjs(`${ym}-01`).daysInMonth();
}
