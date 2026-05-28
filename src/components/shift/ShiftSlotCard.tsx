import { Plus } from "lucide-react";
import type { Slot, ShiftType } from "@/lib/constants";
import { SLOT_LABEL } from "@/lib/constants";
import { DOCTORS, type Doctor, isDoctor } from "@/lib/doctors";
import { CaseRow } from "./CaseRow";
import { useSetAssignment } from "@/hooks/useShift";
import type { CaseRow as CaseRowT } from "@/lib/db";
import type { SlotComputed } from "@/lib/calc-month";

/**
 * One of the 3 shift slot cards on `/shift/:type/:date`.
 *
 * Body: doctor dropdown + case rows + "+ เพิ่มเคสชันสูตร" button.
 * Breakdown for THIS slot's pay is now rendered in the right-side gray
 * panel (SlotBreakdownCard) — keeps the slot card focused on input.
 *
 * `focusCaseId` and `onAddCase` are lifted up to ShiftDayPage so the
 * F1-F3 keyboard shortcuts can spawn-and-focus a row in any slot from
 * one shared piece of state (rather than each card tracking its own).
 */
export function ShiftSlotCard({
  shiftType, date, slot, assignedDoctor, cases, computed,
  focusCaseId, onAddCase,
}: {
  shiftType: ShiftType;
  date: string;
  slot: Slot;
  assignedDoctor: Doctor | null;
  cases: CaseRowT[];
  computed: SlotComputed | null;
  focusCaseId: number | null;
  onAddCase: () => void;
}) {
  const setAssign = useSetAssignment();

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{SLOT_LABEL[slot]}</h2>
          {computed?.pay.offHour && (
            <span className="mt-1 inline-block rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200">
              นอกเวลา
            </span>
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
          cases.map((c) => (
            <CaseRow
              key={c.id}
              row={c}
              shiftType={shiftType}
              autoFocus={c.id === focusCaseId}
              onAddNext={onAddCase}
            />
          ))
        )}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={onAddCase}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
        >
          <Plus className="h-3 w-3" /> เพิ่มเคสชันสูตร
        </button>
      </div>
    </article>
  );
}
