import { Plus } from "lucide-react";
import type { Slot, ShiftType } from "@/lib/constants";
import { SLOT_LABEL } from "@/lib/constants";
import { DOCTORS, DOCTOR_COLOR_HEX, type Doctor, isDoctor } from "@/lib/doctors";
import { CaseRow } from "./CaseRow";
import { isOffHour } from "@/lib/calc";
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
  focusCaseId, onAddCase, onAddSurgery, inDoctor, holidays,
}: {
  inDoctor: Doctor | null;
  holidays: number[];
  onAddSurgery: () => void;
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
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{SLOT_LABEL[slot]}</h2>
          {computed?.pay.offHour && (
            <span className="mt-1 inline-block rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200">
              นอกเวลา
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {(["outHos", "inHos"] as const).map(type => {
            const value = type === "outHos" ? assignedDoctor : inDoctor;
            const other = type === "outHos" ? inDoctor : assignedDoctor;
            return <label key={type} className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">{type === "outHos" ? "แพทย์ชันสูตรนอก" : "แพทย์ชันสูตรใน"}</span>
              <div className="relative">
                {value && <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full" style={{ backgroundColor: DOCTOR_COLOR_HEX[value] }} />}
              <select value={value ?? ""} disabled={setAssign.isPending}
                onChange={e => setAssign.mutate({ shiftType: type, date, slot, doctorName: isDoctor(e.target.value) ? e.target.value : null })}
                className={`rounded-lg border border-zinc-300 bg-white py-1.5 pr-3 text-sm ${value ? "pl-7" : "pl-3"}`}>
                <option value="">—</option>
                {DOCTORS.map(d => <option key={d} value={d} disabled={isOffHour(date, slot, holidays) && d === other}>{d}</option>)}
              </select>
              </div>
            </label>;
          })}
        </div>
      </header>

      {assignedDoctor && assignedDoctor === inDoctor && isOffHour(date, slot, holidays) &&
        <p role="alert" className="mb-3 text-xs text-rose-600">ตารางเดิมมีแพทย์ซ้ำทั้งสองประเภทนอกเวลาราชการ กรุณาแก้แพทย์ก่อนใช้งานยอดสรุป</p>}
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

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onAddCase}
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
        >
          <Plus className="h-3 w-3" /> เพิ่มเคสชันสูตร
        </button>
        <button type="button" onClick={onAddSurgery} className="inline-flex items-center gap-1.5 rounded-lg bg-[#455766] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
          <Plus className="h-3 w-3" /> เพิ่มเคสผ่า
        </button>
      </div>
      {setAssign.error && <p role="alert" className="mt-2 text-xs text-rose-600">บันทึกล้มเหลว: {String(setAssign.error)}</p>}
    </article>
  );
}
