import { describe, expect, it } from "vitest";
import { buildInHosDoctorReport } from "@/lib/doctor-report";
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
    expect(buildInHosDoctorReport("กวินท์", "2026-10", rows, [], [1])).toHaveLength(2);
  });
  it("sorts by date and shift and preserves 24.00 as the last endpoint", () => {
    const late = { ...assignment, slot: "1600-2400" as const };
    const rows = buildInHosDoctorReport("กวินท์", "2026-10", [late, assignment], [], []);
    expect(rows.map(r => r.start)).toEqual(["00.00 น.", "16.00 น."]);
    expect(rows[1].end).toBe("24.00 น.");
    expect(buildInHosDoctorReport("อนิรุต", "2026-10", [assignment], [], [])).toEqual([]);
  });
});
