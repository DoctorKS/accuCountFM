/**
 * TanStack Query hooks for shift data.
 *
 * Query keys form a hierarchy so invalidation can be coarse (whole month)
 * or fine (one slot). Convention:
 *   ['month', shiftType, ym]              → assignments + cases + holidays
 *   ['holidays', ym]                      → standalone holiday list (cross shift_type)
 *   ['slot-cases', shiftType, date, slot] → individual slot cases (rarely used standalone)
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMonthAssignments,
  listMonthCases,
  listSlotCases,
  setAssignmentDoctor,
  addCase,
  updateCase,
  deleteCase,
  listMonthHolidays,
  addHoliday,
  removeHoliday,
  type AssignmentRow,
  type CaseRow,
  type HolidayRow,
} from "@/lib/db";
import type { ShiftType, Slot } from "@/lib/constants";
import type { Doctor } from "@/lib/doctors";

// ─── Reads ──────────────────────────────────────────────────────────────────

export interface MonthData {
  assignments: AssignmentRow[];
  cases: CaseRow[];
  holidays: number[];           // day-of-month integers — calc-month consumes this directly
}

export function useMonth(shiftType: ShiftType, yearMonth: string) {
  return useQuery<MonthData>({
    queryKey: ["month", shiftType, yearMonth],
    queryFn: async () => {
      const [assignments, cases, holidayRows] = await Promise.all([
        listMonthAssignments(shiftType, yearMonth),
        listMonthCases(shiftType, yearMonth),
        listMonthHolidays(yearMonth),
      ]);
      return { assignments, cases, holidays: holidayRows.map((h) => h.day) };
    },
  });
}

/** Standalone holiday query — used by ShiftMonthPage's holiday picker. */
export function useHolidays(yearMonth: string) {
  return useQuery<HolidayRow[]>({
    queryKey: ["holidays", yearMonth],
    queryFn: () => listMonthHolidays(yearMonth),
  });
}

export function useSlotCases(shiftType: ShiftType, date: string, slot: Slot) {
  return useQuery<CaseRow[]>({
    queryKey: ["slot-cases", shiftType, date, slot],
    queryFn: () => listSlotCases(shiftType, date, slot),
  });
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/** Update the doctor assigned to one (shift_type, date, slot). */
export function useSetAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftType, date, slot, doctorName }: {
      shiftType: ShiftType; date: string; slot: Slot; doctorName: Doctor | null;
    }) => setAssignmentDoctor(shiftType, date, slot, doctorName),
    onSuccess: (_, vars) => {
      const ym = vars.date.slice(0, 7);
      qc.invalidateQueries({ queryKey: ["month", vars.shiftType, ym] });
    },
  });
}

export function useAddCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftType, date, slot, init }: {
      shiftType: ShiftType; date: string; slot: Slot;
      init?: { caseName?: string; leaveTime?: string | null; returnTime?: string | null };
    }) => addCase(shiftType, date, slot, init),
    onSuccess: (_, vars) => {
      const ym = vars.date.slice(0, 7);
      qc.invalidateQueries({ queryKey: ["month", vars.shiftType, ym] });
      qc.invalidateQueries({ queryKey: ["slot-cases", vars.shiftType, vars.date, vars.slot] });
    },
  });
}

export function useUpdateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Pick<CaseRow, "case_name" | "leave_time" | "return_time">> }) =>
      updateCase(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["month"] });
      qc.invalidateQueries({ queryKey: ["slot-cases"] });
    },
  });
}

export function useDeleteCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCase(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["month"] });
      qc.invalidateQueries({ queryKey: ["slot-cases"] });
    },
  });
}

export function useAddHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ yearMonth, day, note }: { yearMonth: string; day: number; note?: string }) =>
      addHoliday(yearMonth, day, note),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["holidays", vars.yearMonth] });
      // Holidays affect off-hour status across BOTH shift types → invalidate broadly
      qc.invalidateQueries({ queryKey: ["month", "outHos", vars.yearMonth] });
      qc.invalidateQueries({ queryKey: ["month", "inHos", vars.yearMonth] });
    },
  });
}

export function useRemoveHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ yearMonth, day }: { yearMonth: string; day: number }) =>
      removeHoliday(yearMonth, day),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["holidays", vars.yearMonth] });
      qc.invalidateQueries({ queryKey: ["month", "outHos", vars.yearMonth] });
      qc.invalidateQueries({ queryKey: ["month", "inHos", vars.yearMonth] });
    },
  });
}
