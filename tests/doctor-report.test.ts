import { computeMonthByDoctor } from "@/lib/calc-month";
import { describe, expect, it } from "vitest";
import { buildCaseDoctorReport, buildInHosDoctorReport, buildOutHosDoctorReport } from "@/lib/doctor-report";
import type { AssignmentRow, CaseRow } from "@/lib/db";

const assignment: AssignmentRow = { id: 1, shift_type: "inHos", date: "2026-10-01", slot: "0000-0800", doctor_name: "กวินท์", updated_at: "" };
const examination: CaseRow = { id: 1, shift_type: "inHos", date: assignment.date, slot: assignment.slot, case_name: "ผู้ป่วย", leave_time: null, return_time: null, position: 0, created_at: "", updated_at: "" };

describe("per-doctor inHos report", () => {
  it("uses consultation text and 780 for an assigned slot without examinations", () => {
    const [row] = buildInHosDoctorReport("กวินท์", "2026-10", [assignment], [{ ...examination, case_kind: "surgery" }], []);
    expect(row).toEqual({ date: assignment.date, start: "00.00 น.", end: "08.00 น.", activity: "เวรรับปรึกษานิติเวช", compensation: 780 });
  });
  it("deducts each examination and excludes bonuses and surgery", () => {
    for (const count of [1, 2, 3, 17]) {
      const cases = Array.from({ length: count }, (_, id) => ({ ...examination, id }));
      cases.push({ ...examination, id: 99, case_kind: "surgery" });
      const [row] = buildInHosDoctorReport("กวินท์", "2026-10", [assignment], cases, []);
      expect(row.compensation).toBe(Math.max(0, 780 - count * 48.75));
      expect(row.activity).toBe("ปฏิบัติงานชันสูตรนอกเวลา");
    }
  });
  it("filters month, doctor, type and office hours; holidays remain payable", () => {
    const office = { ...assignment, id: 2, slot: "0800-1600" as const };
    const rows = [assignment, office, { ...assignment, doctor_name: "กนก" as const }, { ...assignment, shift_type: "outHos" as const }, { ...assignment, date: "2026-09-30" }];
    expect(buildInHosDoctorReport("กวินท์", "2026-10", rows, [], [])).toHaveLength(1);
    expect(buildInHosDoctorReport("กวินท์", "2026-10", rows, [], [1])[0].compensation).toBe(1560);
  });
  it("sorts by date and shift and preserves 24.00 as the last endpoint", () => {
    const late = { ...assignment, slot: "1600-2400" as const };
    const rows = buildInHosDoctorReport("กวินท์", "2026-10", [late, assignment], [], []);
    expect(rows.map(r => r.start)).toEqual(["00.00 น.", "16.00 น."]);
    expect(rows[1].end).toBe("24.00 น.");
    expect(buildInHosDoctorReport("อนิรุต", "2026-10", [assignment], [], [])).toEqual([]);
  });
});

describe("case report", () => {
  it("includes all three types with their own times and fees, scoped to the assigned doctor", () => {
    const outside = { ...assignment, shift_type: "outHos" as const };
    const cases: CaseRow[] = [
      { ...examination, examination_time: "23:55" },
      { ...examination, shift_type: "outHos", leave_time: "09:15", return_time: "10:30" },
      { ...examination, case_kind: "surgery", leave_time: "11:00", return_time: "12:00" },
    ];
    const rows = buildCaseDoctorReport("กวินท์", "2026-10", [assignment, outside], cases);
    expect(rows.map(r => r.compensation)).toEqual([1800, 4500, 1200]);
    expect(rows[2].end).toBe("00.05 น.");
    expect(rows[0].activity).toBe("ชันสูตรพลิกศพนอกโรงพยาบาลพระปกเกล้า");
    expect(rows[1].activity).toBe("ผ่าตรวจภายในและตัดชิ้นเนื้อศพ");
    expect(rows.reduce((s,r) => s+r.compensation,0)).toBe(7500);
    expect(buildCaseDoctorReport("อนิรุต", "2026-10", [assignment, outside], cases)).toEqual([]);
    expect(buildCaseDoctorReport("กวินท์", "2026-09", [assignment, outside], cases)).toEqual([]);
  });
  it("requires saved times instead of inventing missing legacy data", () => {
    expect(() => buildCaseDoctorReport("กวินท์", "2026-10", [assignment], [examination])).toThrow("กรุณาบันทึกเวลา");
  });
});

it("pays an independently selected surgeon once, even without a duty assignment", () => {
  const surgery: CaseRow = { ...examination, case_kind: "surgery", surgeon_name: "อนิรุต", leave_time: "01:00", return_time: "02:00" };
  const totals = computeMonthByDoctor("inHos", [assignment], [surgery], []);
  expect(totals.find(t => t.doctor === "กวินท์")?.total).toBe(780);
  expect(totals.find(t => t.doctor === "อนิรุต")?.total).toBe(4500);
  expect(buildCaseDoctorReport("อนิรุต", "2026-10", [assignment], [surgery])[0].compensation).toBe(4500);
  expect(buildCaseDoctorReport("กวินท์", "2026-10", [assignment], [surgery])).toEqual([]);
  expect(computeMonthByDoctor("inHos", [], [surgery], []).find(t => t.doctor === "อนิรุต")?.total).toBe(4500);
});

it("merges consecutive inHos duty slots and adds compensation with examination activity", () => {
  const morning = { ...assignment, slot: "0800-1600" as const };
  const late = { ...assignment, slot: "1600-2400" as const };
  const rows = buildInHosDoctorReport("กวินท์", "2026-10", [late, morning], [{ ...examination, slot: late.slot }], [1]);
  expect(rows).toEqual([{ date: assignment.date, start: "08.00 น.", end: "24.00 น.", activity: "ปฏิบัติงานชันสูตรนอกเวลา", compensation: 1511.25 }]);
  expect(buildInHosDoctorReport("กวินท์", "2026-10", [assignment, morning, late], [], [1])).toEqual([
    { date: assignment.date, start: "00.00 น.", end: "24.00 น.", activity: "เวรรับปรึกษานิติเวช", compensation: 2340 }
  ]);
  expect(buildInHosDoctorReport("กวินท์", "2026-10", [morning, { ...late, date: "2026-10-02" }], [], [1])).toHaveLength(2);
});

it("exports outside duty net pay using saved time, on call text, and merged shifts", () => {
  const outside = { ...assignment, shift_type: "outHos" as const };
  const cases: CaseRow[] = [{ ...examination, shift_type: "outHos", leave_time: "01:00", return_time: "02:10" }];
  expect(buildOutHosDoctorReport("กวินท์", "2026-10", [outside], cases, [])[0]).toMatchObject({ compensation: 633.75, activity: "ปฏิบัติงานชันสูตรนอกเวลา" });
  expect(buildOutHosDoctorReport("กวินท์", "2026-10", [outside], [], [])[0]).toMatchObject({ compensation: 780, activity: "on call" });
  expect(buildOutHosDoctorReport("กวินท์", "2026-10", [outside], [{ ...cases[0], case_kind: "surgery" }], [])[0].activity).toBe("on call");
  const morning = { ...outside, slot: "0800-1600" as const };
  const late = { ...outside, slot: "1600-2400" as const };
  expect(buildOutHosDoctorReport("กวินท์", "2026-10", [morning, late], [], [1])).toEqual([{ date: outside.date, start: "08.00 น.", end: "24.00 น.", activity: "on call", compensation: 1560 }]);
});
