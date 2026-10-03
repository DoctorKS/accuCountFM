import type { AssignmentRow, CaseRow } from "./db";
import type { Doctor } from "./doctors";
import type { DoctorReportRow } from "./tauri";
import { computeSlotPay, isOffHour } from "./calc";

/** One row per assigned off-hour slot; surgery is not an examination. */
export function buildInHosDoctorReport(
  doctor: Doctor, yearMonth: string, assignments: AssignmentRow[], cases: CaseRow[], holidays: number[],
): DoctorReportRow[] {
  return assignments
    .filter(a => a.shift_type === "inHos" && a.doctor_name === doctor && a.date.slice(0, 7) === yearMonth && isOffHour(a.date, a.slot, holidays))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))
    .map(a => {
      const examinations = cases.filter(c => c.shift_type === "inHos" && c.date === a.date && c.slot === a.slot && c.case_kind !== "surgery");
      const pay = computeSlotPay({ shiftType: "inHos", date: a.date, slot: a.slot, doctorName: doctor },
        examinations.map(c => ({ shiftType: "inHos", date: c.date, slot: c.slot, leaveTime: c.leave_time, returnTime: c.return_time })), holidays);
      const [start, end] = a.slot.split("-").map(t => `${t.slice(0, 2)}.${t.slice(2)} น.`);
      return { date: a.date, start, end,
        activity: examinations.length ? "ปฏิบัติงานชันสูตรนอกเวลา" : "เวรรับปรึกษานิติเวช",
        compensation: pay.base - pay.deduction };
    });
}
