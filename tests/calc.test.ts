import { describe, it, expect } from "vitest";
import {
  deductionUnits,
  caseMinutes,
  adjacentSlots,
  computeSlotPay,
  type Assignment,
  type ShiftCase,
} from "@/lib/calc";
import {
  SHIFT_PAY_SOLO_8H,
  SHIFT_PAY_CHAIN_16H,
  CASE_BONUS_OUT_HOS,
  CASE_BONUS_IN_HOS,
  DEDUCT_PER_HALF_HOUR,
  type Slot,
} from "@/lib/constants";

/**
 * Mirror of `src-tauri/src/calc.rs` tests. If a test name here matches one on
 * the Rust side, the expected value MUST agree exactly — these are the same
 * business rules expressed in two languages.
 */
const emptyLookup = () => null;

function makeAssignment(date: string, slot: Slot, doctor: string | null, type: "outHos" | "inHos"): Assignment {
  return { shiftType: type, date, slot, doctorName: doctor };
}

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

describe("adjacentSlots", () => {
  it("00-08 prev crosses to prev day's 16-24", () => {
    const { prev } = adjacentSlots("2026-05-12", "0000-0800");
    expect(prev).toEqual(["2026-05-11", "1600-2400"]);
  });
  it("16-24 next crosses to next day's 00-08", () => {
    const { next } = adjacentSlots("2026-05-12", "1600-2400");
    expect(next).toEqual(["2026-05-13", "0000-0800"]);
  });
  it("middle slot prev/next stay in same date", () => {
    const { prev, next } = adjacentSlots("2026-05-12", "0800-1600");
    expect(prev).toEqual(["2026-05-12", "0000-0800"]);
    expect(next).toEqual(["2026-05-12", "1600-2400"]);
  });
});

describe("computeSlotPay", () => {
  it("no doctor → 0 total", () => {
    const a = makeAssignment("2026-05-12", "0800-1600", null, "outHos");
    expect(computeSlotPay(a, [], emptyLookup).total).toBe(0);
  });

  it("solo 8h no cases pays 780", () => {
    const a = makeAssignment("2026-05-12", "0800-1600", "อนิรุต", "outHos");
    const p = computeSlotPay(a, [], emptyLookup);
    expect(p.base).toBe(SHIFT_PAY_SOLO_8H);
    expect(p.total).toBe(780);
  });

  it("chain via next slot pays 760", () => {
    const a = makeAssignment("2026-05-12", "0800-1600", "อนิรุต", "outHos");
    const p = computeSlotPay(a, [], (_d, s) => (s === "1600-2400" ? "อนิรุต" : null));
    expect(p.base).toBe(SHIFT_PAY_CHAIN_16H);
  });

  it("chain across midnight (16-24 + 00-08 next day)", () => {
    const a = makeAssignment("2026-05-12", "1600-2400", "อนิรุต", "outHos");
    const p = computeSlotPay(a, [], (d, s) =>
      d === "2026-05-13" && s === "0000-0800" ? "อนิรุต" : null,
    );
    expect(p.base).toBe(SHIFT_PAY_CHAIN_16H);
  });

  it("outHos one case 25min: 780 - 48.75 + 1800 = 2531.25", () => {
    const a = makeAssignment("2026-05-12", "0800-1600", "อนิรุต", "outHos");
    const cases: ShiftCase[] = [
      { shiftType: "outHos", date: "2026-05-12", slot: "0800-1600", leaveTime: "13:00", returnTime: "13:25" },
    ];
    const p = computeSlotPay(a, cases, emptyLookup);
    expect(p.deduction).toBeCloseTo(DEDUCT_PER_HALF_HOUR);
    expect(p.caseBonus).toBe(CASE_BONUS_OUT_HOS);
    expect(p.total).toBeCloseTo(780 - DEDUCT_PER_HALF_HOUR + CASE_BONUS_OUT_HOS);
  });

  it("inHos 3 cases × 10min virtual: 780 - 48.75 + 3600 = 4331.25", () => {
    const a = makeAssignment("2026-05-12", "0800-1600", "กนก", "inHos");
    const cases: ShiftCase[] = Array.from({ length: 3 }, () => ({
      shiftType: "inHos" as const,
      date: "2026-05-12",
      slot: "0800-1600" as const,
      leaveTime: null,
      returnTime: null,
    }));
    const p = computeSlotPay(a, cases, emptyLookup);
    expect(p.deduction).toBeCloseTo(DEDUCT_PER_HALF_HOUR);
    expect(p.caseBonus).toBe(3 * CASE_BONUS_IN_HOS);
    expect(p.total).toBeCloseTo(780 - DEDUCT_PER_HALF_HOUR + 3 * CASE_BONUS_IN_HOS);
  });

  it("deduction capped at base; case bonus still paid", () => {
    const a = makeAssignment("2026-05-12", "0800-1600", "กนก", "inHos");
    const cases: ShiftCase[] = Array.from({ length: 100 }, () => ({
      shiftType: "inHos" as const,
      date: "2026-05-12",
      slot: "0800-1600" as const,
      leaveTime: null,
      returnTime: null,
    }));
    const p = computeSlotPay(a, cases, emptyLookup);
    expect(p.deduction).toBe(SHIFT_PAY_SOLO_8H); // capped at base
    expect(p.caseBonus).toBe(100 * CASE_BONUS_IN_HOS);
    expect(p.total).toBe(100 * CASE_BONUS_IN_HOS);
  });
});
