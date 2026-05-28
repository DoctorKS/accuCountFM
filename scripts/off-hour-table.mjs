#!/usr/bin/env node
// Diagnostic — print which slots in a month are off-hour (เวรนอกเวลา).
//
// Mirrors `src/lib/calc.ts::isOffHour` exactly so output reflects what the
// app sees. Useful for sanity-checking the calendar / holiday setup.
//
// Usage:
//   node scripts/off-hour-table.mjs              → current month, no holidays
//   node scripts/off-hour-table.mjs 2026-05      → May 2026, no holidays
//   node scripts/off-hour-table.mjs 2026-05 13 20 → May 2026 with hol. on days 13 & 20

const [, , ymArg, ...holidaysArgs] = process.argv;
const ym = ymArg ?? new Date().toISOString().slice(0, 7);
const holidays = holidaysArgs.map((s) => Number.parseInt(s, 10)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31);

const SLOTS = ["0000-0800", "0800-1600", "1600-2400"];
const WEEKDAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function isOffHour(date, slot, holidays) {
  const dt = new Date(date + "T00:00:00Z");
  const dow = dt.getUTCDay();
  const isWeekend = dow === 0 || dow === 6;
  const day = dt.getUTCDate();
  const isHoliday = holidays.includes(day);
  const isNightSlot = slot === "0000-0800" || slot === "1600-2400";
  return (isNightSlot && !isWeekend && !isHoliday) || isWeekend || isHoliday;
}

const [y, m] = ym.split("-").map(Number);
const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
const beYear = y + 543;

console.log(`\n  เดือน ${ym}  (พ.ศ. ${beYear}) · วันหยุดนักขัตฤกษ์: ${holidays.length ? holidays.join(", ") : "(ไม่มี)"}\n`);
console.log("    วัน  | DOW | 00-08  | 08-16  | 16-24  | tag");
console.log("    -----+-----+--------+--------+--------+----");

let countOff = 0;
let countIn = 0;
for (let d = 1; d <= dim; d++) {
  const date = `${ym}-${String(d).padStart(2, "0")}`;
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  const slots = SLOTS.map((s) => isOffHour(date, s, holidays));
  for (const off of slots) (off ? countOff++ : countIn++);
  const isHol = holidays.includes(d);
  const isWknd = dow === 0 || dow === 6;
  const tag = isHol ? "★ นักขัตฤกษ์" : isWknd ? "☀ weekend" : "";
  console.log(
    `     ${String(d).padStart(2)} | ${WEEKDAY_TH[dow].padEnd(3)} | ` +
      slots.map((off) => (off ? " \x1b[33moff \x1b[0m " : " \x1b[90m in  \x1b[0m ")).join(" | ") +
      ` | ${tag}`,
  );
}

const totalSlots = dim * 3;
console.log(`\n  สรุป: off-hour = ${countOff} slots · in-hour = ${countIn} slots (รวม ${totalSlots})`);
console.log(`        ค่าเวรพื้นฐานเดือนนี้ = ${countOff} × 780 = ฿ ${(countOff * 780).toLocaleString()} (ต่อ shift_type)`);
console.log("\n  Legend: ★ นักขัตฤกษ์ · ☀ เสาร์-อาทิตย์ · off = เวรนอกเวลา (780฿) · in = เวรในเวลา (0฿ base)\n");
