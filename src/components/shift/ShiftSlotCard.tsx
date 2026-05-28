import { Plus } from "lucide-react";
import type { Slot, ShiftType } from "@/lib/constants";
import { SLOT_LABEL, DEDUCT_PER_HALF_HOUR, CASE_BONUS_OUT_HOS, CASE_BONUS_IN_HOS } from "@/lib/constants";
import { DOCTORS, type Doctor, isDoctor } from "@/lib/doctors";
import { CaseRow } from "./CaseRow";
import { useSetAssignment, useAddCase } from "@/hooks/useShift";
import { fmtBaht } from "@/lib/utils";
import type { CaseRow as CaseRowT } from "@/lib/db";
import type { SlotComputed } from "@/lib/calc-month";

/**
 * One of the 3 shift slot cards on `/shift/:type/:date`.
 *
 * Header  : time label + doctor dropdown
 * Body    : case rows + "+ เพิ่มเคส" button
 * Footer  : explicit pay breakdown (base / deduction / bonus / total) with
 *           formulas that show *where each number came from*.
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
  const isOut = shiftType === "outHos";
  const caseRate = isOut ? CASE_BONUS_OUT_HOS : CASE_BONUS_IN_HOS;

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
      </div>

      {/* ─── Breakdown footer ─────────────────────────────────────────────── */}
      {computed && <BreakdownFooter computed={computed} caseCount={cases.length} caseRate={caseRate} />}
    </article>
  );
}

function BreakdownFooter({ computed, caseCount, caseRate }: { computed: SlotComputed; caseCount: number; caseRate: number }) {
  const { pay } = computed;
  const deductUnits = pay.deduction > 0 ? Math.round(pay.deduction / DEDUCT_PER_HALF_HOUR) : 0;

  return (
    <div className="mt-4 space-y-1 rounded-xl bg-zinc-50 p-3 text-xs">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">การคำนวณ</div>
      {pay.base > 0 ? (
        <Line label={pay.offHour ? "เงินเวรนอกเวลา" : "เงินเวรในเวลา"} amount={pay.base} className="text-zinc-700" />
      ) : (
        <Line label="เงินเวร (ในเวลา 08-16 weekday)" amount={0} className="text-zinc-400" />
      )}
      {pay.deduction > 0 && (
        <Line
          label={`หักเวลาออก ${deductUnits} × ${DEDUCT_PER_HALF_HOUR}`}
          amount={-pay.deduction}
          className="text-rose-700"
        />
      )}
      {pay.caseBonus > 0 && (
        <Line
          label={`เคสชันสูตร ${caseCount} × ${caseRate.toLocaleString()}`}
          amount={pay.caseBonus}
          className="text-emerald-700"
        />
      )}
      <div className="my-1 border-t border-zinc-200" />
      <div className="flex items-center justify-between font-bold">
        <span>รวม slot นี้</span>
        <span className="tabular-nums text-zinc-900">{fmtBaht(pay.total)}</span>
      </div>
    </div>
  );
}

function Line({ label, amount, className = "" }: { label: string; amount: number; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <span>{label}</span>
      <span className="tabular-nums">{amount >= 0 ? "" : "−"}{fmtBaht(Math.abs(amount))}</span>
    </div>
  );
}
