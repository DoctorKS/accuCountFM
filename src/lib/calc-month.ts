/**
 * Month-level aggregation built on top of `lib/calc.ts`.
 *
 * Pure functions — no DB, no IPC. Caller fetches rows from `lib/db.ts` and
 * passes them in (incl. holidays for the month). Returned shapes feed
 * straight into the dashboard cards and breakdown table.
 */
import type { AssignmentRow, CaseRow } from "./db";
import type { ShiftType, Slot } from "./constants";
import { SLOT_LABEL } from "./constants";
import { DOCTORS, type Doctor } from "./doctors";
import { computeSlotPay, type Assignment, type ShiftCase, type SlotPay } from "./calc";

export interface SlotComputed {
  date: string;
  slot: Slot;
  shiftType: ShiftType;
  doctor: Doctor | null;
  pay: SlotPay;
  caseCount: number;
}

export interface DoctorMonthSummary {
  doctor: Doctor;
  total: number;
  /** Sum of (base - deduction) over off-hour slots only — the "shift hour" pay,
   *  excluding case bonuses. Used by TotalSummary's "ค่าชม.เวรนอกเวลา" column. */
  offHourBaseTotal: number;
  /** Sum of case_bonus across all slots — used by "ค่าผ่า+ชันสูตร" column. */
  bonusTotal: number;
  slots: SlotComputed[];
}

/**
 * Compute every slot in `assignments` and group by doctor.
 *
 * Slots with `doctor_name = null` contribute nothing (their cases are
 * orphaned until the user assigns someone).
 */
export function computeMonthByDoctor(
  shiftType: ShiftType,
  assignments: AssignmentRow[],
  cases: CaseRow[],
  holidays: number[],
): DoctorMonthSummary[] {
  const byKey = new Map<string, CaseRow[]>();
  for (const c of cases) {
    const k = `${c.date}|${c.slot}`;
    const arr = byKey.get(k) ?? [];
    arr.push(c);
    byKey.set(k, arr);
  }

  const byDoctor = Object.fromEntries(
    DOCTORS.map((d) => [d, {
      doctor: d, total: 0, offHourBaseTotal: 0, bonusTotal: 0, slots: [] as SlotComputed[],
    }]),
  ) as unknown as Record<Doctor, DoctorMonthSummary>;

  for (const a of assignments) {
    if (!a.doctor_name) continue;
    const cs = byKey.get(`${a.date}|${a.slot}`) ?? [];
    const assignment: Assignment = {
      shiftType,
      date: a.date,
      slot: a.slot,
      doctorName: a.doctor_name,
    };
    const casesForCalc: ShiftCase[] = cs.map((c) => ({
      shiftType,
      date: c.date,
      slot: c.slot,
      leaveTime: c.leave_time,
      returnTime: c.return_time,
    }));
    const pay = computeSlotPay(assignment, casesForCalc, holidays);
    const entry = byDoctor[a.doctor_name];
    entry.total += pay.total;
    entry.offHourBaseTotal += Math.max(0, pay.base - pay.deduction);
    entry.bonusTotal += pay.caseBonus;
    entry.slots.push({
      date: a.date,
      slot: a.slot,
      shiftType,
      doctor: a.doctor_name,
      pay,
      caseCount: cs.length,
    });
  }
  return Object.values(byDoctor);
}

/** Day-level summary used in ShiftDayPage. */
export interface DayComputed {
  shiftType: ShiftType;
  date: string;
  slots: Record<Slot, SlotComputed | null>;
  total: number;
}

export function computeDay(
  shiftType: ShiftType,
  date: string,
  monthAssignments: AssignmentRow[],
  monthCases: CaseRow[],
  holidays: number[],
): DayComputed {
  const slots: Record<Slot, SlotComputed | null> = {
    "0000-0800": null,
    "0800-1600": null,
    "1600-2400": null,
  };
  let total = 0;
  for (const slot of Object.keys(slots) as Slot[]) {
    const a = monthAssignments.find((x) => x.date === date && x.slot === slot);
    const cs = monthCases.filter((c) => c.date === date && c.slot === slot);
    if (!a || !a.doctor_name) {
      slots[slot] = null;
      continue;
    }
    const pay = computeSlotPay(
      { shiftType, date, slot, doctorName: a.doctor_name },
      cs.map((c) => ({ shiftType, date: c.date, slot: c.slot, leaveTime: c.leave_time, returnTime: c.return_time })),
      holidays,
    );
    slots[slot] = {
      date,
      slot,
      shiftType,
      doctor: a.doctor_name,
      pay,
      caseCount: cs.length,
    };
    total += pay.total;
  }
  return { shiftType, date, slots, total };
}

/** Human label for breakdown rows: "00.00–08.00 น. · 2026-05-12". */
export function slotLabel(s: SlotComputed): string {
  return `${SLOT_LABEL[s.slot]} · ${s.date}`;
}
