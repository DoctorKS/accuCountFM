import type { AssignmentRow, CaseRow } from "./db";
import type { Doctor } from "./doctors";
import type { DoctorReportRow } from "./tauri";
import { computeSlotPay, isOffHour } from "./calc";

/** Merge consecutive off-hour slots on the same date; surgery is not an examination. */
export function buildInHosDoctorReport(
  doctor: Doctor, yearMonth: string, assignments: AssignmentRow[], cases: CaseRow[], holidays: number[],
  shiftType: "inHos" | "outHos" = "inHos",
): DoctorReportRow[] {
  const rows = assignments
    .filter(a => a.shift_type === shiftType && a.doctor_name === doctor && a.date.slice(0, 7) === yearMonth && isOffHour(a.date, a.slot, holidays))
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot))
    .map(a => {
      const examinations = cases.filter(c => c.shift_type === shiftType && c.date === a.date && c.slot === a.slot && c.case_kind !== "surgery");
      const pay = computeSlotPay({ shiftType, date: a.date, slot: a.slot, doctorName: doctor },
        examinations.map(c => ({ shiftType, date: c.date, slot: c.slot, leaveTime: c.leave_time, returnTime: c.return_time })), holidays);
      const [start, end] = a.slot.split("-").map(t => `${t.slice(0, 2)}.${t.slice(2)} น.`);
      return { date: a.date, start, end,
        activity: examinations.length ? "ปฏิบัติงานชันสูตรนอกเวลา" : shiftType === "outHos" ? "on call" : "เวรรับปรึกษานิติเวช",
        compensation: pay.base - pay.deduction };
    });
  const merged: DoctorReportRow[] = [];
  for (const row of rows) {
    const previous = merged[merged.length - 1];
    if (previous && previous.date === row.date && previous.end === row.start) {
      previous.end = row.end;
      previous.compensation += row.compensation;
      if (row.activity === "ปฏิบัติงานชันสูตรนอกเวลา") previous.activity = row.activity;
    } else { merged.push({ ...row }); }
  }
  return merged;
}

export function buildOutHosDoctorReport(doctor: Doctor, yearMonth: string, assignments: AssignmentRow[], cases: CaseRow[], holidays: number[]) {
  return buildInHosDoctorReport(doctor, yearMonth, assignments, cases, holidays, "outHos");
}

/** Case payments only; legacy monthly counts have no deceased names or times. */
export function buildCaseDoctorReport(
  doctor: Doctor, yearMonth: string, assignments: AssignmentRow[], cases: CaseRow[],
): import("./tauri").CaseReportRow[] {
  const assigned = new Set(assignments.filter(a => a.doctor_name === doctor)
    .map(a => `${a.shift_type}|${a.date}|${a.slot}`));
  const time = (value: string | null | undefined, name: string) => {
    if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
      throw new Error(`กรุณาบันทึกเวลาให้ครบสำหรับ ${name}`);
    return value;
  };
  return cases.filter(c => c.date.slice(0, 7) === yearMonth && (c.case_kind === "surgery" && c.surgeon_name ? c.surgeon_name === doctor : assigned.has(`${c.shift_type}|${c.date}|${c.slot}`)))
    .map(c => {
      if (!c.case_name.trim()) throw new Error(`กรุณาบันทึกชื่อผู้เสียชีวิตวันที่ ${c.date}`);
      const surgery = c.case_kind === "surgery";
      const inside = c.shift_type === "inHos";
      const start = time(!surgery && inside ? c.examination_time : c.leave_time, c.case_name);
      const minutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + 10;
      const end = !surgery && inside
        ? `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
        : time(c.return_time, c.case_name);
      return { date: c.date, start: start.replace(":", ".") + " น.", end: end.replace(":", ".") + " น.",
        activity: surgery ? "ผ่าตรวจภายในและตรวจชิ้นเนื้อศพ" : inside
          ? "ชันสูตรพลิกศพในโรงพยาบาลพระปกเกล้า" : "ชันสูตรพลิกศพนอกโรงพยาบาลพระปกเกล้า",
        deceasedName: c.case_name, compensation: surgery ? 4500 : inside ? 1200 : 1800 };
    }).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}
