import { X } from "lucide-react";
import type { CaseRow } from "@/lib/db";
import type { ShiftType } from "@/lib/constants";
import { SLOT_LABEL, SHIFT_TYPE_LABEL } from "@/lib/constants";
import { DOCTOR_COLOR_HEX, type Doctor } from "@/lib/doctors";
import { formatBEMonth } from "@/lib/buddhist";

/**
 * Pop-up listing every CS in the month that belongs to a doctor's shifts.
 *
 * Each case becomes its own sub-card, sorted by (date, slot, position).
 * For outHos shifts the card also shows the เวลาออก / เวลากลับ — those
 * times drive the deduction so it's useful context when reviewing totals.
 *
 * Cases that are unnamed (user hasn't typed in the prefix yet) show as
 * "(ไม่ระบุ)" so they're still counted and visible — the doctor's CS count
 * matches what the table shows.
 */
export function CasesDialog({
  doctor, shiftType, yearMonth, cases, onClose,
}: {
  doctor: Doctor;
  shiftType: ShiftType;
  yearMonth: string;
  cases: CaseRow[];
  onClose: () => void;
}) {
  const isOut = shiftType === "outHos";
  // Sort by date then slot — stable across renders so layout doesn't jitter.
  const sorted = [...cases].sort((a, b) =>
    a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot) || a.position - b.position,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: DOCTOR_COLOR_HEX[doctor] }} />
            <div>
              <h2 className="font-semibold">เคสชันสูตรของ {doctor}</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {SHIFT_TYPE_LABEL[shiftType]} · {formatBEMonth(yearMonth + "-01")} · {sorted.length} เคส
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-100" aria-label="ปิด">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto bg-zinc-50 p-4">
          {sorted.length === 0 ? (
            <p className="text-center text-sm text-zinc-400">ยังไม่มีเคสในเดือนนี้</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((c) => (
                <article
                  key={c.id}
                  className="rounded-xl bg-white p-3 ring-1 ring-zinc-200 transition-shadow hover:shadow-md"
                >
                  <div className="font-mono text-base font-bold text-zinc-900">
                    {c.case_name || <span className="text-zinc-400">(ไม่ระบุ)</span>}
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {c.date} · {SLOT_LABEL[c.slot]}
                  </div>
                  {isOut && (c.leave_time || c.return_time) && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-zinc-50 px-2 py-0.5 text-[11px] tabular-nums text-zinc-600 ring-1 ring-zinc-200">
                      <span>{c.leave_time ?? "--:--"}</span>
                      <span className="text-zinc-400">→</span>
                      <span>{c.return_time ?? "--:--"}</span>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="border-t border-zinc-200 px-5 py-3 text-right">
          <button onClick={onClose} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
            ปิด
          </button>
        </footer>
      </div>
    </div>
  );
}
