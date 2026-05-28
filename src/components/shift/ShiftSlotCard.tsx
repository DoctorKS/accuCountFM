import { Plus } from "lucide-react";
import type { Slot, ShiftType } from "@/lib/constants";
import { SLOT_LABEL } from "@/lib/constants";
import { DOCTORS, type Doctor, isDoctor } from "@/lib/doctors";
import { CaseRow } from "./CaseRow";
import { useSetAssignment, useAddCase } from "@/hooks/useShift";
import { fmtBaht } from "@/lib/utils";
import type { CaseRow as CaseRowT } from "@/lib/db";
import type { SlotComputed } from "@/lib/calc-month";

/**
 * One of the 3 shift slot cards on `/shift/:type/:date`.
 * Shows: time label, doctor dropdown, case rows, "+ เพิ่มเคส" button, live pay.
 */
export function ShiftSlotCard({
  shiftType, date, slot, assignedDoctor, cases, computed,
}: {
  shiftType: ShiftType;
  date: string;
  slot: Slot;
  assignedDoctor: Doctor | null;
  cases: CaseRowT[];
  computed: SlotComputed | null;
}) {
  const setAssign = useSetAssignment();
  const addCase = useAddCase();

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{SLOT_LABEL[slot]}</h2>
          {computed && (
            <div className="mt-0.5 text-xs text-zinc-500">{computed.pay.reason}</div>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">ชื่อแพทย์</span>
          <select
            value={assignedDoctor ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const nextDoctor: Doctor | null = isDoctor(v) ? v : null;
              setAssign.mutate({ shiftType, date, slot, doctorName: nextDoctor });
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200"
          >
            <option value="">—</option>
            {DOCTORS.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
        </label>
      </header>

      <div className="space-y-2">
        {cases.length === 0 ? (
          <p className="text-xs text-zinc-400">ยังไม่มีเคส</p>
        ) : (
          cases.map((c) => <CaseRow key={c.id} row={c} shiftType={shiftType} />)
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => addCase.mutate({ shiftType, date, slot })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
        >
          <Plus className="h-3 w-3" /> เพิ่มเคสชันสูตร
        </button>
        {computed && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-zinc-400">รวม slot นี้</div>
            <div className="text-lg font-bold text-zinc-900 tabular-nums">{fmtBaht(computed.pay.total)}</div>
          </div>
        )}
      </div>
    </article>
  );
}
