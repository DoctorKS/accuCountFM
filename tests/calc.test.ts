import { describe, it, expect } from "vitest";
import {
  deductionUnits,
  caseMinutes,
  isOffHour,
  computeSlotPay,
  type Assignment,
  type ShiftCase,
} from "@/lib/calc";
import {
  OFF_HOUR_SHIFT_PAY,
  CASE_BONUS_OUT_HOS,
  CASE_BONUS_IN_HOS,
  DEDUCT_PER_HALF_HOUR,
  type Slot,
} from "@/lib/constants";

/**
 * Mirror of `src-tauri/src/calc.rs` tests. Same fixtures, same expected values.
 * If a name matches the Rust side, the expected value MUST agree.
 */

// 2026-05-12 is a Tuesday. 2026-05-16 is a Saturday.
const WEEKDAY = "2026-05-12";
const SATURDAY = "2026-05-16";

function assign(date: string, slot: Slot, doctor: string | null, type: "outHos" | "inHos"): Assignment {
  return { shiftType: type, date, slot, doctorName: doctor };
}

describe("isOffHour", () => {
  it("weekday night slots = off-hour", () => {
    expect(isOffHour(WEEKDAY, "0000-0800", [])).toBe(true);
    expect(isOffHour(WEEKDAY, "0800-1600", [])).toBe(false);
    expect(isOffHour(WEEKDAY, "1600-2400", [])).toBe(true);
  });
  it("weekend all slots = off-hour", () => {
    expect(isOffHour(SATURDAY, "0000-0800", [])).toBe(true);
    expect(isOffHour(SATURDAY, "0800-1600", [])).toBe(true);
    expect(isOffHour(SATURDAY, "1600-2400", [])).toBe(true);
  });
  it("holiday promotes weekday in-hour to off-hour", () => {
    expect(isOffHour(WEEKDAY, "0800-1600", [])).toBe(false);
    expect(isOffHour(WEEKDAY, "0800-1600", [12])).toBe(true);
  });
});

describe("deductionUnits", () => {
  it("0 to 4 minutes = no deduction (grace)", () => {
    expect(deductionUnits(0)).toBe(0);
    expect(deductionUnits(4)).toBe(0);
  });
  it("5 to 34 minutes = 1 unit", () => {
    expect(deductionUnits(5)).toBe(1);
    expect(deductionUnits(34)).toBe(1);
  });
  it("35 to 64 minutes = 2 units", () => {
    expect(deductionUnits(35)).toBe(2);
    expect(deductionUnits(64)).toBe(2);
  });
  it("65 to 94 minutes = 3 units", () => {
    expect(deductionUnits(65)).toBe(3);
    expect(deductionUnits(94)).toBe(3);
  });
});

describe("caseMinutes", () => {
  it("normal range", () => {
    expect(caseMinutes("13:00", "13:25")).toBe(25);
  });
  it("cross midnight adds 24h", () => {
    expect(caseMinutes("23:30", "00:15")).toBe(45);
  });
  it("returns 0 for malformed input", () => {
    expect(caseMinutes(null, "13:00")).toBe(0);
    expect(caseMinutes("13:00", null)).toBe(0);
    expect(caseMinutes("xx:yy", "13:00")).toBe(0);
  });
});

describe("computeSlotPay", () => {
  it("no doctor → 0 total", () => {
    const a = assign(WEEKDAY, "0000-0800", null, "outHos");
    expect(computeSlotPay(a, [], []).total).toBe(0);
  });

  it("off-hour no cases pays 780", () => {
    const a = assign(WEEKDAY, "0000-0800", "อนิรุต", "outHos");
    const p = computeSlotPay(a, [], []);
    expect(p.base).toBe(OFF_HOUR_SHIFT_PAY);
    expect(p.total).toBe(780);
    expect(p.offHour).toBe(true);
  });

  it("in-hour weekday pays 0 base", () => {
    const a = assign(WEEKDAY, "0800-1600", "อนิรุต", "outHos");
    const p = computeSlotPay(a, [], []);
    expect(p.base).toBe(0);
    expect(p.total).toBe(0);
    expect(p.offHour).toBe(false);
  });

  it("in-hour with cases still pays bonus, no deduction", () => {
    const a = assign(WEEKDAY, "0800-1600", "กนก", "outHos");
    const cases: ShiftCase[] = [
      { shiftType: "outHos", date: WEEKDAY, slot: "0800-1600", leaveTime: "13:00", returnTime: "13:25" },
      { shiftType: "outHos", date: WEEKDAY, slot: "0800-1600", leaveTime: "14:00", returnTime: "14:30" },
      { shiftType: "outHos", date: WEEKDAY, slot: "0800-1600", leaveTime: "15:00", returnTime: "15:20" },
    ];
    const p = computeSlotPay(a, cases, []);
    expect(p.base).toBe(0);
    expect(p.deduction).toBe(0);
    expect(p.caseBonus).toBe(3 * CASE_BONUS_OUT_HOS);
    expect(p.total).toBe(3 * CASE_BONUS_OUT_HOS);
  });

  it("weekend in-hour slot promoted to off-hour (780 base)", () => {
    const a = assign(SATURDAY, "0800-1600", "อนิรุต", "outHos");
    const p = computeSlotPay(a, [], []);
    expect(p.base).toBe(780);
    expect(p.offHour).toBe(true);
  });

  it("holiday promotes weekday in-hour to off-hour", () => {
    const a = assign(WEEKDAY, "0800-1600", "อนิรุต", "outHos");
    const p = computeSlotPay(a, [], [12]);
    expect(p.base).toBe(780);
    expect(p.offHour).toBe(true);
  });

  it("outHos off-hour 25min case: 780 − 48.75 + 1800", () => {
    const a = assign(WEEKDAY, "1600-2400", "อนิรุต", "outHos");
    const cases: ShiftCase[] = [
      { shiftType: "outHos", date: WEEKDAY, slot: "1600-2400", leaveTime: "18:00", returnTime: "18:25" },
    ];
    const p = computeSlotPay(a, cases, []);
    expect(p.deduction).toBeCloseTo(DEDUCT_PER_HALF_HOUR);
    expect(p.caseBonus).toBe(CASE_BONUS_OUT_HOS);
    expect(p.total).toBeCloseTo(780 - DEDUCT_PER_HALF_HOUR + CASE_BONUS_OUT_HOS);
  });

  it("inHos off-hour 3 cases × 10min virtual: 780 − 48.75 + 3600", () => {
    const a = assign(SATURDAY, "0800-1600", "กนก", "inHos");
    const cases: ShiftCase[] = Array.from({ length: 3 }, () => ({
      shiftType: "inHos" as const,
      date: SATURDAY,
      slot: "0800-1600" as const,
      leaveTime: null,
      returnTime: null,
    }));
    const p = computeSlotPay(a, cases, []);
    expect(p.deduction).toBeCloseTo(DEDUCT_PER_HALF_HOUR);
    expect(p.caseBonus).toBe(3 * CASE_BONUS_IN_HOS);
    expect(p.total).toBeCloseTo(780 - DEDUCT_PER_HALF_HOUR + 3 * CASE_BONUS_IN_HOS);
  });

  it("deduction capped at base; case bonus still paid", () => {
    const a = assign(WEEKDAY, "0000-0800", "กนก", "inHos");
    const cases: ShiftCase[] = Array.from({ length: 100 }, () => ({
      shiftType: "inHos" as const,
      date: WEEKDAY,
      slot: "0000-0800" as const,
      leaveTime: null,
      returnTime: null,
    }));
    const p = computeSlotPay(a, cases, []);
    expect(p.deduction).toBe(OFF_HOUR_SHIFT_PAY);
    expect(p.caseBonus).toBe(100 * CASE_BONUS_IN_HOS);
    expect(p.total).toBe(100 * CASE_BONUS_IN_HOS);
  });
});


describe("surgery pay", () => {
  for (const shiftType of ["outHos", "inHos"] as const) {
    it(`${shiftType}: surgery adds 4500 without real or virtual deduction`, () => {
      const assignment = assign(WEEKDAY, "0000-0800", "กนก", shiftType);
      const surgery: ShiftCase = { shiftType, date: WEEKDAY, slot: "0000-0800", caseKind: "surgery", leaveTime: "00:00", returnTime: "08:00" };
      const pay = computeSlotPay(assignment, [surgery], []);
      expect(pay.base).toBe(780);
      expect(pay.deduction).toBe(0);
      expect(pay.caseBonus).toBe(4500);
      expect(pay.total).toBe(5280);
      const mixed = computeSlotPay(assignment, [surgery, { ...surgery, caseKind: "examination", leaveTime: "01:00", returnTime: "01:25" }], []);
      expect(mixed.deduction).toBe(48.75);
      expect(mixed.caseBonus).toBe(4500 + (shiftType === "outHos" ? 1800 : 1200));
    });
  }
  it("office surgery has zero base and receives the full 4500", () => {
    const assignment = assign(WEEKDAY, "0800-1600", "กนก", "outHos");
    const pay = computeSlotPay(assignment, [{ shiftType: "outHos", date: WEEKDAY, slot: "0800-1600", caseKind: "surgery", leaveTime: "08:00", returnTime: "16:00" }], []);
    expect(pay.total).toBe(4500);
    expect(pay.deduction).toBe(0);
  });
  it("unassigned surgery pays nobody", () => {
    expect(computeSlotPay(assign(WEEKDAY, "0000-0800", null, "outHos"), [{ shiftType: "outHos", date: WEEKDAY, slot: "0000-0800", caseKind: "surgery", leaveTime: null, returnTime: null }], []).total).toBe(0);
  });
});


import { computeMonthByDoctor, computeDay } from "@/lib/calc-month";
import type { AssignmentRow, CaseRow } from "@/lib/db";

describe("combined month aggregation", () => {
  it("keeps each case with its type and credits surgery exactly once", () => {
    const assignments: AssignmentRow[] = [
      { id: 1, shift_type: "outHos", date: WEEKDAY, slot: "0800-1600", doctor_name: "กนก", updated_at: "" },
      { id: 2, shift_type: "inHos", date: WEEKDAY, slot: "0800-1600", doctor_name: "กนก", updated_at: "" },
    ];
    const base: CaseRow = { id: 1, shift_type: "outHos", date: WEEKDAY, slot: "0800-1600", case_name: "ผู้ป่วย", leave_time: "08:00", return_time: "08:30", position: 0, created_at: "", updated_at: "" };
    const cases: CaseRow[] = [base, { ...base, id: 2, shift_type: "inHos", leave_time: null, return_time: null }, { ...base, id: 3, case_kind: "surgery" }];
    const out = computeMonthByDoctor("outHos", assignments, cases, []).find(s => s.doctor === "กนก")!;
    const inn = computeMonthByDoctor("inHos", assignments, cases, []).find(s => s.doctor === "กนก")!;
    expect(out.total).toBe(6300);
    expect(inn.total).toBe(1200);
    expect(out.slots).toHaveLength(1);
    expect(inn.slots).toHaveLength(1);
    expect(computeDay("outHos", WEEKDAY, assignments, cases, []).total).toBe(out.total);
    expect(computeDay("inHos", WEEKDAY, assignments, cases, []).total).toBe(inn.total);
  });
});
